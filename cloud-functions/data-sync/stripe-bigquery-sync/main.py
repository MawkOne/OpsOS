"""
Stripe Direct to BigQuery Sync Cloud Function

Calls Stripe API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for OAuth credentials.

Architecture: Stripe API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import json
import os
import stripe

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"
RAW_TABLE_ID = "raw_stripe"

# Get Stripe platform secret from environment
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')


def get_stripe_client(connection_data: dict) -> stripe.StripeClient:
    """Create Stripe client from connection credentials"""
    
    stripe_account_id = connection_data.get('stripeAccountId')
    access_token = connection_data.get('accessToken')
    api_key = connection_data.get('apiKey')
    
    # Determine which credentials to use
    if stripe_account_id and STRIPE_SECRET_KEY:
        # Use platform secret with connected account
        return stripe.StripeClient(
            api_key=STRIPE_SECRET_KEY,
            stripe_account=stripe_account_id
        )
    elif access_token:
        # Use OAuth access token
        return stripe.StripeClient(api_key=access_token)
    elif api_key:
        # Use legacy API key
        return stripe.StripeClient(api_key=api_key)
    else:
        raise ValueError("No valid Stripe credentials found")


@functions_framework.http
def sync_stripe_to_bigquery(request):
    """Sync Stripe data directly to BigQuery"""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True)
    if not request_json or 'organizationId' not in request_json:
        return ({'error': 'Missing organizationId'}, 400, headers)
    
    organization_id = request_json['organizationId']
    sync_mode = request_json.get('mode', 'update')  # 'update' (incremental) or 'full' (complete resync)
    
    # Support explicit date range OR days_back
    explicit_start = request_json.get('startDate')  # Format: 'YYYY-MM-DD'
    explicit_end = request_json.get('endDate')      # Format: 'YYYY-MM-DD'
    
    # Set days_back based on mode (only used if no explicit dates)
    if sync_mode == 'full':
        days_back = request_json.get('daysBack', 730)  # 2 years for full resync
    else:
        days_back = request_json.get('daysBack', 30)  # 30 days for incremental
    
    if explicit_start and explicit_end:
        logger.info(f"Starting Stripe → BigQuery sync for org: {organization_id} (explicit range: {explicit_start} to {explicit_end})")
    else:
        logger.info(f"Starting Stripe → BigQuery sync for org: {organization_id} (mode={sync_mode}, days={days_back})")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get OAuth credentials from Firestore (minimal Firestore use)
        connection_ref = db.collection('stripe_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'No Stripe connection found. Please connect first.'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        # Create Stripe client
        try:
            client = get_stripe_client(connection_data)
        except ValueError as e:
            return ({'error': str(e)}, 400, headers)
        
        results = {
            'charges_processed': 0,
            'subscriptions_processed': 0,
            'customers_processed': 0,
            'products_processed': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        raw_rows = []  # For storing raw API responses
        now_iso = datetime.utcnow().isoformat()
        
        # Use explicit dates if provided, otherwise calculate from days_back
        if explicit_start and explicit_end:
            start_date = datetime.strptime(explicit_start, '%Y-%m-%d').date()
            end_date = datetime.strptime(explicit_end, '%Y-%m-%d').date()
        else:
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=days_back)
        
        start_timestamp = int(datetime.combine(start_date, datetime.min.time()).timestamp())
        end_timestamp = int(datetime.combine(end_date + timedelta(days=1), datetime.min.time()).timestamp())  # Include end date
        
        # ============================================
        # 1. FETCH CHARGES DIRECTLY FROM STRIPE API
        # ============================================
        logger.info("Fetching charges from Stripe API...")
        
        daily_revenue = defaultdict(lambda: {
            'total_revenue': 0,
            'payment_count': 0,
            'refund_amount': 0,
            'currencies': set(),
        })
        
        try:
            # Paginate through all charges with date range filter
            charge_filter = {
                'limit': 100,
                'created': {'gte': start_timestamp},
            }
            # Add end filter if explicit dates provided
            if explicit_start and explicit_end:
                charge_filter['created']['lt'] = end_timestamp
            
            charges = client.charges.list(params=charge_filter)
            
            for charge in charges.auto_paging_iter():
                results['charges_processed'] += 1
                
                # Get date from charge
                charge_date = datetime.fromtimestamp(charge.created).date()
                date_str = charge_date.isoformat()
                
                # Skip if outside date range (safety check)
                if charge_date < start_date or charge_date > end_date:
                    continue
                
                if charge.status == 'succeeded':
                    amount = charge.amount / 100  # Convert from cents
                    daily_revenue[date_str]['total_revenue'] += amount
                    daily_revenue[date_str]['payment_count'] += 1
                    daily_revenue[date_str]['currencies'].add(charge.currency.upper())
                
                if charge.refunded:
                    refund_amount = charge.amount_refunded / 100
                    daily_revenue[date_str]['refund_amount'] += refund_amount
                
                # Store raw charge data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': date_str,
                    'data_type': 'charge',
                    'api_response': json.dumps({
                        'id': charge.id,
                        'amount': charge.amount,
                        'currency': charge.currency,
                        'status': charge.status,
                        'created': charge.created,
                        'customer': charge.customer,
                        'refunded': charge.refunded,
                        'amount_refunded': charge.amount_refunded,
                        'payment_method': charge.payment_method,
                        'description': charge.description,
                    }),
                    'created_at': now_iso,
                })
                    
        except Exception as e:
            logger.error(f"Error fetching charges: {e}")
        
        # ============================================
        # 2. FETCH SUBSCRIPTIONS FOR MRR
        # ============================================
        logger.info("Fetching subscriptions from Stripe API...")
        
        total_mrr = 0
        active_subscriptions = 0
        churned_subscriptions = 0
        
        try:
            subscriptions = client.subscriptions.list(params={'limit': 100, 'status': 'all'})
            
            for sub in subscriptions.auto_paging_iter():
                results['subscriptions_processed'] += 1
                
                if sub.status == 'active':
                    active_subscriptions += 1
                    # Calculate MRR from subscription items
                    try:
                        items_data = sub.get('items', {}).get('data', []) if isinstance(sub, dict) else getattr(sub.items, 'data', [])
                        for item in items_data:
                            price = item.get('price', {}) if isinstance(item, dict) else item.price
                            unit_amount = (price.get('unit_amount') if isinstance(price, dict) else price.unit_amount) or 0
                            quantity = (item.get('quantity') if isinstance(item, dict) else item.quantity) or 1
                            recurring = price.get('recurring', {}) if isinstance(price, dict) else price.recurring
                            interval = (recurring.get('interval') if isinstance(recurring, dict) else getattr(recurring, 'interval', None)) if recurring else 'month'
                            
                            # Convert to monthly
                            if interval == 'year':
                                monthly_amount = (unit_amount * quantity) / 12
                            elif interval == 'week':
                                monthly_amount = (unit_amount * quantity) * 4
                            else:
                                monthly_amount = unit_amount * quantity
                            
                            total_mrr += monthly_amount / 100  # Convert from cents
                    except Exception as item_err:
                        logger.warning(f"Error processing subscription items: {item_err}")
                        
                elif sub.status in ['canceled', 'unpaid']:
                    churned_subscriptions += 1
                    
        except Exception as e:
            logger.error(f"Error fetching subscriptions: {e}")
        
        # ============================================
        # 3. FETCH CUSTOMERS WITH DETAILS
        # ============================================
        logger.info("Fetching customers from Stripe API...")
        
        total_customers = 0
        new_customers_by_day = defaultdict(int)
        customer_details = []  # Store individual customer data
        
        try:
            customer_filter = {
                'limit': 100,
                'created': {'gte': start_timestamp},
            }
            if explicit_start and explicit_end:
                customer_filter['created']['lt'] = end_timestamp
            
            customers = client.customers.list(params=customer_filter)
            
            for customer in customers.auto_paging_iter():
                results['customers_processed'] += 1
                total_customers += 1
                
                customer_date = datetime.fromtimestamp(customer.created).date()
                if customer_date < start_date or customer_date > end_date:
                    continue
                    
                new_customers_by_day[customer_date.isoformat()] += 1
                
                # Store individual customer details
                customer_details.append({
                    'id': customer.id,
                    'email': customer.email or '',
                    'name': customer.name or '',
                    'created': customer_date.isoformat(),
                    'currency': customer.currency or 'usd',
                    'delinquent': customer.delinquent,
                })
                
                # Store raw customer data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': customer_date.isoformat(),
                    'data_type': 'customer',
                    'api_response': json.dumps({
                        'id': customer.id,
                        'email': customer.email,
                        'name': customer.name,
                        'created': customer.created,
                        'currency': customer.currency,
                        'delinquent': customer.delinquent,
                        'description': customer.description,
                        'phone': customer.phone,
                        'address': dict(customer.address) if customer.address else None,
                        'metadata': dict(customer.metadata) if customer.metadata else {},
                    }),
                    'created_at': now_iso,
                })
                
        except Exception as e:
            logger.error(f"Error fetching customers: {e}")
        
        # ============================================
        # 4. FETCH PRODUCTS
        # ============================================
        logger.info("Fetching products from Stripe API...")
        
        products_data = []
        
        try:
            products = client.products.list(params={'limit': 100, 'active': True})
            
            for product in products.auto_paging_iter():
                results['products_processed'] += 1
                
                products_data.append({
                    'id': product.id,
                    'name': product.name,
                    'description': product.description or '',
                    'active': product.active,
                    'created': datetime.fromtimestamp(product.created).date().isoformat(),
                    'default_price': product.default_price if hasattr(product, 'default_price') else None,
                    'metadata': dict(product.metadata) if product.metadata else {},
                })
                
        except Exception as e:
            logger.error(f"Error fetching products: {e}")
        
        # ============================================
        # 5. FETCH INDIVIDUAL SUBSCRIPTIONS WITH DETAILS
        # ============================================
        logger.info("Fetching subscription details from Stripe API...")
        
        subscription_details = []
        
        try:
            subs = client.subscriptions.list(params={'limit': 100, 'status': 'all', 'expand': ['data.items.data.price.product']})
            
            for sub in subs.auto_paging_iter():
                sub_created = datetime.fromtimestamp(sub.created).date()
                
                # Get product info from first subscription item
                product_id = None
                product_name = None
                price_amount = 0
                price_interval = 'month'
                
                try:
                    items = sub.items.data if hasattr(sub.items, 'data') else []
                    if items:
                        first_item = items[0]
                        price = first_item.price
                        price_amount = (price.unit_amount or 0) / 100
                        price_interval = price.recurring.interval if price.recurring else 'month'
                        
                        if hasattr(price, 'product'):
                            if isinstance(price.product, str):
                                product_id = price.product
                            else:
                                product_id = price.product.id
                                product_name = price.product.name
                except Exception as e:
                    logger.warning(f"Error getting subscription product: {e}")
                
                subscription_details.append({
                    'id': sub.id,
                    'customer_id': sub.customer,
                    'status': sub.status,
                    'product_id': product_id,
                    'product_name': product_name,
                    'price_amount': price_amount,
                    'price_interval': price_interval,
                    'created': sub_created.isoformat(),
                    'current_period_start': datetime.fromtimestamp(sub.current_period_start).date().isoformat() if sub.current_period_start else None,
                    'current_period_end': datetime.fromtimestamp(sub.current_period_end).date().isoformat() if sub.current_period_end else None,
                    'cancel_at_period_end': sub.cancel_at_period_end,
                })
                
                # Store raw subscription data
                raw_rows.append({
                    'organization_id': organization_id,
                    'date': sub_created.isoformat(),
                    'data_type': 'subscription',
                    'api_response': json.dumps({
                        'id': sub.id,
                        'customer': sub.customer,
                        'status': sub.status,
                        'created': sub.created,
                        'current_period_start': sub.current_period_start,
                        'current_period_end': sub.current_period_end,
                        'cancel_at_period_end': sub.cancel_at_period_end,
                        'canceled_at': sub.canceled_at,
                        'ended_at': sub.ended_at,
                        'product_id': product_id,
                        'product_name': product_name,
                        'price_amount': price_amount,
                        'price_interval': price_interval,
                    }),
                    'created_at': now_iso,
                })
                
        except Exception as e:
            logger.error(f"Error fetching subscription details: {e}")
        
        # ============================================
        # 6. BUILD BIGQUERY ROWS
        # ============================================
        logger.info("Building BigQuery rows...")
        
        today_str = end_date.isoformat()
        
        # Daily revenue rows
        for date_str, metrics in daily_revenue.items():
            row = {
                'organization_id': organization_id,
                'date': date_str,
                'canonical_entity_id': f"stripe_revenue_{date_str}",
                'entity_type': 'revenue',
                
                'revenue': metrics['total_revenue'],
                'source_breakdown': json.dumps({
                    'currencies': list(metrics['currencies']),
                    'payment_count': metrics['payment_count'],
                    'refund_amount': metrics['refund_amount'],
                    'net_revenue': metrics['total_revenue'] - metrics['refund_amount'],
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(row)
        
        # Subscription aggregate metrics snapshot
        subscription_agg_row = {
            'organization_id': organization_id,
            'date': today_str,
            'canonical_entity_id': 'stripe_subscription_metrics',
            'entity_type': 'subscription_summary',
            
            'revenue': total_mrr,  # Use revenue field for MRR
            'source_breakdown': json.dumps({
                'mrr': total_mrr,
                'arr': total_mrr * 12,
                'active_subscriptions': active_subscriptions,
                'churned_subscriptions': churned_subscriptions,
                'churn_rate': (churned_subscriptions / (active_subscriptions + churned_subscriptions) * 100) if (active_subscriptions + churned_subscriptions) > 0 else 0,
            }),
            
            'created_at': now_iso,
            'updated_at': now_iso,
        }
        rows.append(subscription_agg_row)
        
        # Individual subscription rows
        for sub in subscription_details:
            sub_row = {
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': f"stripe_sub_{sub['id']}",
                'entity_type': 'subscription',
                
                'revenue': sub['price_amount'],  # Monthly price
                'source_breakdown': json.dumps({
                    'subscription_id': sub['id'],
                    'customer_id': sub['customer_id'],
                    'status': sub['status'],
                    'product_id': sub['product_id'],
                    'product_name': sub['product_name'],
                    'price_interval': sub['price_interval'],
                    'created': sub['created'],
                    'current_period_start': sub['current_period_start'],
                    'current_period_end': sub['current_period_end'],
                    'cancel_at_period_end': sub['cancel_at_period_end'],
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(sub_row)
        
        # Customer aggregate metrics snapshot
        customer_agg_row = {
            'organization_id': organization_id,
            'date': today_str,
            'canonical_entity_id': 'stripe_customer_metrics',
            'entity_type': 'customer_summary',
            
            'users': total_customers,  # Use users field for customer count
            'source_breakdown': json.dumps({
                'total_customers': total_customers,
                'new_customers_by_day': dict(new_customers_by_day),
            }),
            
            'created_at': now_iso,
            'updated_at': now_iso,
        }
        rows.append(customer_agg_row)
        
        # Individual customer rows
        for cust in customer_details:
            cust_row = {
                'organization_id': organization_id,
                'date': cust['created'],  # Use customer creation date
                'canonical_entity_id': f"stripe_customer_{cust['id']}",
                'entity_type': 'customer',
                
                'source_breakdown': json.dumps({
                    'customer_id': cust['id'],
                    'email': cust['email'],
                    'name': cust['name'],
                    'currency': cust['currency'],
                    'delinquent': cust['delinquent'],
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(cust_row)
        
        # Product rows
        for prod in products_data:
            prod_row = {
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': f"stripe_product_{prod['id']}",
                'entity_type': 'product',
                
                'source_breakdown': json.dumps({
                    'product_id': prod['id'],
                    'name': prod['name'],
                    'description': prod['description'],
                    'active': prod['active'],
                    'created': prod['created'],
                    'default_price': prod['default_price'],
                    'metadata': prod['metadata'],
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(prod_row)
        
        # ============================================
        # 5. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Writing {len(rows)} rows to BigQuery (mode={sync_mode})...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            if sync_mode == 'full':
                # FULL RESYNC: Delete all existing Stripe data and rewrite
                delete_query = f"""
                DELETE FROM `{table_ref}`
                WHERE organization_id = '{organization_id}'
                  AND entity_type IN ('revenue', 'subscription', 'subscription_summary', 'customer', 'customer_summary', 'product')
                """
                
                try:
                    bq.query(delete_query).result()
                    logger.info("Deleted all existing Stripe data for full resync")
                except Exception as e:
                    logger.warning(f"Delete query warning: {e}")
                
                # Insert all rows
                errors = bq.insert_rows_json(table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
                
                if errors:
                    logger.warning(f"Some rows failed: {errors[:3]}")
                else:
                    results['rows_inserted'] = len(rows)
            else:
                # UPDATE SYNC: Use MERGE to upsert (update existing, insert new)
                # Create a temp table with new data, then merge
                temp_table_id = f"temp_stripe_sync_{organization_id.replace('-', '_')}_{int(datetime.utcnow().timestamp())}"
                temp_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{temp_table_id}"
                
                try:
                    # Insert into temp table first
                    temp_table = bq.create_table(f"{temp_table_ref}", exists_ok=False)
                    
                    # Use the main table schema
                    main_table = bq.get_table(table_ref)
                    temp_schema = main_table.schema
                    
                    # Create temp table with same schema
                    temp_table = bigquery.Table(temp_table_ref, schema=temp_schema)
                    temp_table = bq.create_table(temp_table, exists_ok=True)
                    
                    # Insert rows into temp table
                    errors = bq.insert_rows_json(temp_table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
                    if errors:
                        logger.warning(f"Temp table insert errors: {errors[:3]}")
                    
                    # MERGE from temp table
                    merge_query = f"""
                    MERGE `{table_ref}` T
                    USING `{temp_table_ref}` S
                    ON T.organization_id = S.organization_id 
                       AND T.canonical_entity_id = S.canonical_entity_id 
                       AND T.date = S.date
                    WHEN MATCHED THEN
                        UPDATE SET 
                            revenue = S.revenue,
                            payment_count = S.payment_count,
                            refund_amount = S.refund_amount,
                            net_revenue = S.net_revenue,
                            mrr = S.mrr,
                            arr = S.arr,
                            active_subscriptions = S.active_subscriptions,
                            churned_subscriptions = S.churned_subscriptions,
                            churn_rate = S.churn_rate,
                            total_customers = S.total_customers,
                            new_customers_today = S.new_customers_today,
                            source_breakdown = S.source_breakdown,
                            updated_at = S.updated_at
                    WHEN NOT MATCHED THEN
                        INSERT ROW
                    """
                    
                    bq.query(merge_query).result()
                    results['rows_inserted'] = len(rows)
                    logger.info(f"MERGE completed: {len(rows)} rows upserted")
                    
                    # Clean up temp table
                    bq.delete_table(temp_table_ref, not_found_ok=True)
                    
                except Exception as merge_error:
                    logger.error(f"MERGE failed, falling back to delete+insert: {merge_error}")
                    # Fallback to delete+insert for the date range
                    delete_query = f"""
                    DELETE FROM `{table_ref}`
                    WHERE organization_id = '{organization_id}'
                      AND entity_type IN ('revenue', 'subscription', 'subscription_summary', 'customer', 'customer_summary', 'product')
                      AND date >= '{start_date.isoformat()}'
                    """
                    try:
                        bq.query(delete_query).result()
                    except:
                        pass
                    
                    errors = bq.insert_rows_json(table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
                    if not errors:
                        results['rows_inserted'] = len(rows)
        
        # ============================================
        # 7. WRITE RAW DATA TO BIGQUERY WITH UPSERT
        # ============================================
        if raw_rows:
            logger.info(f"Writing {len(raw_rows)} raw records to BigQuery...")
            raw_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{RAW_TABLE_ID}"
            
            # ALWAYS delete existing raw data for date range to avoid duplicates
            delete_raw_query = f"""
            DELETE FROM `{raw_table_ref}`
            WHERE organization_id = '{organization_id}'
              AND date BETWEEN '{start_date.isoformat()}' AND '{end_date.isoformat()}'
            """
            try:
                bq.query(delete_raw_query).result()
                logger.info(f"Deleted existing raw data for {start_date} to {end_date}")
            except Exception as e:
                logger.warning(f"Raw delete warning: {e}")
            
            # Insert raw rows in batches
            BATCH_SIZE = 500
            raw_inserted = 0
            for i in range(0, len(raw_rows), BATCH_SIZE):
                batch = raw_rows[i:i + BATCH_SIZE]
                errors = bq.insert_rows_json(raw_table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                if not errors:
                    raw_inserted += len(batch)
            
            results['raw_records_inserted'] = raw_inserted
            logger.info(f"Inserted {raw_inserted} raw records")
        
        # Update connection status (minimal Firestore update)
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'charges': results['charges_processed'],
                'subscriptions': results['subscriptions_processed'],
                'customers': results['customers_processed'],
                'products': results['products_processed'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        mode_label = "Full re-sync" if sync_mode == 'full' else "Incremental sync"
        logger.info(f"✅ Stripe sync complete ({mode_label}): {results}")
        
        return ({
            'success': True,
            'mode': sync_mode,
            **results,
            'message': f"{mode_label}: {results['rows_inserted']} rows to BigQuery"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ Stripe sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Update connection status on error
        try:
            db = firestore.Client()
            connection_ref = db.collection('stripe_connections').document(organization_id)
            connection_ref.update({
                'status': 'error',
                'errorMessage': str(e),
                'updatedAt': firestore.SERVER_TIMESTAMP,
            })
        except:
            pass
        
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)

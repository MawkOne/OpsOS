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
    
    # Set days_back based on mode
    if sync_mode == 'full':
        days_back = request_json.get('daysBack', 730)  # 2 years for full resync
    else:
        days_back = request_json.get('daysBack', 30)  # 30 days for incremental
    
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
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days_back)
        start_timestamp = int(datetime.combine(start_date, datetime.min.time()).timestamp())
        
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
            # Paginate through all charges
            charges = client.charges.list(
                params={
                    'limit': 100,
                    'created': {'gte': start_timestamp},
                }
            )
            
            for charge in charges.auto_paging_iter():
                results['charges_processed'] += 1
                
                # Get date from charge
                charge_date = datetime.fromtimestamp(charge.created).date()
                date_str = charge_date.isoformat()
                
                if charge.status == 'succeeded':
                    amount = charge.amount / 100  # Convert from cents
                    daily_revenue[date_str]['total_revenue'] += amount
                    daily_revenue[date_str]['payment_count'] += 1
                    daily_revenue[date_str]['currencies'].add(charge.currency.upper())
                
                if charge.refunded:
                    refund_amount = charge.amount_refunded / 100
                    daily_revenue[date_str]['refund_amount'] += refund_amount
                    
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
        # 3. FETCH CUSTOMER COUNT
        # ============================================
        logger.info("Fetching customers from Stripe API...")
        
        total_customers = 0
        new_customers_by_day = defaultdict(int)
        
        try:
            customers = client.customers.list(
                params={
                    'limit': 100,
                    'created': {'gte': start_timestamp},
                }
            )
            
            for customer in customers.auto_paging_iter():
                results['customers_processed'] += 1
                total_customers += 1
                
                customer_date = datetime.fromtimestamp(customer.created).date()
                new_customers_by_day[customer_date.isoformat()] += 1
                
        except Exception as e:
            logger.error(f"Error fetching customers: {e}")
        
        # ============================================
        # 4. BUILD BIGQUERY ROWS
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
                'payment_count': metrics['payment_count'],
                'refund_amount': metrics['refund_amount'],
                'net_revenue': metrics['total_revenue'] - metrics['refund_amount'],
                
                'source_breakdown': json.dumps({
                    'currencies': list(metrics['currencies']),
                }),
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(row)
        
        # Subscription metrics snapshot
        subscription_row = {
            'organization_id': organization_id,
            'date': today_str,
            'canonical_entity_id': 'stripe_subscription_metrics',
            'entity_type': 'subscription',
            
            'mrr': total_mrr,
            'arr': total_mrr * 12,
            'active_subscriptions': active_subscriptions,
            'churned_subscriptions': churned_subscriptions,
            'churn_rate': (churned_subscriptions / (active_subscriptions + churned_subscriptions) * 100) if (active_subscriptions + churned_subscriptions) > 0 else 0,
            
            'created_at': now_iso,
            'updated_at': now_iso,
        }
        rows.append(subscription_row)
        
        # Customer metrics snapshot
        customer_row = {
            'organization_id': organization_id,
            'date': today_str,
            'canonical_entity_id': 'stripe_customer_metrics',
            'entity_type': 'customer',
            
            'total_customers': total_customers,
            'new_customers_today': new_customers_by_day.get(today_str, 0),
            
            'source_breakdown': json.dumps({
                'new_customers_by_day': dict(new_customers_by_day),
            }),
            
            'created_at': now_iso,
            'updated_at': now_iso,
        }
        rows.append(customer_row)
        
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
                  AND entity_type IN ('revenue', 'subscription', 'customer')
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
                      AND entity_type IN ('revenue', 'subscription', 'customer')
                      AND date >= '{start_date.isoformat()}'
                    """
                    try:
                        bq.query(delete_query).result()
                    except:
                        pass
                    
                    errors = bq.insert_rows_json(table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
                    if not errors:
                        results['rows_inserted'] = len(rows)
        
        # Update connection status (minimal Firestore update)
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'charges': results['charges_processed'],
                'subscriptions': results['subscriptions_processed'],
                'customers': results['customers_processed'],
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

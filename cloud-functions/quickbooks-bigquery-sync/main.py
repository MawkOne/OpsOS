"""
QuickBooks Direct to BigQuery Sync Cloud Function

Calls QuickBooks API directly and writes to BigQuery - NO Firestore intermediate storage.
Only uses Firestore for OAuth credentials.

Architecture: QuickBooks API → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
from collections import defaultdict
import logging
import json
import os
import requests
import base64

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"

QUICKBOOKS_CLIENT_ID = os.environ.get('QUICKBOOKS_CLIENT_ID')
QUICKBOOKS_CLIENT_SECRET = os.environ.get('QUICKBOOKS_CLIENT_SECRET')
QUICKBOOKS_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'


def refresh_access_token(db, organization_id: str, connection_data: dict) -> str:
    """Refresh QuickBooks access token if expired"""
    
    access_token = connection_data.get('accessToken')
    refresh_token = connection_data.get('refreshToken')
    expiry = connection_data.get('accessTokenExpiry')
    
    # Check if token is still valid
    if expiry:
        if hasattr(expiry, 'timestamp'):
            expiry_time = expiry.timestamp()
        else:
            expiry_time = 0
        
        # If token valid for at least 5 more minutes, use it
        if expiry_time - 300 > datetime.utcnow().timestamp():
            return access_token
    
    # Token expired, refresh it
    if not QUICKBOOKS_CLIENT_ID or not QUICKBOOKS_CLIENT_SECRET:
        raise ValueError('QuickBooks credentials not configured')
    
    basic_auth = base64.b64encode(f"{QUICKBOOKS_CLIENT_ID}:{QUICKBOOKS_CLIENT_SECRET}".encode()).decode()
    
    response = requests.post(
        QUICKBOOKS_TOKEN_URL,
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': f'Basic {basic_auth}',
        },
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
        }
    )
    
    if not response.ok:
        raise ValueError(f'Failed to refresh QuickBooks token: {response.text}')
    
    token_data = response.json()
    new_access_token = token_data['access_token']
    new_refresh_token = token_data['refresh_token']
    expires_in = token_data['expires_in']
    
    # Update tokens in Firestore
    connection_ref = db.collection('quickbooks_connections').document(organization_id)
    now = datetime.utcnow()
    connection_ref.update({
        'accessToken': new_access_token,
        'refreshToken': new_refresh_token,
        'accessTokenExpiry': now + timedelta(seconds=expires_in),
        'updatedAt': firestore.SERVER_TIMESTAMP,
    })
    
    return new_access_token


def qb_query(access_token: str, realm_id: str, query: str) -> dict:
    """Execute QuickBooks query"""
    url = f"{QUICKBOOKS_API_BASE}/{realm_id}/query?query={requests.utils.quote(query)}&minorversion=65"
    response = requests.get(
        url,
        headers={
            'Accept': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
    )
    
    if not response.ok:
        logger.error(f"QuickBooks query failed: {response.text}")
        return {}
    
    return response.json()


@functions_framework.http
def sync_quickbooks_to_bigquery(request):
    """Sync QuickBooks data directly to BigQuery"""
    
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
    days_back = request_json.get('daysBack', 365)
    
    logger.info(f"Starting QuickBooks → BigQuery DIRECT sync for org: {organization_id}")
    
    try:
        db = firestore.Client()
        bq = bigquery.Client()
        
        # Get OAuth credentials from Firestore
        connection_ref = db.collection('quickbooks_connections').document(organization_id)
        connection_doc = connection_ref.get()
        
        if not connection_doc.exists:
            return ({'error': 'QuickBooks not connected'}, 404, headers)
        
        connection_data = connection_doc.to_dict()
        realm_id = connection_data.get('realmId')
        
        if not realm_id:
            return ({'error': 'No QuickBooks realm ID found'}, 400, headers)
        
        # Update status to syncing
        connection_ref.update({'status': 'syncing', 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        # Get valid access token (refresh if needed)
        access_token = refresh_access_token(db, organization_id, connection_data)
        
        results = {
            'invoices_processed': 0,
            'payments_processed': 0,
            'expenses_processed': 0,
            'rows_inserted': 0,
        }
        
        rows = []
        now_iso = datetime.utcnow().isoformat()
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days_back)
        today_str = end_date.isoformat()
        
        # ============================================
        # 1. FETCH INVOICES DIRECTLY FROM QUICKBOOKS
        # ============================================
        logger.info("Fetching invoices from QuickBooks API...")
        
        daily_revenue = defaultdict(lambda: {
            'total_invoiced': 0,
            'total_paid': 0,
            'invoice_count': 0,
        })
        
        try:
            invoice_data = qb_query(access_token, realm_id, 'SELECT * FROM Invoice MAXRESULTS 1000')
            invoices = invoice_data.get('QueryResponse', {}).get('Invoice', [])
            
            for invoice in invoices:
                results['invoices_processed'] += 1
                
                txn_date_str = invoice.get('TxnDate', '')
                if txn_date_str:
                    try:
                        txn_date = datetime.strptime(txn_date_str, '%Y-%m-%d').date()
                        if start_date <= txn_date <= end_date:
                            date_str = txn_date.isoformat()
                            total_amount = float(invoice.get('TotalAmt', 0))
                            balance = float(invoice.get('Balance', 0))
                            paid_amount = total_amount - balance
                            
                            daily_revenue[date_str]['total_invoiced'] += total_amount
                            daily_revenue[date_str]['total_paid'] += paid_amount
                            daily_revenue[date_str]['invoice_count'] += 1
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"Error fetching invoices: {e}")
        
        # ============================================
        # 2. FETCH EXPENSES (BILLS + PURCHASES)
        # ============================================
        logger.info("Fetching expenses from QuickBooks API...")
        
        daily_expenses = defaultdict(lambda: {
            'total_expenses': 0,
            'expense_count': 0,
        })
        
        try:
            # Fetch Bills
            bill_data = qb_query(access_token, realm_id, 'SELECT * FROM Bill MAXRESULTS 1000')
            bills = bill_data.get('QueryResponse', {}).get('Bill', [])
            
            for bill in bills:
                results['expenses_processed'] += 1
                txn_date_str = bill.get('TxnDate', '')
                if txn_date_str:
                    try:
                        txn_date = datetime.strptime(txn_date_str, '%Y-%m-%d').date()
                        if start_date <= txn_date <= end_date:
                            date_str = txn_date.isoformat()
                            total_amount = float(bill.get('TotalAmt', 0))
                            daily_expenses[date_str]['total_expenses'] += total_amount
                            daily_expenses[date_str]['expense_count'] += 1
                    except:
                        pass
            
            # Fetch Purchases
            purchase_data = qb_query(access_token, realm_id, 'SELECT * FROM Purchase MAXRESULTS 1000')
            purchases = purchase_data.get('QueryResponse', {}).get('Purchase', [])
            
            for purchase in purchases:
                results['expenses_processed'] += 1
                txn_date_str = purchase.get('TxnDate', '')
                if txn_date_str:
                    try:
                        txn_date = datetime.strptime(txn_date_str, '%Y-%m-%d').date()
                        if start_date <= txn_date <= end_date:
                            date_str = txn_date.isoformat()
                            total_amount = float(purchase.get('TotalAmt', 0))
                            daily_expenses[date_str]['total_expenses'] += total_amount
                            daily_expenses[date_str]['expense_count'] += 1
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"Error fetching expenses: {e}")
        
        # ============================================
        # 3. FETCH ACCOUNT BALANCES
        # ============================================
        logger.info("Fetching accounts from QuickBooks API...")
        
        account_balances = {
            'accounts_receivable': 0,
            'accounts_payable': 0,
            'bank_accounts': 0,
            'total_income': 0,
            'total_expenses': 0,
        }
        
        try:
            account_data = qb_query(access_token, realm_id, 'SELECT * FROM Account MAXRESULTS 1000')
            accounts = account_data.get('QueryResponse', {}).get('Account', [])
            
            for account in accounts:
                account_type = account.get('AccountType', '')
                balance = float(account.get('CurrentBalance', 0))
                
                if 'Receivable' in account_type:
                    account_balances['accounts_receivable'] += balance
                elif 'Payable' in account_type:
                    account_balances['accounts_payable'] += balance
                elif 'Bank' in account_type:
                    account_balances['bank_accounts'] += balance
                elif 'Income' in account_type:
                    account_balances['total_income'] += balance
                elif 'Expense' in account_type:
                    account_balances['total_expenses'] += balance
                    
        except Exception as e:
            logger.error(f"Error fetching accounts: {e}")
        
        # ============================================
        # 4. BUILD BIGQUERY ROWS
        # ============================================
        logger.info("Building BigQuery rows...")
        
        # Daily invoice/revenue rows
        for date_str, metrics in daily_revenue.items():
            row = {
                'organization_id': organization_id,
                'date': date_str,
                'canonical_entity_id': f"qb_revenue_{date_str}",
                'entity_type': 'invoice',
                'data_source': 'quickbooks',
                
                'revenue': metrics['total_paid'],
                'invoiced_amount': metrics['total_invoiced'],
                'invoice_count': metrics['invoice_count'],
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(row)
        
        # Daily expense rows
        for date_str, metrics in daily_expenses.items():
            row = {
                'organization_id': organization_id,
                'date': date_str,
                'canonical_entity_id': f"qb_expense_{date_str}",
                'entity_type': 'expense',
                'data_source': 'quickbooks',
                
                'expense_amount': metrics['total_expenses'],
                'expense_count': metrics['expense_count'],
                
                'created_at': now_iso,
                'updated_at': now_iso,
            }
            rows.append(row)
        
        # Account balances snapshot
        account_row = {
            'organization_id': organization_id,
            'date': today_str,
            'canonical_entity_id': 'qb_account_balances',
            'entity_type': 'account',
            'data_source': 'quickbooks',
            
            'accounts_receivable': account_balances['accounts_receivable'],
            'accounts_payable': account_balances['accounts_payable'],
            'bank_balance': account_balances['bank_accounts'],
            'total_income': account_balances['total_income'],
            'total_expenses': account_balances['total_expenses'],
            'net_income': account_balances['total_income'] - account_balances['total_expenses'],
            
            'created_at': now_iso,
            'updated_at': now_iso,
        }
        rows.append(account_row)
        
        # ============================================
        # 5. WRITE DIRECTLY TO BIGQUERY
        # ============================================
        if rows:
            logger.info(f"Inserting {len(rows)} rows directly to BigQuery...")
            
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            # Delete existing QuickBooks data
            delete_query = f"""
            DELETE FROM `{table_ref}`
            WHERE organization_id = '{organization_id}'
              AND data_source = 'quickbooks'
              AND date >= '{start_date.isoformat()}'
            """
            
            try:
                bq.query(delete_query).result()
            except Exception as e:
                logger.warning(f"Delete query warning: {e}")
            
            # Insert new rows
            errors = bq.insert_rows_json(table_ref, rows, skip_invalid_rows=True, ignore_unknown_values=True)
            
            if errors:
                logger.warning(f"Some rows failed: {errors[:3]}")
            else:
                results['rows_inserted'] = len(rows)
        
        # Update connection status
        connection_ref.update({
            'status': 'connected',
            'lastSyncAt': firestore.SERVER_TIMESTAMP,
            'lastSyncResults': {
                'invoices': results['invoices_processed'],
                'expenses': results['expenses_processed'],
                'bigqueryRows': results['rows_inserted'],
            },
            'updatedAt': firestore.SERVER_TIMESTAMP,
        })
        
        logger.info(f"✅ QuickBooks DIRECT sync complete: {results}")
        
        return ({
            'success': True,
            **results,
            'message': f"Synced {results['rows_inserted']} rows directly to BigQuery (bypassed Firestore)"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ QuickBooks sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        try:
            db = firestore.Client()
            connection_ref = db.collection('quickbooks_connections').document(organization_id)
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

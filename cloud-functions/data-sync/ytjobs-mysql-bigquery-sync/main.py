"""
YTJobs MySQL to BigQuery Sync Cloud Function

Connects to YTJobs MySQL read replica via SSH tunnel and syncs
marketplace metrics to BigQuery for analytics.

Architecture: MySQL (RDS) → SSH Tunnel → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import bigquery, secretmanager
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict
import logging
import json
import os
import pymysql
import sshtunnel
import tempfile


def decimal_default(obj):
    """JSON serializer for Decimal types from MySQL"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def to_json(obj):
    """Convert object to JSON string, handling Decimal types"""
    return json.dumps(obj, default=decimal_default)


def safe_float(val):
    """Convert value to float, handling Decimal and None"""
    if val is None:
        return 0.0
    if isinstance(val, Decimal):
        return float(val)
    return float(val)


def safe_int(val):
    """Convert value to int, handling Decimal and None"""
    if val is None:
        return 0
    if isinstance(val, Decimal):
        return int(val)
    return int(val)


def sanitize_row(row_dict):
    """Recursively convert all Decimal values in a dict to float/int for JSON serialization"""
    sanitized = {}
    for key, value in row_dict.items():
        if isinstance(value, Decimal):
            # Convert to int if it's a whole number, else float
            if value == int(value):
                sanitized[key] = int(value)
            else:
                sanitized[key] = float(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_row(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_row(v) if isinstance(v, dict) else (float(v) if isinstance(v, Decimal) else v) for v in value]
        else:
            sanitized[key] = value
    return sanitized

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"
RAW_TABLE_ID = "raw_ytjobs"

# MySQL Connection Settings (from environment/secrets)
MYSQL_HOST = os.environ.get('MYSQL_HOST', 'ytjobs-read.cra3jxfluerj.us-east-1.rds.amazonaws.com')
MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'ytjobs')
MYSQL_USER = os.environ.get('MYSQL_USER', 'mark')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')

# SSH Bastion Settings
SSH_HOST = os.environ.get('SSH_HOST', '34.199.212.144')
SSH_PORT = int(os.environ.get('SSH_PORT', 22))
SSH_USER = os.environ.get('SSH_USER', 'developer')
SSH_KEY_SECRET = os.environ.get('SSH_KEY_SECRET', 'ytjobs-ssh-key')


def get_ssh_key():
    """Get SSH private key from environment (base64 encoded) or Secret Manager"""
    import base64
    
    # First try base64-encoded environment variable
    ssh_key_b64 = os.environ.get('SSH_PRIVATE_KEY_B64')
    if ssh_key_b64:
        return base64.b64decode(ssh_key_b64).decode('utf-8')
    
    # Try plain environment variable (for local testing)
    ssh_key = os.environ.get('SSH_PRIVATE_KEY')
    if ssh_key:
        return ssh_key
    
    # Try Secret Manager
    try:
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{PROJECT_ID}/secrets/{SSH_KEY_SECRET}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to get SSH key from Secret Manager: {e}")
        raise


def get_mysql_connection(tunnel):
    """Create MySQL connection through SSH tunnel"""
    return pymysql.connect(
        host='127.0.0.1',
        port=tunnel.local_bind_port,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=30,
        read_timeout=300,
    )


@functions_framework.http
def sync_ytjobs_to_bigquery(request):
    """Sync YTJobs MySQL data to BigQuery"""
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True) or {}
    organization_id = request_json.get('organizationId', 'ytjobs')
    sync_mode = request_json.get('mode', 'update')  # 'update' or 'full'
    
    # Date range
    explicit_start = request_json.get('startDate')
    explicit_end = request_json.get('endDate')
    
    if sync_mode == 'full':
        days_back = request_json.get('daysBack', 365)
    else:
        days_back = request_json.get('daysBack', 7)  # 7-day lookback for nightly syncs
    
    logger.info(f"Starting YTJobs MySQL → BigQuery sync (mode={sync_mode})")
    
    try:
        # Get SSH key
        ssh_key_str = get_ssh_key()
        
        # Write SSH key to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as f:
            f.write(ssh_key_str)
            ssh_key_file = f.name
        
        import os as os_module
        os_module.chmod(ssh_key_file, 0o600)
        
        # Load the key using paramiko
        import paramiko
        from io import StringIO
        
        # Try to load as different key types
        pkey = None
        try:
            pkey = paramiko.RSAKey.from_private_key(StringIO(ssh_key_str))
        except:
            try:
                pkey = paramiko.Ed25519Key.from_private_key(StringIO(ssh_key_str))
            except:
                try:
                    pkey = paramiko.ECDSAKey.from_private_key(StringIO(ssh_key_str))
                except Exception as e:
                    logger.warning(f"Could not load key directly, will use file: {e}")
        
        results = {
            'users_processed': 0,
            'companies_processed': 0,
            'jobs_processed': 0,
            'applications_processed': 0,
            'payments_processed': 0,
            'rows_inserted': 0,
            'raw_records_inserted': 0,
        }
        
        rows = []
        raw_rows = []
        now_iso = datetime.utcnow().isoformat()
        
        # Calculate date range
        if explicit_start and explicit_end:
            start_date = datetime.strptime(explicit_start, '%Y-%m-%d').date()
            end_date = datetime.strptime(explicit_end, '%Y-%m-%d').date()
        else:
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=days_back)
        
        logger.info(f"Syncing data from {start_date} to {end_date}")
        
        # Connect via SSH tunnel
        tunnel_kwargs = {
            'ssh_username': SSH_USER,
            'remote_bind_address': (MYSQL_HOST, MYSQL_PORT),
            'local_bind_address': ('127.0.0.1', 0),  # Random available port
        }
        
        if pkey:
            tunnel_kwargs['ssh_pkey'] = pkey
        else:
            tunnel_kwargs['ssh_pkey'] = ssh_key_file
        
        with sshtunnel.SSHTunnelForwarder(
            (SSH_HOST, SSH_PORT),
            **tunnel_kwargs
        ) as tunnel:
            
            conn = get_mysql_connection(tunnel)
            cursor = conn.cursor()
            
            # ============================================
            # 1. DAILY USER SIGNUPS (Talent)
            # ============================================
            logger.info("Fetching daily user signups...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as signups,
                    SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_signups,
                    SUM(CASE WHEN hire_me = 1 THEN 1 ELSE 0 END) as hire_me_enabled
                FROM users
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                results['users_processed'] += row['signups']
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_talent_signups_{row['date'].isoformat()}",
                    'entity_type': 'talent_signups',
                    'users': row['signups'],
                    'conversions': row['verified_signups'],
                    'source_breakdown': to_json({
                        'total_signups': row['signups'],
                        'verified_signups': row['verified_signups'],
                        'hire_me_enabled': row['hire_me_enabled'],
                        'verification_rate': round(row['verified_signups'] / row['signups'] * 100, 2) if row['signups'] > 0 else 0,
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 2. DAILY COMPANY SIGNUPS
            # ============================================
            logger.info("Fetching daily company signups...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as signups
                FROM companies
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                results['companies_processed'] += row['signups']
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_company_signups_{row['date'].isoformat()}",
                    'entity_type': 'company_signups',
                    'users': row['signups'],
                    'source_breakdown': to_json({
                        'company_signups': row['signups'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 3. DAILY JOBS POSTED
            # ============================================
            logger.info("Fetching daily jobs posted...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as jobs_posted,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_jobs,
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_jobs,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_jobs
                FROM jobs
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                results['jobs_processed'] += row['jobs_posted']
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_jobs_posted_{row['date'].isoformat()}",
                    'entity_type': 'jobs_posted',
                    'sessions': row['jobs_posted'],  # Using sessions field for count
                    'source_breakdown': to_json({
                        'total_posted': row['jobs_posted'],
                        'active': row['active_jobs'],
                        'draft': row['draft_jobs'],
                        'closed': row['closed_jobs'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 4. DAILY APPLICATIONS
            # ============================================
            logger.info("Fetching daily applications...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_applications,
                    SUM(CASE WHEN status = 'undecided' THEN 1 ELSE 0 END) as undecided_cnt,
                    SUM(CASE WHEN status = 'lowPriority' THEN 1 ELSE 0 END) as low_priority_cnt,
                    SUM(CASE WHEN status = 'highPriority' THEN 1 ELSE 0 END) as high_priority_cnt,
                    SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_cnt,
                    SUM(CASE WHEN status = 'hired' THEN 1 ELSE 0 END) as hired_cnt
                FROM job_apply
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                results['applications_processed'] += row['total_applications']
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_applications_{row['date'].isoformat()}",
                    'entity_type': 'applications',
                    'sessions': row['total_applications'],  # Total applications
                    'conversions': row['hired_cnt'],  # Hired = conversion
                    'source_breakdown': to_json({
                        'total': row['total_applications'],
                        'undecided': row['undecided_cnt'],
                        'low_priority': row['low_priority_cnt'],
                        'high_priority': row['high_priority_cnt'],
                        'accepted': row['accepted_cnt'],
                        'hired': row['hired_cnt'],
                        'acceptance_rate': round((row['accepted_cnt'] + row['hired_cnt']) / row['total_applications'] * 100, 2) if row['total_applications'] > 0 else 0,
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 5. DAILY HIRES (from job_apply status changes)
            # ============================================
            logger.info("Fetching daily hires...")
            cursor.execute("""
                SELECT 
                    DATE(updated_at) as date,
                    COUNT(*) as hires
                FROM job_apply
                WHERE status = 'hired'
                  AND updated_at >= %s AND updated_at < %s
                GROUP BY DATE(updated_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_hires_{row['date'].isoformat()}",
                    'entity_type': 'hires',
                    'conversions': row['hires'],
                    'source_breakdown': to_json({
                        'hires': row['hires'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 6. DAILY PAYMENTS (Revenue)
            # ============================================
            logger.info("Fetching daily payments...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as payment_count,
                    SUM(COALESCE(amount_total, 0)) / 100 as total_revenue,
                    COUNT(DISTINCT job_id) as jobs_with_payments,
                    product
                FROM payments
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at), product
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            # Aggregate by date (across products)
            daily_payments = defaultdict(lambda: {
                'payment_count': 0,
                'total_revenue': 0,
                'jobs_with_payments': 0,
                'by_product': {},
            })
            
            for row in cursor.fetchall():
                date_str = row['date'].isoformat()
                results['payments_processed'] += row['payment_count']
                
                daily_payments[date_str]['payment_count'] += safe_int(row['payment_count'])
                daily_payments[date_str]['total_revenue'] += safe_float(row['total_revenue'])
                daily_payments[date_str]['jobs_with_payments'] += safe_int(row['jobs_with_payments'])
                
                product = row['product'] or 'unknown'
                if product not in daily_payments[date_str]['by_product']:
                    daily_payments[date_str]['by_product'][product] = {
                        'count': 0,
                        'revenue': 0,
                    }
                daily_payments[date_str]['by_product'][product]['count'] += safe_int(row['payment_count'])
                daily_payments[date_str]['by_product'][product]['revenue'] += safe_float(row['total_revenue'])
            
            for date_str, metrics in daily_payments.items():
                rows.append({
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"ytjobs_payments_{date_str}",
                    'entity_type': 'marketplace_revenue',
                    'revenue': metrics['total_revenue'],
                    'source_breakdown': to_json({
                        'payment_count': metrics['payment_count'],
                        'total_revenue': metrics['total_revenue'],
                        'jobs_with_payments': metrics['jobs_with_payments'],
                        'by_product': metrics['by_product'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 7. DAILY JOB VIEWS
            # ============================================
            logger.info("Fetching daily job views...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as views
                FROM job_views
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_job_views_{row['date'].isoformat()}",
                    'entity_type': 'job_views',
                    'pageviews': row['views'],
                    'source_breakdown': to_json({
                        'job_views': row['views'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 8. DAILY PROFILE VIEWS
            # ============================================
            logger.info("Fetching daily profile views...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as views
                FROM profile_views
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_profile_views_{row['date'].isoformat()}",
                    'entity_type': 'profile_views',
                    'pageviews': row['views'],
                    'source_breakdown': to_json({
                        'profile_views': row['views'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 9. DAILY REVIEWS
            # ============================================
            logger.info("Fetching daily reviews...")
            cursor.execute("""
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as reviews
                FROM reviews
                WHERE created_at >= %s AND created_at < %s
                GROUP BY DATE(created_at)
                ORDER BY date
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                rows.append({
                    'organization_id': organization_id,
                    'date': row['date'].isoformat(),
                    'canonical_entity_id': f"ytjobs_reviews_{row['date'].isoformat()}",
                    'entity_type': 'reviews',
                    'conversions': row['reviews'],  # Number of reviews
                    'source_breakdown': to_json({
                        'review_count': row['reviews'],
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
            
            # ============================================
            # 10. MARKETPLACE HEALTH SNAPSHOT (Daily)
            # ============================================
            logger.info("Calculating marketplace health metrics...")
            
            # Get current totals for snapshot
            cursor.execute("SELECT COUNT(*) as cnt FROM users")
            total_users = safe_int(cursor.fetchone()['cnt'])
            
            cursor.execute("SELECT COUNT(*) as cnt FROM companies")
            total_companies = safe_int(cursor.fetchone()['cnt'])
            
            cursor.execute("SELECT COUNT(*) as cnt FROM jobs WHERE status = 'active'")
            active_jobs = safe_int(cursor.fetchone()['cnt'])
            
            cursor.execute("SELECT COUNT(*) as cnt FROM subscriptions WHERE stripe_status = 'active'")
            active_subscriptions = safe_int(cursor.fetchone()['cnt'])
            
            # Applications per active job
            cursor.execute("""
                SELECT COUNT(*) / NULLIF(COUNT(DISTINCT job_id), 0) as apps_per_job
                FROM job_apply ja
                JOIN jobs j ON ja.job_id = j.id
                WHERE j.status = 'active'
            """)
            apps_per_job = safe_float(cursor.fetchone()['apps_per_job'])
            
            # Match rate (hired / closed+expired jobs) for recent period
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT CASE WHEN ja.status = 'hired' THEN ja.job_id END) as jobs_with_hires,
                    COUNT(DISTINCT j.id) as total_completed_jobs
                FROM jobs j
                LEFT JOIN job_apply ja ON j.id = ja.job_id
                WHERE j.status IN ('closed', 'expired')
                  AND j.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            """)
            match_data = cursor.fetchone()
            jobs_with_hires = safe_int(match_data['jobs_with_hires'])
            total_completed_jobs = safe_int(match_data['total_completed_jobs'])
            match_rate = (jobs_with_hires / total_completed_jobs * 100) if total_completed_jobs > 0 else 0
            
            today_str = end_date.isoformat()
            rows.append({
                'organization_id': organization_id,
                'date': today_str,
                'canonical_entity_id': f"ytjobs_marketplace_health_{today_str}",
                'entity_type': 'marketplace_health',
                'users': total_users,
                'source_breakdown': to_json({
                    'total_talent': total_users,
                    'total_companies': total_companies,
                    'active_jobs': active_jobs,
                    'active_subscriptions': active_subscriptions,
                    'talent_to_job_ratio': round(total_users / active_jobs, 1) if active_jobs > 0 else 0.0,
                    'applications_per_job': round(apps_per_job, 1),
                    'match_rate_90d': round(match_rate, 1),
                }),
                'created_at': now_iso,
                'updated_at': now_iso,
            })
            
            conn.close()
        
        # Clean up temp file
        import os as os_module
        os_module.unlink(ssh_key_file)
        
        # ============================================
        # WRITE TO BIGQUERY
        # ============================================
        if rows:
            bq = bigquery.Client()
            table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
            
            logger.info(f"Writing {len(rows)} rows to BigQuery...")
            
            # Always delete existing data for the date range to prevent duplicates (upsert behavior)
            delete_query = f"""
            DELETE FROM `{table_ref}`
            WHERE organization_id = '{organization_id}'
              AND entity_type IN (
                'talent_signups', 'company_signups', 'jobs_posted', 
                'applications', 'hires', 'marketplace_revenue',
                'job_views', 'profile_views', 'reviews', 'marketplace_health'
              )
              AND date >= '{start_date.isoformat()}' AND date <= '{end_date.isoformat()}'
            """
            try:
                bq.query(delete_query).result()
                logger.info(f"Deleted existing data for {start_date} to {end_date} (upsert)")
            except Exception as e:
                logger.warning(f"Delete warning: {e}")
            
            # Insert rows in batches (sanitize to remove Decimal types)
            BATCH_SIZE = 500
            inserted = 0
            for i in range(0, len(rows), BATCH_SIZE):
                batch = [sanitize_row(row) for row in rows[i:i + BATCH_SIZE]]
                errors = bq.insert_rows_json(table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                if errors:
                    logger.warning(f"Insert errors: {errors[:3]}")
                else:
                    inserted += len(batch)
            
            results['rows_inserted'] = inserted
        
        logger.info(f"✅ YTJobs sync complete: {results}")
        
        return ({
            'success': True,
            'mode': sync_mode,
            'date_range': f"{start_date} to {end_date}",
            **results,
            'message': f"Synced {results['rows_inserted']} rows to BigQuery"
        }, 200, headers)
        
    except Exception as e:
        logger.error(f"❌ YTJobs sync failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        return ({
            'success': False,
            'error': str(e)
        }, 500, headers)

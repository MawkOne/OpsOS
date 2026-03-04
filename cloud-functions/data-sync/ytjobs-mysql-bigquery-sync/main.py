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
    """Recursively convert all Decimal and datetime values in a dict for JSON serialization"""
    from datetime import datetime, date
    sanitized = {}
    for key, value in row_dict.items():
        if isinstance(value, Decimal):
            # Convert to int if it's a whole number, else float
            if value == int(value):
                sanitized[key] = int(value)
            else:
                sanitized[key] = float(value)
        elif isinstance(value, (datetime, date)):
            # Convert datetime/date to ISO format string
            sanitized[key] = value.isoformat()
        elif isinstance(value, dict):
            sanitized[key] = sanitize_row(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_row(v) if isinstance(v, dict) else (float(v) if isinstance(v, Decimal) else (v.isoformat() if isinstance(v, (datetime, date)) else v)) for v in value]
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
def ytjobs_mysql_bigquery_sync(request):
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
    
    # Table filtering (optional - for backfills of specific tables)
    tables_param = request_json.get('tables', '')  # Comma-separated list or array
    if isinstance(tables_param, list):
        allowed_tables = set(tables_param) if tables_param else None
    else:
        allowed_tables = set(tables_param.split(',')) if tables_param else None
    
    def should_process_table(table_name):
        """Check if table should be processed based on allowed_tables filter"""
        if allowed_tables is None:
            return True  # Process all tables if no filter specified
        return table_name in allowed_tables
    
    logger.info(f"Starting YTJobs MySQL → BigQuery sync (mode={sync_mode}, tables={tables_param or 'all'})")
    
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
            # 7. PAYMENT SESSIONS (for GA4 Attribution)
            # ============================================
            logger.info("Fetching payment sessions for GA4 attribution...")
            cursor.execute("""
                SELECT 
                    ps.stripe_session_id,
                    ps.stripe_customer_id,
                    ps.amount_total,
                    ps.amount_subtotal,
                    ps.payment_status,
                    ps.created_at,
                    c.id as company_id,
                    u.id as user_id,
                    p.job_id,
                    p.product
                FROM payment_sessions ps
                LEFT JOIN companies c ON ps.stripe_customer_id = c.stripe_id
                LEFT JOIN users u ON ps.stripe_customer_id = u.stripe_id
                LEFT JOIN payments p ON ps.stripe_session_id = p.stripe_session_id
                WHERE ps.created_at >= %s AND ps.created_at < %s
                ORDER BY ps.created_at
            """, (start_date, end_date + timedelta(days=1)))
            
            for row in cursor.fetchall():
                date_str = row['created_at'].date().isoformat()
                rows.append({
                    'organization_id': organization_id,
                    'date': date_str,
                    'canonical_entity_id': f"payment_session_{row['stripe_session_id']}",
                    'entity_type': 'payment_session',
                    'revenue': safe_float(row['amount_total']) / 100,
                    'conversions': 1,
                    'source_breakdown': to_json({
                        'stripe_session_id': row['stripe_session_id'],
                        'stripe_customer_id': row['stripe_customer_id'],
                        'payment_status': row['payment_status'],
                        'company_id': row['company_id'],
                        'user_id': row['user_id'],
                        'job_id': row['job_id'],
                        'product': row['product'],
                        'amount_total': safe_float(row['amount_total']) / 100,
                        'amount_subtotal': safe_float(row['amount_subtotal']) / 100,
                    }),
                    'created_at': now_iso,
                    'updated_at': now_iso,
                })
                results['payments_processed'] += 1
            
            logger.info(f"Processed {len([r for r in rows if r['entity_type'] == 'payment_session'])} payment sessions")
            
            # ============================================
            # 8. DAILY JOB VIEWS
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
            # 9. DAILY PROFILE VIEWS
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
            # 10. DAILY REVIEWS
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
            # 11. MARKETPLACE HEALTH SNAPSHOT (Daily)
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
            
            # ============================================
            # 12. BOOKINGS (Consultation Revenue)
            # ============================================
            if should_process_table('bookings'):
                logger.info("Fetching bookings (consultation revenue)...")
                cursor.execute("""
                    SELECT 
                        b.*,
                        c.name as company_name,
                        u.name as talent_name
                    FROM bookings b
                    LEFT JOIN companies c ON b.booker_id = c.id AND b.booker_type = 'App\\\\Company'
                    LEFT JOIN users u ON b.bookable_id = u.id AND b.bookable_type = 'App\\\\User'
                    WHERE b.created_at >= %s AND b.created_at < %s
                    ORDER BY b.created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"booking_{row['id']}",
                        'entity_type': 'booking',
                        'revenue': safe_float(row['price']) / 100,
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'booking_id': row['id'],
                            'company_id': row['booker_id'],
                            'company_name': row['company_name'],
                            'talent_id': row['bookable_id'],
                            'talent_name': row['talent_name'],
                            'price': safe_float(row['price']) / 100,
                            'status': row['status'],
                            'booked_for': row['booked_for'].isoformat() if row['booked_for'] else None,
                            'event_type_id': row['event_type_id'],
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 13. ONE CLICK HIRINGS (Instant Hires)
            # ============================================
            if should_process_table('one_click_hirings'):
                logger.info("Fetching one-click hirings...")
                cursor.execute("""
                    SELECT *
                    FROM one_click_hirings
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"one_click_hiring_{row['id']}",
                        'entity_type': 'one_click_hiring',
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'hiring_id': row['id'],
                            'company_id': row.get('company_id'),
                            'user_id': row.get('user_id'),
                            'status': row.get('status'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 14. COMPANIES LTV (Pre-calculated) - Only on full sync
            # ============================================
            # Skip if explicit table filter is set (backfill mode)
            if should_process_table('companies_ltv') and allowed_tables is None and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching companies LTV (snapshot)...")
                cursor.execute("SELECT * FROM companies_ltv LIMIT 5000")
                ltv_rows = cursor.fetchall()
                
                if ltv_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"companies_ltv_snapshot_{today_str}",
                        'entity_type': 'companies_ltv_snapshot',
                        'source_breakdown': to_json({
                            'ltv_data': [dict(row) for row in ltv_rows],
                            'snapshot_date': today_str,
                            'record_count': len(ltv_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 15. COMPANIES RFM (Customer Segmentation) - Only on full sync
            # ============================================
            # Skip if explicit table filter is set (backfill mode)
            if should_process_table('companies_rfm') and allowed_tables is None and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching companies RFM scores...")
                cursor.execute("SELECT * FROM companies_rfm LIMIT 5000")
                rfm_rows = cursor.fetchall()
                
                if rfm_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"companies_rfm_snapshot_{today_str}",
                        'entity_type': 'companies_rfm_snapshot',
                        'source_breakdown': to_json({
                            'rfm_data': [dict(row) for row in rfm_rows],
                            'snapshot_date': today_str,
                            'record_count': len(rfm_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 16. USERS RFM (Talent Segmentation) - Only on full sync
            # ============================================
            # Skip if explicit table filter is set (backfill mode)
            if should_process_table('users_rfm') and allowed_tables is None and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching users RFM scores...")
                cursor.execute("SELECT * FROM users_rfm LIMIT 1000")
                user_rfm_rows = cursor.fetchall()
                
                if user_rfm_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"users_rfm_snapshot_{today_str}",
                        'entity_type': 'users_rfm_snapshot',
                        'source_breakdown': to_json({
                            'rfm_data': [dict(row) for row in user_rfm_rows],
                            'snapshot_date': today_str,
                            'record_count': len(user_rfm_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 17. USER STATS (Mautic Integration)
            # ============================================
            if should_process_table('user_stats'):
                logger.info("Fetching user stats...")
                cursor.execute("""
                    SELECT *
                    FROM user_stats
                    WHERE updated_at >= %s
                    ORDER BY updated_at
                """, (start_date,))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['updated_at'].date().isoformat(),
                        'canonical_entity_id': f"user_stat_{row['user_id']}_{row['updated_at'].date().isoformat()}",
                        'entity_type': 'user_stat',
                        'source_breakdown': to_json({
                            'user_id': row['user_id'],
                            'mautic_id': row.get('mautic_id'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 18. USERS KPI (24 Comprehensive KPIs) - Only on full sync
            # ============================================
            if should_process_table('users_kpi') and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching users KPI...")
                cursor.execute("SELECT * FROM users_kpi ORDER BY created_at DESC LIMIT 100")
                kpi_rows = cursor.fetchall()
                
                if kpi_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"users_kpi_snapshot_{today_str}",
                        'entity_type': 'users_kpi_snapshot',
                        'source_breakdown': to_json({
                            'kpi_data': [dict(row) for row in kpi_rows],
                            'snapshot_date': today_str,
                            'record_count': len(kpi_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 19. AFFILIATES (Referral Tracking)
            # ============================================
            if should_process_table('affiliates'):
                logger.info("Fetching affiliates...")
                cursor.execute("""
                    SELECT *
                    FROM affiliates
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"affiliate_{row['id']}",
                        'entity_type': 'affiliate',
                        'source_breakdown': to_json({
                            'affiliate_id': row['id'],
                            'owner_id': row.get('owner_id'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 20. STRIPE COUPONS + USAGE
            # ============================================
            if should_process_table('stripe_coupons') and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching stripe coupons...")
                cursor.execute("SELECT * FROM stripe_coupons LIMIT 500")
                coupon_rows = cursor.fetchall()
                
                if coupon_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"stripe_coupons_snapshot_{today_str}",
                        'entity_type': 'stripe_coupons_snapshot',
                        'source_breakdown': to_json({
                            'coupons': [dict(row) for row in coupon_rows],
                            'snapshot_date': today_str,
                            'record_count': len(coupon_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            if should_process_table('couponables'):
                logger.info("Fetching coupon usage...")
                cursor.execute("""
                    SELECT *
                    FROM couponables
                    LIMIT 10000
                """)
                
                for row in cursor.fetchall():
                    # Couponables is a pivot table - use today's date for grouping
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"coupon_usage_{row['stripe_coupon_id']}_{row['couponable_id']}",
                        'entity_type': 'coupon_usage',
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'coupon_id': row['stripe_coupon_id'],
                            'couponable_id': row['couponable_id'],
                            'couponable_type': row.get('couponable_type'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 21. CHARGES (Payment Details, Refunds)
            # ============================================
            if should_process_table('charges'):
                logger.info("Fetching charges...")
                cursor.execute("""
                    SELECT *
                    FROM charges
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    status = row.get('status', '')
                    amount = safe_float(row.get('amount', 0)) / 100
                    amount_captured = safe_float(row.get('amount_captured', 0)) / 100
                    amount_refunded = safe_float(row.get('amount_refunded', 0)) / 100
                    
                    # Only count revenue for succeeded charges, and subtract refunds
                    revenue = (amount_captured - amount_refunded) if status == 'succeeded' else 0
                    
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"charge_{row['stripe_id']}",
                        'entity_type': 'charge',
                        'revenue': revenue,
                        'conversions': 1 if status == 'succeeded' else 0,
                        'source_breakdown': to_json({
                            'stripe_id': row['stripe_id'],
                            'payment_intent_id': row.get('payment_intent_id'),
                            'amount': amount,
                            'amount_captured': amount_captured,
                            'amount_refunded': amount_refunded,
                            'status': status,
                            'failure_code': row.get('failure_code'),
                            'failure_message': row.get('failure_message'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 22. PAYMENT INTENTS (Payment Lifecycle)
            # ============================================
            if should_process_table('payment_intents'):
                logger.info("Fetching payment intents...")
                cursor.execute("""
                    SELECT *
                    FROM payment_intents
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    status = row.get('status', '')
                    amount = safe_float(row.get('amount', 0)) / 100
                    
                    # Only count revenue for succeeded payment intents
                    revenue = amount if status == 'succeeded' else 0
                    
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"payment_intent_{row['stripe_id']}",
                        'entity_type': 'payment_intent',
                        'revenue': revenue,
                        'conversions': 1 if status == 'succeeded' else 0,
                        'source_breakdown': to_json({
                            'stripe_id': row['stripe_id'],
                            'amount': amount,
                            'status': status,
                            'amount_received': safe_float(row.get('amount_received', 0)) / 100,
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 23. VOUCHES (Social Proof)
            # ============================================
            if should_process_table('vouches'):
                logger.info("Fetching vouches...")
                cursor.execute("""
                    SELECT *
                    FROM vouches
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"vouch_{row['id']}",
                        'entity_type': 'vouch',
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'vouch_id': row['id'],
                            'vouchable_id': row.get('vouchable_id'),
                            'vouched_by_id': row.get('vouched_by_id'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 24. TESTIMONIALS
            # ============================================
            if should_process_table('testimonials'):
                logger.info("Fetching testimonials...")
                cursor.execute("""
                    SELECT *
                    FROM testimonials
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"testimonial_{row['id']}",
                        'entity_type': 'testimonial',
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'testimonial_id': row['id'],
                            'writer_id': row.get('writer_id'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 25. FEEDBACK
            # ============================================
            if should_process_table('feedback'):
                logger.info("Fetching feedback...")
                cursor.execute("""
                    SELECT *
                    FROM feedback
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"feedback_{row['id']}",
                        'entity_type': 'feedback',
                        'source_breakdown': to_json({
                            'feedback_id': row['id'],
                            'writer_id': row.get('writer_id'),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            # ============================================
            # 26. GAMIFICATION (Leaderboards, Badges) - Only on full sync
            # ============================================
            if should_process_table('leaderboards') and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching leaderboards...")
                cursor.execute("SELECT * FROM leaderboards LIMIT 100")
                leaderboard_rows = cursor.fetchall()

                if leaderboard_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"leaderboards_snapshot_{today_str}",
                        'entity_type': 'leaderboards_snapshot',
                        'source_breakdown': to_json({
                            'leaderboards': [sanitize_row(dict(row)) for row in leaderboard_rows],
                            'snapshot_date': today_str,
                            'record_count': len(leaderboard_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            if should_process_table('badges') and (sync_mode == 'full' or (end_date - start_date).days >= 30):
                logger.info("Fetching badges...")
                cursor.execute("SELECT * FROM badges LIMIT 100")
                badge_rows = cursor.fetchall()
                
                if badge_rows:
                    rows.append({
                        'organization_id': organization_id,
                        'date': today_str,
                        'canonical_entity_id': f"badges_snapshot_{today_str}",
                        'entity_type': 'badges_snapshot',
                        'source_breakdown': to_json({
                            'badges': [sanitize_row(dict(row)) for row in badge_rows],
                            'snapshot_date': today_str,
                            'record_count': len(badge_rows),
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            if should_process_table('users_badges'):
                logger.info("Fetching users_badges...")
                cursor.execute("""
                    SELECT *
                    FROM users_badges
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at
                """, (start_date, end_date + timedelta(days=1)))
                
                for row in cursor.fetchall():
                    rows.append({
                        'organization_id': organization_id,
                        'date': row['created_at'].date().isoformat(),
                        'canonical_entity_id': f"user_badge_{row['user_id']}_{row['badge_id']}",
                        'entity_type': 'user_badge',
                        'conversions': 1,
                        'source_breakdown': to_json({
                            'user_id': row['user_id'],
                            'badge_id': row['badge_id'],
                        }),
                        'created_at': now_iso,
                        'updated_at': now_iso,
                    })
            
            logger.info(f"Total new tables processed: booking, one_click_hiring, LTV, RFM, affiliates, coupons, charges, social proof, gamification")
            
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
            
            # Check if data already exists for this exact date range
            check_query = f"""
            SELECT COUNT(*) as record_count
            FROM `{table_ref}`
            WHERE organization_id = '{organization_id}'
              AND date >= '{start_date.isoformat()}' AND date <= '{end_date.isoformat()}'
              AND entity_type IN (
                'talent_signups', 'company_signups', 'jobs_posted', 
                'applications', 'hires', 'marketplace_revenue'
              )
            """
            existing_count = list(bq.query(check_query).result())[0].record_count
            logger.info(f"Found {existing_count} existing records for {start_date} to {end_date}")
            
            # Use MERGE (upsert) to prevent duplicates from concurrent syncs
            # This is safer than DELETE+INSERT which has a race condition
            logger.info(f"Upserting {len(rows)} rows using MERGE...")
            
            # Create temp table for MERGE source
            temp_table_id = f"temp_ytjobs_sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            temp_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{temp_table_id}"
            
            # Get target table schema
            target_table = bq.get_table(table_ref)
            temp_schema = target_table.schema
            
            # Create temp table
            temp_table = bigquery.Table(temp_table_ref, schema=temp_schema)
            temp_table = bq.create_table(temp_table, exists_ok=True)
            
            try:
                # Insert rows into temp table in batches
                BATCH_SIZE = 500
                inserted = 0
                for i in range(0, len(rows), BATCH_SIZE):
                    batch = [sanitize_row(row) for row in rows[i:i + BATCH_SIZE]]
                    errors = bq.insert_rows_json(temp_table_ref, batch, skip_invalid_rows=True, ignore_unknown_values=True)
                    if errors:
                        logger.warning(f"Temp table insert errors: {errors[:3]}")
                    else:
                        inserted += len(batch)
                
                logger.info(f"Inserted {inserted} rows into temp table")
                
                # MERGE from temp table into target (upsert by canonical_entity_id + date)
                merge_query = f"""
                MERGE `{table_ref}` T
                USING `{temp_table_ref}` S
                ON T.organization_id = S.organization_id
                   AND T.canonical_entity_id = S.canonical_entity_id
                   AND T.date = S.date
                   AND T.entity_type = S.entity_type
                WHEN MATCHED THEN
                  UPDATE SET
                    users = S.users,
                    sessions = S.sessions,
                    conversions = S.conversions,
                    revenue = S.revenue,
                    pageviews = S.pageviews,
                    source_breakdown = S.source_breakdown,
                    updated_at = S.updated_at
                WHEN NOT MATCHED THEN
                  INSERT (organization_id, date, canonical_entity_id, entity_type, users, sessions, conversions, revenue, pageviews, source_breakdown, created_at, updated_at)
                  VALUES (S.organization_id, S.date, S.canonical_entity_id, S.entity_type, S.users, S.sessions, S.conversions, S.revenue, S.pageviews, S.source_breakdown, S.created_at, S.updated_at)
                """
                
                merge_result = bq.query(merge_query).result()
                logger.info(f"✅ MERGE complete - upserted {inserted} rows (preventing duplicates)")
                
            finally:
                # Clean up temp table
                try:
                    bq.delete_table(temp_table_ref, not_found_ok=True)
                    logger.info(f"Cleaned up temp table {temp_table_id}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temp table: {cleanup_error}")
            
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

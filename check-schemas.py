import pymysql
import sshtunnel

# SSH and MySQL credentials
ssh_host = "3.15.192.9"
ssh_port = 22
ssh_user = "ubuntu"
ssh_key = "/Users/markhenderson/Cursor Projects/OpsOS/keys/yt-jobs-mysql.pem"

mysql_host = "ytjobs-db.cbppzxbmghj0.us-east-2.rds.amazonaws.com"
mysql_port = 3306
mysql_user = "readonly_user"
mysql_pass = "readonly_pass_2024"
mysql_db = "ytjobs"

# Check schemas for these tables
tables_to_check = [
    'bookings',
    'one_click_hirings',
    'user_stats',
    'affiliates',
    'couponables',
    'charges',
    'payment_intents',
    'vouches',
    'testimonials',
    'feedback',
    'users_badges'
]

with sshtunnel.SSHTunnelForwarder(
    (ssh_host, ssh_port),
    ssh_username=ssh_user,
    ssh_pkey=ssh_key,
    remote_bind_address=(mysql_host, mysql_port)
) as tunnel:
    conn = pymysql.connect(
        host='127.0.0.1',
        port=tunnel.local_bind_port,
        user=mysql_user,
        password=mysql_pass,
        database=mysql_db,
        cursorclass=pymysql.cursors.DictCursor
    )
    
    cursor = conn.cursor()
    
    for table in tables_to_check:
        print(f"\n{'='*60}")
        print(f"Table: {table}")
        print('='*60)
        try:
            cursor.execute(f"DESCRIBE {table}")
            columns = cursor.fetchall()
            timestamp_cols = [col['Field'] for col in columns if 'created' in col['Field'].lower() or 'updated' in col['Field'].lower() or 'at' in col['Field'].lower()]
            print(f"Timestamp columns: {timestamp_cols}")
            if not any('created' in col.lower() for col in timestamp_cols):
                print(f"⚠️  WARNING: No 'created' column found in {table}!")
        except Exception as e:
            print(f"ERROR: {e}")
    
    conn.close()

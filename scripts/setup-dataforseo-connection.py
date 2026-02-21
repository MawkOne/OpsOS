#!/usr/bin/env python3
"""
Setup DataForSEO connection in Firestore so nightly sync can find it
"""

from google.cloud import firestore
from datetime import datetime

PROJECT_ID = "opsos-864a1"
ORG_ID = "SBjucW1ztDyFYWBz7ZLE"

db = firestore.Client(project=PROJECT_ID)

# Check if connection already exists
doc_ref = db.collection('dataforseo_connections').document(ORG_ID)
doc = doc_ref.get()

if doc.exists:
    data = doc.to_dict()
    print(f"✅ DataForSEO connection already exists:")
    print(f"   Status: {data.get('status')}")
    print(f"   Domain: {data.get('domain')}")
    print(f"   Last sync: {data.get('last_sync')}")
else:
    print("❌ No DataForSEO connection found. Creating one...")
    
    # Get credentials from existing connection or prompt
    print("\nℹ️  You need DataForSEO credentials (login and password)")
    print("   Get them from: https://app.dataforseo.com/api-access")
    
    login = input("DataForSEO login (email): ").strip()
    password = input("DataForSEO password: ").strip()
    domain = input("Target domain (e.g., ytjobs.co): ").strip()
    
    if not login or not password or not domain:
        print("❌ All fields are required")
        exit(1)
    
    # Create connection
    connection_data = {
        'organization_id': ORG_ID,
        'status': 'connected',
        'login': login,
        'password': password,
        'domain': domain,
        'created_at': datetime.utcnow(),
        'last_sync': None,
        'sync_frequency': 'daily',
        'features_enabled': {
            'keywords': True,
            'backlinks': True,
            'historical': True
        }
    }
    
    doc_ref.set(connection_data)
    print(f"\n✅ DataForSEO connection created for {ORG_ID}")
    print(f"   Domain: {domain}")
    print(f"   Nightly sync will now run automatically at midnight UTC")

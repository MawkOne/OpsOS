"""
Diagnostic Script - Check Firestore Data Structure
Helps understand why daily rollup ETL might not be processing certain collections
"""

from google.cloud import firestore
import json

db = firestore.Client()

ORG_ID = "SBjucW1ztDyFYWBz7ZLE"

def check_collection(collection_name: str, limit: int = 5):
    """Check structure of a Firestore collection"""
    print(f"\n{'='*60}")
    print(f"📋 Collection: {collection_name}")
    print(f"{'='*60}")
    
    try:
        docs = db.collection(collection_name).where('organizationId', '==', ORG_ID).limit(limit).stream()
        
        doc_count = 0
        for doc in docs:
            doc_count += 1
            data = doc.to_dict()
            print(f"\n📄 Document {doc_count}: {doc.id}")
            print(f"   Fields: {list(data.keys())}")
            
            # Check for date/time fields
            time_fields = [k for k in data.keys() if any(x in k.lower() for x in ['date', 'month', 'year', 'time', 'created', 'updated'])]
            if time_fields:
                print(f"   Time fields: {time_fields}")
                for tf in time_fields:
                    print(f"     {tf}: {data.get(tf)} (type: {type(data.get(tf)).__name__})")
            
            # Show first few key fields
            key_fields = ['pagePath', 'pageTitle', 'campaignName', 'keyword', 'name', 'sessions', 'pageviews', 'conversions', 'revenue']
            present_fields = {k: data.get(k) for k in key_fields if k in data}
            if present_fields:
                print(f"   Data sample: {json.dumps(present_fields, indent=6, default=str)[:200]}...")
        
        if doc_count == 0:
            print("   ❌ No documents found (collection might be empty or organizationId mismatch)")
        else:
            print(f"\n   ✅ Found {doc_count}+ documents")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")


if __name__ == "__main__":
    print(f"\n🔍 FIRESTORE DATA STRUCTURE DIAGNOSTIC")
    print(f"Organization ID: {ORG_ID}\n")
    
    collections_to_check = [
        'ga_pages',
        'ga_campaigns',
        'dataforseo_keywords',
        'stripe_products',
        'stripe_invoices',
        'activecampaign_campaigns'
    ]
    
    for collection in collections_to_check:
        check_collection(collection)
    
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    print("\nIf collections are empty or missing month/year fields:")
    print("1. Check if organizationId matches")
    print("2. Check if data has been synced from sources")
    print("3. Check field names in Firestore console")
    print("\nExpected fields for daily rollup:")
    print("  ga_pages: month, year, pagePath, sessions, pageviews, etc.")
    print("  ga_campaigns: month, year, campaignName, sessions, conversions, revenue, cost")
    print("  dataforseo_keywords: keyword, position, searchVolume")
    print("  stripe_invoices: date, productId, amount")
    print("  activecampaign_campaigns: send_date, name, total_sent, total_opens, total_clicks")

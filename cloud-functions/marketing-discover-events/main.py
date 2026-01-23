"""
Cloud Function: Discover Marketing Events
Deployed to: projects/opsos-864a1/locations/us-central1/functions/marketing-discover-events
"""

import functions_framework
from google.cloud import bigquery
import json

@functions_framework.http
def discover_events(request):
    """HTTP Cloud Function to discover marketing events."""
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    # Handle preflight
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    # Get parameters
    organization_id = request.args.get('organizationId', 'SBjucW1ztDyFYWBz7ZLE')
    
    try:
        # Initialize BigQuery client
        client = bigquery.Client(project='opsos-864a1')
        
        # Query events
        query = """
            SELECT 
                JSON_VALUE(data, '$.eventName') as event_name,
                data
            FROM `opsos-864a1.firestore_export.ga_events_raw_latest`
            WHERE JSON_VALUE(data, '$.organizationId') = @org_id
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
            ]
        )
        
        query_job = client.query(query, job_config=job_config)
        rows = query_job.result()
        
        # Process results
        events = []
        for row in rows:
            event_name = row.event_name
            data = json.loads(row.data) if isinstance(row.data, str) else row.data
            
            # Extract months data
            months = data.get('months', {})
            month_keys = sorted(months.keys(), reverse=True)
            
            # Calculate totals
            total_count = sum(m.get('events', m.get('eventCount', 0)) for m in months.values())
            last_month = month_keys[0] if month_keys else ''
            
            # Categorize
            name_lower = event_name.lower()
            if 'page_view' in name_lower or 'first_visit' in name_lower or 'session_start' in name_lower:
                category = 'Acquisition'
            elif 'signup' in name_lower or 'sign_up' in name_lower or 'conversion' in name_lower or 'verified' in name_lower or 'form_submit' in name_lower:
                category = 'Activation'
            elif 'purchase' in name_lower or 'checkout' in name_lower or 'cart' in name_lower:
                category = 'Monetization'
            elif 'paywall' in name_lower or 'restriction' in name_lower:
                category = 'Friction'
            elif 'notification' in name_lower or 'email' in name_lower or 'message' in name_lower:
                category = 'Retention'
            else:
                category = 'Engagement'
            
            events.append({
                'eventName': event_name,
                'category': category,
                'totalCount': total_count,
                'lastMonth': last_month
            })
        
        # Group by category
        categorized = {}
        for event in events:
            cat = event['category']
            if cat not in categorized:
                categorized[cat] = []
            categorized[cat].append(event)
        
        # Sort within categories
        for cat in categorized:
            categorized[cat].sort(key=lambda x: x['totalCount'], reverse=True)
        
        # Summary
        summary = {
            'totalEvents': len(events),
            'totalEventCount': sum(e['totalCount'] for e in events),
            'categoryCounts': {cat: len(evts) for cat, evts in categorized.items()}
        }
        
        response = {
            'success': True,
            'summary': summary,
            'events': categorized,
            'organizationId': organization_id
        }
        
        return (json.dumps(response), 200, headers)
        
    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e)
        }
        return (json.dumps(error_response), 500, headers)

"""
Cloud Function: Analyze Traffic Sources
Deployed to: projects/opsos-864a1/locations/us-central1/functions/marketing-analyze-traffic
"""

import functions_framework
from google.cloud import bigquery
import json

@functions_framework.http
def analyze_traffic(request):
    """HTTP Cloud Function to analyze traffic sources."""
    
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
    months = int(request.args.get('months', 3))
    
    try:
        # Initialize BigQuery client
        client = bigquery.Client(project='opsos-864a1')
        
        # Query traffic sources
        query = """
            SELECT 
                JSON_VALUE(data, '$.sourceName') as source_name,
                JSON_VALUE(data, '$.sourceId') as source_id,
                data
            FROM `opsos-864a1.firestore_export.ga_traffic_sources_raw_latest`
            WHERE JSON_VALUE(data, '$.organizationId') = @org_id
            ORDER BY source_name
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("org_id", "STRING", organization_id)
            ]
        )
        
        query_job = client.query(query, job_config=job_config)
        rows = query_job.result()
        
        # Process results
        sources = []
        for row in rows:
            source_name = row.source_name
            source_id = row.source_id
            data = json.loads(row.data) if isinstance(row.data, str) else row.data
            
            # Extract months data
            months_data = data.get('months', {})
            month_keys = sorted(months_data.keys(), reverse=True)[:months]
            
            # Calculate totals
            total_users = 0
            total_sessions = 0
            total_conversions = 0
            total_revenue = 0
            
            for month_key in month_keys:
                month_data = months_data[month_key]
                total_users += month_data.get('users', 0)
                total_sessions += month_data.get('sessions', 0)
                total_conversions += month_data.get('conversions', 0)
                total_revenue += month_data.get('revenue', 0)
            
            # Calculate metrics
            conversion_rate = (total_conversions / total_users * 100) if total_users > 0 else 0
            revenue_per_user = total_revenue / total_users if total_users > 0 else 0
            avg_sessions_per_user = total_sessions / total_users if total_users > 0 else 0
            
            # Calculate quality score (0-10)
            conversion_score = min(conversion_rate * 2, 4)
            revenue_score = min(revenue_per_user / 10, 3)
            engagement_score = min(avg_sessions_per_user, 3)
            quality_score = round((conversion_score + revenue_score + engagement_score) * 10) / 10
            
            sources.append({
                'sourceName': source_name,
                'sourceId': source_id,
                'totalUsers': total_users,
                'totalSessions': total_sessions,
                'totalConversions': total_conversions,
                'totalRevenue': total_revenue,
                'conversionRate': round(conversion_rate, 2),
                'revenuePerUser': round(revenue_per_user, 2),
                'qualityScore': quality_score
            })
        
        # Sort by quality score
        sources.sort(key=lambda x: x['qualityScore'], reverse=True)
        
        # Summary
        summary = {
            'totalSources': len(sources),
            'totalUsers': sum(s['totalUsers'] for s in sources),
            'totalConversions': sum(s['totalConversions'] for s in sources),
            'totalRevenue': sum(s['totalRevenue'] for s in sources),
            'avgConversionRate': round(sum(s['conversionRate'] for s in sources) / len(sources), 2) if sources else 0,
            'topSource': sources[0]['sourceName'] if sources else None,
            'lowestQualitySource': sources[-1]['sourceName'] if sources else None
        }
        
        # Generate insights
        insights = []
        if sources and sources[0]['qualityScore'] >= 7:
            insights.append({
                'type': 'success',
                'title': f"{sources[0]['sourceName']} is your highest quality source",
                'description': f"{sources[0]['conversionRate']}% conversion rate, {sources[0]['totalConversions']} conversions",
                'recommendation': f"Double down on {sources[0]['sourceName']}. This source drives your best users."
            })
        
        if sources and sources[-1]['qualityScore'] < 3:
            worst = sources[-1]
            insights.append({
                'type': 'warning',
                'title': f"{worst['sourceName']} underperforming",
                'description': f"Only {worst['conversionRate']}% conversion rate, quality score {worst['qualityScore']}/10",
                'recommendation': 'Review targeting and landing pages' if 'paid' in worst['sourceId'] else f"Improve content quality for {worst['sourceName']} traffic"
            })
        
        response = {
            'success': True,
            'summary': summary,
            'sources': sources,
            'insights': insights,
            'organizationId': organization_id,
            'analyzedMonths': months
        }
        
        return (json.dumps(response), 200, headers)
        
    except Exception as e:
        error_response = {
            'success': False,
            'error': str(e)
        }
        return (json.dumps(error_response), 500, headers)

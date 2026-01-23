"""
Marketing Optimization Engine - Cloud Function
Runs daily at 6am to analyze marketing data and generate optimization recommendations
"""

import functions_framework
from google.cloud import bigquery, firestore
import json
from datetime import datetime, timedelta
import logging
import numpy as np

# Import our modules
from data_fetcher import fetch_marketing_data
from driver_analysis import analyze_drivers, calculate_driver_health
from opportunity_finder import find_opportunities, prioritize_opportunities
from recommendations import generate_recommendations, format_output
from business_context import fetch_business_context

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def convert_to_json_serializable(obj):
    """Convert numpy/pandas types to Python native types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    else:
        return obj


@functions_framework.http
def marketing_optimization_engine(request):
    """
    Main entry point for Marketing Optimization Engine
    
    Runs the complete optimization analysis:
    1. Fetch marketing data from BigQuery
    2. Analyze driver importance
    3. Identify optimization opportunities
    4. Generate prioritized recommendations
    5. Store results in Firestore
    6. Return summary
    """
    
    # Set CORS headers for all responses
    if request.method == 'OPTIONS':
        # Preflight request
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    # Set CORS headers for actual request
    headers = {
        'Access-Control-Allow-Origin': '*'
    }
    
    try:
        logger.info("🤖 Marketing Optimization Engine starting...")
        start_time = datetime.now()
        
        # Parse request parameters
        request_json = request.get_json(silent=True)
        request_args = request.args
        
        # Configuration
        org_id = (request_json.get('organizationId') if request_json else None) or \
                 request_args.get('organizationId', 'SBjucW1ztDyFYWBz7ZLE')
        goal_kpi = (request_json.get('goalKpi') if request_json else None) or \
                   request_args.get('goalKpi', 'signups')
        target_value = int((request_json.get('targetValue') if request_json else None) or \
                          request_args.get('targetValue', '6000'))
        lookback_days = int((request_json.get('lookbackDays') if request_json else None) or \
                           request_args.get('lookbackDays', '90'))
        channel = (request_json.get('channel') if request_json else None) or \
                  request_args.get('channel', 'all')  # all, advertising, seo, pages, traffic, social, email
        
        logger.info(f"Config: org_id={org_id}, goal_kpi={goal_kpi}, target={target_value}, channel={channel}")
        
        # Step 1: Fetch marketing data
        logger.info(f"📊 Step 1: Fetching marketing data (channel: {channel})...")
        data = fetch_marketing_data(org_id, lookback_days, channel)
        logger.info(f"✅ Fetched {len(data)} months of data with {len(data.columns)} features")
        
        # Step 2: Analyze drivers
        logger.info("🔍 Step 2: Analyzing driver importance...")
        driver_analysis = analyze_drivers(data, goal_kpi)
        driver_health = calculate_driver_health(data, driver_analysis, goal_kpi)
        logger.info(f"✅ Identified {len(driver_analysis['drivers'])} drivers")
        
        # Step 3: Fetch business context
        logger.info("🏢 Step 3: Fetching business context...")
        business_context = fetch_business_context(org_id)
        logger.info(f"✅ Context: {business_context.get('team_size', 0)} team, {len(business_context.get('products', []))} products, {len(business_context.get('initiatives', []))} initiatives")
        
        # Step 4: Find opportunities
        logger.info("💡 Step 4: Identifying optimization opportunities...")
        opportunities = find_opportunities(data, goal_kpi, target_value, driver_analysis)
        logger.info(f"✅ Found {len(opportunities)} opportunities")
        
        # Step 5: Prioritize and generate AI recommendations
        logger.info("🤖 Step 5: Generating AI-powered recommendations with Gemini 3...")
        prioritized = prioritize_opportunities(opportunities)
        recommendations = generate_recommendations(prioritized[:5], business_context, channel)  # Top 5 with context
        logger.info(f"✅ Generated {len(recommendations)} AI recommendations")
        
        # Step 6: Format output
        logger.info("📝 Step 6: Formatting output...")
        output = format_output(
            org_id=org_id,
            goal_kpi=goal_kpi,
            target_value=target_value,
            current_value=data[goal_kpi].iloc[-1] if goal_kpi in data.columns else 0,
            driver_health=driver_health,
            recommendations=recommendations,
            analysis_metadata={
                'channel': channel,
                'lookback_days': lookback_days,
                'num_observations': len(data),
                'num_features': len(data.columns),
                'r_squared': driver_analysis.get('r_squared', 0),
                'execution_time_seconds': (datetime.now() - start_time).total_seconds()
            }
        )
        
        # Step 7: Store in Firestore
        logger.info("💾 Step 7: Storing results in Firestore...")
        store_results(org_id, output)
        
        # Complete
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"✅ Marketing Optimization Engine complete in {duration:.2f}s")
        
        result = {
            'status': 'success',
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': duration,
            'summary': {
                'goal_kpi': goal_kpi,
                'current': output['current_value'],
                'target': output['target_value'],
                'gap': output['gap'],
                'gap_pct': output['gap_pct'],
                'num_recommendations': len(recommendations),
                'total_opportunity': sum(r['expected_lift'] for r in recommendations)
            },
            'recommendations': recommendations
        }
        
        # Convert numpy types to JSON-serializable types
        result = convert_to_json_serializable(result)
        
        return (json.dumps(result, indent=2), 200, headers)
        
    except Exception as e:
        logger.error(f"❌ Error in marketing optimization engine: {str(e)}", exc_info=True)
        return (json.dumps({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }, indent=2), 500, headers)


def store_results(org_id: str, output: dict):
    """Store analysis results in Firestore"""
    try:
        db = firestore.Client()
        
        # Convert all numpy types to Python native types before storing
        firestore_data = {
            'organizationId': org_id,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'goalKpi': output['goal_kpi'],
            'currentValue': float(output['current_value']),
            'targetValue': float(output['target_value']),
            'gap': float(output['gap']),
            'gapPct': float(output['gap_pct']),
            'driverHealth': convert_to_json_serializable(output['driver_health']),
            'recommendations': convert_to_json_serializable(output['recommendations']),
            'metadata': convert_to_json_serializable(output['metadata']),
            'status': 'new'  # Can be: new, viewed, actioned, dismissed
        }
        
        # Store in marketing_insights collection
        doc_ref = db.collection('marketing_insights').document()
        doc_ref.set(firestore_data)
        
        logger.info(f"✅ Stored results in Firestore: {doc_ref.id}")
        
    except Exception as e:
        logger.error(f"⚠️ Failed to store in Firestore: {str(e)}")
        # Don't fail the whole function if Firestore write fails
        pass


# Allow manual trigger for testing
if __name__ == '__main__':
    import flask
    
    app = flask.Flask(__name__)
    
    @app.route('/', methods=['GET', 'POST'])
    def index():
        return marketing_optimization_engine(flask.request)
    
    app.run(host='0.0.0.0', port=8080, debug=True)

"""
OpsOS Marketing Intelligence Agent
Local development with ADK
"""

from google.adk.agents.llm_agent import Agent
import requests
from typing import Dict, Any

# ============================================
# CLOUD FUNCTION URLs (within GCP project)
# ============================================
DISCOVER_EVENTS_URL = "https://marketing-discover-events-bgjb4fnyeq-uc.a.run.app"
ANALYZE_TRAFFIC_URL = "https://marketing-analyze-traffic-bgjb4fnyeq-uc.a.run.app"

# ============================================
# CUSTOM TOOL 1: Discover Marketing Events
# ============================================
def discover_marketing_events(organization_id: str = "SBjucW1ztDyFYWBz7ZLE") -> Dict[str, Any]:
    """
    Discovers and categorizes all marketing events being tracked.
    
    Returns events grouped by category (Acquisition, Activation, Engagement, 
    Monetization, Friction, Retention) with trend analysis.
    
    Args:
        organization_id: The organization to analyze
        
    Returns:
        Dictionary with summary stats and categorized events
    """
    url = f"{DISCOVER_EVENTS_URL}?organizationId={organization_id}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to discover events: {str(e)}'
        }


# ============================================
# CUSTOM TOOL 2: Analyze Traffic Sources
# ============================================
def analyze_traffic_sources(
    organization_id: str = "SBjucW1ztDyFYWBz7ZLE",
    months: int = 3
) -> Dict[str, Any]:
    """
    Analyzes traffic source performance including conversion rates, quality scores, and trends.
    
    Args:
        organization_id: The organization to analyze
        months: Number of recent months to analyze (default: 3)
        
    Returns:
        Dictionary with traffic source analysis and insights
    """
    url = f"{ANALYZE_TRAFFIC_URL}?organizationId={organization_id}&months={months}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to analyze traffic: {str(e)}'
        }


# ============================================
# ROOT AGENT
# ============================================
root_agent = Agent(
    name='Marketing_Intelligence_Agent',
    model='gemini-3-flash-preview',
    description=(
        'Marketing Intelligence AI that analyzes marketing events and traffic sources. '
        'Provides actionable insights about marketing performance, event tracking, '
        'traffic quality, and conversion optimization.'
    ),
    sub_agents=[],
    instruction=(
        'You are a Marketing Intelligence AI for OpsOS. '
        'You have access to real-time marketing data through custom tools. '
        '\n\n'
        'TOOLS AVAILABLE:\n'
        '1. discover_marketing_events() - Use when asked about:\n'
        '   - "What events are we tracking?"\n'
        '   - "Show me event categories"\n'
        '   - "Which events are trending?"\n'
        '   - "What are our top events?"\n'
        '\n'
        '2. analyze_traffic_sources() - Use when asked about:\n'
        '   - "Which traffic source is best?"\n'
        '   - "What should I focus on?"\n'
        '   - "Organic vs paid performance"\n'
        '   - "Traffic quality analysis"\n'
        '\n\n'
        'RESPONSE FORMAT:\n'
        '- Always cite specific numbers from the data\n'
        '- Use emojis for clarity: 📊 (data), 💡 (recommendations), ⚠️ (warnings), ✅ (success)\n'
        '- Provide 1-3 actionable recommendations\n'
        '- Explain WHY something matters, not just WHAT the numbers are\n'
        '\n\n'
        'EXAMPLE RESPONSE:\n'
        '"📊 Based on your last 3 months:\n\n'
        'You\'re tracking 80 events across 6 categories, with 49M total events.\n\n'
        '⚠️ Concern: 65 events (81%) are trending down, only 7 trending up.\n\n'
        '💡 Recommendations:\n'
        '1. Investigate the decline - could be seasonal or data collection issue\n'
        '2. Focus on your top 3 events: scroll (6.4M), user_engagement (5.1M), click (882K)\n'
        '3. Review why engagement metrics are dropping"\n'
    ),
    tools=[
        discover_marketing_events,
        analyze_traffic_sources,
    ],
)

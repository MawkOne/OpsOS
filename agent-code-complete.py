# OpsOS Marketing Intelligence Agent
# Add this to your Vertex AI Agent code editor

from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
import requests
from typing import Dict, Any

# ============================================
# CUSTOM TOOL 1: Discover Marketing Events
# ============================================
@agent_tool
def discover_marketing_events(organization_id: str = "SBjucW1ztDyFYWBz7ZLE") -> Dict[str, Any]:
    """
    Discovers and categorizes all marketing events being tracked.
    
    Returns events grouped by category (Acquisition, Activation, Engagement, 
    Monetization, Friction, Retention) with trend analysis.
    
    Args:
        organization_id: The organization to analyze (default: SBjucW1ztDyFYWBz7ZLE)
        
    Returns:
        Dictionary with summary stats and categorized events
    """
    url = f"https://opsos-app.vercel.app/api/agents/marketing/discover-events?organizationId={organization_id}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Return simplified response for the agent
        if data.get('success'):
            return {
                'success': True,
                'total_events': data['summary']['totalEvents'],
                'categories': data['summary']['categoryCounts'],
                'trending_up': data['summary']['trendingUp'],
                'trending_down': data['summary']['trendingDown'],
                'top_events': {
                    category: [
                        {'name': e['eventName'], 'count': e['totalCount'], 'trend': e['trend']}
                        for e in events[:3]  # Top 3 per category
                    ]
                    for category, events in data['events'].items()
                }
            }
        return data
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to discover events: {str(e)}'
        }


# ============================================
# CUSTOM TOOL 2: Analyze Traffic Sources
# ============================================
@agent_tool
def analyze_traffic_sources(
    organization_id: str = "SBjucW1ztDyFYWBz7ZLE",
    months: int = 3
) -> Dict[str, Any]:
    """
    Analyzes traffic source performance including conversion rates, quality scores, and trends.
    
    Provides actionable insights about which sources drive the best users.
    
    Args:
        organization_id: The organization to analyze (default: SBjucW1ztDyFYWBz7ZLE)
        months: Number of recent months to analyze (default: 3)
        
    Returns:
        Dictionary with traffic source analysis and insights
    """
    url = f"https://opsos-app.vercel.app/api/agents/marketing/analyze-traffic?organizationId={organization_id}&months={months}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Return simplified response for the agent
        if data.get('success'):
            return {
                'success': True,
                'summary': data['summary'],
                'top_3_sources': data['sources'][:3],  # Top 3 highest quality
                'bottom_3_sources': data['sources'][-3:],  # Bottom 3 lowest quality
                'insights': data['insights'],
                'analyzed_months': data['analyzedMonths']
            }
        return data
    except Exception as e:
        return {
            'success': False,
            'error': f'Failed to analyze traffic: {str(e)}'
        }


# ============================================
# AGENT CONFIGURATION
# ============================================

# Your existing agents (keep these if you want Google Search & URL context)
my_agent_google_search_agent = LlmAgent(
    name='My_Agent_google_search_agent',
    model='gemini-3-flash-preview',
    description='Agent specialized in performing Google searches.',
    sub_agents=[],
    instruction='Use the GoogleSearchTool to find information on the web.',
    tools=[GoogleSearchTool()],
)

my_agent_url_context_agent = LlmAgent(
    name='My_Agent_url_context_agent',
    model='gemini-3-flash-preview',
    description='Agent specialized in fetching content from URLs.',
    sub_agents=[],
    instruction='Use the UrlContextTool to retrieve content from provided URLs.',
    tools=[url_context],
)

# ROOT AGENT - Replace your existing root_agent with this
root_agent = LlmAgent(
    name='Marketing_Intelligence_Agent',
    model='gemini-3-flash-preview',
    description=(
        'Marketing Intelligence AI that analyzes marketing events and traffic sources. '
        'Provides actionable insights about marketing performance, event tracking, '
        'traffic quality, and conversion optimization.'
    ),
    sub_agents=[my_agent_google_search_agent, my_agent_url_context_agent],
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
        '\n'
        '3. External Research Tools - Use when asked to:\n'
        '   - Search Google for broader context\n'
        '   - Read content from specific URLs\n'
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
        agent_tool.AgentTool(agent=my_agent_google_search_agent),
        agent_tool.AgentTool(agent=my_agent_url_context_agent),
    ],
)

"""
Vertex AI Agent Tools for OpsOS Marketing AI
Uses Google ADK (Agent Development Kit)
"""

from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
import requests
from typing import Dict, Any

# Custom Tool 1: Discover Marketing Events
@agent_tool
def discover_marketing_events(organization_id: str = "SBjucW1ztDyFYWBz7ZLE") -> Dict[str, Any]:
    """
    Discovers and categorizes all marketing events being tracked.
    
    Returns events grouped by category (Acquisition, Activation, Engagement, 
    Monetization, Friction, Retention) with trend analysis.
    
    Args:
        organization_id: The organization to analyze (default: SBjucW1ztDyFYWBz7ZLE)
        
    Returns:
        Dict containing:
        - summary: Overall statistics (total events, category counts, trending events)
        - events: Events grouped by category with trend data
        - organizationId: The analyzed organization
    """
    url = f"https://opsos-app.vercel.app/api/agents/marketing/discover-events?organizationId={organization_id}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Failed to discover events: {str(e)}"
        }


# Custom Tool 2: Analyze Traffic Sources
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
        Dict containing:
        - summary: Overall statistics (total sources, users, conversions, revenue)
        - sources: Array of traffic sources with quality scores and performance metrics
        - insights: Automated insights about best/worst performing sources
        - organizationId: The analyzed organization
        - analyzedMonths: Number of months analyzed
    """
    url = f"https://opsos-app.vercel.app/api/agents/marketing/analyze-traffic?organizationId={organization_id}&months={months}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"Failed to analyze traffic: {str(e)}"
        }


# Marketing Intelligence Agent (uses the custom tools)
marketing_events_agent = LlmAgent(
    name='Marketing_Events_Agent',
    model='gemini-3-flash-preview',
    description=(
        'Agent specialized in analyzing marketing events and categorizing them '
        'by business function (Acquisition, Activation, Engagement, etc.)'
    ),
    sub_agents=[],
    instruction=(
        'Use the discover_marketing_events tool to get all tracked events. '
        'Analyze the data and provide clear insights about event trends and categories.'
    ),
    tools=[discover_marketing_events],
)

marketing_traffic_agent = LlmAgent(
    name='Marketing_Traffic_Agent',
    model='gemini-3-flash-preview',
    description=(
        'Agent specialized in analyzing traffic source performance and quality. '
        'Provides insights about which channels drive the best users.'
    ),
    sub_agents=[],
    instruction=(
        'Use the analyze_traffic_sources tool to evaluate traffic sources. '
        'Calculate quality scores, identify top performers, and provide actionable recommendations.'
    ),
    tools=[analyze_traffic_sources],
)

# Root Marketing AI Agent
marketing_ai_root = LlmAgent(
    name='Marketing_Intelligence_Agent',
    model='gemini-3-flash-preview',
    description=(
        'Marketing Intelligence AI that analyzes events and traffic sources to provide '
        'actionable insights about marketing performance. Can answer questions about '
        'what events are being tracked, which traffic sources perform best, and why '
        'certain metrics are trending up or down.'
    ),
    sub_agents=[marketing_events_agent, marketing_traffic_agent],
    instruction=(
        'You are a Marketing Intelligence AI for OpsOS. '
        'When users ask about marketing events, use the Marketing_Events_Agent. '
        'When users ask about traffic sources or which channels to focus on, use the Marketing_Traffic_Agent. '
        'Always provide specific numbers from the data and actionable recommendations. '
        'Format responses clearly with emojis for readability (📊 for data, 💡 for recommendations, ⚠️ for warnings).'
    ),
    tools=[
        agent_tool.AgentTool(agent=marketing_events_agent),
        agent_tool.AgentTool(agent=marketing_traffic_agent),
        GoogleSearchTool(),  # Can search web for context if needed
        url_context  # Can fetch content from URLs
    ],
)

# Export the root agent
root_agent = marketing_ai_root

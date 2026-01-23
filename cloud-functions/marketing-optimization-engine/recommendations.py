"""
Recommendations Module
Generates actionable recommendations and formats output
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def generate_recommendations(opportunities: list) -> list:
    """
    Convert opportunities into actionable recommendations
    
    Args:
        opportunities: Prioritized list of opportunities
    
    Returns:
        List of actionable recommendations
    """
    
    recommendations = []
    
    for opp in opportunities:
        rec = {
            'id': f"rec_{datetime.now().strftime('%Y%m%d')}_{opp['rank']}",
            'rank': opp['rank'],
            'priority': opp['priority_label'],
            'driver': opp['driver'],
            'type': opp['type'],
            'title': generate_title(opp),
            'description': generate_description(opp),
            'rationale': opp['rationale'],
            'expected_lift': round(opp['expected_lift'], 0),
            'pct_of_gap_closed': round(opp['pct_of_gap_closed'] * 100, 1),
            'effort': opp['effort_estimate'],
            'confidence': opp['confidence'],
            'current_value': round(opp['current_value'], 2),
            'target_value': round(opp['benchmark_value'], 2),
            'gap_pct': round(opp['gap_pct'] * 100, 1),
            'actions': generate_action_items(opp),
            'success_metrics': generate_success_metrics(opp),
            'timeline': estimate_timeline(opp)
        }
        
        recommendations.append(rec)
    
    logger.info(f"✅ Generated {len(recommendations)} recommendations")
    
    return recommendations


def generate_title(opp: dict) -> str:
    """Generate concise title for the recommendation"""
    
    driver = opp['driver'].replace('_', ' ').title()
    
    if opp['type'] == 'improve_driver':
        if 'email' in opp['driver'].lower():
            return f"Scale Email Marketing"
        elif 'video' in opp['driver'].lower():
            return f"Expand Video Content"
        elif 'search' in opp['driver'].lower():
            return f"Boost Search Engagement"
        elif 'organic' in opp['driver'].lower() or 'seo' in opp['driver'].lower():
            return f"Grow Organic Traffic"
        else:
            return f"Improve {driver}"
    
    elif opp['type'] == 'remove_friction':
        if 'paywall' in opp['driver'].lower():
            return f"Optimize Paywall Frequency"
        elif 'form' in opp['driver'].lower():
            return f"Reduce Form Abandonment"
        elif 'mobile' in opp['driver'].lower():
            return f"Fix Mobile Experience"
        else:
            return f"Reduce {driver}"
    
    return f"Optimize {driver}"


def generate_description(opp: dict) -> str:
    """Generate detailed description of the recommendation"""
    
    driver = opp['driver'].replace('_', ' ')
    current = opp['current_value']
    target = opp['benchmark_value']
    gap_pct = opp['gap_pct'] * 100
    lift = opp['expected_lift']
    
    if opp['type'] == 'improve_driver':
        return f"Increase {driver} from {current:.0f} to {target:.0f} " \
               f"(+{gap_pct:.0f}% improvement). This would add approximately {lift:.0f} " \
               f"signups per month based on its {opp['importance']:.1%} importance."
    else:
        return f"Reduce {driver} from {current:.0f} to {target:.0f} " \
               f"(-{gap_pct:.0f}% reduction). This friction point is currently causing " \
               f"a {abs(opp['importance']):.1%} negative impact on signups. " \
               f"Addressing it could add {lift:.0f} signups per month."


def generate_action_items(opp: dict) -> list:
    """Generate specific action items for the recommendation"""
    
    driver = opp['driver'].lower()
    
    # Paywall optimization
    if 'paywall' in driver:
        return [
            "Update paywall configuration to reduce frequency from 60% to 20% of users",
            "Implement intent scoring to show paywall only to high-intent users",
            "Set up A/B test (Control: current, Treatment: reduced frequency)",
            "Run test for 14 days with 10K users per group",
            "Monitor signup conversion rate and revenue impact"
        ]
    
    # Email marketing
    elif 'email' in driver:
        if 'open_rate' in driver or 'open' in driver:
            return [
                "Analyze top-performing campaigns (Welcome Series has 48% open rate)",
                "A/B test subject lines using proven formats",
                "Increase send frequency from 3/week to 5/week",
                "Segment list and personalize content",
                "Clean list to remove inactive subscribers"
            ]
        elif 'campaigns' in driver:
            return [
                "Scale successful campaigns (e.g., Welcome Series, Product Launch)",
                "Schedule 2 additional campaigns per week",
                "Create campaign calendar for next month",
                "Invest in content creation resources",
                "Track incremental signup lift"
            ]
    
    # Video engagement
    elif 'video' in driver:
        return [
            "Add explainer video to /jobs page hero section",
            "Create short demo videos for key features",
            "Optimize video placement for visibility",
            "Test autoplay vs click-to-play",
            "Track video view rate and completion rate"
        ]
    
    # Organic traffic
    elif 'organic' in driver or 'seo' in driver:
        return [
            "Publish 2-4 SEO-optimized blog posts per month",
            "Target keywords: 'youtube jobs', 'creator marketplace', 'freelance creators'",
            "Improve technical SEO (page speed, mobile experience)",
            "Build backlinks through partnerships",
            "Track organic traffic and keyword rankings monthly"
        ]
    
    # Search usage
    elif 'search' in driver:
        return [
            "Make search bar more prominent on homepage",
            "Add search suggestions and auto-complete",
            "Improve search algorithm relevance",
            "Track search usage rate and result click-through",
            "A/B test search bar placement"
        ]
    
    # Form optimization
    elif 'form' in driver:
        return [
            "Reduce form fields (remove non-essential questions)",
            "Add progress indicator for multi-step forms",
            "Implement autosave to prevent data loss",
            "Improve error messaging and validation",
            "Track form completion rate by field"
        ]
    
    # Default actions
    else:
        return [
            f"Analyze current state of {opp['driver']}",
            f"Identify quick wins to improve performance",
            f"Implement changes and monitor impact",
            f"Measure results against {opp['benchmark_value']:.0f} benchmark"
        ]


def generate_success_metrics(opp: dict) -> list:
    """Define success metrics for tracking the recommendation"""
    
    driver = opp['driver']
    expected_lift = opp['expected_lift']
    
    return [
        {
            'metric': driver,
            'current': round(opp['current_value'], 2),
            'target': round(opp['benchmark_value'], 2),
            'measurement_frequency': 'weekly'
        },
        {
            'metric': 'signups',
            'expected_lift': round(expected_lift, 0),
            'measurement_frequency': 'daily'
        },
        {
            'metric': 'conversion_rate',
            'measurement_frequency': 'daily'
        }
    ]


def estimate_timeline(opp: dict) -> dict:
    """Estimate implementation timeline"""
    
    effort = opp['effort_estimate']
    
    if effort == 'low':
        return {
            'implementation_days': 7,
            'testing_days': 14,
            'results_visible_days': 21,
            'phase': 'quick_win'
        }
    elif effort == 'medium':
        return {
            'implementation_days': 21,
            'testing_days': 30,
            'results_visible_days': 45,
            'phase': 'medium_term'
        }
    else:  # high
        return {
            'implementation_days': 60,
            'testing_days': 60,
            'results_visible_days': 90,
            'phase': 'strategic'
        }


def format_output(org_id: str, goal_kpi: str, target_value: float, current_value: float,
                 driver_health: list, recommendations: list, analysis_metadata: dict) -> dict:
    """
    Format complete output for storage and display
    
    Args:
        org_id: Organization ID
        goal_kpi: Target metric name
        target_value: Goal value
        current_value: Current value
        driver_health: Driver health reports
        recommendations: List of recommendations
        analysis_metadata: Metadata about the analysis
    
    Returns:
        Formatted output dict
    """
    
    gap = target_value - current_value
    gap_pct = gap / target_value if target_value > 0 else 0
    
    # Calculate total opportunity
    total_opportunity = sum(rec['expected_lift'] for rec in recommendations)
    
    # Determine overall status
    if gap_pct > 0.3:
        status = 'needs_attention'
    elif gap_pct > 0.1:
        status = 'on_track'
    else:
        status = 'exceeding_goal'
    
    output = {
        'organization_id': org_id,
        'timestamp': datetime.now().isoformat(),
        'analysis_type': 'marketing_optimization',
        
        # Goal progress
        'goal_kpi': goal_kpi,
        'current_value': current_value,
        'target_value': target_value,
        'gap': gap,
        'gap_pct': gap_pct,
        'progress_pct': current_value / target_value if target_value > 0 else 0,
        'status': status,
        
        # Driver health
        'driver_health': driver_health,
        
        # Recommendations
        'recommendations': recommendations,
        'total_opportunity': total_opportunity,
        'opportunity_vs_gap': total_opportunity / gap if gap > 0 else 0,
        
        # Metadata
        'metadata': analysis_metadata
    }
    
    return output


def format_slack_message(output: dict) -> str:
    """
    Format output as Slack message
    
    Args:
        output: Output from format_output()
    
    Returns:
        Slack message string
    """
    
    goal = output['goal_kpi']
    current = output['current_value']
    target = output['target_value']
    gap = output['gap']
    progress = output['progress_pct'] * 100
    
    recs = output['recommendations'][:3]  # Top 3
    
    message = f"""🤖 *Marketing Optimization Agent*
{datetime.now().strftime('%A, %B %d, %Y at %I:%M%p')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *GOAL STATUS*
{goal.title()}: {current:,.0f} (Goal: {target:,.0f})
Gap: {gap:,.0f} ({progress:.0f}% of goal)

📊 *TOP 3 ACTIONS FOR THIS WEEK*
"""
    
    priority_emojis = {'urgent': '🔴', 'high': '🟡', 'medium': '🟢', 'low': '⚪'}
    
    for i, rec in enumerate(recs, 1):
        emoji = priority_emojis.get(rec['priority'], '⚪')
        message += f"\n{i}. {emoji} [{rec['priority'].upper()}] {rec['title']}\n"
        message += f"   Impact: +{rec['expected_lift']:,.0f} {goal}/mo | "
        message += f"Effort: {rec['effort'].title()} | "
        message += f"Confidence: {rec['confidence'].title()}\n"
    
    message += f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    message += f"\nNext update: Tomorrow at 6am"
    
    return message

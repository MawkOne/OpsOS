"""
AI-Powered Recommendations Module
Uses Gemini 3 Flash to generate contextual, intelligent recommendations
"""

import logging
from datetime import datetime
import json
import os
import google.generativeai as genai

logger = logging.getLogger(__name__)

# Initialize Gemini API
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))


def generate_recommendations(opportunities: list, business_context: dict = None, channel: str = 'all') -> list:
    """
    Generate AI-powered recommendations using Gemini 3 Flash
    
    Args:
        opportunities: Prioritized list of opportunities from driver analysis
        business_context: Business context from Firestore
        channel: Marketing channel being analyzed
    
    Returns:
        List of AI-generated recommendations
    """
    
    logger.info(f"🤖 Generating AI recommendations for {len(opportunities)} opportunities (channel: {channel})...")
    
    # Build the prompt
    prompt = build_recommendation_prompt(opportunities, business_context, channel)
    
    # Call Gemini Flash
    try:
        model = genai.GenerativeModel("gemini-3-flash-preview")
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,  # Lower temperature for more focused recommendations
                top_p=0.8,
                top_k=40,
                max_output_tokens=8192,
            )
        )
        
        # Parse the AI response
        recommendations = parse_ai_response(response.text, opportunities)
        
        logger.info(f"✅ Generated {len(recommendations)} AI-powered recommendations")
        
        return recommendations
        
    except Exception as e:
        logger.error(f"❌ Error calling Gemini API: {e}")
        logger.warning("⚠️ Falling back to template-based recommendations")
        # Fallback to simple recommendations if AI fails
        return generate_fallback_recommendations(opportunities)


def build_recommendation_prompt(opportunities: list, business_context: dict, channel: str = 'all') -> str:
    """Build the prompt for Gemini 3"""
    
    # Channel descriptions
    channel_context = {
        'advertising': 'paid advertising campaigns (Google Ads, social ads, display ads)',
        'seo': 'organic search optimization (keywords, rankings, backlinks, content)',
        'pages': 'landing pages and website content (engagement, forms, CTAs)',
        'social': 'social media presence and engagement',
        'email': 'email marketing campaigns and automation',
        'articles': 'blog articles and content marketing (time on page, backlinks, shares)'
    }
    
    channel_desc = channel_context.get(channel, 'all marketing channels')
    
    # Format opportunities data
    opps_summary = []
    for i, opp in enumerate(opportunities[:5], 1):
        opps_summary.append(f"""
Opportunity #{i}:
- Driver: {opp['driver']}
- Current Value: {opp['current_value']:.2f}
- Benchmark (Best): {opp['benchmark_value']:.2f}
- Gap: {opp['gap_pct']*100:.1f}%
- Importance: {opp['importance']:.1%}
- Expected Lift: +{opp['expected_lift']:.0f} signups/month
- Type: {opp['type']}
- Priority: {opp['priority_label']}
- Confidence: {opp['confidence']}
- Rationale: {opp['rationale']}
""")
    
    # Format business context
    context_str = ""
    if business_context:
        if business_context.get('products'):
            products = [p['name'] for p in business_context['products'][:5]]
            context_str += f"\n**Products:** {', '.join(products)}"
        
        if business_context.get('initiatives'):
            initiatives = [f"{i['name']} ({i['category']})" for i in business_context['initiatives'][:5]]
            context_str += f"\n**Active Initiatives:** {', '.join(initiatives)}"
        
        if business_context.get('team_size'):
            context_str += f"\n**Team Size:** {business_context['team_size']} people"
        
        if business_context.get('recent_campaigns'):
            campaigns = [c['name'] for c in business_context['recent_campaigns'][:3]]
            context_str += f"\n**Recent Campaigns:** {', '.join(campaigns)}"
    
    prompt = f"""You are a senior marketing strategist analyzing data for a SaaS company. You are specifically analyzing **{channel_desc.upper()}** performance. Based on the driver analysis below, generate 5 specific, actionable recommendations focused on {channel_desc}.

BUSINESS CONTEXT:{context_str if context_str else " (Limited context available)"}

TOP OPPORTUNITIES FROM DATA ANALYSIS (focused on {channel_desc}):
{''.join(opps_summary)}

INSTRUCTIONS:
For EACH of the 5 opportunities above, provide:

1. **Title** (10 words max): Clear, action-oriented title
2. **Description** (2-3 sentences): Explain the opportunity and expected impact
3. **Actions** (5 specific action items): Concrete, implementable steps. Be SPECIFIC - include numbers, timeframes, tools, tactics
4. **Success Metrics** (3 metrics to track): How to measure success
5. **Timeline**: Estimate implementation days, testing days, and when results will be visible

CRITICAL REQUIREMENTS:
- Make recommendations SPECIFIC to this company's context (products, initiatives, team size)
- Include CONCRETE numbers and tactics (don't say "improve email marketing" - say "send 2 additional campaigns per week targeting X segment")
- Consider resource constraints (team size, budget)
- Build on what's already working (reference their products/campaigns when relevant)
- Prioritize quick wins (low effort, high impact) first

OUTPUT FORMAT (JSON):
Return ONLY valid JSON array with this exact structure:

[
  {{
    "rank": 1,
    "title": "Scale High-Performing Email Campaigns",
    "description": "Current email campaigns are driving 15% of signups but frequency is 40% below benchmark. Increasing from 3 to 5 emails per week would close 35% of the gap to goal.",
    "actions": [
      "Duplicate top-performing campaign template (Welcome Series) and adapt for different segments",
      "Schedule 2 additional sends per week: Tuesday 10am and Thursday 2pm",
      "Create 4 new email templates this week focused on product benefits and social proof",
      "Set up A/B test on subject lines for new campaigns (test for 14 days)",
      "Track incremental signup lift with UTM parameters (goal: +50 signups/week)"
    ],
    "success_metrics": [
      "Email campaigns sent per week (target: 5, current: 3)",
      "Incremental signups from email (target: +200/month)",
      "Email-to-signup conversion rate (maintain above 2%)"
    ],
    "timeline": {{
      "implementation_days": 7,
      "testing_days": 14,
      "results_visible_days": 21
    }}
  }}
]

Generate recommendations now:"""
    
    return prompt


def parse_ai_response(response_text: str, opportunities: list) -> list:
    """Parse Gemini 3 response into structured recommendations"""
    
    try:
        # Try to extract JSON from response
        # Sometimes the model wraps JSON in markdown code blocks
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        # Parse JSON
        ai_recommendations = json.loads(response_text)
        
        # Enhance with original opportunity data
        recommendations = []
        for i, rec in enumerate(ai_recommendations[:5]):
            opp = opportunities[i] if i < len(opportunities) else opportunities[0]
            
            # Merge AI output with opportunity data
            enhanced_rec = {
                'id': f"rec_{datetime.now().strftime('%Y%m%d')}_{rec.get('rank', i+1)}",
                'rank': rec.get('rank', i+1),
                'priority': opp['priority_label'],
                'driver': opp['driver'],
                'type': opp['type'],
                'title': rec.get('title', 'Optimization Opportunity'),
                'description': rec.get('description', ''),
                'rationale': opp['rationale'],
                'expected_lift': round(opp['expected_lift'], 0),
                'pct_of_gap_closed': round(opp['pct_of_gap_closed'] * 100, 1),
                'effort': opp['effort_estimate'],
                'confidence': opp['confidence'],
                'current_value': round(opp['current_value'], 2),
                'target_value': round(opp['benchmark_value'], 2),
                'gap_pct': round(opp['gap_pct'] * 100, 1),
                'actions': rec.get('actions', []),
                'success_metrics': rec.get('success_metrics', []),
                'timeline': rec.get('timeline', {
                    'implementation_days': 21,
                    'testing_days': 30,
                    'results_visible_days': 45
                })
            }
            
            recommendations.append(enhanced_rec)
        
        return recommendations
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        logger.debug(f"Response text: {response_text[:500]}")
        # Fallback
        return generate_fallback_recommendations(opportunities)
    except Exception as e:
        logger.error(f"Error parsing AI response: {e}")
        return generate_fallback_recommendations(opportunities)


def generate_fallback_recommendations(opportunities: list) -> list:
    """
    Fallback: Generate simple template-based recommendations if AI fails
    """
    
    logger.warning("Using fallback template recommendations")
    
    recommendations = []
    
    for opp in opportunities[:5]:
        rec = {
            'id': f"rec_{datetime.now().strftime('%Y%m%d')}_{opp['rank']}",
            'rank': opp['rank'],
            'priority': opp['priority_label'],
            'driver': opp['driver'],
            'type': opp['type'],
            'title': f"Optimize {opp['driver'].replace('_', ' ').title()}",
            'description': f"Improve {opp['driver']} from {opp['current_value']:.0f} to {opp['benchmark_value']:.0f} to add {opp['expected_lift']:.0f} signups per month.",
            'rationale': opp['rationale'],
            'expected_lift': round(opp['expected_lift'], 0),
            'pct_of_gap_closed': round(opp['pct_of_gap_closed'] * 100, 1),
            'effort': opp['effort_estimate'],
            'confidence': opp['confidence'],
            'current_value': round(opp['current_value'], 2),
            'target_value': round(opp['benchmark_value'], 2),
            'gap_pct': round(opp['gap_pct'] * 100, 1),
            'actions': [
                f"Analyze current state of {opp['driver']}",
                f"Identify specific improvements to reach {opp['benchmark_value']:.0f}",
                "Implement changes and track impact",
                f"Measure results weekly",
                "Adjust strategy based on performance"
            ],
            'success_metrics': [
                f"{opp['driver']} value",
                "Signup conversion rate",
                "Week-over-week growth"
            ],
            'timeline': {
                'implementation_days': 14,
                'testing_days': 21,
                'results_visible_days': 30
            }
        }
        
        recommendations.append(rec)
    
    return recommendations


def format_output(org_id: str, goal_kpi: str, target_value: float, current_value: float,
                 driver_health: list, recommendations: list, analysis_metadata: dict) -> dict:
    """
    Format complete output for storage and display
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
        'analysis_type': 'marketing_optimization_ai',
        
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
        
        # AI-generated recommendations
        'recommendations': recommendations,
        'total_opportunity': total_opportunity,
        'opportunity_vs_gap': total_opportunity / gap if gap > 0 else 0,
        
        # Metadata
        'metadata': {
            **analysis_metadata,
            'ai_model': 'gemini-pro',
            'recommendation_engine': 'ai_powered'
        }
    }
    
    return output

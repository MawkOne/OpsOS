"""
Business Context Module
Fetches business context from Firestore for AI-powered recommendations
"""

from google.cloud import firestore
import logging

logger = logging.getLogger(__name__)


def fetch_business_context(org_id: str) -> dict:
    """
    Fetch business context from Firestore to inform AI recommendations
    
    Args:
        org_id: Organization ID
    
    Returns:
        Dict with business context including products, initiatives, team, etc.
    """
    
    try:
        db = firestore.Client()
        
        context = {
            'organization_id': org_id,
            'products': [],
            'initiatives': [],
            'team_size': 0,
            'budget': 0,
            'recent_campaigns': []
        }
        
        # Fetch products (Stripe)
        try:
            products_ref = db.collection('stripe_products').where('organizationId', '==', org_id).limit(20)
            products = products_ref.stream()
            context['products'] = [
                {
                    'name': p.to_dict().get('name', 'Unknown'),
                    'active': p.to_dict().get('active', False),
                    'description': p.to_dict().get('description', '')
                }
                for p in products
            ]
            logger.info(f"  → Loaded {len(context['products'])} products")
        except Exception as e:
            logger.warning(f"Could not load products: {e}")
        
        # Fetch active initiatives
        try:
            initiatives_ref = db.collection('initiatives')\
                .where('organizationId', '==', org_id)\
                .where('status', 'in', ['in-progress', 'planned', 'approved'])\
                .limit(10)
            initiatives = initiatives_ref.stream()
            context['initiatives'] = [
                {
                    'name': i.to_dict().get('name', 'Unknown'),
                    'category': i.to_dict().get('category', 'other'),
                    'status': i.to_dict().get('status', 'unknown'),
                    'priority': i.to_dict().get('priority', 'medium'),
                    'expected_revenue': i.to_dict().get('expectedRevenue', 0)
                }
                for i in initiatives
            ]
            logger.info(f"  → Loaded {len(context['initiatives'])} active initiatives")
        except Exception as e:
            logger.warning(f"Could not load initiatives: {e}")
        
        # Fetch team data
        try:
            people_ref = db.collection('people').where('organizationId', '==', org_id)
            people = list(people_ref.stream())
            context['team_size'] = len(people)
            
            # Calculate total team cost (annual)
            total_cost = 0
            for person in people:
                data = person.to_dict()
                salary = data.get('salary', 0)
                salary_type = data.get('salaryType', 'annual')
                
                if salary_type == 'annual':
                    total_cost += salary
                elif salary_type == 'monthly':
                    total_cost += salary * 12
                else:  # hourly
                    hours_per_week = data.get('hoursPerWeek', 40)
                    total_cost += salary * hours_per_week * 52
            
            context['budget'] = total_cost
            logger.info(f"  → Team: {context['team_size']} people, ${total_cost:,.0f} annual cost")
        except Exception as e:
            logger.warning(f"Could not load team data: {e}")
        
        # Fetch recent email campaigns
        try:
            campaigns_ref = db.collection('activecampaign_campaigns')\
                .where('organizationId', '==', org_id)\
                .order_by('sentAt', direction=firestore.Query.DESCENDING)\
                .limit(5)
            campaigns = campaigns_ref.stream()
            context['recent_campaigns'] = [
                {
                    'name': c.to_dict().get('name', 'Unknown'),
                    'sent': c.to_dict().get('sendAmt', 0),
                    'opens': c.to_dict().get('uniqueOpens', 0),
                    'clicks': c.to_dict().get('uniqueLinkClicks', 0)
                }
                for c in campaigns
            ]
            logger.info(f"  → Loaded {len(context['recent_campaigns'])} recent campaigns")
        except Exception as e:
            logger.warning(f"Could not load campaigns: {e}")
        
        return context
        
    except Exception as e:
        logger.error(f"Error fetching business context: {e}")
        # Return minimal context if fetch fails
        return {
            'organization_id': org_id,
            'products': [],
            'initiatives': [],
            'team_size': 0,
            'budget': 0,
            'recent_campaigns': []
        }


def format_context_for_prompt(context: dict) -> str:
    """
    Format business context into a readable string for the AI prompt
    
    Args:
        context: Business context dict
    
    Returns:
        Formatted string
    """
    
    sections = []
    
    # Products
    if context['products']:
        products_str = "\n".join([
            f"  - {p['name']}: {p.get('description', 'No description')[:100]}"
            for p in context['products'][:5]
        ])
        sections.append(f"**Products/Services:**\n{products_str}")
    
    # Initiatives
    if context['initiatives']:
        initiatives_str = "\n".join([
            f"  - {i['name']} ({i['category']}, {i['status']}, priority: {i['priority']})"
            for i in context['initiatives'][:5]
        ])
        sections.append(f"**Active Initiatives:**\n{initiatives_str}")
    
    # Team & Budget
    if context['team_size'] > 0:
        sections.append(f"**Team:** {context['team_size']} people, ${context['budget']:,.0f} annual budget")
    
    # Recent campaigns
    if context['recent_campaigns']:
        campaigns_str = "\n".join([
            f"  - {c['name']}: {c['sent']} sent, {c['opens']} opens, {c['clicks']} clicks"
            for c in context['recent_campaigns'][:3]
        ])
        sections.append(f"**Recent Email Campaigns:**\n{campaigns_str}")
    
    return "\n\n".join(sections) if sections else "No additional context available."

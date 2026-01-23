"""
Opportunity Finder Module
Identifies optimization opportunities by analyzing gaps vs benchmarks
"""

import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def find_opportunities(data: pd.DataFrame, goal_kpi: str, target_value: float, driver_analysis: dict) -> list:
    """
    Identify optimization opportunities by finding gaps vs benchmarks
    
    Args:
        data: DataFrame with all marketing features
        goal_kpi: Target variable (e.g., 'signups')
        target_value: Goal value to reach
        driver_analysis: Output from analyze_drivers()
    
    Returns:
        List of opportunities with expected impact
    """
    
    opportunities = []
    
    # Current goal KPI value
    current_value = float(data[goal_kpi].iloc[-1])
    gap_to_goal = target_value - current_value
    
    logger.info(f"Current {goal_kpi}: {current_value:.0f}, Target: {target_value:.0f}, Gap: {gap_to_goal:.0f}")
    
    # Analyze each driver for headroom
    for driver in driver_analysis['drivers']:
        feature = driver['feature']
        importance = driver['importance']
        direction = driver['direction']
        
        if feature not in data.columns:
            continue
        
        # Skip very low importance drivers (< 2%)
        if importance < 0.02:
            continue
        
        # Get current and benchmark values
        current = float(data[feature].iloc[-1])
        
        # Calculate benchmarks
        benchmarks = calculate_benchmarks(data, feature)
        
        # For positive drivers: find upside
        if direction == 'positive':
            best_benchmark = max(benchmarks['internal_best'], benchmarks['historical_best'])
            
            if best_benchmark > current * 1.05:  # At least 5% upside
                gap = best_benchmark - current
                gap_pct = gap / current if current != 0 else 0
                
                # Estimate impact on goal KPI
                # Formula: gap% × importance × current_goal_value
                expected_lift = gap_pct * importance * current_value
                
                opportunities.append({
                    'driver': feature,
                    'type': 'improve_driver',
                    'direction': direction,
                    'importance': importance,
                    'current_value': current,
                    'benchmark_value': best_benchmark,
                    'benchmark_type': get_best_benchmark_type(benchmarks, best_benchmark),
                    'gap': gap,
                    'gap_pct': gap_pct,
                    'expected_lift': expected_lift,
                    'pct_of_gap_closed': expected_lift / gap_to_goal if gap_to_goal > 0 else 0,
                    'confidence': calculate_confidence(data, feature, goal_kpi),
                    'effort_estimate': estimate_effort(feature),
                    'rationale': generate_rationale(feature, current, best_benchmark, gap_pct, direction)
                })
        
        # For negative drivers: find opportunity to reduce
        else:  # negative direction
            # Best benchmark is the LOWEST value (least negative impact)
            best_benchmark = min(benchmarks['internal_best'], benchmarks['historical_best'])
            
            if current > best_benchmark * 1.05:  # Current is significantly worse
                reduction_needed = current - best_benchmark
                reduction_pct = reduction_needed / current if current != 0 else 0
                
                # Estimate impact from reducing friction
                # Assume we can achieve 50% of the gap
                achievable_reduction_pct = reduction_pct * 0.5
                expected_lift = achievable_reduction_pct * abs(importance) * current_value
                
                opportunities.append({
                    'driver': feature,
                    'type': 'remove_friction',
                    'direction': direction,
                    'importance': importance,
                    'current_value': current,
                    'benchmark_value': best_benchmark,
                    'benchmark_type': get_best_benchmark_type(benchmarks, best_benchmark),
                    'gap': reduction_needed,
                    'gap_pct': reduction_pct,
                    'expected_lift': expected_lift,
                    'pct_of_gap_closed': expected_lift / gap_to_goal if gap_to_goal > 0 else 0,
                    'confidence': 'high',  # Removing friction is usually safer
                    'effort_estimate': estimate_effort(feature),
                    'rationale': generate_rationale(feature, current, best_benchmark, reduction_pct, direction)
                })
    
    logger.info(f"✅ Found {len(opportunities)} opportunities")
    
    return opportunities


def calculate_benchmarks(data: pd.DataFrame, feature: str) -> dict:
    """Calculate various benchmarks for a feature"""
    
    values = data[feature].dropna()
    
    return {
        'internal_best': float(values.quantile(0.9)),  # Top 10% performance
        'historical_best': float(values.max()),
        'historical_avg': float(values.mean()),
        'recent_avg': float(data[feature].iloc[-3:].mean()) if len(data) >= 3 else float(values.mean())
    }


def get_best_benchmark_type(benchmarks: dict, best_value: float) -> str:
    """Determine which benchmark type was used"""
    
    if best_value == benchmarks['internal_best']:
        return 'internal_best'
    elif best_value == benchmarks['historical_best']:
        return 'historical_best'
    else:
        return 'target'


def calculate_confidence(data: pd.DataFrame, feature: str, goal_kpi: str) -> str:
    """
    Calculate confidence level in the opportunity
    Based on correlation strength and data quality
    """
    
    try:
        # Calculate correlation - handle edge cases
        feature_values = data[feature].fillna(0).values
        goal_values = data[goal_kpi].values
        
        # Need at least 2 observations for correlation
        if len(feature_values) < 2:
            return 'low'
        
        # Check if there's any variance
        if np.std(feature_values) == 0 or np.std(goal_values) == 0:
            return 'low'
        
        correlation = np.corrcoef(feature_values, goal_values)[0, 1]
        
        # Handle NaN correlation
        if np.isnan(correlation):
            return 'low'
        
        # Calculate data quality (how consistent is the feature)
        mean_val = data[feature].mean()
        cv = data[feature].std() / mean_val if mean_val != 0 else 99
        
        # Determine confidence
        if abs(correlation) > 0.7 and cv < 0.5:
            return 'high'
        elif abs(correlation) > 0.4 and cv < 1.0:
            return 'medium'
        else:
            return 'low'
            
    except Exception as e:
        logger.warning(f"Could not calculate confidence for {feature}: {str(e)}")
        return 'low'


def estimate_effort(feature: str) -> str:
    """
    Estimate implementation effort for improving a feature
    This is a simple heuristic - can be refined based on business knowledge
    """
    
    # Low effort (config/operational changes)
    low_effort_keywords = ['paywall', 'frequency', 'rate', 'threshold']
    
    # High effort (strategic/long-term changes)
    high_effort_keywords = ['traffic', 'users', 'seo', 'organic']
    
    feature_lower = feature.lower()
    
    for keyword in low_effort_keywords:
        if keyword in feature_lower:
            return 'low'
    
    for keyword in high_effort_keywords:
        if keyword in feature_lower:
            return 'high'
    
    return 'medium'


def generate_rationale(feature: str, current: float, benchmark: float, gap_pct: float, direction: str) -> str:
    """Generate human-readable rationale for the opportunity"""
    
    if direction == 'positive':
        return f"{feature} is currently {current:.0f}, but could reach {benchmark:.0f} " \
               f"(+{gap_pct:.1%} improvement). This represents significant upside."
    else:
        return f"{feature} is causing negative impact at {current:.0f}. " \
               f"Reducing to {benchmark:.0f} (-{gap_pct:.1%}) would improve conversion."


def prioritize_opportunities(opportunities: list) -> list:
    """
    Prioritize opportunities by impact/effort ratio
    
    Args:
        opportunities: List of opportunities from find_opportunities()
    
    Returns:
        Sorted list of opportunities with priority scores
    """
    
    # Effort scoring
    effort_scores = {'low': 1, 'medium': 3, 'high': 8}
    
    # Confidence multipliers
    confidence_multipliers = {'high': 1.0, 'medium': 0.7, 'low': 0.4}
    
    for opp in opportunities:
        effort_score = effort_scores.get(opp['effort_estimate'], 3)
        confidence_multiplier = confidence_multipliers.get(opp['confidence'], 0.7)
        
        # Priority score = (Expected Lift / Effort) × Confidence
        opp['priority_score'] = (opp['expected_lift'] / effort_score) * confidence_multiplier
        
        # Determine priority label
        if opp['priority_score'] > 100 and opp['confidence'] == 'high':
            opp['priority_label'] = 'urgent'
        elif opp['priority_score'] > 50:
            opp['priority_label'] = 'high'
        elif opp['priority_score'] > 20:
            opp['priority_label'] = 'medium'
        else:
            opp['priority_label'] = 'low'
    
    # Sort by priority score
    sorted_opps = sorted(opportunities, key=lambda x: x['priority_score'], reverse=True)
    
    # Add rank
    for i, opp in enumerate(sorted_opps, 1):
        opp['rank'] = i
    
    logger.info(f"✅ Prioritized {len(sorted_opps)} opportunities")
    if sorted_opps:
        logger.info(f"Top opportunity: {sorted_opps[0]['driver']} (+{sorted_opps[0]['expected_lift']:.0f} lift)")
    
    return sorted_opps

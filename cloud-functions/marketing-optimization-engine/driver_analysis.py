"""
Driver Analysis Module
Analyzes which marketing drivers have the most impact on goal KPI
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import logging

logger = logging.getLogger(__name__)


def analyze_drivers(data: pd.DataFrame, goal_kpi: str) -> dict:
    """
    Analyze which features/drivers have the most impact on the goal KPI
    
    Args:
        data: DataFrame with all marketing features
        goal_kpi: Target variable to optimize (e.g., 'signups')
    
    Returns:
        Dict with driver importance rankings and model metadata
    """
    
    # Validate goal KPI exists
    if goal_kpi not in data.columns:
        raise ValueError(f"Goal KPI '{goal_kpi}' not found in data columns")
    
    # Prepare features and target
    X, y, feature_names = prepare_features(data, goal_kpi)
    
    logger.info(f"Training model with {len(X)} samples and {len(feature_names)} features")
    
    # Train Random Forest model
    model = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X, y)
    
    # Get feature importance
    importance = model.feature_importances_
    
    # Calculate R-squared
    r_squared = model.score(X, y)
    
    # Build driver rankings
    drivers = []
    for i, feature in enumerate(feature_names):
        # Calculate correlation to understand direction
        correlation = np.corrcoef(X[:, i], y)[0, 1] if not np.isnan(X[:, i]).all() else 0
        
        drivers.append({
            'feature': feature,
            'importance': float(importance[i]),
            'correlation': float(correlation),
            'direction': 'positive' if correlation > 0 else 'negative',
            'rank': i + 1
        })
    
    # Sort by absolute importance
    drivers = sorted(drivers, key=lambda x: abs(x['importance']), reverse=True)
    
    # Re-rank after sorting
    for i, driver in enumerate(drivers):
        driver['rank'] = i + 1
    
    logger.info(f"✅ Model R²: {r_squared:.3f}")
    logger.info(f"Top 3 drivers: {', '.join([d['feature'] for d in drivers[:3]])}")
    
    return {
        'drivers': drivers,
        'r_squared': float(r_squared),
        'num_features': len(feature_names),
        'num_observations': len(X),
        'goal_kpi': goal_kpi
    }


def calculate_driver_health(data: pd.DataFrame, driver_analysis: dict, goal_kpi: str) -> list:
    """
    Calculate health status for each driver (current vs benchmark)
    
    Args:
        data: DataFrame with all marketing features
        driver_analysis: Output from analyze_drivers()
        goal_kpi: Target variable
    
    Returns:
        List of driver health reports
    """
    
    health_reports = []
    
    # Get top 10 drivers by importance
    top_drivers = driver_analysis['drivers'][:10]
    
    for driver in top_drivers:
        feature = driver['feature']
        
        if feature not in data.columns:
            continue
        
        # Current value (most recent month)
        current_value = float(data[feature].iloc[-1])
        
        # Historical average
        historical_avg = float(data[feature].mean())
        
        # Internal best (90th percentile)
        internal_best = float(data[feature].quantile(0.9))
        
        # Recent trend (last 3 months avg vs previous 3 months)
        if len(data) >= 6:
            recent_avg = float(data[feature].iloc[-3:].mean())
            previous_avg = float(data[feature].iloc[-6:-3].mean())
            trend = 'improving' if recent_avg > previous_avg else 'declining' if recent_avg < previous_avg else 'stable'
            trend_pct = float((recent_avg - previous_avg) / previous_avg if previous_avg != 0 else 0)
        else:
            trend = 'unknown'
            trend_pct = 0
        
        # Determine status
        if current_value >= internal_best * 0.95:
            status = 'excellent'
        elif current_value >= historical_avg:
            status = 'good'
        elif current_value >= historical_avg * 0.85:
            status = 'below_average'
        else:
            status = 'critical'
        
        # Adjust status for negative drivers (higher is worse)
        if driver['direction'] == 'negative':
            if current_value >= internal_best * 0.95:
                status = 'critical'  # High negative impact is bad
            elif current_value >= historical_avg:
                status = 'below_average'
            else:
                status = 'excellent'  # Low negative impact is good
        
        health_reports.append({
            'feature': feature,
            'importance': driver['importance'],
            'direction': driver['direction'],
            'current_value': current_value,
            'historical_avg': historical_avg,
            'internal_best': internal_best,
            'gap_vs_best': float((internal_best - current_value) / internal_best if internal_best != 0 else 0),
            'trend': trend,
            'trend_pct': trend_pct,
            'status': status,
            'rank': driver['rank']
        })
    
    return sorted(health_reports, key=lambda x: x['importance'], reverse=True)


def prepare_features(data: pd.DataFrame, goal_kpi: str) -> tuple:
    """
    Prepare feature matrix for modeling
    
    Args:
        data: Raw DataFrame
        goal_kpi: Target variable to exclude from features
    
    Returns:
        Tuple of (X, y, feature_names)
    """
    
    # Exclude target and non-numeric columns
    exclude_cols = [goal_kpi, 'month']
    
    # Get numeric columns only
    numeric_cols = data.select_dtypes(include=[np.number]).columns.tolist()
    feature_cols = [col for col in numeric_cols if col not in exclude_cols]
    
    # Remove columns with all zeros or NaN
    valid_cols = []
    for col in feature_cols:
        if data[col].sum() != 0 and not data[col].isna().all():
            valid_cols.append(col)
    
    logger.info(f"Selected {len(valid_cols)} valid features from {len(feature_cols)} total")
    
    # Create feature matrix
    # Convert to numpy arrays and handle pandas NA types
    X_df = data[valid_cols].fillna(0)  # Fill NA with 0 first
    X = X_df.to_numpy(dtype=float)  # Convert to numpy float array
    
    y_series = data[goal_kpi].fillna(0)  # Fill NA with 0 first
    y = y_series.to_numpy(dtype=float)  # Convert to numpy float array
    
    # Handle inf values
    X = np.nan_to_num(X, nan=0, posinf=0, neginf=0)
    y = np.nan_to_num(y, nan=0, posinf=0, neginf=0)
    
    return X, y, valid_cols


def get_feature_importance_summary(driver_analysis: dict, top_n: int = 10) -> str:
    """
    Generate human-readable summary of feature importance
    
    Args:
        driver_analysis: Output from analyze_drivers()
        top_n: Number of top drivers to include
    
    Returns:
        Formatted string summary
    """
    
    drivers = driver_analysis['drivers'][:top_n]
    
    summary = f"Top {top_n} Drivers (R² = {driver_analysis['r_squared']:.2%}):\n\n"
    
    for i, driver in enumerate(drivers, 1):
        direction_emoji = "↑" if driver['direction'] == 'positive' else "↓"
        summary += f"{i}. {driver['feature']}: {driver['importance']:.1%} {direction_emoji}\n"
    
    return summary

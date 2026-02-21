"""
Social Media to BigQuery Sync Cloud Function

Tracks YTJobs' social media channels (followers, engagement, messages)
Supports both public scraping and OAuth-connected business accounts.

Architecture: Platform APIs → Cloud Function → BigQuery
"""

import functions_framework
from google.cloud import firestore, bigquery
from datetime import datetime, timedelta
import logging
import json
import os
import requests

logger = logging.getLogger(__name__)

PROJECT_ID = "opsos-864a1"
DATASET_ID = "marketing_ai"
TABLE_ID = "daily_entity_metrics"

# Platform API configurations
PLATFORMS = {
    'linkedin': {
        'name': 'LinkedIn',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['followers', 'posts']
    },
    'twitter': {
        'name': 'Twitter/X',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['followers', 'posts', 'engagement']
    },
    'instagram': {
        'name': 'Instagram',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['followers', 'posts', 'engagement']
    },
    'facebook': {
        'name': 'Facebook',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['followers', 'posts', 'engagement']
    },
    'youtube': {
        'name': 'YouTube',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['subscribers', 'videos', 'views']
    },
    'tiktok': {
        'name': 'TikTok',
        'oauth_required_for': ['messages', 'analytics'],
        'public_metrics': ['followers', 'videos', 'likes']
    },
    'telegram': {
        'name': 'Telegram',
        'oauth_required_for': ['messages'],
        'public_metrics': ['subscribers', 'posts']
    }
}


def get_credentials(db, organization_id: str, platform: str):
    """Get OAuth credentials for a platform from Firestore"""
    try:
        doc = db.collection('social_media_connections').document(organization_id).collection('platforms').document(platform).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.warning(f"No credentials found for {platform}: {e}")
        return None


def fetch_linkedin_metrics(credentials: dict, profile_url: str) -> dict:
    """Fetch LinkedIn company page metrics"""
    metrics = {
        'followers': 0,
        'posts_7d': 0,
        'engagement_rate': 0,
        'impressions_7d': 0,
    }
    
    if not credentials:
        logger.warning("LinkedIn: No OAuth credentials - public scraping not yet implemented")
        return metrics
    
    # OAuth-based API call
    try:
        access_token = credentials.get('access_token')
        organization_id = credentials.get('organization_id')
        
        # Get follower count
        headers = {'Authorization': f'Bearer {access_token}'}
        follower_response = requests.get(
            f'https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:{organization_id}',
            headers=headers
        )
        
        if follower_response.ok:
            data = follower_response.json()
            # Parse follower count from response
            metrics['followers'] = data.get('elements', [{}])[0].get('followerCounts', {}).get('organicFollowerCount', 0)
        
        # Get post analytics (last 7 days)
        # ... implement post analytics API call
        
    except Exception as e:
        logger.error(f"LinkedIn API error: {e}")
    
    return metrics


def fetch_twitter_metrics(credentials: dict, handle: str) -> dict:
    """Fetch Twitter/X metrics"""
    metrics = {
        'followers': 0,
        'posts_7d': 0,
        'engagement_rate': 0,
        'impressions_7d': 0,
    }
    
    if not credentials:
        logger.warning("Twitter: No OAuth credentials - public scraping not yet implemented")
        return metrics
    
    # OAuth-based API call (Twitter API v2)
    try:
        bearer_token = credentials.get('bearer_token')
        user_id = credentials.get('user_id')
        
        headers = {'Authorization': f'Bearer {bearer_token}'}
        
        # Get user metrics
        user_response = requests.get(
            f'https://api.twitter.com/2/users/{user_id}?user.fields=public_metrics',
            headers=headers
        )
        
        if user_response.ok:
            data = user_response.json()
            metrics['followers'] = data.get('data', {}).get('public_metrics', {}).get('followers_count', 0)
        
    except Exception as e:
        logger.error(f"Twitter API error: {e}")
    
    return metrics


def fetch_instagram_metrics(credentials: dict, handle: str) -> dict:
    """Fetch Instagram Business Account metrics"""
    metrics = {
        'followers': 0,
        'posts_7d': 0,
        'engagement_rate': 0,
        'impressions_7d': 0,
    }
    
    if not credentials:
        logger.warning("Instagram: No OAuth credentials - public scraping not yet implemented")
        return metrics
    
    # OAuth-based API call (Instagram Graph API)
    try:
        access_token = credentials.get('access_token')
        business_account_id = credentials.get('business_account_id')
        
        # Get followers
        response = requests.get(
            f'https://graph.facebook.com/v18.0/{business_account_id}?fields=followers_count,media_count&access_token={access_token}'
        )
        
        if response.ok:
            data = response.json()
            metrics['followers'] = data.get('followers_count', 0)
        
    except Exception as e:
        logger.error(f"Instagram API error: {e}")
    
    return metrics


def fetch_youtube_metrics(credentials: dict, channel_id: str) -> dict:
    """Fetch YouTube channel metrics"""
    metrics = {
        'subscribers': 0,
        'videos': 0,
        'views_total': 0,
        'views_7d': 0,
    }
    
    if not credentials:
        logger.warning("YouTube: No OAuth credentials - trying public API")
        # YouTube public API (requires API key only, not OAuth)
        api_key = os.environ.get('YOUTUBE_API_KEY')
        if api_key:
            try:
                response = requests.get(
                    f'https://www.googleapis.com/youtube/v3/channels?part=statistics&id={channel_id}&key={api_key}'
                )
                if response.ok:
                    data = response.json()
                    stats = data.get('items', [{}])[0].get('statistics', {})
                    metrics['subscribers'] = int(stats.get('subscriberCount', 0))
                    metrics['videos'] = int(stats.get('videoCount', 0))
                    metrics['views_total'] = int(stats.get('viewCount', 0))
            except Exception as e:
                logger.error(f"YouTube API error: {e}")
        return metrics
    
    # OAuth-based API call for analytics
    try:
        access_token = credentials.get('access_token')
        # ... implement YouTube Analytics API
    except Exception as e:
        logger.error(f"YouTube API error: {e}")
    
    return metrics


def fetch_telegram_metrics(credentials: dict, channel_username: str) -> dict:
    """Fetch Telegram channel metrics"""
    metrics = {
        'subscribers': 0,
        'posts_7d': 0,
        'views_avg': 0,
    }
    
    if not credentials:
        logger.warning("Telegram: Bot token required for channel stats")
        return metrics
    
    # Telegram Bot API
    try:
        bot_token = credentials.get('bot_token')
        
        # Get channel info
        response = requests.get(
            f'https://api.telegram.org/bot{bot_token}/getChat?chat_id=@{channel_username}'
        )
        
        if response.ok:
            data = response.json()
            # Note: Telegram doesn't expose subscriber count via API
            # Would need to scrape or estimate
            logger.info(f"Telegram channel data: {data}")
        
    except Exception as e:
        logger.error(f"Telegram API error: {e}")
    
    return metrics


@functions_framework.http
def sync_social_media_to_bigquery(request):
    """Sync social media metrics to BigQuery"""
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    request_json = request.get_json(silent=True) or {}
    organization_id = request_json.get('organizationId', 'ytjobs')
    platforms_to_sync = request_json.get('platforms', list(PLATFORMS.keys()))
    
    logger.info(f"Starting social media sync for {organization_id}")
    
    db = firestore.Client()
    bq = bigquery.Client()
    
    results = {
        'platforms_processed': 0,
        'platforms_failed': 0,
        'rows_inserted': 0,
    }
    
    rows = []
    now_iso = datetime.utcnow().isoformat()
    today_str = datetime.utcnow().date().isoformat()
    
    # Get social media config (handles, channel IDs, etc.)
    try:
        config_doc = db.collection('social_media_connections').document(organization_id).get()
        if not config_doc.exists:
            return ({
                'success': False,
                'error': 'No social media configuration found. Please set up social accounts first.',
            }, 400, headers)
        
        config = config_doc.to_dict()
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        return ({
            'success': False,
            'error': f'Failed to get configuration: {e}',
        }, 500, headers)
    
    # Fetch metrics for each platform
    for platform in platforms_to_sync:
        if platform not in PLATFORMS:
            logger.warning(f"Unknown platform: {platform}")
            continue
        
        try:
            logger.info(f"Fetching {platform} metrics...")
            
            credentials = get_credentials(db, organization_id, platform)
            platform_config = config.get(platform, {})
            
            if not platform_config.get('enabled', False):
                logger.info(f"Skipping {platform} - not enabled")
                continue
            
            # Fetch metrics based on platform
            metrics = {}
            if platform == 'linkedin':
                metrics = fetch_linkedin_metrics(credentials, platform_config.get('profile_url'))
            elif platform == 'twitter':
                metrics = fetch_twitter_metrics(credentials, platform_config.get('handle'))
            elif platform == 'instagram':
                metrics = fetch_instagram_metrics(credentials, platform_config.get('handle'))
            elif platform == 'youtube':
                metrics = fetch_youtube_metrics(credentials, platform_config.get('channel_id'))
            elif platform == 'telegram':
                metrics = fetch_telegram_metrics(credentials, platform_config.get('channel_username'))
            
            if metrics:
                row = {
                    'organization_id': organization_id,
                    'date': today_str,
                    'canonical_entity_id': f"social_{platform}_{today_str}",
                    'entity_type': 'social_channel',
                    'entity_name': f"{PLATFORMS[platform]['name']} - {platform_config.get('handle', platform_config.get('channel_id', 'unknown'))}",
                    
                    # Map metrics to standard fields
                    'users': metrics.get('followers', metrics.get('subscribers', 0)),
                    'sessions': metrics.get('posts_7d', metrics.get('videos', 0)),
                    'impressions': metrics.get('impressions_7d', 0),
                    'engagement_rate': metrics.get('engagement_rate', 0),
                    
                    'source_breakdown': json.dumps({
                        'platform': platform,
                        'platform_name': PLATFORMS[platform]['name'],
                        **metrics,
                    }),
                    
                    'created_at': now_iso,
                    'updated_at': now_iso,
                }
                rows.append(row)
                results['platforms_processed'] += 1
            else:
                results['platforms_failed'] += 1
                
        except Exception as e:
            logger.error(f"Error fetching {platform} metrics: {e}")
            results['platforms_failed'] += 1
    
    # Write to BigQuery
    if rows:
        table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"
        
        # Delete today's social data (allow re-runs)
        delete_query = f"""
        DELETE FROM `{table_ref}`
        WHERE organization_id = '{organization_id}'
          AND entity_type = 'social_channel'
          AND date = '{today_str}'
        """
        
        try:
            bq.query(delete_query).result()
            logger.info(f"Deleted existing social data for {today_str}")
        except Exception as e:
            logger.warning(f"Delete query warning: {e}")
        
        # Insert new rows
        try:
            errors = bq.insert_rows_json(table_ref, rows)
            if errors:
                logger.error(f"BigQuery insert errors: {errors}")
            else:
                results['rows_inserted'] = len(rows)
                logger.info(f"✅ Inserted {len(rows)} rows to BigQuery")
        except Exception as e:
            logger.error(f"Failed to insert rows: {e}")
            return ({
                'success': False,
                'error': f'Failed to insert rows: {e}',
            }, 500, headers)
    
    return ({
        'success': True,
        'message': f"Synced {results['platforms_processed']} social platforms",
        **results,
    }, 200, headers)

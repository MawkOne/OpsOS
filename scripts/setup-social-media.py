#!/usr/bin/env python3
"""
Setup YTJobs social media tracking in Firestore
"""

from google.cloud import firestore
from datetime import datetime
import os

# Set credentials
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.expanduser('~/Downloads/opsos-864a1-firebase-adminsdk-fbsvc-9f16a2d1a9.json')

PROJECT_ID = "opsos-864a1"
ORG_ID = "ytjobs"

db = firestore.Client(project=PROJECT_ID)

# YTJobs social media configuration
social_config = {
    'organization_id': ORG_ID,
    'created_at': datetime.utcnow(),
    
    # LinkedIn
    'linkedin': {
        'enabled': True,
        'profile_url': 'https://www.linkedin.com/company/yt-jobs/',
        'handle': 'yt-jobs',
        'company_id': '',  # TODO: Get LinkedIn organization ID for OAuth
        'current_followers': 6925,  # As of Feb 2026
        'notes': 'Connect OAuth for follower count and analytics'
    },
    
    # Twitter/X - Main Account
    'twitter': {
        'enabled': True,
        'handle': 'yt_jobs',
        'profile_url': 'https://x.com/yt_jobs',
        'notes': 'Main account - Connect OAuth for follower count and engagement'
    },
    
    # Twitter/X - Spotlight Account
    'twitter_spotlight': {
        'enabled': True,
        'handle': 'YTJobsSpotlight',
        'profile_url': 'https://x.com/YTJobsSpotlight',
        'notes': 'Secondary spotlight account'
    },
    
    # Instagram
    'instagram': {
        'enabled': False,
        'notes': 'Not currently used by YTJobs'
    },
    
    # Facebook
    'facebook': {
        'enabled': False,
        'notes': 'Not currently used by YTJobs'
    },
    
    # YouTube
    'youtube': {
        'enabled': False,
        'notes': 'Not currently used by YTJobs (serves YouTube creators, no branded channel)'
    },
    
    # TikTok
    'tiktok': {
        'enabled': False,
        'notes': 'Not currently used by YTJobs'
    },
    
    # Telegram
    'telegram': {
        'enabled': True,
        'channel_username': 'ytjobs',  # TODO: Confirm actual channel username (without @)
        'channel_url': 't.me/ytjobs',
        'notes': 'Need Telegram bot token for subscriber count'
    }
}

print("Setting up YTJobs social media tracking...")
print(f"Organization: {ORG_ID}")
print()

# Save to Firestore
doc_ref = db.collection('social_media_connections').document(ORG_ID)
doc_ref.set(social_config)

print("✅ Social media configuration saved!")
print()
print("Platforms configured:")
for platform, config in social_config.items():
    if isinstance(config, dict) and 'enabled' in config:
        status = "✅ Enabled" if config['enabled'] else "⏸️  Disabled"
        print(f"  {platform.capitalize()}: {status}")
        if config.get('notes'):
            print(f"    → {config['notes']}")

print()
print("Next steps:")
print("1. Update YouTube channel_id in Firestore")
print("2. (Optional) Connect OAuth for each platform for detailed analytics")
print("3. Deploy the cloud function:")
print("   cd cloud-functions/data-sync/social-media-bigquery-sync && gcloud functions deploy ...")
print("4. Test sync:")
print("   curl -X POST https://us-central1-opsos-864a1.cloudfunctions.net/social-media-bigquery-sync \\")
print("     -H 'Content-Type: application/json' \\")
print("     -d '{\"organizationId\": \"ytjobs\"}'")

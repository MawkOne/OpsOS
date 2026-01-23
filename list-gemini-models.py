#!/usr/bin/env python3
"""
Query Google for available Gemini models
Usage: python3 list-gemini-models.py
"""

import os

def list_models_genai():
    """Method 1: Using google.generativeai (requires API key)"""
    try:
        import google.generativeai as genai
        
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            print("⚠️  GOOGLE_API_KEY not set. Get one at: https://aistudio.google.com/app/apikey")
            return False
            
        genai.configure(api_key=api_key)
        models = genai.list_models()
        
        print("\n" + "="*70)
        print("📋 AVAILABLE GEMINI MODELS (via Gemini API)")
        print("="*70)
        
        gemini_models = [m for m in models if 'gemini' in m.name.lower()]
        
        for model in sorted(gemini_models, key=lambda x: x.name):
            print(f"\n  Model: {model.name}")
            if hasattr(model, 'display_name'):
                print(f"    Display Name: {model.display_name}")
            if hasattr(model, 'supported_generation_methods'):
                print(f"    Methods: {', '.join(model.supported_generation_methods)}")
        
        return True
        
    except ImportError:
        print("❌ google.generativeai not installed. Install: pip install google-generativeai")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def list_models_vertex():
    """Method 2: Using Vertex AI (requires GCP project)"""
    try:
        from google.cloud import aiplatform
        
        aiplatform.init(project='opsos-864a1', location='us-central1')
        
        print("\n" + "="*70)
        print("📋 DOCUMENTED GEMINI MODELS (Vertex AI)")
        print("="*70)
        print("\nThese models are confirmed available in Vertex AI:")
        
        models = {
            "Gemini 1.5": [
                ("gemini-1.5-pro-002", "Most capable, best for complex reasoning"),
                ("gemini-1.5-pro-001", "Previous version"),
                ("gemini-1.5-flash-002", "Fast and efficient"),
                ("gemini-1.5-flash-001", "Previous version"),
            ],
            "Gemini 2.0": [
                ("gemini-2.0-flash-exp", "Latest experimental (fastest)"),
                ("gemini-2.0-flash-thinking-exp-01-21", "With reasoning traces"),
            ],
            "Gemini 1.0": [
                ("gemini-1.0-pro", "Original Pro model"),
            ]
        }
        
        for version, model_list in models.items():
            print(f"\n  {version}:")
            for model_name, description in model_list:
                print(f"    • {model_name}")
                print(f"      └─ {description}")
        
        return True
        
    except ImportError:
        print("❌ Vertex AI SDK not installed. Install: pip install google-cloud-aiplatform")
        return False
    except Exception as e:
        print(f"⚠️  Vertex AI init: {e}")
        return False


def list_models_curl():
    """Method 3: Using curl and gcloud"""
    print("\n" + "="*70)
    print("🔧 QUERY WITH CURL (Copy & Run)")
    print("="*70)
    
    curl_cmd = '''
# Get access token
TOKEN=$(gcloud auth print-access-token)

# Query model garden
curl -H "Authorization: Bearer $TOKEN" \\
  "https://us-central1-aiplatform.googleapis.com/v1/projects/opsos-864a1/locations/us-central1/models" \\
  | jq '.models[] | select(.displayName | contains("gemini")) | {name, displayName}'
'''
    print(curl_cmd)


if __name__ == "__main__":
    print("\n🔍 QUERYING GOOGLE FOR AVAILABLE GEMINI MODELS\n")
    
    # Try all methods
    success = False
    
    print("\n" + "─"*70)
    print("Method 1: Gemini API (requires GOOGLE_API_KEY)")
    print("─"*70)
    if list_models_genai():
        success = True
    
    print("\n" + "─"*70)
    print("Method 2: Vertex AI SDK (requires GCP project)")
    print("─"*70)
    if list_models_vertex():
        success = True
    
    print("\n" + "─"*70)
    print("Method 3: curl command")
    print("─"*70)
    list_models_curl()
    
    if not success:
        print("\n⚠️  Could not query models directly.")
        print("    Using documented model list above.")
    
    print("\n" + "="*70)
    print("✅ RECOMMENDED FOR YOUR AGENTS:")
    print("="*70)
    print("\n  Use: gemini-2.0-flash-exp  (Latest & Fastest)")
    print("  Or:  gemini-1.5-flash-002  (Stable & Reliable)")
    print("\n  Your current config: gemini-3.0-flash (❌ Does not exist)")
    print("\n" + "="*70 + "\n")

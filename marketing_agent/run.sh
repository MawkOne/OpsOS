#!/bin/bash

# Helper script to run the Marketing Intelligence Agent

# Add ADK to PATH
export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:$PATH"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo ""
    echo "Create it with:"
    echo "  echo 'GOOGLE_API_KEY=\"your-key-here\"' > .env"
    echo ""
    echo "Get your API key from: https://aistudio.google.com/apikey"
    exit 1
fi

# Get the parent directory
PARENT_DIR="$(cd .. && pwd)"

echo "🤖 Starting Marketing Intelligence Agent..."
echo ""
echo "Choose interface:"
echo "1. Command-line (adk run)"
echo "2. Web UI (adk web)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "Starting CLI..."
        cd "$PARENT_DIR" && adk run marketing_agent
        ;;
    2)
        echo ""
        echo "Starting Web UI on http://localhost:8000"
        cd "$PARENT_DIR" && adk web --port 8000
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

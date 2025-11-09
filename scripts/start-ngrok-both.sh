#!/bin/bash

# Start ngrok tunnels for both frontend and backend
# This requires ngrok to be configured with multiple tunnels

echo "Starting ngrok tunnels for E2E Chat App..."
echo ""

# Check if ngrok config exists
if [ ! -f ~/.ngrok2/ngrok.yml ] && [ ! -f ~/Library/Application\ Support/ngrok/ngrok.yml ]; then
    echo "Creating ngrok config for multiple tunnels..."
    mkdir -p ~/.ngrok2 2>/dev/null || mkdir -p ~/Library/Application\ Support/ngrok 2>/dev/null

    # Create a basic config
    cat > ~/.ngrok2/ngrok.yml << EOF
version: "2"
authtoken: YOUR_AUTHTOKEN_HERE
tunnels:
  frontend:
    addr: 3000
    proto: http
  backend:
    addr: 5002
    proto: http
EOF

    echo "⚠️  Please update ~/.ngrok2/ngrok.yml with your authtoken"
    echo "   Then run: ngrok start --all"
    exit 1
fi

# Start both tunnels
echo "Starting ngrok with multiple tunnels..."
ngrok start --all


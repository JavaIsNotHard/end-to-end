#!/bin/bash

# Start ngrok tunnel for E2E Chat App
# This exposes your local server to the internet

PORT=${1:-5002}

echo "Starting ngrok tunnel on port $PORT..."
echo "Your server will be accessible via the ngrok URL"
echo ""

# Start ngrok
ngrok http $PORT


#!/bin/bash

# Start ngrok tunnel for E2E Chat App Frontend
# This exposes your local React app to the internet

PORT=${1:-3000}

echo "Starting ngrok tunnel for frontend on port $PORT..."
echo "Your React app will be accessible via the ngrok URL"
echo ""

# Start ngrok
ngrok http $PORT


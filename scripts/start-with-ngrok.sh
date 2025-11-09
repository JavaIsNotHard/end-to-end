#!/bin/bash

# Start server and ngrok together
# This script starts the server and then starts ngrok in a separate terminal

PORT=${PORT:-5002}

echo "Starting E2E Chat App with ngrok..."
echo ""

# Start the server in the background
echo "Starting server on port $PORT..."
npm run server &
SERVER_PID=$!

# Wait a bit for server to start
sleep 3

# Start ngrok
echo "Starting ngrok tunnel..."
echo "Your server will be accessible via the ngrok URL shown below"
echo ""

ngrok http $PORT

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null" EXIT


# Ngrok Setup Guide

This guide will help you expose your E2E Chat App server to the internet using ngrok, so your friends can connect to it.

## Prerequisites

1. **Install ngrok** (if not already installed):
   ```bash
   # macOS
   brew install ngrok/ngrok/ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Sign up for ngrok** (free account):
   - Go to https://dashboard.ngrok.com/signup
   - Sign up for a free account
   - Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```

## Quick Start

### Option 1: Expose Frontend Only (Easiest for Friends)

This is the easiest option - your friends just need to visit a URL!

1. **Start your app** (in one terminal):
   ```bash
   npm run dev
   ```
   This starts both server (port 5002) and client (port 3000)

2. **Start ngrok for frontend** (in another terminal):
   ```bash
   npm run ngrok:frontend
   ```
   
   Or manually:
   ```bash
   ngrok http 3000
   ```

3. **Copy the frontend ngrok URL**:
   - You'll see output like:
     ```
     Forwarding   https://abc123.ngrok.io -> http://localhost:3000
     ```
   - Share this URL with your friends - they can just open it in their browser!

4. **Update client to use backend ngrok URL**:
   - You'll also need to expose the backend
   - In a third terminal, run: `npm run ngrok` (for port 5002)
   - Copy the backend ngrok URL
   - Create `client/.env` file:
     ```bash
     REACT_APP_API_URL=https://your-backend-ngrok-url.ngrok.io
     ```
   - Restart the React app (Ctrl+C and `npm run dev` again)

### Option 2: Expose Backend Only (Friends Run Client Locally)

1. **Start your server** (in one terminal):
   ```bash
   npm run server
   ```

2. **Start ngrok for backend** (in another terminal):
   ```bash
   npm run ngrok
   ```
   
   Or manually:
   ```bash
   ngrok http 5002
   ```

3. **Copy the ngrok URL**:
   - You'll see output like:
     ```
     Forwarding   https://abc123.ngrok.io -> http://localhost:5002
     ```
   - Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

4. **Share the URL with your friends**:
   - They need to update their client to use this URL
   - Or you can create a simple redirect page

### Option 3: Expose Both Frontend and Backend (Advanced)

If you have ngrok configured for multiple tunnels:

1. **Configure ngrok for multiple tunnels**:
   ```bash
   # Edit ngrok config
   ngrok config edit
   ```
   
   Add this configuration:
   ```yaml
   version: "2"
   authtoken: YOUR_AUTHTOKEN_HERE
   tunnels:
     frontend:
       addr: 3000
       proto: http
     backend:
       addr: 5002
       proto: http
   ```

2. **Start both tunnels**:
   ```bash
   npm run ngrok:both
   ```
   
   Or manually:
   ```bash
   ngrok start --all
   ```

3. **Update client with backend URL**:
   - Create `client/.env` with the backend ngrok URL
   - Share the frontend ngrok URL with friends

### Option 4: Start server and ngrok together

```bash
./start-with-ngrok.sh
```

## Recommended Setup: Frontend via Ngrok

**Easiest approach**: Expose the frontend via ngrok so friends can just visit a URL!

1. **You (Server Owner)**:
   ```bash
   # Terminal 1: Start everything
   npm run dev
   
   # Terminal 2: Expose frontend
   npm run ngrok:frontend
   # Copy frontend URL: https://abc123.ngrok.io
   
   # Terminal 3: Expose backend
   npm run ngrok:backend
   # Copy backend URL: https://xyz789.ngrok.io
   ```

2. **Configure backend URL** (IMPORTANT):
   
   **Option A: Using URL parameter (Easiest)**
   - Share the frontend URL with backend parameter:
     ```
     https://abc123.ngrok.io?backend=https://xyz789.ngrok.io
     ```
   - The backend URL will be automatically saved
   
   **Option B: Using setup page**
   - Visit: `https://abc123.ngrok.io/ngrok-setup.html`
   - Enter your backend ngrok URL
   - Click "Save Backend URL"
   
   **Option C: Manual prompt**
   - When accessing the app via ngrok, you'll be prompted to enter the backend URL
   - Enter: `https://xyz789.ngrok.io`
   - It will be saved for future sessions

3. **Share with friends**:
   - Share the frontend ngrok URL with the backend parameter:
     ```
     https://abc123.ngrok.io?backend=https://xyz789.ngrok.io
     ```
   - Or share the setup page: `https://abc123.ngrok.io/ngrok-setup.html`
   - They can open it in their browser and use the app!

## Updating Client Configuration (If Friends Run Locally)

### For Your Friends

If you only expose the backend, your friends need to update the client to connect to your ngrok URL:

1. **Option A: Environment Variable** (Recommended)
   - Create a `.env` file in the `client` directory:
     ```bash
     REACT_APP_API_URL=https://your-ngrok-url.ngrok.io
     ```
   - Restart the React app

2. **Option B: Update Code Directly**
   - Edit `client/src/components/ChatInterface.js`
   - Change:
     ```javascript
     const newSocket = io('http://localhost:5002');
     ```
   - To:
     ```javascript
     const newSocket = io('https://your-ngrok-url.ngrok.io');
     ```

3. **Option C: Build and Share**
   - Build the React app:
     ```bash
     cd client && npm run build
     ```
   - Serve the build folder and share the ngrok URL

## Important Notes

### Security
- ⚠️ **Anyone with the ngrok URL can access your server**
- ⚠️ **Use ngrok only for testing/sharing with trusted friends**
- ⚠️ **For production, use proper hosting (AWS, Heroku, etc.)**

### Limitations
- Free ngrok accounts have:
  - Random URLs that change each time you restart
  - Limited connections
  - Bandwidth limits
- Paid ngrok accounts allow:
  - Custom domains
  - Reserved domains
  - More connections

### Getting a Static URL

To get a static URL that doesn't change:

1. **Sign up for ngrok paid plan** (or use free trial)
2. **Reserve a domain**:
   ```bash
   ngrok http 5002 --domain=your-custom-name.ngrok-free.app
   ```

### Troubleshooting

1. **CORS errors**:
   - Make sure your ngrok URL is in the allowed origins
   - The server automatically allows all `*.ngrok.io` domains

2. **Connection refused**:
   - Make sure your server is running on port 5002
   - Check that ngrok is forwarding to the correct port

3. **WebSocket connection fails**:
   - Make sure you're using the HTTPS ngrok URL (not HTTP)
   - Check that Socket.io CORS is configured correctly

## Example Workflow

1. **You (Server Owner)**:
   ```bash
   # Terminal 1: Start server
   npm run server
   
   # Terminal 2: Start ngrok
   ./start-ngrok.sh
   # Copy the URL: https://abc123.ngrok.io
   ```

2. **Your Friend**:
   ```bash
   # Clone the repo
   git clone <your-repo>
   cd end-to-end
   
   # Update client config
   echo "REACT_APP_API_URL=https://abc123.ngrok.io" > client/.env
   
   # Start client
   cd client && npm start
   ```

## Sharing the App

### Option 1: Share the Code
- Share your repository
- Friends clone and update the API URL

### Option 2: Build and Host
- Build the React app
- Host it on a static hosting service
- Point it to your ngrok URL

### Option 3: Use ngrok for Both
- Use ngrok for the backend (port 5002)
- Use ngrok for the frontend (port 3000)
- Share both URLs with friends

## Next Steps

For production deployment, consider:
- **Heroku**: Easy deployment for Node.js apps
- **AWS**: More control, better for production
- **DigitalOcean**: Simple VPS hosting
- **Railway**: Modern deployment platform


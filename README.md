# WebSocket Proxy Setup Guide for Railway

## Problem: WebSocket CORS Issues

**Current Error**:

```text
Firefox can't establish a connection to the server at wss://crashed-backend-production.up.railway.app/ws.
```

**Root Cause**:
Your browser is being blocked from directly connecting to the WebSocket server due to **Cross-Origin Resource Sharing (CORS)** restrictions. While your HTTP API requests work through your Next.js API proxy route (`app/api/games/route.ts`), WebSocket connections cannot be proxied the same way because they require a persistent connection between client and server.

## Solution: Create a WebSocket Proxy Server

We'll create a dedicated Node.js proxy server that:

1. Accepts WebSocket connections from your frontend (with CORS enabled)
2. Forwards these connections to your existing backend WebSocket server
3. Relays messages in both directions

**Architecture:**

```text
Frontend (Next.js) ⟷ WebSocket Proxy (Node.js on Railway) ⟷ Backend WebSocket (Python on Railway)
```

## Step-by-Step Implementation

### 1. Create a New GitHub Repository

1. Create a new repository named `crashed-ws-proxy` (or any name you prefer)
2. Clone it to your local machine:

   ```bash
   git clone https://github.com/your-username/crashed-ws-proxy.git
   cd crashed-ws-proxy
   ```

### 2. Create the WebSocket Proxy Server

1. Create a `package.json` file:

```json
{
  "name": "crashed-ws-proxy",
  "version": "1.0.0",
  "description": "WebSocket proxy for crashed game data",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

1. Create a `server.js` file:

```javascript
// server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const winston = require('winston');
const app = express();
const http = require('http').createServer(app);

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Set up middleware
app.use(cors({
  origin: '*', // In production, replace with your frontend domain(s)
  methods: ['GET', 'POST'],
  credentials: true
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'healthy',
    message: 'WebSocket proxy server is running',
    timestamp: new Date().toISOString()
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.send({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Create WebSocket proxy middleware
const wsProxy = createProxyMiddleware({
  target: 'wss://crashed-backend-production.up.railway.app',
  ws: true, // Enable WebSocket proxying
  changeOrigin: true,
  pathRewrite: path => path, // No rewrite needed
  logLevel: 'debug',
  logProvider: () => logger,
  onError: (err, req, res) => {
    logger.error('Proxy error', { error: err.message });
    if (res.writeHead) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    }
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    logger.info('WebSocket connection proxied', { 
      path: req.url,
      remoteAddress: req.socket.remoteAddress
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    logger.info('HTTP response proxied', { path: req.url, status: proxyRes.statusCode });
  }
});

// Apply WebSocket proxy middleware
app.use('/ws', wsProxy);
http.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    wsProxy.upgrade(req, socket, head);
  }
});

// Start server
const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
  logger.info(`WebSocket proxy server running on port ${PORT}`);
});
```

1. Create a `.gitignore` file:

```text
node_modules/
.env
npm-debug.log
```

1. Create a `README.md` file:

```md
# WebSocket Proxy Server

A proxy server to facilitate WebSocket connections between the frontend and backend for Crashed Game data.

## Purpose

This server acts as a middleware that:
- Enables CORS for WebSocket connections
- Forwards WebSocket traffic between the frontend and backend
- Provides monitoring and logging for WebSocket connections

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev
```

## Deployment

This application is designed to be deployed on Railway.

### 3. Deploy to Railway

1. Push your code to GitHub:

   ```bash
   git add .
   git commit -m "Initial commit: WebSocket proxy server"
   git push origin main
   ```

2. Go to [Railway](https://railway.app/) and sign in with your GitHub account

3. Create a new project:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `crashed-ws-proxy` repository
   - Railway will automatically detect it's a Node.js project

4. Configure the deployment:
   - No environment variables are required for basic setup
   - Railway will automatically assign a domain

5. Wait for deployment to complete (usually takes about 1-2 minutes)

6. Get your deployment URL from the Railway dashboard

### 4. Update Your Frontend WebSocket Connection

In your `lib/websocket.ts` file, update the WebSocket URL to use your proxy:

```typescript
// Original connection (not working due to CORS)
// url: 'wss://crashed-backend-production.up.railway.app/ws',

// New connection via proxy
url: 'wss://your-proxy-name.railway.app/ws',
```

## How This Solves the Problem

1. **CORS Handling**: The proxy server explicitly enables CORS, allowing connections from your frontend domain
2. **Connection Forwarding**: The proxy maintains persistent WebSocket connections to both your frontend and backend
3. **Protocol Consistency**: All WebSocket protocols and message formats are preserved through the proxy
4. **Error Handling**: The proxy includes robust error logging to help diagnose any connection issues

## Benefits of This Approach

1. **No Backend Changes Required**: You don't need to modify your Python backend
2. **Improved Debugging**: The proxy provides detailed logs about WebSocket traffic
3. **Enhanced Security**: You can later restrict CORS to only allow specific frontend domains
4. **Scalability**: Railway automatically scales the proxy server as needed

## Testing the Connection

After deploying the proxy and updating your frontend:

1. Open your application in Firefox
2. Open the browser developer tools (F12)
3. Check the console – you should no longer see the WebSocket connection error
4. In the Network tab, filter by "WS" to see the WebSocket connection to your proxy server

## Maintenance Considerations

1. **Monitor Usage**: Check Railway's dashboard to ensure the proxy stays within free tier limits
2. **Update CORS Settings**: In production, replace `origin: '*'` with your specific frontend domain
3. **Log Rotation**: For high-traffic applications, consider adding log rotation
4. **Security Updates**: Periodically update dependencies for security patches

This completes the setup of your WebSocket proxy server on Railway!

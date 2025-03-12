import express from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';
import cors from 'cors';
import winston from 'winston';
import * as http from 'node:http';

// Configure logger
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json()
	),
	transports: [new winston.transports.Console()],
});

// Create Express app
const app = express();
const server = http.createServer(app);

// Set up middleware
app.use(
	cors({
		origin: '*', // In production, replace with your frontend domain(s)
		methods: ['GET', 'POST'],
		credentials: true,
	})
);

// Health check endpoint
app.get('/', (req, res) => {
	res.send({
		status: 'healthy',
		message: 'WebSocket proxy server is running',
		timestamp: new Date().toISOString(),
	});
});

// Stats endpoint
app.get('/stats', (req, res) => {
	res.send({
		uptime: process.uptime(),
		memory: process.memoryUsage(),
		timestamp: new Date().toISOString(),
	});
});

// Create WebSocket proxy middleware
const wsProxy = createProxyMiddleware({
	target: 'wss://crashed-backend-production.up.railway.app',
	ws: true, // Enable WebSocket proxying
	changeOrigin: true,
	pathRewrite: (path) => path, // No rewrite needed
	logProvider: () => logger,
	onError: (err, req, res) => {
		logger.error('Proxy error', { error: err.message });
		if (res && 'writeHead' in res) {
			res.writeHead(500, { 'Content-Type': 'application/json' });
			res.end(
				JSON.stringify({ error: 'Proxy error', message: err.message })
			);
		}
	},
	onProxyReqWs: (proxyReq, req, socket, options, head) => {
		logger.info('WebSocket connection proxied', {
			path: req.url,
			remoteAddress: req.socket.remoteAddress,
		});
	},
	onProxyRes: (proxyRes, req, res) => {
		logger.info('HTTP response proxied', {
			path: req.url,
			status: proxyRes.statusCode,
		});
	},
} as Options);

// Apply WebSocket proxy middleware
app.use('/ws', wsProxy);

// Handle WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
	if (req.url?.startsWith('/ws')) {
		// @ts-ignore: TypeScript has issues with the upgrade method
		wsProxy.upgrade(req, socket, head);
	}
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	logger.info(`WebSocket proxy server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
	logger.info('SIGTERM signal received: closing HTTP server');
	server.close(() => {
		logger.info('HTTP server closed');
		process.exit(0);
	});
});

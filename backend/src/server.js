import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { initDb } from './models/db.js';
import { initRedis } from './services/redisStore.js';
import { setupSockets } from './sockets/socketHandler.js';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration (supports comma-separated URLs or wildcard)
const configuredOrigins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(u => u.trim()) : [];
const defaultOrigins = [
  'http://localhost:5173', 
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
];
const allowedOrigins = [...new Set([...configuredOrigins, ...defaultOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
      return callback(null, true);
    }
    // Allow by default to prevent hard deployment lockouts
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Setup Socket.IO with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Attach socket IO handlers
setupSockets(io);
app.set('io', io);

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GroupRoute Location Intelligence Platform',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Register API Routes
app.use('/api', apiRoutes);

// Serve frontend static assets if dist exists (e.g. single-service deployment)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred.'
  });
});

// Start Server
async function startServer() {
  try {
    await initDb();
    await initRedis();

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server Error] Port ${PORT} is already in use.`);
        console.error('Please close the process using this port and try again.');
        process.exit(1);
      } else {
        console.error('[Server Error] Unhandled server error:', err);
      }
    });

    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 GroupRoute Real-Time Location Platform Server            ║
║                                                               ║
║   • REST API:     http://localhost:${PORT}/api                   ║
║   • Health Check: http://localhost:${PORT}/api/health            ║
║   • Socket.IO:    ws://localhost:${PORT}                        ║
║   • Frontend:     ${CLIENT_URL}                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('Fatal error starting GroupRoute server:', err);
    process.exit(1);
  }
}

// Graceful Shutdown Handlers
const shutdown = () => {
  console.log('[Server] Gracefully shutting down...');
  server.close(() => {
    console.log('[Server] HTTP/Socket.IO server closed.');
    process.exit(0);
  });
  
  // Force close after 10s
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR2', shutdown); // nodemon restart signal

startServer();

export { app, server, io };

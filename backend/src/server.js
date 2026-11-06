import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase } from './db.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend web files
app.use(express.static(publicDir));

// HTTP Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Web Application Routes
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/hr', (req, res) => res.sendFile(path.join(publicDir, 'hr.html')));

// Root Route: Serve Web Portal if browser requests HTML, else API JSON status
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  res.json({
    status: 'ONLINE',
    service: 'UnitedSoft Attendance & Payroll API',
    endpoints: {
      webPortal: '/',
      adminPortal: '/admin',
      hrPortal: '/hr',
      health: '/api/health',
      demoAccounts: '/api/auth/demo-accounts',
      routes: '/api'
    },
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'UnitedSoft Attendance & Payroll API',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Mount Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

export { app };

// Initialize database & Start Server
if (process.env.NODE_ENV !== 'test') {
  try {
    initDatabase();
    app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`  UnitedSoft Attendance & Payroll Backend Server`);
      console.log(`  Listening on: http://localhost:${config.PORT}`);
      console.log(`  Network:      http://0.0.0.0:${config.PORT}`);
      console.log(`  Health Check: http://localhost:${config.PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

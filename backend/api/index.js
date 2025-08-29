import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PgStore } from '../pg-store.js';
import { UserStore } from '../user-store.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { fetchJobs, fetchEmployees, fetchJobCostingAccounts } from '../api-fetcher.js';
import appConfig, { getBackendUrl, getApiUrl } from '../config/app-config.js';
import logger, { logRequest, logError, logDatabase, logApiCall, logAuth } from '../logger.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// HTTP request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('combined'));
}

// Custom request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, res, duration);
  });
  next();
});

// Initialize database stores lazily (only when needed)
let pgStore, userStore;

const initializeStores = async () => {
  if (!pgStore || !userStore) {
    try {
      const TIME_ENTRIES_TABLE = 'time_entries_jobs';
      const USERS_TABLE = 'time_entries_users';
      
      pgStore = new PgStore(appConfig.database, TIME_ENTRIES_TABLE);
      userStore = new UserStore(appConfig.database, USERS_TABLE);
      
      // Ensure tables exist
      await Promise.all([
        pgStore.ensureTable(),
        userStore.ensureTable()
      ]);
      
      logger.info('Database stores initialized successfully');
    } catch (error) {
      logError(error, { context: 'Database initialization' });
      throw error;
    }
  }
  return { pgStore, userStore };
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Time Tracking API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes

// Get all time entries (Protected route)
app.get('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const limit = parseInt(req.query.limit) || 100;
    
    // Get employee_code from the authenticated user (handle both old and new token formats)
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.getAllEntries(limit, employeeCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.entries,
        count: result.entries.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logError(error, { context: 'GET /api/time-entries' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Add more routes here as needed...

// Error handling middleware
app.use((error, req, res, next) => {
  logError(error, { context: 'Global error handler' });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Export for Vercel
export default app;

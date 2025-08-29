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
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
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

// ===== TIME ENTRIES ENDPOINTS =====

// Get all time entries (Protected route)
app.get('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const limit = parseInt(req.query.limit) || 100;
    
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

// Get active time entries (Protected route)
app.get('/api/time-entries/active', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.getActiveEntries(employeeCode);
    
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
    logError(error, { context: 'GET /api/time-entries/active' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get time entry by ID (Protected route)
app.get('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.getEntryById(req.params.id, employeeCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.entry
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logError(error, { context: 'GET /api/time-entries/:id' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create time entry (Protected route)
app.post('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const entryData = {
      ...req.body,
      employee_code: employeeCode,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await pgStore.createEntry(entryData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        data: { id: result.id },
        message: 'Time entry created successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logError(error, { context: 'POST /api/time-entries' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Stop time entry (Protected route)
app.put('/api/time-entries/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.stopEntry(req.params.id, employeeCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.entry,
        message: 'Time entry stopped successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logError(error, { context: 'PUT /api/time-entries/:id/stop' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update time entry (Protected route)
app.put('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    const { pgStore } = await initializeStores();
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.updateEntry(req.params.id, req.body, employeeCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.entry,
        message: 'Time entry updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logError(error, { context: 'PUT /api/time-entries/:id' });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===== SPIRE API ENDPOINTS =====

// Get jobs from Spire API (Protected route)
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const searchTerm = req.query.search || null;
    
    logger.info('Fetching jobs from Spire API', {
      endpoint: '/api/jobs',
      method: 'GET',
      searchTerm,
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });

    const jobs = await fetchJobs(searchTerm);
    
    logApiCall('/api/jobs', 'GET', Date.now(), true, { 
      count: jobs.length, 
      searchTerm,
      source: 'Spire API'
    });
    
    res.json({ 
      success: true,
      jobs, 
      count: jobs.length 
    });
  } catch (error) {
    logApiCall('/api/jobs', 'GET', Date.now(), false, { 
      error: error.message,
      searchTerm: req.query.search 
    });
    logError(error, { context: 'API endpoint', endpoint: '/api/jobs' });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get employees from Spire API (Public route for login page)
app.get('/api/employees', async (req, res) => {
  try {
    logger.info('Fetching employees from Spire API', {
      endpoint: '/api/employees',
      method: 'GET',
      userId: 'anonymous',
    });

    const employees = await fetchEmployees();
    
    logApiCall('/api/employees', 'GET', Date.now(), true, { 
      count: employees.length,
      source: 'Spire API'
    });
    
    res.json({ 
      success: true,
      employees, 
      count: employees.length 
    });
  } catch (error) {
    logApiCall('/api/employees', 'GET', Date.now(), false, { 
      error: error.message
    });
    logError(error, { context: 'API endpoint', endpoint: '/api/employees' });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get job costing accounts from Spire API (Protected route)
app.get('/api/job-costing-accounts', authenticateToken, async (req, res) => {
  try {
    const { jobCode } = req.query;
    
    if (!jobCode) {
      return res.status(400).json({
        success: false,
        error: 'Job code is required'
      });
    }

    logger.info('Fetching job costing accounts from Spire API', {
      endpoint: '/api/job-costing-accounts',
      method: 'GET',
      jobCode,
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });

    const accounts = await fetchJobCostingAccounts(jobCode);
    
    logApiCall('/api/job-costing-accounts', 'GET', Date.now(), true, { 
      count: accounts.length,
      jobCode,
      source: 'Spire API'
    });
    
    res.json({ 
      success: true,
      accounts, 
      count: accounts.length 
    });
  } catch (error) {
    logApiCall('/api/job-costing-accounts', 'GET', Date.now(), false, { 
      error: error.message,
      jobCode: req.query.jobCode
    });
    logError(error, { context: 'API endpoint', endpoint: '/api/job-costing-accounts' });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ===== USER AUTHENTICATION ENDPOINTS =====

// User login
app.post('/api/users/login', async (req, res) => {
  try {
    const { emp_code, password } = req.body;
    
    if (!emp_code || !password) {
      return res.status(400).json({
        success: false,
        error: 'Employee code and password are required'
      });
    }
    
    logger.info('User login attempt', { emp_code });
    
    const { userStore } = await initializeStores();
    const user = await userStore.authenticateUser(emp_code, password);
    
    if (!user) {
      logAuth('login', emp_code, false, { reason: 'Invalid credentials' });
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }
    
    const token = generateToken(user);
    
    logAuth('login', emp_code, true, { 
      ip: req.ip || req.connection?.remoteAddress
    });
    
    res.json({ 
      success: true,
      token, 
      user: { 
        emp_code: user.emp_code, 
        name: user.name,
        role: user.role 
      } 
    });
  } catch (error) {
    logError(error, { context: 'User login' });
    res.status(500).json({ 
      success: false,
      error: 'Login failed' 
    });
  }
});

// Validate user token
app.get('/api/users/validate', authenticateToken, (req, res) => {
  res.json({ 
    success: true,
    valid: true, 
    user: req.user,
    message: 'Token is valid' 
  });
});

// Get user favorites
app.get('/api/users/:emp_code/favorites', authenticateToken, async (req, res) => {
  try {
    const { emp_code } = req.params;
    const { userStore } = await initializeStores();
    const favorites = await userStore.getUserFavorites(emp_code);
    
    res.json({ 
      success: true,
      favorites 
    });
  } catch (error) {
    logError(error, { context: 'Get user favorites', emp_code: req.params.emp_code });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch favorites' 
    });
  }
});

// ===== ROOT AND INFO ENDPOINTS =====

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Time Tracking API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/health',
      '/api/time-entries',
      '/api/jobs',
      '/api/employees',
      '/api/job-costing-accounts',
      '/api/users/login',
      '/api/users/validate'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      '/',
      '/api/health',
      '/api/time-entries',
      '/api/jobs',
      '/api/employees',
      '/api/job-costing-accounts',
      '/api/users/login',
      '/api/users/validate'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logError(error, { context: 'Global error handler' });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Export for Vercel
export default app;

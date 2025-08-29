import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import your modules
import logger, { logRequest, logError, logDatabase, logApiCall, logAuth } from '../logger.js';
import { fetchJobs, fetchEmployees, fetchJobCostingAccounts } from '../api-fetcher.js';
import PgStore from '../pg-store.js';
import UserStore from '../user-store.js';
import { authenticateToken } from '../middleware/auth.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const TIME_ENTRIES_TABLE = 'time_entries';
const USERS_TABLE = 'users';

// Database configuration
const appConfig = {
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  spire: {
    baseUrl: process.env.SPIRE_BASE_URL,
    company: process.env.SPIRE_COMPANY,
    auth: process.env.SPIRE_AUTH,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
  },
};

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// Custom request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, res, duration);
  });
  next();
});

// Initialize database stores
let pgStore, userStore;

try {
  pgStore = new PgStore(appConfig.database, TIME_ENTRIES_TABLE);
  userStore = new UserStore(appConfig.database, USERS_TABLE);
  logger.info('Database stores initialized successfully');
} catch (error) {
  logError(error, { context: 'Database initialization' });
  logger.error('Database initialization failed, exiting');
  process.exit(1);
}

// Setup database tables
Promise.all([
  pgStore.ensureTable(),
  userStore.ensureTable()
]).then(() => {
  logger.info('Database ready', {
    tables: [TIME_ENTRIES_TABLE, USERS_TABLE],
    database: `${appConfig.database.database}@${appConfig.database.host}`,
  });
}).catch(error => {
  logError(error, { context: 'Database setup' });
  logger.error('Database setup failed, exiting');
  process.exit(1);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  logger.debug('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Jobs endpoint
app.get('/api/jobs', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const searchTerm = req.query.search || null;
  
  try {
    logger.info('Fetching jobs from Spire API', {
      endpoint: '/api/jobs',
      method: 'GET',
      searchTerm,
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });

    const jobs = await fetchJobs(searchTerm);
    
    const duration = Date.now() - startTime;
    logApiCall('/api/jobs', 'GET', duration, true, { 
      count: jobs.length, 
      searchTerm,
      source: 'Spire API'
    });
    
    res.json({ jobs, count: jobs.length });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiCall('/api/jobs', 'GET', duration, false, { 
      error: error.message,
      searchTerm 
    });
    logError(error, { context: 'API endpoint', endpoint: '/api/jobs' });
    res.status(500).json({ error: error.message });
  }
});

// Employees endpoint
app.get('/api/employees', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Fetching employees from Spire API', {
      endpoint: '/api/employees',
      method: 'GET',
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });

    const employees = await fetchEmployees();
    
    const duration = Date.now() - startTime;
    logApiCall('/api/employees', 'GET', duration, true, { 
      count: employees.length,
      source: 'Spire API'
    });
    
    res.json({ employees, count: employees.length });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiCall('/api/employees', 'GET', duration, false, { 
      error: error.message
    });
    logError(error, { context: 'API endpoint', endpoint: '/api/employees' });
    res.status(500).json({ error: error.message });
  }
});

// User authentication endpoints
app.post('/api/users/login', async (req, res) => {
  const startTime = Date.now();
  const { emp_code, password } = req.body;
  
  try {
    logger.info('User login attempt', { emp_code });
    
    const user = await userStore.authenticateUser(emp_code, password);
    if (!user) {
      logAuth('login', emp_code, false, { reason: 'Invalid credentials' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = userStore.generateToken(user);
    
    const duration = Date.now() - startTime;
    logAuth('login', emp_code, true, { 
      ip: req.ip || req.connection?.remoteAddress,
      duration: `${duration}ms`
    });
    
    res.json({ 
      token, 
      user: { 
        emp_code: user.emp_code, 
        name: user.name,
        role: user.role 
      } 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logAuth('login', emp_code, false, { 
      error: error.message,
      duration: `${duration}ms`
    });
    logError(error, { context: 'User login' });
    res.status(500).json({ error: 'Login failed' });
  }
});

// User validation endpoint
app.get('/api/users/validate', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user,
    message: 'Token is valid' 
  });
});

// User favorites endpoint
app.get('/api/users/:emp_code/favorites', authenticateToken, async (req, res) => {
  try {
    const { emp_code } = req.params;
    const favorites = await userStore.getUserFavorites(emp_code);
    res.json({ favorites });
  } catch (error) {
    logError(error, { context: 'Get user favorites', emp_code: req.params.emp_code });
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Time entries endpoints
app.post('/api/time-entries', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const timeEntry = await pgStore.createTimeEntry(req.body);
    
    const duration = Date.now() - startTime;
    logDatabase('INSERT', TIME_ENTRIES_TABLE, duration, true, { 
      entryId: timeEntry.id,
      userId: req.user.emp_code 
    });
    
    res.status(201).json(timeEntry);
  } catch (error) {
    const duration = Date.now() - startTime;
    logDatabase('INSERT', TIME_ENTRIES_TABLE, duration, false, { 
      error: error.message,
      userId: req.user.emp_code 
    });
    logError(error, { context: 'Create time entry' });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/time-entries/:emp_code', authenticateToken, async (req, res) => {
  try {
    const { emp_code } = req.params;
    const timeEntries = await pgStore.getTimeEntriesByEmployee(emp_code);
    res.json({ timeEntries });
  } catch (error) {
    logError(error, { context: 'Get time entries', emp_code });
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.json({ 
    message: 'Flourish UI Backend API',
    endpoints: [
      'GET /api/health',
      'GET /api/jobs',
      'GET /api/employees',
      'POST /api/users/login',
      'GET /api/users/validate',
      'GET /api/users/:emp_code/favorites',
      'POST /api/time-entries',
      'GET /api/time-entries/:emp_code'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logError(error, { context: 'Global error handler' });
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
export default app;

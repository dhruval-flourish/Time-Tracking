import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PgStore } from './pg-store.js';
import { UserStore } from './user-store.js';
import { authenticateToken, generateToken } from './middleware/auth.js';
import { fetchJobs, fetchEmployees, fetchJobCostingAccounts } from './api-fetcher.js';
import appConfig, { getBackendUrl, getApiUrl } from './config/app-config.js';
import logger, { logRequest, logError, logDatabase, logApiCall, logAuth } from './logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Fixed table names
const TIME_ENTRIES_TABLE = 'time_entries_jobs';
const USERS_TABLE = 'time_entries_users';

// Simple startup info
logger.info('Starting server', {
  port: PORT,
  environment: process.env.NODE_ENV || 'development',
  database: `${appConfig.database.database}@${appConfig.database.host}`,
});

// Middleware
app.use(cors());
app.use(express.json());

// HTTP request logging middleware
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

// Ensure tables exist on startup
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

// API Routes

// Get all time entries (Protected route)
app.get('/api/time-entries', authenticateToken, async (req, res) => {
  try {
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
    console.error('Error getting time entries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get active time entries (Protected route)
app.get('/api/time-entries/active', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
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
    console.error('Error getting active time entries:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get time entry by ID (Protected route)
app.get('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
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
    console.error('Error getting time entry:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new time entry (Protected route)
app.post('/api/time-entries', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    

    
    const entryData = {
      ...req.body,
      employee_code: employeeCode, // Automatically set from authenticated user
      start_time: new Date(),
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
      console.log('❌ Database error:', result.error);
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating time entry:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Stop time entry (Protected route)
app.put('/api/time-entries/:id/stop', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
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
    console.error('Error stopping time entry:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update time entry (Protected route)
app.put('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
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
    console.error('Error updating time entry:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete time entry (Protected route)
app.delete('/api/time-entries/:id', authenticateToken, async (req, res) => {
  try {
    // Get employee_code from the authenticated user (handle both old and new token formats)
    const employeeCode = req.user.empcode || req.user.emp_code;
    
    if (!employeeCode) {
      return res.status(400).json({
        success: false,
        error: 'Employee code not found in user data. Please log out and log back in.'
      });
    }
    
    const result = await pgStore.deleteEntry(req.params.id, employeeCode);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.entry,
        message: 'Time entry deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting time entry:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get job costing accounts filtered by job code
app.get('/api/job-costing-accounts/:jobCode', async (req, res) => {
  try {
    const { jobCode } = req.params;
    
    if (!jobCode) {
      return res.status(400).json({
        success: false,
        error: 'Job code is required'
      });
    }


    
    // Call the API fetcher to get accounts for this specific job
    const accounts = await fetchJobCostingAccounts(jobCode);
    
    if (accounts && accounts.length > 0) {
      // Transform the accounts data
      const transformedAccounts = accounts.map(account => ({
        id: account.id,
        code: account.code,
        jobNo: account.jobNo,
        accountNo: account.accountNo,
        name: account.name,
        memo: account.memo,
        job: account.job
      }));
      
      res.json({
        success: true,
        records: transformedAccounts,
        count: transformedAccounts.length
      });
    } else {
      res.json({
        success: true,
        records: [],
        count: 0
      });
    }
  } catch (error) {
    console.error('❌ Error fetching job costing accounts:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch job costing accounts'
    });
  }
});

// Get jobs from SpireLAN API
app.get('/api/jobs', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const searchTerm = req.query.search || null;
    
    logger.info('Fetching jobs from Spire API', {
      endpoint: '/api/jobs',
      method: 'GET',
      searchTerm,
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });
    
    const jobs = await fetchJobs(searchTerm);
    const duration = Date.now() - startTime;
    
    if (jobs && jobs.length > 0) {
      // Transform SpireLAN job data to match our frontend expectations
      const transformedJobs = jobs.map(job => ({
        id: job.id, // Keep the original API id (e.g., 13, 26, 39)
        code: job.code, // Keep the job code (e.g., "400", "401", "402")
        orderNo: job.code, // Keep for backward compatibility
        name: job.name || 'Unnamed Job',
        description: job.description || 'No Description',
        status: job.status || 'Unknown',
        company: job.customer?.name || 'Unknown Company',
        startDate: job.startDate,
        endDate: job.endDate
      }));
      
      logApiCall('/api/jobs', 'GET', duration, true, { 
        count: transformedJobs.length,
        searchTerm,
        source: 'Spire API'
      });
      
      logger.info('Jobs fetched successfully', {
        count: transformedJobs.length,
        duration: `${duration}ms`,
        searchTerm,
        source: 'Spire API',
      });
      
      res.json({
        success: true,
        records: transformedJobs,
        count: transformedJobs.length
      });
    } else {
      logApiCall('/api/jobs', 'GET', duration, true, { 
        count: 0,
        searchTerm,
        source: 'Spire API'
      });
      
      logger.info('No jobs found', {
        duration: `${duration}ms`,
        searchTerm,
        source: 'Spire API',
      });
      
      res.json({
        success: true,
        records: [],
        count: 0
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logApiCall('/api/jobs', 'GET', duration, false, { 
      error: error.message,
      searchTerm: req.query.search || null,
      source: 'Spire API'
    });
    
    logError(error, { 
      context: 'Jobs API endpoint',
      endpoint: '/api/jobs',
      method: 'GET',
      searchTerm: req.query.search || null,
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch jobs from SpireLAN API'
    });
  }
});

// Get employees from SpireLAN API
app.get('/api/employees', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const searchTerm = req.query.search || null;
    
    logger.info('Fetching employees from Spire API', {
      endpoint: '/api/employees',
      method: 'GET',
      searchTerm,
      userId: req.user?.emp_code || req.user?.empcode || 'anonymous',
    });
    
    const employees = await fetchEmployees(searchTerm);
    const duration = Date.now() - startTime;
    
    if (employees && employees.length > 0) {
      // Transform SpireLAN employee data to match our frontend expectations
      const transformedEmployees = employees.map(employee => ({
        id: employee.employeeNo || employee.id,
        employeeNo: employee.employeeNo,
        name: employee.name || 'Unknown Employee',
        role: employee.role || 'Employee',
        status: employee.status || 'Unknown'
      }));
      
      logApiCall('/api/employees', 'GET', duration, true, { 
        count: transformedEmployees.length,
        searchTerm,
        source: 'Spire API'
      });
      
      logger.info('Employees fetched successfully', {
        count: transformedEmployees.length,
        duration: `${duration}ms`,
        searchTerm,
        source: 'Spire API',
      });
      
      res.json({
        success: true,
        records: transformedEmployees,
        count: transformedEmployees.length
      });
    } else {
      logApiCall('/api/employees', 'GET', duration, true, { 
        count: 0,
        searchTerm,
        source: 'Spire API'
      });
      
      logger.info('No employees found', {
        duration: `${duration}ms`,
        searchTerm,
        source: 'Spire API',
      });
      
      res.json({
        success: true,
        records: [],
        count: 0
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logApiCall('/api/employees', 'GET', duration, false, { 
      error: error.message,
      searchTerm: req.query.search || null,
      source: 'Spire API'
    });
    
    logError(error, { 
      context: 'Employees API endpoint',
      endpoint: '/api/employees',
      method: 'GET',
      searchTerm: req.query.search || null,
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch employees from SpireLAN API'
    });
  }
});

// USER MANAGEMENT ENDPOINTS

// Create new user (Sign Up)
app.post('/api/users/signup', async (req, res) => {
  try {
    
    const { emp_code, emp_name, password } = req.body;
    
    // Basic validation
    if (!emp_code || !password) {
      return res.status(400).json({
        success: false,
        error: 'Employee code and password are required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }
    
    // For now, store password as plain text (in production, you should hash it)
    // TODO: Implement password hashing with bcrypt or similar
    const userData = {
      emp_code: emp_code.trim(),
      emp_name: emp_name || null,
      password: password, // This should be hashed in production
      verified: false
    };
    
    const result = await userStore.createUser(userData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'User account created successfully',
        user: {
          id: result.user.id,
          emp_code: result.user.emp_code,
          emp_name: result.user.emp_name,
          verified: result.user.verified,
          created: result.user.created
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error in user signup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during signup'
    });
  }
});

// User login (Authentication)
app.post('/api/users/login', async (req, res) => {
  try {
    
    const { emp_code, password } = req.body;
    
    // Basic validation
    if (!emp_code || !password) {
      return res.status(400).json({
        success: false,
        error: 'Employee code and password are required'
      });
    }
    
    // First check if user exists
    const userExists = await userStore.checkUserExists(emp_code.trim());
    
    if (!userExists.success) {
      return res.status(401).json({
        success: false,
        error: 'User not found. Please go to register.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // User exists, now verify password
    const result = await userStore.verifyPassword(emp_code.trim(), password);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_PASSWORD'
      });
    }
    
    const user = result.user;
    

    // Generate JWT token
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        emp_code: user.emp_code,
        emp_name: user.emp_name,
        verified: user.verified,
        created: user.created
      }
    });
    
  } catch (error) {
    console.error('❌ Error in user login:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login'
    });
  }
});

// Verify JWT token
app.get('/api/users/verify-token', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token is valid',
      user: req.user
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});



// Validate current user token and check if user still exists
app.get('/api/users/validate', authenticateToken, async (req, res) => {
  try {
    // The authenticateToken middleware already checks if user exists
    // If we reach here, the user is valid
    res.json({
      success: true,
      message: 'User is valid and exists',
      user: req.user
    });
  } catch (error) {
    console.error('Error validating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user by employee code
app.get('/api/users/:emp_code', async (req, res) => {
  try {
    const result = await userStore.getUserByEmpcode(req.params.emp_code);
    
    if (result.success) {
      // Don't return password in response
      const { password, ...userWithoutPassword } = result.user;
      res.json({
        success: true,
        user: userWithoutPassword
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Add job to user favorites
app.post('/api/users/favorites', authenticateToken, async (req, res) => {
  try {
    const { emp_code, favorite } = req.body;
    
    if (!emp_code || !favorite) {
      return res.status(400).json({
        success: false,
        error: 'Employee code and favorite data are required'
      });
    }

    // Validate favorite data structure
    if (!favorite.job_no || !favorite.job_name || !favorite.acc_no || !favorite.acc_name) {
      return res.status(400).json({
        success: false,
        error: 'Invalid favorite data structure'
      });
    }

    const result = await userStore.addJobToFavorites(emp_code, favorite);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Favorite added successfully',
        favorites: result.favorites
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user favorites
app.get('/api/users/:emp_code/favorites', async (req, res) => {
  try {
    const result = await userStore.getUserFavorites(req.params.emp_code);
    
    if (result.success) {
      res.json({
        success: true,
        favorites: result.favorites
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Remove job from user favorites
app.delete('/api/users/favorites', authenticateToken, async (req, res) => {
  try {
    const { emp_code, job_no } = req.body;
    
    if (!emp_code || !job_no) {
      return res.status(400).json({
        success: false,
        error: 'Employee code and job number are required'
      });
    }

    const result = await userStore.removeJobFromFavorites(emp_code, job_no);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Favorite removed successfully',
        favorites: result.favorites
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all users (Admin only - in production, add authentication)
app.get('/api/users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await userStore.getAllUsers(limit);
    
    if (result.success) {
      res.json({
        success: true,
        users: result.users,
        count: result.users.length
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Verify user account (Admin only)
app.put('/api/users/:emp_code/verify', async (req, res) => {
  try {
    const { emp_code } = req.params;
    const result = await userStore.verifyUser(emp_code);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'User verified successfully',
        user: result.user
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user password
app.put('/api/users/:emp_code/password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }
    
    // TODO: Hash the new password before storing
    const result = await userStore.updatePassword(req.params.emp_code, newPassword);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Password updated successfully',
        user: result.user
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Verify user account
app.put('/api/users/:emp_code/verify', async (req, res) => {
  try {
    const result = await userStore.verifyUser(req.params.emp_code);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'User verified successfully',
        user: result.user
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete user (Admin only - in production, add authentication)
app.delete('/api/users/:emp_code', async (req, res) => {
  try {
    const result = await userStore.deleteUser(req.params.emp_code);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'User deleted successfully',
        user: result.user
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});



// Health check
app.get('/api/health', (req, res) => {
  logger.debug('Health check requested', {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
  });
  
  res.json({
    success: true,
    message: 'Time tracking API is running',
    timestamp: new Date().toISOString(),
    tables: {
      timeEntries: TIME_ENTRIES_TABLE,
      users: USERS_TABLE
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info('Server running successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    database: `${appConfig.database.database}@${appConfig.database.host}`,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully');
  try {
    if (pgStore) {
      await pgStore.close();
      logger.info('PgStore closed successfully');
    }
    if (userStore) {
      await userStore.close();
      logger.info('UserStore closed successfully');
    }
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logError(error, { context: 'Graceful shutdown' });
    logger.error('Error during graceful shutdown');
    process.exit(1);
  }
});

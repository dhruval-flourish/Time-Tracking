import jwt from 'jsonwebtoken';
import pg from 'pg';
import config from '../config/app-config.js';

const { Pool } = pg;

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Database connection for user validation using config
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
});

// Use the same table name as the main app
const USERS_TABLE = 'time_entries_users';

// Middleware to verify JWT token and check user exists
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists in database
    try {
      const userCheckQuery = `
        SELECT id, emp_code, verified 
        FROM ${USERS_TABLE} 
        WHERE id = $1 AND emp_code = $2
      `;
      
      const userResult = await pool.query(userCheckQuery, [decoded.id, decoded.empcode]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User no longer exists or has been deleted',
          code: 'USER_DELETED'
        });
      }
      
      // Check if user is still verified
      if (!userResult.rows[0].verified) {
        return res.status(401).json({
          success: false,
          error: 'User account is not verified',
          code: 'USER_NOT_VERIFIED'
        });
      }
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError.message);
      // If database is down, allow the request to proceed (token is valid)
      // This prevents the app from breaking when database is temporarily unavailable
      console.log('⚠️ Database unavailable, allowing request based on valid token');
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Generate JWT token
const generateToken = (userData) => {
  return jwt.sign(
    {
      id: userData.id,
      empcode: userData.emp_code, // Use emp_code from database
      verified: userData.verified
    },
    JWT_SECRET,
    { expiresIn: '24h' } // Token expires in 24 hours
  );
};

// Refresh token (optional - for longer sessions)
const generateRefreshToken = (userData) => {
  return jwt.sign(
    {
      id: userData.id,
      empcode: userData.emp_code, // Use emp_code from database
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Refresh token expires in 7 days
  );
};

export {
  authenticateToken,
  generateToken,
  generateRefreshToken,
  JWT_SECRET
};

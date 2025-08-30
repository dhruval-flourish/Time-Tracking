// 🚀 Backend Configuration
// Simple, focused configuration for the backend server

const config = {
  // 🌐 Environment Detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // 🔗 Backend API Configuration
  backend: {
    port: process.env.PORT || 3001,
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: process.env.ALLOWED_METHODS?.split(',') || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: process.env.ALLOWED_HEADERS?.split(',') || ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  },
  
  // 🗄️ Database Configuration
  database: {
    host: process.env.DB_HOST || '172.16.70.25',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'timetracking_main',
    user: process.env.DB_USER || 'spireapp',
    password: process.env.DB_PASSWORD || '9xQ*s-XT1Yk!VTNE'
  },
  
  // 🔐 Spire API Configuration
  spire: {
    baseUrl: process.env.SPIRE_BASE_URL || 'https://blue-decimal-2893.spirelan.com:10880',
    company: process.env.SPIRE_COMPANY || 'inspirehealth',
    auth: process.env.SPIRE_AUTH || 'Basic RGhydXZhbDpEaHJ1dmFsQDMwMDY='
  },
  
  // 🏢 Company Information
  company_name: process.env.COMPANY_NAME || 'Homestead',
  
  // 🔑 JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  }
};

// 🎯 Helper Functions
export const getBackendUrl = () => {
  const env = config.isDevelopment ? 'development' : 'production';
  return `http://localhost:${config.backend.port}`;
};

export const getApiUrl = (endpoint = '') => {
  const backendUrl = getBackendUrl();
  return `${backendUrl}/api${endpoint}`;
};

export const getSpireUrl = (endpoint = '') => {
  return `${config.spire.baseUrl}${endpoint}`;
};

// 📋 Export everything
export default config;

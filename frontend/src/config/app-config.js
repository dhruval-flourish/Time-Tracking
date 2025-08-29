// 🚀 Centralized App Configuration
// Change these URLs once and they work everywhere!

const config = {
  // 🌐 Environment Detection
  isDevelopment: process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  isProduction: process.env.NODE_ENV === 'production' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1',
  
  // 📱 Mobile Detection
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  
  // 🔗 Backend API Configuration
  backend: {
    // Development (localhost)
    development: {
      baseUrl: 'http://localhost:3001',
      apiPath: '/api',
      fullUrl: 'http://localhost:3001/api'
    },
    // Production (your domain)
    production: {
      baseUrl: 'https://timetracking-xi.vercel.app', // Your actual Vercel URL
      apiPath: '/api',
      fullUrl: 'https://timetracking-xi.vercel.app/api' // Your actual Vercel URL
    }
  },
  
  // 🌍 Frontend Configuration
  frontend: {
    // Development (localhost)
    development: {
      baseUrl: 'http://localhost:3000',
      fullUrl: 'http://localhost:3000'
    },
    // Production (your domain)
    production: {
      baseUrl: 'https://timetracking-xi.vercel.app', // Your Vercel URL
      fullUrl: 'https://timetracking-xi.vercel.app' // Your Vercel URL
    }
  },
  
  // 🗄️ Database Configuration
  database: {
    // These will be overridden by environment variables in production
    host: process.env.DB_HOST || '172.16.70.25',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'timetracking_main',
    user: process.env.DB_USER || 'spireapp',
    password: process.env.DB_PASSWORD || '9xQ*s-XT1Yk!VTNE'
  },
  
  // 🔐 Spire API Configuration
  spire: {
    baseUrl: process.env.SPIRE_BASE_URL || 'https://clean-invoice-3801.spirelan.com:10880',
    company: process.env.SPIRE_COMPANY || 'fmc_hvac',
    auth: process.env.SPIRE_AUTH || 'Basic RGhydXZhbDpEaHJ1dmFsMTIzJCVe'
  },
  
  // 🏢 Company Information
  company_name: process.env.COMPANY_NAME || 'Homestead',
  
  // 📱 Mobile Network Settings
  mobile: {
    timeout: 30000, // 30 seconds for mobile
    retryAttempts: 3,
    retryDelay: 1000
  }
};

// 🎯 Helper Functions
export const getBackendUrl = () => {
  const env = config.isDevelopment ? 'development' : 'production';
  return config.backend[env].fullUrl;
};

export const getFrontendUrl = () => {
  const env = config.isDevelopment ? 'development' : 'production';
  return config.frontend[env].fullUrl;
};

export const getApiUrl = (endpoint = '') => {
  const backendUrl = getBackendUrl();
  return `${backendUrl}${endpoint}`;
};

export const getSpireUrl = (endpoint = '') => {
  return `${config.spire.baseUrl}${endpoint}`;
};

// 📱 Mobile Network Helpers
export const getMobileTimeout = () => {
  return config.mobile.timeout;
};

export const getMobileRetryConfig = () => {
  return {
    attempts: config.mobile.retryAttempts,
    delay: config.mobile.retryDelay
  };
};

export const isMobileDevice = () => {
  return config.isMobile;
};

// 📋 Export everything
export default config;

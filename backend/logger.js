import winston from 'winston';

// Create a console-only logger for serverless environments
const createLogger = () => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ];

  // Only add file transports in development
  if (process.env.NODE_ENV === 'development') {
    try {
      const DailyRotateFile = require('winston-daily-rotate-file');
      transports.push(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d'
        })
      );
    } catch (error) {
      // File logging not available, continue with console only
    }
  }

  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports,
    exitOnError: false
  });
};

const logger = createLogger();

// Create a stream object for Morgan (HTTP logging)
const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Logging functions
export const logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection?.remoteAddress
  });
};

export const logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export const logDatabase = (operation, table, duration, success, details = {}) => {
  logger.info('Database operation', {
    operation,
    table,
    duration: `${duration}ms`,
    success,
    ...details
  });
};

export const logApiCall = (endpoint, method, duration, success, details = {}) => {
  logger.info('API call', {
    endpoint,
    method,
    duration: `${duration}ms`,
    success,
    ...details
  });
};

export const logAuth = (action, userId, success, details = {}) => {
  logger.info('Authentication event', {
    action,
    userId,
    success,
    ...details
  });
};

export { logger, stream };
export default logger;

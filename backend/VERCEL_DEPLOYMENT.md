# Vercel Deployment Guide

## Current Issue
Your Vercel deployment is failing with a 500 Internal Server Error due to several compatibility issues:

1. **Database initialization on startup** - The server tries to connect to PostgreSQL immediately, which fails on Vercel
2. **File-based logging** - Winston tries to write to log files, which isn't allowed in serverless functions
3. **Missing environment variables** - Database credentials and other sensitive data need to be configured

## What I Fixed

### 1. Created Vercel-Compatible API Structure
- Moved the main server logic to `api/index.js`
- Updated `vercel.json` to point to the new API file
- Added lazy database initialization (only connects when needed)

### 2. Fixed Logging Issues
- Updated `logger.js` to use console-only logging in production
- Removed file-based logging that causes crashes in serverless environments

### 3. Environment Variables
You need to set these environment variables in your Vercel project:

```bash
# Database Configuration
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Spire API Configuration
SPIRE_BASE_URL=https://your-spire-instance.com:port
SPIRE_COMPANY=your-company-name
SPIRE_AUTH=Basic your-base64-encoded-credentials

# Company Information
COMPANY_NAME=Your Company Name

# Environment
NODE_ENV=production
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your Time-Tracking project
3. Go to Settings → Environment Variables
4. Add each variable from the list above
5. Redeploy your project

## Testing the Fix

After setting the environment variables and redeploying:

1. Test the health endpoint: `https://your-domain.vercel.app/api/health`
2. This should return a success response instead of crashing

## Important Notes

- **Database connections are now lazy-loaded** - they only connect when an API endpoint is called
- **File logging is disabled in production** - all logs go to Vercel's console
- **The server no longer crashes on startup** if database is unavailable
- **Environment variables are required** for the app to function properly

## Next Steps

1. Set the environment variables in Vercel
2. Redeploy your project
3. Test the health endpoint
4. If successful, test your other API endpoints

## Troubleshooting

If you still get errors after setting environment variables:
1. Check Vercel logs for specific error messages
2. Ensure your database is accessible from Vercel's servers
3. Verify all environment variables are set correctly
4. Check that your database credentials are valid

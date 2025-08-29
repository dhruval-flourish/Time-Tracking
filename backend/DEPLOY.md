# 🚀 Quick Deployment Guide

## Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
vercel --prod
```

### 4. Set Environment Variables
Go to Vercel Dashboard → Project Settings → Environment Variables and add:

```
DB_HOST=your-database-host
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password
SPIRE_BASE_URL=https://your-spire-api.com
SPIRE_COMPANY=your-company
SPIRE_AUTH=your-auth-token
JWT_SECRET=your-jwt-secret
NODE_ENV=production
```

## Deploy to GitHub

### 1. Create New Repository
- Go to GitHub and create a new repository named `flourish-backend`
- Don't initialize with README (we already have one)

### 2. Initialize Git and Push
```bash
git init
git add .
git commit -m "Initial commit: Flourish Backend API"
git branch -M main
git remote add origin https://github.com/yourusername/flourish-backend.git
git push -u origin main
```

## Test Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Create .env File
Copy the environment variables from above into a `.env` file

### 3. Start Server
```bash
npm run dev
```

### 4. Test Health Endpoint
```bash
curl http://localhost:3001/api/health
```

## Your API Will Be Available At:
- **Local**: `http://localhost:3001`
- **Vercel**: `https://your-project.vercel.app`
- **GitHub**: Your repository URL

## Next Steps:
1. Deploy to Vercel
2. Set environment variables
3. Test your endpoints
4. Update frontend to use new backend URL
5. 🎉 You're live!

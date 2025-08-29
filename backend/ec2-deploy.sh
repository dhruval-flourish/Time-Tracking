#!/bin/bash

# EC2 Deployment Script for Flourish Backend
# Run this after uploading your code to EC2

echo "🚀 Deploying Flourish Backend on EC2..."

# Navigate to app directory
cd /var/www/flourish-backend

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install --production

# Create environment file
echo "🔧 Setting up environment variables..."
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# Database Configuration
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Spire API Configuration
SPIRE_API_URL=your-spire-api-url
SPIRE_API_KEY=your-spire-api-key
SPIRE_USERNAME=your-spire-username
SPIRE_PASSWORD=your-spire-password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
EOF
    echo "⚠️  Please edit .env file with your actual values!"
fi

# Stop existing PM2 process if running
echo "🛑 Stopping existing PM2 process..."
pm2 stop flourish-backend 2>/dev/null || true
pm2 delete flourish-backend 2>/dev/null || true

# Start with PM2
echo "🚀 Starting backend with PM2..."
pm2 start server.js --name flourish-backend --env production

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on boot
echo "🔧 Setting up PM2 startup script..."
pm2 startup

# Copy nginx configuration
echo "🌐 Setting up nginx..."
sudo cp nginx.conf /etc/nginx/conf.d/flourish-backend.conf

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    # Reload nginx
    sudo systemctl reload nginx
    echo "🔄 Nginx reloaded"
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# Show status
echo "📊 Deployment Status:"
pm2 status
echo ""
echo "🌐 Nginx Status:"
sudo systemctl status nginx --no-pager -l

echo ""
echo "✅ Deployment complete!"
echo "🌍 Your backend should be accessible at: http://your-ec2-ip"
echo "📋 Useful commands:"
echo "  - View logs: pm2 logs flourish-backend"
echo "  - Restart: pm2 restart flourish-backend"
echo "  - Stop: pm2 stop flourish-backend"
echo "  - Monitor: pm2 monit"

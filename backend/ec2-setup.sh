#!/bin/bash

# EC2 Setup Script for Flourish Backend
# Run this on your EC2 instance after connecting via SSH

echo "🚀 Setting up Flourish Backend on EC2..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Node.js 18.x
echo "📦 Installing Node.js 18.x..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install nginx for reverse proxy
echo "📦 Installing nginx..."
sudo yum install -y nginx

# Start nginx
echo "🚀 Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Create app directory
echo "📁 Creating app directory..."
sudo mkdir -p /var/www/flourish-backend
sudo chown ec2-user:ec2-user /var/www/flourish-backend

echo "✅ EC2 setup complete!"
echo "📋 Next steps:"
echo "1. Upload your backend code to /var/www/flourish-backend"
echo "2. Run: cd /var/www/flourish-backend && npm install"
echo "3. Run: pm2 start server.js --name flourish-backend"
echo "4. Configure nginx reverse proxy"
echo "5. Set up environment variables"

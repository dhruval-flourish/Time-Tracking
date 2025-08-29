#!/bin/bash

echo "🚀 Deploying Backend to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel first:"
    vercel login
fi

echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!"
echo "🌐 Your backend is now live on Vercel!"
echo "📋 Don't forget to set environment variables in Vercel dashboard"

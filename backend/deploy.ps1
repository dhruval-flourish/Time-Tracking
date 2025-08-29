# PowerShell Deployment Script for Vercel

Write-Host "🚀 Deploying Backend to Vercel..." -ForegroundColor Green

# Check if Vercel CLI is installed
try {
    $vercelVersion = vercel --version
    Write-Host "✅ Vercel CLI found: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Check if user is logged in
try {
    $user = vercel whoami
    Write-Host "✅ Logged in as: $user" -ForegroundColor Green
} catch {
    Write-Host "🔐 Please login to Vercel first:" -ForegroundColor Yellow
    vercel login
}

Write-Host "📦 Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Your backend is now live on Vercel!" -ForegroundColor Green
Write-Host "📋 Don't forget to set environment variables in Vercel dashboard" -ForegroundColor Yellow

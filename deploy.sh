#!/bin/bash

# Simple build and deploy script for gh-pages

echo "🚀 Building and deploying to GitHub Pages..."

# Ensure we're on main branch
git checkout main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project (try npm run build first, then npx as fallback)
echo "🔨 Building project..."
npm run build || npx vite build

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed - no dist folder found!"
    exit 1
fi

# Deploy to gh-pages
echo "📦 Deploying to gh-pages..."
git checkout gh-pages

# Clean up old files (keep .git)
rm -rf assets index.html vite.svg 2>/dev/null || true

# Copy built files
cp -r dist/* .
rm -rf dist node_modules

# Commit and push
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin gh-pages

# Back to main
git checkout main

echo "✅ Deployment complete!"
echo "🌐 Site: https://krydix.github.io/FranceRoadTrip/"

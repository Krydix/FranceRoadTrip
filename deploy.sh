#!/bin/bash

# Robust build and deploy script for gh-pages

echo "🚀 Building and deploying to GitHub Pages..."

# Ensure we're on main branch and up to date
git checkout main
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Clean any previous build artifacts
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build the project
echo "🔨 Building project..."
npm run build

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed - no dist folder found!"
    exit 1
fi

# Store the current commit hash for reference
CURRENT_COMMIT=$(git rev-parse HEAD)

# Create/switch to gh-pages branch
echo "📦 Deploying to gh-pages..."
git checkout gh-pages

# Clean up old files (keep .git)
rm -rf assets index.html vite.svg README.md 2>/dev/null || true

# Copy built files from dist folder
cp -r dist/* . 2>/dev/null || true

# Remove the dist folder
rm -rf dist

# Add all files and commit
git add -A
if git diff --cached --quiet; then
    echo "No changes to deploy"
else
    git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S') from commit $CURRENT_COMMIT"
    git push origin gh-pages
    echo "✅ Deployment successful!"
fi

# Back to main
git checkout main

echo "🌐 Site: https://krydix.github.io/FranceRoadTrip/"

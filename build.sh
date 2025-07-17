#!/bin/bash

# Build and deploy to gh-pages branch

echo "🚀 Building project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Switch to gh-pages branch
echo "� Deploying to gh-pages branch..."
git checkout gh-pages

# Remove old files but keep .git
find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} \;

# Copy new built files
cp -r dist/* .
rm -rf dist

# Commit and push
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
git push origin gh-pages

# Switch back to main
git checkout main

echo "✅ Deployment complete!"
echo "🌐 Your site will be available at: https://krydix.github.io/FranceRoadTrip/"
echo "📋 Note: It may take a few minutes for GitHub Pages to update"

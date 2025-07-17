#!/bin/bash

# Build the project
echo "Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📁 Built files are in the 'dist' directory"
    echo "🚀 GitHub Actions will automatically deploy when you push to main"
    echo "🌐 Your site will be available at: https://krydix.github.io/FranceRoadTrip/"
else
    echo "❌ Build failed!"
    exit 1
fi

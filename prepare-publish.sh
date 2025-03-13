#!/bin/bash

# Prepare the captide package for publishing to npm

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Clean the dist directory
echo "Cleaning dist directory..."
npm run clean

# Build the package
echo "Building package..."
npm run build

# Create npm pack
echo "Creating npm pack for testing..."
npm pack

echo ""
echo "Package prepared for publishing!"
echo ""
echo "To publish to npm, run:"
echo "npm publish"
echo ""
echo "Or to test locally, run:"
echo "npm install ./captide-x.y.z.tgz"
echo "" 
#!/usr/bin/env bash
set -e

echo "Assembling Resource Bank v7.0..."
cat Resource-Bank-v7.0.zip.part* > Resource-Bank-v7.0.zip

echo "Unpacking project..."
unzip -o Resource-Bank-v7.0.zip

echo "Cleaning temporary upload files..."
rm -f Resource-Bank-v7.0.zip Resource-Bank-v7.0.zip.part* INSTALL_RESOURCE_BANK.sh

echo "Committing Resource Bank files..."
git add .
git commit -m "Add Resource Bank v7.0 Cloudflare AI" || true
git push

echo ""
echo "DONE. Resource Bank v7.0 is now in this GitHub repository."

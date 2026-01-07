#!/bin/bash
# Migration Runner and Verification Script
# This script runs the migration and then verifies the results

set -e  # Exit on error

echo "=========================================="
echo "L0/L1/L2 Migration Runner"
echo "=========================================="
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ] && [ -z "$POSTGRES_URL" ]; then
    echo "❌ ERROR: DATABASE_URL or POSTGRES_URL environment variable not set"
    echo ""
    echo "Please set your database URL:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    echo "Or if using Vercel:"
    echo "  vercel env pull .env.local"
    echo "  export DATABASE_URL=\$(grep DATABASE_URL .env.local | cut -d '=' -f2-)"
    echo ""
    exit 1
fi

# Use POSTGRES_URL if DATABASE_URL not set
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="$POSTGRES_URL"
fi

echo "✅ Database URL found"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Run migration
echo "🚀 Running migration..."
npm run migrate

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Next: Run verification queries to check for data duplication"
echo "See: migrations/verify-migration.sql"


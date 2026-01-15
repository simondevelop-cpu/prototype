# App Health Dashboard Update

## Summary

Replaced the "Debugging Guide" tab with an "App Health" tab in the admin dashboard, featuring comprehensive health checks for the application and database.

## Changes Made

### 1. Created Health Check API Endpoint
**File:** `app/api/admin/health/route.ts`

A comprehensive health check endpoint that performs the following checks:

- ✅ **Environment Variables** - Verifies required env vars are set
- ✅ **Database Connection** - Tests database connectivity
- ✅ **Schema Tables** - Verifies all required tables exist
- ✅ **Database Extensions** - Checks pgcrypto extension
- ✅ **Data Migration** - Verifies L0/L1 migration status
- ✅ **Data Integrity** - Checks for orphaned records
- ✅ **Password Security** - Verifies bcrypt usage (flags legacy SHA-256)

Each check returns:
- Status: `pass`, `fail`, or `warning`
- Description: What the check verifies
- Message: Human-readable result
- Details: Additional diagnostic information

### 2. Updated Admin Dashboard
**File:** `app/admin/page.tsx`

- Changed tab name from "🐛 Debugging Guide" to "🏥 App Health"
- Updated tab type from `'debugging'` to `'health'`
- Created new `renderAppHealth()` function with:
  - Overall status display (green/yellow/red)
  - Individual health check cards with:
    - Status icons (✅/❌/⚠️)
    - Color-coded borders (green/yellow/red)
    - Detailed descriptions
    - Expandable details sections
  - Refresh button to manually trigger health checks
  - Auto-fetch on tab activation

### 3. Security Review

All critical security implementations are in place:

✅ **Password Hashing** - bcrypt with 12 rounds (`lib/auth.ts`)
✅ **Rate Limiting** - In-memory rate limiter (`lib/rate-limit.ts`)
✅ **CSRF Protection** - Origin verification (`lib/csrf.ts`)
✅ **Onboarding Completion Check** - Middleware protection (`lib/auth-middleware.ts`)

The health check endpoint will flag any issues with password security (legacy SHA-256 hashes).

## Features

### Health Check Cards
Each check displays:
- **Status Icon**: ✅ (pass), ❌ (fail), ⚠️ (warning)
- **Color Coding**: Green/yellow/red borders based on status
- **Description**: Explains what the check verifies
- **Message**: Clear status message
- **Details**: Expandable JSON with diagnostic info

### Overall Status
- Shows summary: X passed, Y warnings, Z failed
- Color-coded based on overall health
- Timestamp of last check

### Refresh Functionality
- Manual refresh button
- Auto-fetch when health tab is activated
- Loading states during checks

## Testing

To test the health checks:

1. Navigate to Admin Dashboard
2. Click "🏥 App Health" tab
3. Review all health checks
4. Click "🔄 Refresh" to re-run checks
5. Expand "View Details" on any check for more information

## API Endpoint

The health check endpoint is available at:
```
GET /api/admin/health
```

Returns JSON with:
```json
{
  "status": "pass|fail|warning",
  "timestamp": "ISO timestamp",
  "checks": [
    {
      "name": "Check Name",
      "description": "What it checks",
      "status": "pass|fail|warning",
      "message": "Status message",
      "details": { /* optional diagnostic info */ }
    }
  ],
  "summary": {
    "total": 7,
    "passed": 6,
    "warnings": 1,
    "failed": 0
  }
}
```

## Notes

- The health checks are non-invasive (read-only)
- Some checks may show warnings if tables don't exist yet (pre-migration)
- Password security check will flag users with legacy SHA-256 hashes
- All checks gracefully handle missing tables/extensions


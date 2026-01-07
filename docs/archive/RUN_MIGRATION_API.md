# Run Migration via API Endpoint 🚀

Perfect! Now you can run the migration just like the other migrations.

## Steps:

### 1. Deploy the Changes
The new endpoint will be available after your next deployment, OR if you're running locally, it's available now.

### 2. Run the Migration

**Option A: Check Status First (GET)**
Visit in your browser:
```
https://your-app.vercel.app/api/admin/migrate-l0-l1-l2
```

This shows you the current state (which tables exist, counts, etc.)

**Option B: Run Migration (POST)**
You can trigger it by:

1. **Using curl:**
```bash
curl -X POST https://your-app.vercel.app/api/admin/migrate-l0-l1-l2
```

2. **Using a tool like Postman/Insomnia:**
   - Method: POST
   - URL: `https://your-app.vercel.app/api/admin/migrate-l0-l1-l2`
   - Click Send

3. **From browser console (on your app):**
```javascript
fetch('/api/admin/migrate-l0-l1-l2', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

### 3. Expected Response

**Success:**
```json
{
  "success": true,
  "message": "L0/L1/L2 migration completed successfully",
  "steps": [
    "✅ Database connection established",
    "✅ Schema creation completed",
    "✅ Data migration completed",
    "✅ Verification: 15 tokenized users, 599 transactions, 15 customers"
  ],
  "verification": {
    "tokenizedUsers": 15,
    "piiRecords": 15,
    "transactionFacts": 599,
    "customerFacts": 15,
    "categories": 25,
    "orphanedTransactions": 0
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Migration failed",
  "details": "error message here",
  "steps": [...],
  "errors": [...]
}
```

## ⚠️ Important Notes

- This endpoint runs the FULL migration (schema + data)
- It's idempotent - safe to run multiple times (uses IF NOT EXISTS, ON CONFLICT)
- May take 30-60 seconds depending on data size
- Returns detailed status and verification

## After Migration

Once you see `success: true`, your migration is complete! Test your app to verify everything works.


# 📄 Statement Upload & Review Flow

## 🎯 Overview

The new statement upload system provides a **comprehensive review process** before importing transactions into the database. Users can review, edit, and approve/reject transactions in multiple categories.

---

## 🔄 Flow Diagram

```
┌─────────────────┐
│  Upload PDFs    │ ← User uploads 1-6 PDF statements
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parse Files    │ ← Extract transactions (NO database writes)
│  /api/statements│   - Detect bank & account type
│  /parse         │   - Parse transactions
│                 │   - Check for duplicates
└────────┬────────┘   - Auto-categorize
         │
         ▼
┌─────────────────────────────────────────────────────┐
│          REVIEW MODAL (Multi-Step)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Step 1: 🔴 DUPLICATES                              │
│  ├─ Default: EXCLUDED                               │
│  ├─ User can override to include                    │
│  └─ Shows: "X of Y duplicates will be imported"   │
│                                                     │
│  Step 2: ⚠️ UNCATEGORIZED                           │
│  ├─ Default: INCLUDED                               │
│  ├─ User should review/edit                         │
│  └─ Edit: merchant, category, amount                │
│                                                     │
│  Step 3: 💸 EXPENSES                                │
│  ├─ Default: INCLUDED                               │
│  ├─ Auto-categorized                                │
│  └─ User can edit/exclude                           │
│                                                     │
│  Step 4: 💰 INCOME                                  │
│  ├─ Default: INCLUDED                               │
│  ├─ Auto-categorized                                │
│  └─ User can edit/exclude                           │
│                                                     │
│  Step 5: 📊 CONFIRM                                 │
│  ├─ Shows total count & net amount                  │
│  ├─ Preview of transactions                         │
│  └─ Final confirmation                              │
│                                                     │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Import to DB   │ ← Only approved transactions inserted
│  /api/statements│
│  /import        │
└─────────────────┘
```

---

## 📁 New Files

### 1. `app/api/statements/parse/route.ts`
**Purpose**: Parse PDFs without inserting into database

**Flow**:
1. Accepts multipart form data (up to 6 PDFs)
2. Calls `parseBankStatement()` for each file
3. Detects duplicates by querying database
4. Categorizes transactions into 4 groups:
   - Duplicates
   - Uncategorized
   - Expenses
   - Income
5. Returns detailed transaction data (NO insertion)

**Response Format**:
```json
{
  "results": [
    {
      "filename": "TD_Statement.pdf",
      "status": "success",
      "bank": "TD",
      "accountType": "Credit Card",
      "totalTransactions": 25,
      "categorized": {
        "duplicates": [...],
        "uncategorized": [...],
        "expenses": [...],
        "income": [...]
      }
    }
  ]
}
```

---

### 2. `app/api/statements/import/route.ts`
**Purpose**: Import reviewed/edited transactions

**Flow**:
1. Receives array of transactions from frontend
2. Inserts each transaction into database
3. Uses `ON CONFLICT DO NOTHING` for safety
4. Returns count of imported vs. total

**Request Format**:
```json
{
  "transactions": [
    {
      "date": "2025-08-12",
      "merchant": "Starbucks",
      "description": "Coffee",
      "amount": -5.50,
      "cashflow": "expense",
      "category": "Food & Dining",
      "account": "Credit Card",
      "label": ""
    },
    ...
  ]
}
```

**Response Format**:
```json
{
  "imported": 24,
  "total": 25,
  "errors": ["Optional array of error messages"]
}
```

---

### 3. `components/StatementReviewModal.tsx`
**Purpose**: Comprehensive multi-step review UI

**Features**:
- **Step Navigation**: 5 steps (duplicates → uncategorized → expenses → income → confirm)
- **Checkbox Toggle**: Include/exclude individual transactions
- **Inline Editing**: Edit merchant, category, amount
- **Smart Defaults**:
  - Duplicates: EXCLUDED by default
  - Everything else: INCLUDED by default
- **Visual Indicators**:
  - Color-coded categories
  - Progress bar
  - Transaction counts per category
- **Preview Summary**: Shows what will be imported before confirmation

**State Management**:
- `excludedTransactions`: Set of transaction keys to exclude
- `editedTransactions`: Map of edited transaction data
- `editingTransaction`: Currently open edit modal

---

## 🔧 Modified Files

### 1. `lib/pdf-parser.ts`

**Added**:
- `insertTransactionsWithDuplicateCheck()`: Checks for existing transactions before insert
- Returns `newTransactions` and `duplicateTransactions` arrays
- Updated `ParseResult` interface to include duplicate info

**Key Logic**:
```typescript
// Check if transaction exists
const existingCheck = await pool.query(
  `SELECT id FROM transactions 
   WHERE user_id = $1 AND date = $2 AND amount = $3 
   AND merchant = $4 AND cashflow = $5`,
  [userId, tx.date, tx.amount, tx.merchant, tx.cashflow]
);

if (existingCheck.rows.length > 0) {
  duplicateTransactions.push(tx);
} else {
  newTransactions.push(tx);
}
```

---

### 2. `components/StatementUploadModal.tsx`

**Changes**:
- Now calls `/api/statements/parse` instead of `/api/statements/upload`
- Stores parsed results in `parsedStatements` state
- Opens `StatementReviewModal` when parsing completes
- Modal stays open until user reviews and confirms

**New Flow**:
1. User uploads PDFs
2. Click "Upload" → Calls parse endpoint
3. Parse completes → Opens review modal
4. Review modal overlays upload modal
5. Import completes → Closes both modals, refreshes data

---

## 🎨 User Experience

### Before (Old Flow)
```
Upload PDF → Auto-import → Done
❌ No control
❌ Duplicates imported silently
❌ No chance to fix errors
❌ No preview
```

### After (New Flow)
```
Upload PDF → Parse → Review → Edit → Confirm → Import
✅ Full control
✅ Duplicates flagged
✅ Edit before import
✅ Preview summary
```

---

## 📝 Edit Capabilities

Users can edit the following fields for each transaction:
- **Merchant**: Update merchant name
- **Category**: Change auto-categorization
- **Amount**: Fix incorrect amounts
- **Include/Exclude**: Toggle checkbox

**Note**: Date, description, account, and cashflow are not editable in v1 (can be added later if needed)

---

## 🧪 Testing Checklist

After deployment, test:

1. **Upload a new statement** (no duplicates)
   - [ ] All transactions appear in review
   - [ ] Duplicates step shows "0 duplicates"
   - [ ] Expenses/income are categorized correctly
   - [ ] Can edit a transaction
   - [ ] Can exclude a transaction
   - [ ] Import completes successfully

2. **Upload same statement twice**
   - [ ] First upload: All transactions imported
   - [ ] Second upload: All transactions in "Duplicates" step
   - [ ] Duplicates are EXCLUDED by default
   - [ ] Can override to include duplicates if desired

3. **Upload statement with uncategorized transactions**
   - [ ] Uncategorized step shows transactions
   - [ ] Can edit category before import
   - [ ] Edits persist through import

4. **Upload multiple statements at once**
   - [ ] All statements parsed
   - [ ] Transactions from all files shown
   - [ ] Filename shown for each transaction

5. **Error handling**
   - [ ] Invalid PDF shows error
   - [ ] Image-based PDF shows helpful message
   - [ ] Can cancel during review
   - [ ] Can go back through steps

---

## 🚀 Deployment

```bash
git push origin fix/auth-login
# Merge to main via GitHub
# Vercel auto-deploys
```

---

## 📊 Database Impact

**Old System**:
- Immediate INSERT with ON CONFLICT DO NOTHING
- Silent duplicate skipping
- No user awareness

**New System**:
- Query first to detect duplicates
- Present to user for review
- INSERT only approved transactions
- Explicit user control

**Performance**:
- Duplicate check adds ~10-50ms per transaction
- Worth it for UX improvement
- Only runs during upload (rare operation)

---

## 🔮 Future Enhancements

Potential improvements:
1. **Batch editing**: Edit category for multiple transactions at once
2. **Smart categorization**: Learn from user edits
3. **Merge duplicates**: For partial duplicates, merge the better data
4. **Save draft**: Save review state and come back later
5. **Rules engine**: "Always categorize Starbucks as Food & Dining"
6. **OCR support**: For image-based PDFs
7. **Edit more fields**: Date, description, account
8. **Undo import**: Bulk delete recently imported transactions

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Check Vercel function logs (`/api/statements/parse` or `/api/statements/import`)
3. Verify database connection
4. Test with a simple 1-page statement first

---

**Created**: Oct 22, 2025  
**Version**: 1.0  
**Status**: Ready for testing 🚀


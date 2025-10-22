# 🎨 Statement Review UI Guide

## Visual Flow

### **Step 1: Upload Modal**
```
┌─────────────────────────────────────────────────────────┐
│ Upload Bank Statements                              ✕   │
│ Upload up to 6 PDF statements from major Canadian banks │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✓ RBC  ✓ TD  ✓ Scotiabank  ✓ BMO  ✓ CIBC  ✓ Tangerine│
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │   📄  Drop PDF statements here or click to      │   │
│  │       browse                                      │   │
│  │       Max 6 files, 5MB each                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📋 Selected Files (1/6)                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📄 TD_Credit_Card_Statement.pdf         1.2 MB  ✕│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🔒 Your privacy is protected                           │
│  Files are processed securely and never stored          │
│                                                         │
│                             [Cancel] [Upload 1 File]   │
└─────────────────────────────────────────────────────────┘
```

---

### **Step 2: Review Modal - Duplicates**
```
┌───────────────────────────────────────────────────────────────┐
│ Review Transactions                                       ✕   │
│ Review and edit transactions before importing                 │
├───────────────────────────────────────────────────────────────┤
│ [duplicates] → uncategorized → expenses → income → confirm    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 🔴 Duplicate Transactions                                     │
│ These transactions already exist in your database. By default,│
│ they are EXCLUDED from import. Check to include duplicates.  │
│ 0 of 3 duplicates will be imported.                           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☐ Starbucks                              -$5.50      │    │
│  │   Coffee purchase                                     │    │
│  │   Aug 12, 2025 • Credit Card • Food & Dining         │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☐ Metro Plus Westmount                   -$18.39     │    │
│  │   Grocery purchase                                    │    │
│  │   Aug 12, 2025 • Credit Card • Groceries             │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│                                         [Cancel] [Next →]    │
└───────────────────────────────────────────────────────────────┘
```

---

### **Step 3: Review Modal - Uncategorized**
```
┌───────────────────────────────────────────────────────────────┐
│ Review Transactions                                       ✕   │
│ Review and edit transactions before importing                 │
├───────────────────────────────────────────────────────────────┤
│ duplicates → [uncategorized] → expenses → income → confirm    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ⚠️ Uncategorized Transactions                                 │
│ These transactions couldn't be automatically categorized.     │
│ Review and edit as needed.                                    │
│ 2 of 2 will be imported.                                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☑ Unknown Merchant ABC123                -$42.00     │    │
│  │   Unknown transaction                                 │    │
│  │   Sep 1, 2025 • Credit Card • Uncategorised          │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☑ XYZ Corp                               -$99.99     │    │
│  │   Payment                                             │    │
│  │   Sep 5, 2025 • Credit Card • Uncategorised          │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│                                    [← Previous] [Next →]     │
└───────────────────────────────────────────────────────────────┘
```

---

### **Step 4: Review Modal - Expenses**
```
┌───────────────────────────────────────────────────────────────┐
│ Review Transactions                                       ✕   │
│ Review and edit transactions before importing                 │
├───────────────────────────────────────────────────────────────┤
│ duplicates → uncategorized → [expenses] → income → confirm    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 💸 Expense Transactions                                       │
│ These transactions were automatically categorized as expenses.│
│ 18 of 18 will be imported.                                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☑ Petro-Canada                           -$7.10      │    │
│  │   Gas purchase                                        │    │
│  │   Aug 15, 2025 • Credit Card • Transportation        │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☑ Tim Hortons #2169                      -$7.04      │    │
│  │   Coffee purchase                                     │    │
│  │   Aug 23, 2025 • Credit Card • Food & Dining         │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ... and 16 more                                              │
│                                                               │
│                                    [← Previous] [Next →]     │
└───────────────────────────────────────────────────────────────┘
```

---

### **Step 5: Review Modal - Income**
```
┌───────────────────────────────────────────────────────────────┐
│ Review Transactions                                       ✕   │
│ Review and edit transactions before importing                 │
├───────────────────────────────────────────────────────────────┤
│ duplicates → uncategorized → expenses → [income] → confirm    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 💰 Income Transactions                                        │
│ These transactions were automatically categorized as income.  │
│ 1 of 1 will be imported.                                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ☑ Preauthorized Payment                  +$890.90    │    │
│  │   Credit card payment                                 │    │
│  │   Sep 2, 2025 • Credit Card • Payment                │    │
│  │   TD_Credit_Card_Statement.pdf                       │    │
│  │   ✏️ Edit                                             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│                                    [← Previous] [Next →]     │
└───────────────────────────────────────────────────────────────┘
```

---

### **Step 6: Review Modal - Confirm**
```
┌───────────────────────────────────────────────────────────────┐
│ Review Transactions                                       ✕   │
│ Review and edit transactions before importing                 │
├───────────────────────────────────────────────────────────────┤
│ duplicates → uncategorized → expenses → income → [confirm]    │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ 📊 Import Summary                                             │
│                                                               │
│  Total Transactions          Net Amount                       │
│        21                    -$245.67                         │
│                                                               │
│ ────────────────────────────────────────────────────────────  │
│                                                               │
│ Preview                                                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Petro-Canada                             -$7.10      │    │
│  │ Aug 15, 2025 • Transportation                        │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Tim Hortons #2169                        -$7.04      │    │
│  │ Aug 23, 2025 • Food & Dining                         │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Preauthorized Payment                    +$890.90    │    │
│  │ Sep 2, 2025 • Payment                                │    │
│  └──────────────────────────────────────────────────────┘    │
│  ... and 18 more                                              │
│                                                               │
│                         [← Previous] [✓ Import 21 Transactions]│
└───────────────────────────────────────────────────────────────┘
```

---

### **Edit Transaction Modal** (Overlay)
```
┌─────────────────────────────────────┐
│ Edit Transaction               ✕   │
├─────────────────────────────────────┤
│                                     │
│ Merchant                            │
│ ┌─────────────────────────────────┐ │
│ │ Starbucks                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Category                            │
│ ┌─────────────────────────────────┐ │
│ │ Food & Dining                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Amount                              │
│ ┌─────────────────────────────────┐ │
│ │ 5.50                            │ │
│ └─────────────────────────────────┘ │
│                                     │
│                                     │
│         [Cancel]      [Save]        │
└─────────────────────────────────────┘
```

---

## 🎨 Color Coding

### Status Colors
- 🔴 **Red/Yellow** = Duplicates (warning, excluded by default)
- ⚠️ **Orange** = Uncategorized (needs attention)
- 💸 **Red** = Expenses (auto-categorized)
- 💰 **Green** = Income (auto-categorized)
- 📊 **Blue** = Confirmation (summary)

### Transaction Colors
- **Expense amount**: Red text (e.g., -$5.50)
- **Income amount**: Green text (e.g., +$890.90)
- **Selected (checkbox checked)**: White background, full opacity
- **Excluded (checkbox unchecked)**: Gray background, reduced opacity

---

## 🔄 User Interactions

### Checkbox Behavior
- **Click checkbox**: Toggle include/exclude
- **For duplicates**: Unchecked by default (excluded)
- **For others**: Checked by default (included)
- **Visual feedback**: Background color changes

### Edit Button
- **Click "✏️ Edit"**: Opens inline edit modal
- **Edit fields**: Merchant, Category, Amount
- **Save**: Updates transaction in review state
- **Cancel**: Discards changes

### Navigation
- **Next →**: Advances to next step
- **← Previous**: Returns to previous step
- **Cancel**: Closes entire review flow
- **✓ Import**: Confirms and imports

---

## 📱 Responsive Design

### Desktop (> 768px)
- Modal width: `max-w-4xl` (896px)
- 2-column grid for categorized list
- Full edit form visible

### Tablet/Mobile (< 768px)
- Modal width: `90vw`
- Single column layout
- Stacked edit form
- Scrollable transaction list

---

## ⚡ Performance Optimizations

### Rendering
- Virtualized lists for > 50 transactions
- Lazy loading of transaction details
- Debounced edit inputs

### State Management
- Set for O(1) lookups (excluded transactions)
- Map for O(1) edits (edited transactions)
- Immutable updates for React re-renders

---

## 🧪 Testing Scenarios

### Happy Path
1. Upload valid PDF
2. Review each category
3. Make one edit
4. Exclude one transaction
5. Confirm and import
6. ✅ Success message

### Duplicate Handling
1. Upload same PDF twice
2. First time: All imported
3. Second time: All in duplicates
4. Override one duplicate
5. Import
6. ✅ Only overridden duplicate inserted

### Error Handling
1. Upload invalid PDF
2. ❌ Error shown in upload modal
3. Upload valid + invalid
4. ✅ Valid one opens review
5. ❌ Invalid one shows error

---

## 🎯 Key Features

1. **Visual Clarity**: Color-coded categories, clear labels
2. **User Control**: Checkbox toggles, inline editing
3. **Smart Defaults**: Duplicates excluded, others included
4. **Progress Tracking**: Step indicator, transaction counts
5. **Preview**: See exactly what will be imported
6. **Responsive**: Works on mobile, tablet, desktop
7. **Accessible**: Keyboard navigation, screen reader friendly

---

**Visual Design** by Claude Sonnet 4.5 🎨  
**Created**: Oct 22, 2025


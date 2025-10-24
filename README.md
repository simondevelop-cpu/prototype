# Canadian Insights 💰📊

A modern, AI-ready personal finance management application built for Canadians. Track your spending, visualize cash flow, and gain insights into your financial habits.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2.0-black.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

### 📊 **Dashboard**
- **Interactive Cash Flow Chart** - Visualize income, expenses, and other transactions over time
- **Time Range Filters** - View data for 3 months, 6 months, 12 months, or custom date ranges
- **Clickable Charts** - Click on bars to drill down into specific months and categories
- **Real-time Stats Cards** - Total Income, Total Expenses, and Net Cash Flow at a glance
- **Category Breakdown** - See where your money goes with detailed expense categorization
- **Percentage Analysis** - Visual breakdowns showing % of total for each category

### 💳 **Transactions**
- **Complete Transaction Management**
  - ✅ Add new transactions manually
  - ✅ Edit existing transactions inline
  - ✅ Delete transactions with confirmation
  - ✅ Bulk update multiple transactions at once
  - ✨ **Upload PDF bank statements** (NEW!)
- **PDF Statement Upload** 🆕
  - Drag & drop PDF statements
  - Supports TD, RBC, CIBC, National Bank, Amex
  - Multi-step review flow with duplicate detection
  - Smart categorization into expenses, income, and other (transfers)
  - Edit account names and verify totals before import
- **Powerful Filtering & Search**
  - Universal search across description, amount, category, label
  - Filter by date range, category, account, cashflow type
  - Persistent selection across filters
- **Smart Categorization**
  - Auto-categorize as "Uncategorised" if no category provided
  - Autocomplete for categories and accounts
- **Bulk Operations**
  - Select multiple transactions with checkboxes
  - Bulk recategorize, change account, or update labels
  - Shows selection count and total amount

### 🔐 **Authentication**
- Secure JWT-based authentication
- User registration with hashed passwords
- Demo account with 12 months of realistic Canadian transaction data
- Multi-user support with data isolation

### 🛠️ **Admin Dashboard** 🆕
- **Secure Admin Login** - Separate admin authentication at `/admin/login`
- **Category Engine Management**
  - **Patterns Tab** - Manage keywords and merchants for auto-categorization
    - View/edit/delete keywords and merchants
    - Inline editing (double-click cells to edit)
    - Multi-select filtering by category and label
    - Bulk delete operations
    - Add alternate merchant patterns (e.g., "TIMHORT" for "TIM HORTONS")
  - **Recategorization Log** - Track user recategorizations
    - See what patterns users are creating
    - Monitor categorization frequency and accuracy
    - Mark recategorizations as reviewed
- **Accounts Tab** - View all registered users and their activity
- **Analytics, Insights, Inbox** - Placeholder tabs for future features
- **Auto-Categorization Engine Display** - Shows the 3-tier logic:
  1. User History (highest priority)
  2. Merchant Matching
  3. Keyword Search (first match)

### 🎨 **Modern UI/UX**
- Built with Next.js 14 and React
- Styled with Tailwind CSS
- Responsive design (mobile, tablet, desktop)
- Beautiful modals and interactive components
- Smooth transitions and loading states

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (or use Vercel serverless)
- PostgreSQL database (Vercel Neon recommended)

### Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secret-key-change-this-in-production
DEMO_EMAIL=demo@example.com
DEMO_PASSWORD=demo123
```

### Installation

```bash
# Install dependencies
npm install

# Run database initialization (creates tables and seeds demo data)
node init-db.js

# Start development server
npm run dev
```

Visit `http://localhost:3000` and log in with:
- **Email**: demo@example.com
- **Password**: demo123

### Deployment (Vercel)

1. **Connect to GitHub**
   - Push your code to GitHub
   - Import project in Vercel

2. **Add Neon Postgres**
   - In Vercel dashboard → Storage → Create Database
   - Choose Neon (serverless Postgres)
   - Select your region and auth method

3. **Set Environment Variables**
   - Vercel auto-creates `DATABASE_URL`
   - Add `JWT_SECRET`, `DEMO_EMAIL`, `DEMO_PASSWORD`

4. **Deploy**
   ```bash
   git push origin main
   ```
   - Vercel auto-deploys on push
   - Database initializes lazily on first request

---

## 📁 Project Structure

```
prototype/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── login/            # POST /api/auth/login
│   │   │   └── register/         # POST /api/auth/register
│   │   ├── transactions/         # Transaction CRUD
│   │   │   ├── create/           # POST /api/transactions/create
│   │   │   ├── update/           # PUT /api/transactions/update
│   │   │   ├── delete/           # DELETE /api/transactions/delete
│   │   │   ├── bulk-update/      # POST /api/transactions/bulk-update
│   │   │   └── route.ts          # GET /api/transactions
│   │   ├── summary/              # GET /api/summary (dashboard data)
│   │   └── categories/           # GET /api/categories (breakdown)
│   ├── globals.css               # Tailwind directives
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main entry (auth wrapper)
├── components/                   # React Components
│   ├── Dashboard.tsx             # Main dashboard with tabs
│   ├── CashflowChart.tsx         # Interactive Recharts bar chart
│   ├── TransactionsList.tsx      # Transaction table with CRUD
│   ├── TransactionModal.tsx      # Add/Edit transaction form
│   ├── BulkRecategorizeModal.tsx # Bulk update modal
│   └── Login.tsx                 # Login/Register forms
├── lib/                          # Shared utilities
│   ├── auth.ts                   # JWT & password hashing
│   └── db.ts                     # PostgreSQL connection pool
├── server.js                     # Express backend (demo data seeding)
├── init-db.js                    # Database initialization script
├── package.json                  # Dependencies
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
└── vercel.json                   # Vercel deployment config
```

---

## 🤖 Auto-Categorization Engine

Canadian Insights features a powerful, database-driven categorization engine that automatically classifies your transactions. The system uses a three-tier priority approach to ensure accuracy while learning from your preferences.

### How It Works

The categorization engine processes transactions in this **priority order**:

#### 1️⃣ **User History** (Highest Priority)
- Your past recategorizations are stored and checked first
- If you've corrected a transaction before, that pattern is remembered
- **Confidence: 95-100%** (boosted by frequency)
- Example: If you recategorized "UBER EATS" from Transport to Food, all future "UBER EATS" transactions automatically go to Food

#### 2️⃣ **Merchant Matching**
- 200+ pre-loaded Canadian merchants (Tim Hortons, Loblaws, Rogers, etc.)
- Supports **alternate patterns** for merchant name variations
  - Example: "TIM HORTONS" also matches "TIMHORT", "TIM HORT", "HORTONS"
- **Confidence: 90%**
- **Space-insensitive matching** catches descriptions like "TIMHORTONS" (no space)

#### 3️⃣ **Keyword Search** (First Match Wins)
- 70+ curated keywords for Canadian spending patterns
- Searches by **category priority order**:
  ```
  Housing → Bills → Subscriptions → Food → Travel → 
  Health → Transport → Education → Personal → Shopping → Work
  ```
- **First match wins** - fast and predictable
- **Confidence: 85%**
- Example: "HYDRO" keyword matches before generic "ELECTRIC" due to category priority

### Category Priority Order

The engine searches categories in this specific order to avoid misclassification:

1. **Housing** - Rent, mortgage, pets, daycare
2. **Bills** - Utilities, phone, internet, insurance
3. **Subscriptions** - Netflix, Spotify, streaming services
4. **Food** - Groceries, restaurants, coffee
5. **Travel** - Hotels, flights, bookings
6. **Health** - Pharmacy, medical, dental
7. **Transport** - Transit, taxis, gas, parking
8. **Education** - Tuition, textbooks, courses
9. **Personal** - Entertainment, gym, hobbies
10. **Shopping** - Retail, clothes, electronics
11. **Work** - Office supplies, conferences

### Admin Dashboard

Admins can manage the categorization system at `/admin`:

- **Keywords Tab** - Add/edit/delete generic keywords
- **Merchants Tab** - Manage merchant patterns with alternate spellings
- **Bulk Operations** - Select and delete multiple items at once
- **Inline Editing** - Double-click cells to edit quickly
- **Column Filters** - Filter by category or label
- **Live Updates** - Changes take effect immediately for new uploads

**Admin Login:**
- Email: `admin@canadianinsights.ca`
- Password: `categorisationandinsightsengine`
- Token expires: 1 day

### Example Categorizations

| Transaction Description | Match Type | Category | Label | Why? |
|------------------------|------------|----------|-------|------|
| `UBER EATS` (user corrected before) | User History | Food | Eating Out | User's past correction |
| `TIMHORT 123 MAIN ST` | Merchant (alternate) | Food | Coffee | "TIMHORT" is alternate for "TIM HORTONS" |
| `HYDRO OTTAWA PAYMENT` | Keyword | Bills | Gas & Electricity | "HYDRO" keyword in Bills category |
| `AMAZON.CA PURCHASE` | Merchant | Shopping | Shopping | "AMAZON" is known merchant |
| `RENT PAYMENT TO LANDLORD` | Keyword | Housing | Rent | "RENT" keyword (highest priority category) |

### Adding New Patterns

To improve categorization:

1. **Log in to Admin** at `/admin`
2. **Keywords Tab**:
   - Click "➕ Add Keyword"
   - Enter keyword (e.g., "COSTCO")
   - Select category and label
   - Save
3. **Merchants Tab**:
   - Click "➕ Add Merchant"
   - Enter primary merchant name (e.g., "TIM HORTONS")
   - Add alternate patterns: `TIMHORT, TIM HORT, HORTONS`
   - Select category and label
   - Save

All changes apply immediately to future transaction uploads.

---

## 🔧 Tech Stack

### **Frontend**
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Chart library
- **Day.js** - Date manipulation

### **Backend**
- **Next.js API Routes** - Serverless functions
- **Express.js** - (Legacy, for demo data seeding)
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### **Deployment**
- **Vercel** - Hosting and serverless functions
- **Neon** - Serverless Postgres

---

## 🗄️ Database Schema

### **users** table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **transactions** table
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  cashflow VARCHAR(50),
  category VARCHAR(255),
  account VARCHAR(255),
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **categorization_learning** table
```sql
CREATE TABLE categorization_learning (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  description_pattern TEXT NOT NULL,
  original_category VARCHAR(255),
  corrected_category VARCHAR(255) NOT NULL,
  corrected_label VARCHAR(255),
  frequency INTEGER DEFAULT 1,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, description_pattern)
);
```

### **admin_keywords** table (Categorization Engine)
```sql
CREATE TABLE admin_keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(keyword, category)
);
```

### **admin_merchants** table (Categorization Engine)
```sql
CREATE TABLE admin_merchants (
  id SERIAL PRIMARY KEY,
  merchant_pattern TEXT NOT NULL UNIQUE,
  alternate_patterns TEXT[], -- Array of alternate spellings
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔑 API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/register` | POST | Register new user |

### Transactions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions` | GET | Get all transactions (or filtered by date) |
| `/api/transactions/create` | POST | Create new transaction |
| `/api/transactions/update` | PUT | Update existing transaction |
| `/api/transactions/delete` | DELETE | Delete transaction |
| `/api/transactions/bulk-update` | POST | Bulk update multiple transactions |

### Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/summary` | GET | Monthly income/expense summary for charts |
| `/api/categories` | GET | Category breakdown for selected period |

### Admin (Categorization Engine Management)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/login` | POST | Admin login (returns JWT) |
| `/api/admin/keywords` | GET | Get all keywords |
| `/api/admin/keywords` | POST | Create new keyword |
| `/api/admin/keywords/[id]` | PUT | Update keyword by ID |
| `/api/admin/keywords/[id]` | DELETE | Delete keyword by ID |
| `/api/admin/merchants` | GET | Get all merchants |
| `/api/admin/merchants` | POST | Create new merchant (with alternate_patterns) |
| `/api/admin/merchants/[id]` | PUT | Update merchant by ID |
| `/api/admin/merchants/[id]` | DELETE | Delete merchant by ID |
| `/api/admin/view-keywords` | GET | Get keywords + merchants (for admin dashboard) |

---

## 🎯 Roadmap & Next Steps

### 🚧 Phase 1: Core Infrastructure (Q1 2025)
- [ ] **Onboarding Journey**
  - Welcome flow for new users
  - Guided tour of features
  - Quick setup wizard
  - Sample data generator

- [ ] **Settings Page**
  - Profile management
  - Password change
  - Account preferences
  - Data export (CSV, JSON)
  - Dark mode toggle
  - Notification preferences

### 🤖 Phase 2: AI & Automation (Q2 2025)
- [x] **Smart Categorization Engine** ✨ LIVE!
  - **Database-driven categorization** with admin management dashboard
  - **Three-tier matching logic** (in priority order):
    1. **User History** - Your past corrections always take priority
    2. **Merchant Matching** - 200+ Canadian merchants with alternate spellings (e.g., "TIMHORT" → "TIM HORTONS")
    3. **Keyword Search** - Smart keyword matching by category priority (Housing → Bills → Subscriptions → Food → etc.)
  - **Admin Dashboard** at `/admin` for managing keywords and merchants
  - **Alternate Patterns** - Handle merchant name variations automatically
  - **Space-insensitive matching** - Catches descriptions with missing spaces
  - **First-match approach** - Fast, predictable categorization
  - **Live updates** - Changes to keywords/merchants affect future uploads immediately

- [x] **PDF Bank Statement Parser** ✨ NEW!
  - Upload PDF statements via drag & drop
  - Multi-step review flow with duplicate detection
  - Smart categorization (expenses, income, other/transfers)
  - **Supported banks:**
    - ✅ TD (Credit Card, Chequing, Savings)
    - ✅ RBC (Credit Card, Chequing, Savings)
    - ✅ CIBC (Credit Card, Chequing)
    - ✅ BMO (Credit Card, Chequing)
  - **Coming soon:**
    - 🚧 National Bank
    - 🚧 American Express
    - 🚧 Scotiabank
    - 🚧 Desjardins
  - **Next generation support:**
    - 📅 Tangerine
    - 📅 Simplii Financial
    - 📅 PC Financial
    - 📅 Koho
    - 📅 Wealthsimple
    - 📅 Neo Financial

- [ ] **Automated Insights Engine**
  - Spending pattern analysis
  - Anomaly detection (unusual transactions)
  - Month-over-month comparisons
  - Budget recommendations
  - Savings opportunities
  - Predictive cash flow forecasting

### 📊 Phase 3: Advanced Analytics (Q3 2025)
- [ ] **Enhanced Insights Tab**
  - Spending trends and forecasts
  - Category deep-dives
  - Merchant analysis
  - Budget vs. actual tracking
  - Goal setting and tracking
  - Net worth dashboard

- [ ] **Reporting**
  - Customizable reports
  - Tax preparation exports
  - Yearly summaries
  - Quarterly reviews
  - Downloadable PDFs

### 🔗 Phase 4: Integrations (Q4 2025)
- [ ] **Bank Connections**
  - Plaid integration for Canadian banks
  - Automatic transaction sync
  - Balance tracking
  - Account aggregation

- [ ] **Third-party Integrations**
  - Export to accounting software (QuickBooks, FreshBooks)
  - Calendar integration for bill reminders
  - Email parsing for e-receipts

### 🎨 Phase 5: UX Enhancements (Ongoing)
- [ ] **Mobile App**
  - Native iOS and Android apps
  - Offline mode
  - Push notifications
  - Quick expense entry

- [ ] **Collaboration Features**
  - Shared accounts for couples/families
  - Split expenses
  - Expense approval workflows

---

## 🐛 Known Issues & Limitations

- Settings page is placeholder (coming soon modal)
- Insights tab is placeholder (coming soon)
- Budget tab is placeholder (coming soon)
- No mobile app yet (responsive web only)
- PDF statement parsing is beta (supported banks: TD, RBC, CIBC, National Bank, Amex)
- Single currency support (CAD)
- Admin dashboard placeholders: Inbox, Analytics, Insights Engine (Category Engine is fully functional)

---

## 🤝 Contributing

This is a prototype project. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

---

## 🙏 Acknowledgments

- Built with ❤️ for the Canadian financial management community
- Demo data includes realistic Canadian merchants and spending patterns
- Inspired by modern fintech apps like Mint, YNAB, and Monarch Money

---

## 📞 Support

For questions, issues, or feature requests, please open an issue on GitHub.

**Demo Account Credentials:**
- Email: demo@example.com
- Password: demo123

**Admin Dashboard Access:**
- Visit: `/admin/login`
- Email: admin@canadianinsights.ca
- Password: categorisationandinsightsengine

**Happy tracking!** 🎉💸

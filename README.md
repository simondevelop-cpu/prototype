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
- [ ] **Smart Categorization Engine**
  - Machine learning for auto-categorization
  - Pattern recognition for merchants
  - User training/correction loop
  - Canadian-specific merchant database

- [ ] **PDF Bank Statement Parser**
  - Upload PDF statements
  - OCR text extraction
  - Intelligent transaction parsing
  - Support for major Canadian banks (RBC, TD, Scotia, BMO, CIBC)
  - CSV import as fallback

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
- No mobile app yet (responsive web only)
- Manual transaction entry only (no bank import yet)
- Single currency support (CAD)

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

**Happy tracking!** 🎉💸

# Canadian Insights - Personal Finance Web App

A personal finance application built for Canadian households, featuring transaction tracking, budgeting, insights, and financial analytics.

## 🏗️ **Architecture**

### **Frontend**
- **Framework:** Vanilla JavaScript (no build tooling required)
- **Future:** Can migrate to React when needed (API-compatible)
- **Styling:** Custom CSS
- **Charts:** Vanilla JS with Chart.js or similar

### **Backend**
- **Runtime:** Node.js + Express.js
- **Database:** PostgreSQL (Neon on Vercel)
- **Authentication:** JWT-based, database-backed
- **Architecture:** Multi-tenant SaaS (shared database, isolated by user_id)

### **Deployment**
- **Platform:** Vercel Serverless Functions
- **Static Assets:** Served by Vercel CDN
- **Database:** Neon PostgreSQL (Canada Central region)

---

## ✨ **Features**

### **Core Functionality**
- ✅ **User Authentication**
  - JWT-based secure authentication
  - Demo account with pre-populated data
  - User registration for personal accounts

- ✅ **Transaction Management**
  - View transactions with filtering and search
  - Categories and labels
  - CSV import support
  - 200+ realistic Canadian demo transactions (12 months)

- ✅ **Financial Dashboard**
  - Monthly cash flow visualization
  - Income vs expenses tracking
  - Category breakdown
  - Spending trends

- ✅ **Budgeting**
  - Monthly and quarterly budget analysis
  - Category-wise spending breakdown
  - Spending vs budget comparison
  - Savings calculation

- ✅ **Savings Tracking**
  - Cumulative savings calculation
  - Savings goals
  - Year-to-date and lifetime views

- ✅ **Insights**
  - Top spending categories
  - Average monthly spending
  - Savings rate analysis
  - Personalized recommendations

---

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ (for local development)
- PostgreSQL database (Neon recommended for production)

### **Local Development**

```bash
# Clone the repository
git clone <repository-url>
cd prototype

# Install dependencies
npm install

# Set up environment variables (optional for local dev)
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL

# Run the server
npm start

# Open in browser
open http://localhost:3000
```

### **Static Mode (No Database)**
```bash
# Just open the HTML file
open index.html
```

---

## 🔐 **Authentication**

### **Demo Account**
Perfect for exploring the app with realistic data:
- **Email:** `demo@canadianinsights.ca`
- **Password:** `northstar-demo`
- **Data:** 12 months of realistic Canadian transactions

### **Create Your Own Account**
1. Click "Create Account"
2. Enter email, password, and name
3. Start with empty state
4. Upload CSV to populate your data

### **Multi-Tenant Architecture**
- All users share the same database
- Data is isolated by `user_id` (integer foreign key)
- Users can only see their own transactions
- Demo user has ID: 1, new users get sequential IDs

---

## 📊 **Demo Data**

The demo account includes 12 months of realistic Canadian financial data:

### **Income**
- Monthly salary: $4,800
- Occasional freelance: $600-1,100 (quarterly)

### **Expenses**
- **Housing:** Rent ($1,650/month)
- **Utilities:** Hydro-Québec ($90-150), Rogers Internet ($85), Telus Mobile ($65)
- **Groceries:** Loblaws, Metro, Sobeys, No Frills (4x/month, $120-200 each)
- **Transportation:** Presto Card ($156), Gas ($50-80), occasional Uber
- **Dining:** Tim Hortons, Starbucks (15-20x/month, $4-12), Restaurants (3-5x/month, $40-100)
- **Shopping:** Amazon.ca, Winners, Canadian Tire, Shoppers Drug Mart
- **Entertainment:** Netflix, Spotify, Cineplex

### **Savings**
- Monthly transfer: $500 to savings account

**Total Transactions:** 200+ across 12 months (Nov 2023 - Oct 2024)

---

## 🗂️ **API Endpoints**

### **Authentication**
```
POST   /api/auth/login      - Login with email/password
POST   /api/auth/register   - Create new account
GET    /api/auth/me         - Get current user info
```

### **Data Endpoints** (all require authentication)
```
GET    /api/transactions    - List transactions with filters
GET    /api/summary         - Monthly cash flow summary
GET    /api/budget          - Budget analysis by category
GET    /api/savings         - Savings tracking
GET    /api/insights        - Personalized insights
```

### **Example Requests**

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@canadianinsights.ca","password":"northstar-demo"}'
```

**Get Transactions:**
```bash
curl http://localhost:3000/api/transactions?limit=50 \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🗄️ **Database Schema**

### **users**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **transactions**
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  merchant TEXT,
  date DATE NOT NULL,
  cashflow TEXT NOT NULL CHECK (cashflow IN ('income', 'expense', 'other')),
  account TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_cashflow ON transactions(cashflow);
```

---

## 🚢 **Deployment to Vercel**

### **1. Connect Repository**
1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Framework Preset: **Other**
4. Build Command: *(leave empty)*
5. Deploy

### **2. Set Up Database**
1. In Vercel dashboard, go to **Storage** tab
2. Click **Create Database** → **Neon Postgres**
3. Choose **Canada (Central)** region
4. Database automatically connects and sets `DATABASE_URL`

### **3. First Deployment**
- On first API request after deployment, database initializes automatically
- Schema created, demo user seeded, sample transactions loaded
- Takes 1-2 seconds on first load
- Subsequent requests are instant

### **4. Environment Variables** (Optional)
```
DATABASE_URL     - (Auto-set by Neon)
JWT_SECRET       - Custom JWT signing key (optional)
DEMO_EMAIL       - Override demo email (optional)
DEMO_PASSWORD    - Override demo password (optional)
```

---

## 🧪 **Testing**

### **Manual Testing Checklist**

**Authentication:**
- [ ] Login with demo account works
- [ ] Create new account works
- [ ] Sign out works
- [ ] Token persists across page reloads
- [ ] Invalid credentials rejected

**Data Endpoints:**
- [ ] Dashboard shows charts and data
- [ ] Transactions tab shows list
- [ ] Budget tab shows category breakdown
- [ ] Savings tab shows goals
- [ ] Insights tab shows recommendations

**Multi-Tenancy:**
- [ ] Demo user sees 200+ transactions
- [ ] New user sees empty state
- [ ] Different users see different data
- [ ] Users can't access others' transactions

---

## 📝 **Development Notes**

### **Why Vanilla JavaScript?**
- ✅ **Simple:** No build step, no complex tooling
- ✅ **Fast:** Instant page loads, no bundle size
- ✅ **Flexible:** Easy to understand and modify
- ✅ **Vercel-ready:** Works perfectly with serverless

### **When to Migrate to React?**
Consider React when:
- UI complexity increases significantly
- Need component reusability
- Want better state management
- Team prefers React ecosystem

**Migration path:**
- API endpoints stay the same (no changes needed)
- Rebuild frontend incrementally
- Keep working on current version while migrating

### **Current Tech Stack**
```
Frontend:  Vanilla JS + HTML + CSS
Backend:   Node.js + Express.js
Database:  PostgreSQL (Neon)
Auth:      JWT tokens
Hosting:   Vercel Serverless Functions
```

---

## 🐛 **Troubleshooting**

### **Login Returns 401**
- Check email is lowercase (demo@canadianinsights.ca)
- Verify password is correct
- Check Vercel logs for database errors

### **Empty Dashboard**
- Wait 1-2 seconds on first load (database initializing)
- Check Network tab for 200/304 responses
- Verify demo data was seeded (check Vercel logs)

### **Database Connection Issues**
- Verify `DATABASE_URL` is set in Vercel
- Check Neon dashboard that database is active
- Review Vercel function logs for connection errors

### **500 Errors on Data Endpoints**
- Check Vercel function logs for SQL errors
- Verify schema was created successfully
- Ensure user_id is an integer (not text)

---

## 📚 **Documentation**

- **ARCHITECTURE_EXPLAINED.md** - Detailed architecture and design decisions
- **ARCHITECTURE_FIX.md** - Technical details on the auth system redesign
- **VERCEL_DATABASE_SETUP.md** - Step-by-step Vercel deployment guide
- **TESTING_CHECKLIST.md** - Comprehensive testing procedures

---

## 🗺️ **Roadmap**

### **Phase 1: Core Functionality** ✅ **COMPLETE**
- [x] JWT authentication
- [x] User registration
- [x] Transaction management
- [x] Dashboard with charts
- [x] Budget analysis
- [x] Savings tracking
- [x] Insights

### **Phase 2: Enhanced Features** (Future)
- [ ] CSV upload and import
- [ ] Transaction editing and deletion
- [ ] Custom budget categories
- [ ] Recurring transactions
- [ ] Export data (PDF, CSV)
- [ ] Mobile-responsive design

### **Phase 3: Advanced Features** (Future)
- [ ] Multi-currency support
- [ ] Bill reminders
- [ ] Debt tracking
- [ ] Investment tracking
- [ ] Financial goals with milestones
- [ ] French language support

### **Phase 4: React Migration** (Optional)
- [ ] Set up Next.js or Vite
- [ ] Rebuild UI components in React
- [ ] Implement routing
- [ ] Add animations and transitions
- [ ] Enhance mobile experience

---

## 🤝 **Contributing**

This is currently a prototype for stakeholder review. If you'd like to contribute:

1. Check the roadmap for planned features
2. Open an issue to discuss your idea
3. Fork the repository
4. Create a feature branch
5. Submit a pull request

---

## 📄 **License**

Proprietary – Internal prototype for discovery and user feedback.

---

## 🙋 **Support**

For questions or issues:
1. Check the troubleshooting section above
2. Review the documentation files
3. Check Vercel function logs
4. Open an issue with detailed error information

---

**Built with ❤️ for Canadians, by Canadians** 🇨🇦

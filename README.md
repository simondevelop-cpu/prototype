# Hummingbird Finance 💰📊

A modern, privacy-compliant personal finance management application built for Canadians. Track your spending, visualize cash flow, and gain insights into your financial habits while maintaining full control over your data.

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
  - ✅ Edit existing transactions inline (all fields: description, category, label, date, amount, cashflow, account)
  - ✅ Delete transactions with double confirmation
  - ✅ Bulk update multiple transactions at once
  - ✅ Bulk delete with double confirmation
  - ✨ **Upload PDF bank statements** (NEW!)
- **PDF Statement Upload** 🆕
  - Drag & drop PDF statements
  - Supports TD, RBC, CIBC, National Bank, Amex
  - Multi-step review flow with duplicate detection
  - Smart categorization into expenses, income, and other (transfers)
  - Auto-categorization before import (mandatory)
  - Edit account names and verify totals before import
- **Powerful Filtering & Search**
  - Universal search across description, amount, category, label
  - Filter by date range, category, account, cashflow type
  - Persistent selection across filters
  - Clear all filters functionality
- **Smart Categorization**
  - Auto-categorization with empty labels (no "needs review" or "uncategorized")
  - Autocomplete for categories and accounts
  - Custom category creation for new users
- **Bulk Operations**
  - Select multiple transactions with checkboxes
  - Bulk recategorize, change account, or update labels
  - Bulk delete with double confirmation
  - Shows selection count and total amount

### 🔐 **Authentication & Onboarding**
- Secure JWT-based authentication
- User registration with hashed passwords (bcrypt)
- Required consent acceptance for account creation
- Multi-step onboarding journey:
  - Emotional calibration questions
  - Financial context questions
  - Motivation and segmentation
  - Acquisition source
  - Insight preferences
  - Profile information (name, email, date of birth, province, recovery phone)
- Demo account with 12 months of realistic Canadian transaction data
- Multi-user support with data isolation

### 🔒 **Privacy & Consent Management** 🆕
- **Comprehensive Consent System**
  - Account creation consent (required)
  - Cookie consent banner (essential vs. non-essential)
  - First upload consent modal
  - All consent events logged with timestamps
- **Account Settings Page**
  - **Personal Details** - Edit name, email, date of birth, province, recovery phone
  - **Data Consent** - Granular control over:
    - Required data (essential cookies + essential/performance/analytics data)
    - Service improvement data (functional data)
    - Targeting and marketing data
    - Non-essential cookies
  - **Account Deletion** - Double confirmation with 30-day retention policy
  - Links to Privacy Policy and Terms & Conditions
- **Privacy Policy Compliance**
  - Dynamic privacy policy checks in admin dashboard
  - Functional tests against policy commitments
  - Unhappy path detection
- **Data Export** - Export all user data in JSON format
- **PIPEDA & Law 25 Compliance** - Full compliance with Canadian privacy regulations

### 📅 **Chat Booking System** 🆕
- **User Features**
  - View available 20-minute slots (3 per hour)
  - Book appointments with preferred method (Teams, Google Meet, Phone)
  - Conditional questions for Teams/Google Meet (screen sharing, recording)
  - Optional notes (200 word limit)
  - View booking status (requested, confirmed, cancelled, completed)
  - Edit notes and cancel bookings
- **Admin Features**
  - Calendar view with rolling 4-week period
  - Mark office hours (9am-6pm) as available
  - View all bookings with user details
  - Update booking status
  - Manage slot availability

### 📊 **Survey System** 🆕
- **"What's Coming" Tab**
  - Feature prioritization survey
  - Multi-step modal interface
  - Question types:
    - Q1: Feature expectations (table format with "Expect", "Use", "Love" columns)
    - Q2: Priority ranking (drag-and-drop, locked #1 for data security)
    - Q3: Professional advisor interest (conditional display)
    - Q4: Access level preferences (conditional on Q3)
    - Q5: Free text comments (200 word limit)
- **Admin Dashboard**
  - View all survey responses
  - User details and timestamps
  - Full response data display

### 🛠️ **Admin Dashboard** 🆕
- **Secure Admin Login** - Separate admin authentication at `/admin/login`
- **App Monitoring Tab**
  - **Accounts** - View all registered users with:
    - Consent timestamps (account creation, cookie consent, first upload)
    - Legacy consent notes for pre-logging accounts
    - User activity and status
    - Horizontal scrolling support
  - **App Health** - System health checks and metrics
  - **Privacy Policy Check** - Dynamic compliance testing:
    - Data collection verification
    - Retention policy checks
    - Consent enforcement tests
    - Security checks
    - Sharing policy verification
    - Age restriction checks
    - Cookie policy tests
    - Unhappy path detection
- **Inbox Tab**
  - **Chat Scheduler** - Manage chat bookings and availability
  - **Feedback** - View user feedback submissions
  - **What's Coming Survey** - View all survey responses
- **Categories Tab** - Categorization Engine Management
  - **Patterns Sub-tab** - Manage keywords and merchants for auto-categorization
    - View/edit/delete keywords and merchants
    - Inline editing (double-click cells to edit)
    - Multi-select filtering by category and label
    - Bulk delete operations
    - Add alternate merchant patterns (e.g., "TIMHORT" for "TIM HORTONS")
  - **Recategorization Log Sub-tab** - Track user recategorizations
    - See previous category and new category
    - Monitor categorization frequency and accuracy
    - Mark recategorizations as reviewed
    - Horizontal scrolling support
- **Analytics Tab**
  - **Cohort Analysis** - User cohort metrics and analysis
  - **Customer Data** - Detailed customer information
  - **Events Data** - User event tracking and analytics
  - **Editing Events Data** - Transaction editing event logs
  - **Vanity Metrics** - High-level engagement metrics
  - **Data Details** - Comprehensive list of all database tables and columns
- **Insights Tab** - Placeholder for future insights features
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
- Custom inline confirmations (no browser dialogs)
- Fixed column widths for transaction tables
- Text truncation with ellipsis
- Inline editing for all transaction fields

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (or use Vercel serverless)
- PostgreSQL database (Vercel Neon recommended)

### Environment Variables

Create a `.env.local` file in the root directory (see `.env.example` for template):

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database
DATABASE_SSL=false

# Security (REQUIRED in production)
JWT_SECRET=your-super-secret-key-minimum-32-characters-long-change-this-in-production
TOKENIZATION_SALT=your-random-salt-for-user-tokenization-change-in-production

# CSRF Protection (REQUIRED in production)
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com

# Admin Access
ADMIN_EMAIL=admin@hummingbirdfinance.ca
ADMIN_JWT_SECRET=your-admin-jwt-secret

# Demo Account (optional)
DEMO_EMAIL=demo@example.com
DEMO_PASSWORD=demo123
```

**⚠️ Security Note:** Never commit `.env` files to git. Use `.env.example` as a template. In production, ensure `JWT_SECRET` and `TOKENIZATION_SALT` are strong random strings (32+ characters).

### Installation

```bash
# Install dependencies
npm install

# Run database initialization (creates tables and seeds demo data)
# This is done automatically on first API call, or run manually:
curl -X POST http://localhost:3000/api/admin/init-db

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
   - Add `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_JWT_SECRET`, `DEMO_EMAIL`, `DEMO_PASSWORD`
   - Add `ALLOWED_ORIGINS` for CSRF protection

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
│   │   ├── consent/              # Consent management
│   │   │   ├── route.ts          # POST /api/consent (log consent)
│   │   │   └── check/            # GET /api/consent/check
│   │   ├── account/              # Account management
│   │   │   ├── personal-data/    # GET /api/account/personal-data
│   │   │   ├── update/           # PUT /api/account/update
│   │   │   └── export/           # GET /api/account/export
│   │   ├── bookings/             # Chat booking system
│   │   │   ├── available/        # GET /api/bookings/available
│   │   │   ├── create/           # POST /api/bookings/create
│   │   │   ├── my-bookings/      # GET /api/bookings/my-bookings
│   │   │   └── update/           # PUT /api/bookings/update
│   │   ├── survey/               # Survey system
│   │   │   └── submit/           # POST /api/survey/submit
│   │   ├── feedback/             # User feedback
│   │   │   └── route.ts          # POST /api/feedback
│   │   ├── summary/              # GET /api/summary (dashboard data)
│   │   └── categories/           # GET /api/categories (breakdown)
│   ├── admin/                    # Admin dashboard
│   │   ├── page.tsx              # Main admin dashboard
│   │   └── login/                # Admin login page
│   ├── settings/                 # User settings page
│   ├── onboarding/               # Onboarding flow
│   ├── globals.css               # Tailwind directives
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main entry (auth wrapper)
├── components/                   # React Components
│   ├── Dashboard.tsx             # Main dashboard with tabs
│   ├── CashflowChart.tsx         # Interactive Recharts bar chart
│   ├── TransactionsList.tsx      # Transaction table with CRUD
│   ├── TransactionModal.tsx      # Add/Edit transaction form
│   ├── BulkRecategorizeModal.tsx # Bulk update modal
│   ├── CookieBanner.tsx          # Cookie consent banner
│   ├── FirstUploadConsentModal.tsx # First upload consent
│   ├── BookingModal.tsx          # Chat booking modal
│   ├── BookingItem.tsx           # Booking display component
│   ├── SurveyModal.tsx           # Survey modal
│   ├── FeedbackModal.tsx          # Feedback modal
│   └── Login.tsx                 # Login/Register forms
├── lib/                          # Shared utilities
│   ├── auth.ts                   # JWT & password hashing
│   ├── db.ts                     # PostgreSQL connection pool
│   ├── csrf.ts                   # CSRF protection
│   ├── event-logger.ts           # Event logging utilities
│   └── categorization-engine.ts  # Auto-categorization logic
├── migrations/                   # Database migrations
│   ├── create-chat-bookings-table.sql
│   ├── create-available-slots-table.sql
│   └── update-chat-bookings-status-constraint.sql
├── server.js                     # Express backend (demo data seeding)
├── package.json                  # Dependencies
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── vercel.json                   # Vercel deployment config
```

---

## 🤖 Auto-Categorization Engine

Hummingbird Finance features a powerful, database-driven categorization engine that automatically classifies your transactions. The system uses a three-tier priority approach to ensure accuracy while learning from your preferences.

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
- Visit: `/admin/login`
- Email: `admin@hummingbirdfinance.ca` (or set via `ADMIN_EMAIL` env var)
- Password: Set via admin authentication system

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
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  login_attempts INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **l0_pii_users** table (PII Isolation)
```sql
CREATE TABLE l0_pii_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  recovery_phone TEXT,
  province_region TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

### **transactions** table
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  cashflow VARCHAR(50),
  category VARCHAR(255),
  account VARCHAR(255),
  label VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **categorization_learning** table
```sql
CREATE TABLE categorization_learning (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  original_category VARCHAR(255),
  original_label VARCHAR(255),
  corrected_category VARCHAR(255) NOT NULL,
  corrected_label VARCHAR(255),
  frequency INTEGER DEFAULT 1,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, description_pattern)
);
```

### **user_events** table (Event Tracking)
```sql
CREATE TABLE user_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### **onboarding_responses** table
```sql
CREATE TABLE onboarding_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  emotional_state TEXT[],
  financial_context TEXT[],
  motivation TEXT,
  motivation_other TEXT,
  acquisition_source TEXT,
  acquisition_other TEXT,
  insight_preferences TEXT[],
  insight_other TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  recovery_phone TEXT,
  province_region TEXT,
  last_step INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **chat_bookings** table
```sql
CREATE TABLE chat_bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  preferred_method TEXT NOT NULL CHECK (preferred_method IN ('teams', 'google-meet', 'phone')),
  share_screen BOOLEAN,
  record_conversation BOOLEAN,
  notes TEXT,
  status TEXT DEFAULT 'requested' CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_date, booking_time)
);
```

### **available_slots** table
```sql
CREATE TABLE available_slots (
  id SERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slot_date, slot_time)
);
```

### **survey_responses** table
```sql
CREATE TABLE survey_responses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  q1_data JSONB,
  q2_data JSONB,
  q3_data JSONB,
  q4_data TEXT,
  q5_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
  alternate_patterns TEXT[],
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
| `/api/auth/register` | POST | Register new user (requires consent) |

### Transactions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transactions` | GET | Get all transactions (or filtered by date) |
| `/api/transactions/create` | POST | Create new transaction |
| `/api/transactions/update` | PUT | Update existing transaction (logs editing events) |
| `/api/transactions/delete` | DELETE | Delete transaction |
| `/api/transactions/bulk-update` | POST | Bulk update multiple transactions |

### Consent Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/consent` | POST | Log consent event |
| `/api/consent/check` | GET | Check if user has given specific consent |

### Account Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/personal-data` | GET | Get user's personal data |
| `/api/account/update` | PUT | Update user's personal details |
| `/api/account/export` | GET | Export all user data (JSON) |

### Chat Bookings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bookings/available` | GET | Get available booking slots |
| `/api/bookings/create` | POST | Create new booking |
| `/api/bookings/my-bookings` | GET | Get user's bookings |
| `/api/bookings/update` | PUT | Update booking (notes, cancel) |

### Survey
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/survey/submit` | POST | Submit survey response |

### Feedback
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feedback` | POST | Submit user feedback |

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
| `/api/admin/users` | GET | Get all users with consent information |
| `/api/admin/bookings` | GET | Get all bookings |
| `/api/admin/bookings/update-status` | PUT | Update booking status |
| `/api/admin/available-slots` | GET/POST | Get/update available slots |
| `/api/admin/survey-responses` | GET | Get all survey responses |
| `/api/admin/user-feedback` | GET | Get all user feedback |
| `/api/admin/recategorizations` | GET | Get recategorization log |
| `/api/admin/editing-events` | GET | Get transaction editing events |
| `/api/admin/privacy-policy-check` | GET | Run privacy policy compliance checks |

---

## 🎯 Roadmap & Next Steps

### ✅ Phase 1: Core Infrastructure (COMPLETE)
- [x] **Onboarding Journey** ✨ LIVE!
  - Multi-step onboarding flow
  - Emotional calibration questions
  - Financial context questions
  - Motivation and segmentation
  - Profile information collection
- [x] **Settings Page** ✨ LIVE!
  - Profile management
  - Data consent controls
  - Account deletion with 30-day retention
  - Privacy Policy and Terms & Conditions links
- [x] **Privacy & Consent Management** ✨ LIVE!
  - Account creation consent
  - Cookie consent banner
  - First upload consent
  - Consent event logging
  - Privacy policy compliance checks

### ✅ Phase 2: AI & Automation (COMPLETE)
- [x] **Smart Categorization Engine** ✨ LIVE!
  - Database-driven categorization with admin management dashboard
  - Three-tier matching logic (User History → Merchant → Keyword)
  - 200+ Canadian merchants with alternate spellings
  - 70+ curated keywords
  - Live updates from admin dashboard
- [x] **PDF Bank Statement Parser** ✨ LIVE!
  - Upload PDF statements via drag & drop
  - Multi-step review flow with duplicate detection
  - Smart categorization (expenses, income, other/transfers)
  - Auto-categorization before import
  - **Supported banks:**
    - ✅ TD (Credit Card, Chequing, Savings)
    - ✅ RBC (Credit Card, Chequing, Savings)
    - ✅ CIBC (Credit Card, Chequing)
    - ✅ BMO (Credit Card, Chequing)
    - ✅ National Bank
    - ✅ American Express

### ✅ Phase 3: User Engagement (COMPLETE)
- [x] **Chat Booking System** ✨ LIVE!
  - 20-minute slot booking
  - Admin calendar management
  - Booking status tracking
- [x] **Survey System** ✨ LIVE!
  - Feature prioritization survey
  - Multi-step modal interface
  - Admin response viewing
- [x] **Feedback System** ✨ LIVE!
  - User feedback collection
  - Admin feedback viewing

### 📊 Phase 4: Advanced Analytics (In Progress)
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

### 🔗 Phase 5: Integrations (Future)
- [ ] **Bank Connections**
  - Plaid integration for Canadian banks
  - Automatic transaction sync
  - Balance tracking
  - Account aggregation

- [ ] **Third-party Integrations**
  - Export to accounting software (QuickBooks, FreshBooks)
  - Calendar integration for bill reminders
  - Email parsing for e-receipts

### 🎨 Phase 6: UX Enhancements (Ongoing)
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

- Insights tab is placeholder ("What's Coming" survey)
- Budget tab is placeholder ("Schedule a Chat" booking system)
- No mobile app yet (responsive web only)
- Single currency support (CAD)
- Email confirmation is bypassed (email_validated set to true on registration)

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
- Privacy-first design compliant with PIPEDA and Quebec's Law 25

---

## 📞 Support

For questions, issues, or feature requests, please open an issue on GitHub.

**Demo Account Credentials:**
- Email: demo@example.com
- Password: demo123

**Admin Dashboard Access:**
- Visit: `/admin/login`
- Email: Set via `ADMIN_EMAIL` environment variable
- Password: Set via admin authentication system

**Happy tracking!** 🎉💸

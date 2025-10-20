# Canadian Insights prototype

This repository contains a static prototype for **Canadian Insights**, a personal finance web app built for Canadian households. The goal is to translate the product specification into a browsable, interactive experience that can be shared with stakeholders and prospective users.

## Status

The prototype is functional and ready for stakeholder walkthroughs, but it remains a work in progress. Follow-up iterations will continue to land here as we expand coverage of the specification and gather feedback.

## What’s included

- **Static SPA-style experience** powered by vanilla HTML, CSS and JavaScript (no build tooling required).
- **Four primary tabs** that mirror the product areas in the specification:
  - Cash flow & budget dashboard with locked sample modules
  - Categorise transactions workspace with filters and table interactions
  - Insight modules for subscriptions, fraud detection and peer benchmarks
  - Account settings, privacy messaging and feedback collection
- **Sample data** for cash flow trends, budgets, savings goals, transactions and insight cards to demonstrate core flows.
- **Lightweight interaction layer** for tab switching, filtering, module unlocking, feedback capture and toast notifications.

## Getting started

The prototype assets are still static, but the ingestion and insight APIs now run from a managed PostgreSQL database. To explore the end-to-end flow locally you can either open the static HTML (no API calls) or run the Node.js server with a database URL.

```bash
# Static walkthrough (no API calls)
open static/index.html     # macOS
xdg-open static/index.html # Linux
start static/index.html    # Windows

# Interactive API walkthrough
npm install
DATABASE_URL="postgres://user:password@host:5432/db" npm start
```

## Design & interaction notes

- Modules start in a locked state to mirror the upload-first journey; choosing “Explore sample data” reveals the sample charts and lists.
- Filters and dropdowns update the sample data in-place, providing a feel for the analytical workflows.
- Transactions can be filtered, searched and selected to simulate bulk actions, with running totals updated in real-time.
- Insight cards capture qualitative feedback and keep a running tally of “useful” insights to demonstrate how we will measure value.
- A modal upload prompt and global toast component illustrate supporting UI needed for CSV imports and confirmations.

## Next steps

- Replace sample data with live imports once data ingestion and categorisation services are ready.
- Extend the insights module lists with additional rules from the specification.
- Hook the feedback form into the chosen support tooling (e.g., email or CRM) and persist responses.
- Add French language copy to satisfy the bilingual requirement noted in the specification.

## Managed database configuration

The prototype now uses a hosted PostgreSQL instance for long-lived storage. We provisioned a [Supabase](https://supabase.com/) project in the **Canada (Central)** region (`ca-central-1`, Montréal) so data residency remains in Canada. The application server manages schema creation and migrations on boot, so no external migration tool is required.

### 1. Provision the database

1. Create a new Supabase project and select the **Canada (Central)** region.
2. Once the project is ready, open **Project Settings → Database → Connection string** and copy the `Direct Connection` URL (format: `postgres://USER:PASSWORD@HOST:5432/postgres?sslmode=require`).
3. (Optional) Run the following snippet in the Supabase SQL editor if you want to pre-create the tables manually—otherwise the server will create them on first run:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  merchant TEXT NOT NULL,
  date DATE NOT NULL,
  cashflow TEXT NOT NULL,
  account TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT DEFAULT '',
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT transactions_unique UNIQUE (date, amount, merchant, cashflow)
);

CREATE TABLE IF NOT EXISTS insight_feedback (
  id SERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL,
  insight_title TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Configure environment variables

Add the following environment variables locally (e.g., `.env.local`) and in Vercel (`Project Settings → Environment Variables`) for **Development**, **Preview**, and **Production**:

| Name | Description |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string (`postgres://…`). |
| `DATABASE_SSL` | Optional. Leave unset to enforce SSL (recommended for Supabase). Set to `false` only for trusted local Postgres instances. |

Vercel will expose these variables to `server.js`. After updating the variables, redeploy the project so the new configuration is applied.

## Refreshing demo data

Before a stakeholder walkthrough, you can reset the demo account’s data back to the curated baseline. The repository includes a helper script that truncates the `transactions` and `insight_feedback` tables and reloads the canonical CSV found in `scripts/demo-transactions.csv`.

```bash
# Supabase connection string must be provided
DATABASE_URL="postgres://user:password@host:5432/db" npm run refresh-demo-data

# Optionally point to a different CSV
DATABASE_URL="postgres://user:password@host:5432/db" npm run refresh-demo-data -- ./path/to/custom.csv
```

The script honours the `DATABASE_SSL` flag (defaults to SSL on) in case you are targeting a local PostgreSQL instance without TLS.

### Demo account credentials

Share these credentials with anyone rehearsing the product demo so that all presenters use the same dataset:

- **Email:** `demo@canadianinsights.ca`
- **Password:** `DemoUser!2024`

### 3. Deployment notes

- The repository includes a `vercel.json` file that disables automatic Next.js detection and maps `/api/*` routes to the Express
  server defined in `server.js`. This avoids the `No Next.js version detected` build failure reported by Vercel and keeps the
  static prototype assets (`static/index.html`, `static/app.js`, `static/styles.css`, `static/logo.svg`) served by Vercel’s
  static hosting.
- The Express app now exports its instance so Vercel’s Node runtime can mount it while local development continues to use `npm start`.

## License

Proprietary – internal prototype for discovery and user feedback.

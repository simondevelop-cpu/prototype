# Canadian Insights prototype

This repository now hosts a functional prototype for **Canadian Insights**, a personal finance web app built for Canadian households. It combines an Express API, a lightweight SQLite data store and the original HTML/CSS experience so you can ingest CSV statements, browse live dashboards and exercise the end-to-end flows described in the product specification.

## Status

- ✅ CSV uploads persist transactions in a local SQLite database.
- ✅ Dashboards, budgets, savings and insights render real data derived from the uploaded statements.
- ✅ Insight feedback and user feedback are captured server-side for later analysis.
- 🚧 Additional ingestion formats (PDF/OCR) and Plaid-style linking are out of scope for this iteration.

## What’s included

- **Full-stack prototype** using Express for the API layer and vanilla HTML/CSS/JS on the frontend.
- **Four primary tabs** aligned with the product spec:
  - Cash flow & budget dashboard with dynamic charts and breakdowns
  - Categorise transactions workspace backed by persisted data
  - Insight modules for subscriptions, fraud detection and peer benchmarks
  - Account settings with privacy messaging and in-app feedback capture
- **CSV ingestion pipeline** that normalises merchants, infers categories, avoids duplicates and seeds demo data automatically.
- **Insight logging** to track which modules resonate (useful/maybe/not relevant).

## Getting started

Install dependencies and start the local server (defaults to [http://localhost:3000](http://localhost:3000)). The Express app serves the static assets and exposes JSON endpoints for the dashboards.

```bash
npm install
npm start
```

The database seeds itself with demo transactions on first launch. Upload CSV statements via **Upload statements** to replace the sample data with your own.

## Automated verification

A Playwright smoke test exercises the end-to-end prototype against the running server. Start the app in a separate terminal before launching the test.

```bash
npm start
# in another terminal
npx playwright install --with-deps
npm run test:ui
```

## Design & interaction notes

- Modules unlock automatically once live data is available but can still be previewed with sample data via the “Explore sample data” buttons.
- Filters and dropdowns re-query the API so the charts always reflect uploaded data.
- Transaction filters apply client-side to the current dataset; recategorisations are not yet persisted but the API exposes category and label metadata for future iterations.
- Insight cards call back to the API for feedback logging; benchmark copy adapts to the cohort selector.
- The upload modal streams CSVs to the backend, which normalises merchants, infers categories and avoids duplicate inserts via a unique index.

## Next steps

- Expand CSV parsers to cover additional bank formats and add PDF/OCR ingestion.
- Store smart rules when users recategorise transactions and replay them on imports.
- Introduce authentication and per-user data isolation.
- Add French translations to satisfy the bilingual requirement in the PRD.

## Resolving merge conflicts with this update

If you run into merge conflicts while integrating **Add Express backend and connect UI to live data (#3)**, use the following decision tree:

1. Prefer **Accept incoming change** when the conflict is between legacy static prototype code and the new Express-backed implementation. The incoming block contains the backend-enabled logic and should generally replace the older stub.
2. Choose **Accept both changes** only when the conflicting snippets configure complementary behaviour (e.g., environment variables or documentation notes). After accepting both, edit the result to remove duplicate headings or commands.
3. Fall back to **Accept current change** when you have local modifications that intentionally diverge from the full-stack implementation and you plan to re-apply the backend wiring manually.

After resolving each conflict, delete the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), run `npm start` to verify the server boots, and rerun the Playwright smoke test (`npm run test:ui`) to confirm the UI still operates end to end.

## License

Proprietary – internal prototype for discovery and user feedback.

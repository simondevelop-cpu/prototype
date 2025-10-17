```markdown
# Canadian Insights — Prototype

This repository contains the prototype for the "Canadian Insights" product.

Overview
- FastAPI backend + PDF parser microservice (Python)
- React (TypeScript) frontend (Cashflow, Transactions, Insights, Settings)
- Parser focused on TD + National Bank credit card PDFs
- DB: PostgreSQL (Cloud SQL). Deploy target: GCP (northamerica-northeast1)

Local development
- Backend: Python 3.11 (pip/poetry)
- Frontend: Node 18+ (npm/yarn)
- Tests: pytest (backend), jest (frontend)

What I need to start
- Representative TD and National Bank credit card PDF samples (secure link or upload)
- Category hierarchy Excel (optional — I will create a placeholder if not provided)

Development branch
- feature/full-product-mvp contains the MVP work (parser, backend, frontend, CI)

License: MIT
```

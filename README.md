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

No build step is required. Open `index.html` in any modern browser (Chrome, Edge, Firefox or Safari) and the prototype will load immediately.

```bash
# From the repository root
open index.html     # macOS
xdg-open index.html # Linux
start index.html    # Windows
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

## License

Proprietary – internal prototype for discovery and user feedback.

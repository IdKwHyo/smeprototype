# SME Commercial Team — Workflow Prototype

A barebones GrabSpark prototype giving independent restaurants a connected analyst, marketing strategist, and communications workflow.

**Live prototype:** https://sme-commercial-prototype.vercel.app

## Workflow

1. **Business:** enter the business brief and editable menu economics, or import the sample CSV.
2. **Analysis:** review calculated unit contribution and weekday/weekend order patterns.
3. **Campaign:** change the offer, order assumptions, and budget; edit communications drafts; approve the plan.
4. **Results:** evaluate campaign orders and spending against an estimated baseline.

## Run locally

No package installation or build is required. Serve the static files over HTTP:

```bash
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Opening index.html directly with file:// may block ES modules.

## Check calculations

With Node.js 18 or later:

```bash
node checks.mjs
```

Checks cover contribution, menu ranking, CSV parsing and validation, campaign economics, break-even, loss scenarios, result comparisons, and template drafts.

## Deploy on Vercel

Import this repository into Vercel. The included vercel.json selects a static site with dist as the output directory and no installation or build command.

The current live deployment was uploaded directly; automatic GitHub deployments require connecting this repository to the Vercel project.

## Prototype limits

AI outputs are explicitly simulated templates; no model or live platform integration is connected. Business and campaign data stays in browser localStorage. Reset demo restores synthetic sample data. Publishing campaigns and contacting customers are manual.

The input CSV represents 14 days: 10 weekdays and 4 weekend days, with one item per order. Costs and fees are entered assumptions. Contribution excludes fixed overhead, taxes, and additional labour costs. Order-volume forecasts are user assumptions, and baseline-based results do not establish causality.

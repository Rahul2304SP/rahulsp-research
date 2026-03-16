# Research Site — Instructions for Claude

## Project Overview
This is a Next.js 15 static research publication site for **Rahul S. P.** at **https://rahulsp.com**. Hosted on Cloudflare Pages — auto-deploys on `git push` to `Rahul2304SP/rahulsp-research`.

## Tech Stack
- Next.js 15 (App Router, `output: "export"`, static HTML)
- Tailwind CSS v3 (light academic theme)
- KaTeX (CDN-loaded, auto-renders `$$...$$` and `$...$`)
- Node.js 20 at `C:\Users\Rahul Parmeshwar\AppData\Local\nodejs20\node-v20.19.2-win-x64`

## Known Build Issue
Next.js has a `generateBuildId` bug on this Windows system. The `scripts/postinstall.js` patches it automatically on `npm install`. Always run `node scripts/postinstall.js` before `npx next build` if node_modules were reinstalled.

## How to Add a New Paper

### Step 1: Gather source data
- Find the study script and results in the Stock-Forecaster repo
- Read the actual CSV/output files to extract exact numbers — DO NOT use memory or approximations
- Copy any PNG charts to `research/public/charts/[topic]/`

### Step 2: Write the paper content file
Create `research/src/lib/papers/[slug].ts`:
```typescript
export const content = `
<h2>1. Introduction</h2>
<p>...</p>
...
`;
```

**Rules:**
- NO code blocks (`<pre><code>`) — use LaTeX math (`$$...$$`, `$...$`) or prose
- NO inline `<code>` with variable names — use math notation or plain English
- Use `<div class="finding-box">` for key findings (blue-bordered callout)
- Use `<p class="figure-caption">Figure N: ...</p>` under every chart
- Add amber disclaimer box if showing simulated/backtest results:
  ```html
  <div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
    <strong>Disclaimer — Simulated Results:</strong> ...
  </div>
  ```
- Include proper academic references in a References section at the end
- All charts: `<img src="/charts/[topic]/[file].png" alt="..." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />`

### Step 3: Register the paper
Edit `research/src/lib/papers.ts`:
1. Add import: `import { content as myContent } from "./papers/[slug]";`
2. Add paper object to the `papers` array in the desired position within its category
3. Set category to one of: `"Empirical Studies"`, `"Architecture & Models"`, `"Feature Engineering"`

### Step 4: Build and deploy
```bash
NODE_DIR="/c/Users/Rahul Parmeshwar/AppData/Local/nodejs20/node-v20.19.2-win-x64"
export PATH="$NODE_DIR:$PATH"
unset NODE_ENV
cd "/c/Users/Rahul Parmeshwar/Documents/GitHub/Stock-Forecaster/research"
rm -rf .next
node scripts/postinstall.js
npx next build
```

If devDependencies are missing (tailwindcss not found), run: `npm install --include=dev`

### Step 5: Push to deploy
```bash
cd "/c/Users/Rahul Parmeshwar/Documents/GitHub/Stock-Forecaster/research"
git add -A
git commit -m "Add [paper title]"
git push
```
Cloudflare rebuilds automatically in ~30 seconds.

## File Structure
```
research/
├── public/charts/          # Real chart images from studies
│   ├── scalper/            # Scalper study charts (24 files)
│   ├── gold/               # Gold analysis charts (10 files)
│   ├── features/           # Feature analysis charts (6 files)
│   ├── dow/                # DOW metrics charts (4 files)
│   ├── dispersion/         # Dispersion study charts (4 files)
│   ├── kalman/             # Kalman/HMM charts (16 files)
│   └── gpr/                # GPR study charts (7 files)
├── src/
│   ├── app/
│   │   ├── page.tsx        # Index — papers grouped by category
│   │   ├── about/page.tsx  # About — Rahul's profile
│   │   ├── papers/[slug]/page.tsx  # Paper renderer
│   │   ├── globals.css     # Light academic theme
│   │   └── layout.tsx      # Root layout with KaTeX CDN
│   ├── components/
│   │   └── math-renderer.tsx  # Client component for KaTeX
│   └── lib/
│       ├── papers.ts       # Paper registry (imports + metadata)
│       └── papers/         # Individual paper content files
│           ├── entry-speed-vs-confirmation.ts
│           ├── cross-asset-lead-lag.ts
│           ├── goldssm-architecture.ts
│           ├── alpha101-intraday-gold.ts
│           ├── xag-directional-disagreement.ts
│           ├── 107-feature-pipeline.ts
│           ├── dispersion-trading.ts
│           ├── kalman-hmm-gold.ts
│           └── gpr-gold.ts
```

## Categories (display order)
1. **Empirical Studies** — experimental results on real data
2. **Architecture & Models** — neural network design
3. **Feature Engineering** — feature construction and selection

## Paper Style Guide
- Light theme: white bg, dark text (#1a1a2e), blue accent (#1e40af)
- Academic tone — no casual language
- Section numbering (1., 2., 2.1, etc.)
- Tables with uppercase headers, proper borders
- All claims must be verified against actual CSV/output data
- Include simulated results disclaimer for any backtest numbers
- Cite sources properly (author, year, title, journal)

## Current Papers (9)
1. GPR vs Gold (Empirical)
2. Kalman + HMM (Empirical)
3. Dispersion Trading (Empirical)
4. XAG Disagreement (Empirical)
5. Cross-Asset Lead-Lag (Empirical)
6. Entry Speed (Empirical)
7. GoldSSM Architecture (Architecture)
8. Alpha101 Screening (Feature Eng)
9. 107 Features Pipeline (Feature Eng)

## Audit Protocol
Before publishing any paper, verify ALL numerical claims against actual data files:
- Parse CSVs properly (handle quoted fields with commas)
- Compute PnL, win rates, profit factors from raw trade data
- Cross-check tables against SVG chart values
- Flag any simulated vs live results distinction

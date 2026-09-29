# HistoAtlas Frontend (Astro + React Islands)

The frontend is now an Astro application with React islands for interactive views.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Architecture

- Astro pages render static layout and content first.
- React islands are hydrated for interactive sections:
  - Atlas explorer
  - Slide detail
  - Cluster detail
  - Associations explorer
  - Global search palette and selection context bar

## Deployment

There is no CI/CD: merging to `main` does not deploy. Deploy by hand with:

```bash
scripts/deploy.sh
```

The site goes to Cloudflare Pages (project `histoatlas`). The downloadable result bundles go to
Cloudflare R2, because the full atlas (30 MB) is over Pages' 25 MiB per-file limit. The script:

1. Builds the site. The build also writes the bundles to `dist/downloads/` (one zip of CSV tables
   per cohort, plus `histoatlas.zip`) and `dist/downloads/sizes.json`.
2. Uploads the zips to the R2 bucket `histoatlas-assets` under `bundles/downloads/`. They are
   served at `/bundles/downloads/*` by `functions/bundles/[[path]].ts`.
3. Removes the zips and other oversized files from `dist`, then deploys `dist` to Pages.
4. Checks that every live bundle has the size the live site displays.

The sizes shown next to the download buttons come from `sizes.json`, so the bundles on R2 and the
site must come from the same build. Never deploy the site without uploading the bundles.

To check sizes without deploying:

```bash
node scripts/check-bundles.mjs dist/downloads                              # after a build
node scripts/check-bundles.mjs https://histoatlas.com/bundles/downloads    # live
```

Requirements: `wrangler` authenticated (`npx wrangler login`), and `fflate` in `package.json`.
During `npm run dev` the bundles are built on request at `/downloads/...`; no R2 access is needed.

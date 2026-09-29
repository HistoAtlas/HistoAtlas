#!/usr/bin/env bash
# Build the site, publish the result bundles to R2, deploy the rest to Cloudflare Pages.
# Run from anywhere: web/scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=histoatlas-assets
PREFIX=bundles/downloads            # served at /bundles/downloads/* by functions/bundles
SITE=${SITE:-https://histoatlas.com}

# public/bundles is a symlink to local tile assets; the build needs its target to exist
mkdir -p ../visual_assets/bundles

npm run build

# 1. Result bundles live on R2: the full atlas exceeds Pages' 25 MiB per-file limit.
#    The site displays the sizes in dist/downloads/sizes.json, written by this same build.
node scripts/check-bundles.mjs dist/downloads
find dist/downloads -name '*.zip' | while read -r file; do
  npx wrangler r2 object put "$BUCKET/$PREFIX/${file#dist/downloads/}" \
    --file "$file" --content-type application/zip --remote
done

# 2. Keep the Pages deploy under its limits (25 MiB per file, 20,000 files)
find dist/downloads -name '*.zip' -delete
rm -rf dist/og dist/api/mutations
rm -f dist/api/tcga/sample-data/PANCAN.json
echo "Deploying $(find dist -type f | wc -l | tr -d ' ') files"

# 3. Site
npx wrangler pages deploy dist \
  --project-name=histoatlas \
  --branch=main \
  --commit-dirty=true \
  --commit-hash="$(git rev-parse HEAD)"

# 4. The live bundles must have the sizes the live site displays
node scripts/check-bundles.mjs "$SITE/bundles/downloads"

#!/usr/bin/env bash
# The static API (web/public/api, ~1 GB of generated JSON) is not in git. CI gets it from R2.
#   scripts/data.sh push   pack web/public/api and upload it (run after regenerating the API)
#   scripts/data.sh pull   download and unpack it into web/public/api
set -euo pipefail
cd "$(dirname "$0")/.."

OBJECT=histoatlas-assets/build-data/api.tar.zst
ARCHIVE=$(mktemp -d)/api.tar.zst

case "${1:-}" in
  push)
    COPYFILE_DISABLE=1 tar -C public -cf - api | zstd -T0 -10 -q -o "$ARCHIVE"
    npx wrangler r2 object put "$OBJECT" --file "$ARCHIVE" --remote
    ;;
  pull)
    npx wrangler r2 object get "$OBJECT" --file "$ARCHIVE" --remote
    rm -rf public/api
    zstd -dc "$ARCHIVE" | tar -C public -xf -
    echo "Unpacked $(find public/api -type f | wc -l | tr -d ' ') files into public/api"
    ;;
  *)
    echo "usage: $0 push|pull" >&2
    exit 1
    ;;
esac
rm -f "$ARCHIVE"

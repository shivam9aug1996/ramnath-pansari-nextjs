# Backfill product blurhash

Generates `blurhash` on products in DB `basic-crud` that have an `image` URL.

```bash
# dry run (first 20)
node scripts/backfill-product-blurhash.mjs --dry-run --limit=20

# full backfill (skips docs that already have blurhash)
node scripts/backfill-product-blurhash.mjs

# regenerate everything
node scripts/backfill-product-blurhash.mjs --force
```

Uses `MONGODB_URI` from `.env`. Does not print the URI.

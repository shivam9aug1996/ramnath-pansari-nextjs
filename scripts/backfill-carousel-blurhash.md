# Backfill carousel blurhash placeholders

Run once after deploying blurhash support to generate placeholders for existing banners.

```bash
curl -X POST "$HOST/api/admin/carousel/backfill-blurhash" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Response:

```json
{ "success": true, "updated": 5, "total": 5 }
```

New banners get blurhash automatically on create/update when `imageUrl` is set or changed.

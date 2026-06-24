# One-time product flags backfill

Run once on production after deploying `promoOnly` / `productFromJio` support.

```javascript
// mongosh — adjust db name
use ramnath_pansari;

// Jio-synced products
db.products.updateMany(
  { jiomartUid: { $exists: true, $ne: null } },
  { $set: { productFromJio: true } }
);

// Legacy sugar promo SKU
db.products.updateOne(
  { _id: ObjectId("676da9f75763ded56d43032d") },
  { $set: { promoOnly: true, productFromJio: false } }
);

// Default missing flags on remaining docs
db.products.updateMany(
  { promoOnly: { $exists: false } },
  { $set: { promoOnly: false } }
);
db.products.updateMany(
  { productFromJio: { $exists: false }, jiomartUid: { $exists: false } },
  { $set: { productFromJio: false } }
);
```

/**
 * Backfill blurhash on products that have an image URL.
 *
 * Usage:
 *   node scripts/backfill-product-blurhash.mjs
 *   node scripts/backfill-product-blurhash.mjs --limit=50
 *   node scripts/backfill-product-blurhash.mjs --dry-run
 *   node scripts/backfill-product-blurhash.mjs --concurrency=6
 *   node scripts/backfill-product-blurhash.mjs --force   # regenerate even if blurhash exists
 *
 * Reads MONGODB_URI from .env. Uses DB `basic-crud` (app default).
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient, ObjectId } from "mongodb";
import { encode } from "blurhash";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DB_NAME = "basic-crud";
const FETCH_TIMEOUT_MS = 15_000;

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, ".env"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const opts = {
    limit: null,
    dryRun: false,
    concurrency: 6,
    force: false,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--force") opts.force = true;
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice(8));
    else if (arg.startsWith("--concurrency="))
      opts.concurrency = Math.max(1, Number(arg.slice(14)) || 6);
  }
  return opts;
}

async function blurhashFromImageUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`fetch ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

async function mapPool(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (!env.MONGODB_URI) {
    console.error("MONGODB_URI missing in .env");
    process.exit(1);
  }

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const col = client.db(DB_NAME).collection("products");

  const filter = {
    image: { $type: "string", $ne: "" },
    ...(opts.force
      ? {}
      : {
          $or: [
            { blurhash: { $exists: false } },
            { blurhash: null },
            { blurhash: "" },
          ],
        }),
  };

  let cursor = col.find(filter, {
    projection: { _id: 1, name: 1, image: 1, blurhash: 1 },
  });
  if (opts.limit) cursor = cursor.limit(opts.limit);

  const docs = await cursor.toArray();
  console.log(
    JSON.stringify({
      db: DB_NAME,
      toProcess: docs.length,
      dryRun: opts.dryRun,
      concurrency: opts.concurrency,
      force: opts.force,
    }),
  );

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  await mapPool(docs, opts.concurrency, async (doc, i) => {
    const label = `[${i + 1}/${docs.length}]`;
    try {
      if (!doc.image) {
        skipped++;
        return;
      }
      const blurhash = await blurhashFromImageUrl(doc.image);
      if (opts.dryRun) {
        console.log(label, "dry-run ok", String(doc._id), blurhash.slice(0, 12) + "…");
        updated++;
        return;
      }
      await col.updateOne(
        { _id: doc._id instanceof ObjectId ? doc._id : new ObjectId(doc._id) },
        { $set: { blurhash } },
      );
      updated++;
      if (updated % 25 === 0 || i === docs.length - 1) {
        console.log(label, `updated=${updated} failed=${failed}`);
      }
    } catch (err) {
      failed++;
      console.warn(
        label,
        "fail",
        String(doc._id),
        doc.image?.slice(0, 60),
        err?.message || err,
      );
    }
  });

  console.log(JSON.stringify({ done: true, updated, failed, skipped }));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import type { Db } from "mongodb";
import {
  STORE_SETTINGS_ID,
  SYNC_VERSIONS_DOC_ID,
  storeSettingsCollection,
} from "@/app/api/offers/storeSettingsUtils";
import {
  DEFAULT_SYNC_VERSIONS,
  SYNC_VERSION_KEYS,
  type SyncStateClientVersions,
  type SyncStateFetchFlags,
  type SyncStateResponse,
  type SyncVersions,
  type SyncVersionsDocument,
} from "./syncVersionsTypes";

export function normalizeSyncVersions(
  versions?: Partial<SyncVersions> | null,
): SyncVersions {
  return {
    carousel: Number(versions?.carousel ?? DEFAULT_SYNC_VERSIONS.carousel),
    offers: Number(versions?.offers ?? DEFAULT_SYNC_VERSIONS.offers),
    deliverySettings: Number(
      versions?.deliverySettings ?? DEFAULT_SYNC_VERSIONS.deliverySettings,
    ),
    storeConfig: Number(
      versions?.storeConfig ?? DEFAULT_SYNC_VERSIONS.storeConfig,
    ),
    category: Number(versions?.category ?? DEFAULT_SYNC_VERSIONS.category),
    product: Number(versions?.product ?? DEFAULT_SYNC_VERSIONS.product),
  };
}

async function readLegacySyncVersions(db: Db): Promise<Partial<SyncVersions> | null> {
  const legacy = await storeSettingsCollection(db).findOne({
    _id: STORE_SETTINGS_ID,
  });
  const nested = (legacy as { syncVersions?: Partial<SyncVersions> } | null)
    ?.syncVersions;
  return nested ?? null;
}

function syncVersionsDocCollection(db: Db) {
  return db.collection<SyncVersionsDocument>("storeSettings");
}

async function ensureSyncVersionsDocument(db: Db): Promise<SyncVersions> {
  const collection = syncVersionsDocCollection(db);
  const existing = await collection.findOne({ _id: SYNC_VERSIONS_DOC_ID });

  if (existing) {
    return normalizeSyncVersions(existing as Partial<SyncVersions>);
  }

  const legacy = await readLegacySyncVersions(db);
  const versions = normalizeSyncVersions(legacy);
  const doc: SyncVersionsDocument = {
    _id: SYNC_VERSIONS_DOC_ID,
    ...versions,
    updatedAt: new Date(),
  };

  await collection.updateOne(
    { _id: SYNC_VERSIONS_DOC_ID },
    { $setOnInsert: doc },
    { upsert: true },
  );

  return versions;
}

export async function getSyncVersions(db: Db): Promise<SyncVersions> {
  return ensureSyncVersionsDocument(db);
}

export function shouldFetchResource(
  clientVersion: number | undefined,
  serverVersion: number,
): boolean {
  if (clientVersion == null || Number.isNaN(clientVersion)) {
    return true;
  }
  return clientVersion < serverVersion;
}

export function buildGlobalFetchFlags(
  client: SyncStateClientVersions | undefined,
  server: SyncVersions,
): SyncStateFetchFlags {
  return {
    carousel: shouldFetchResource(client?.carousel, server.carousel),
    offers: shouldFetchResource(client?.offers, server.offers),
    deliverySettings: shouldFetchResource(
      client?.deliverySettings,
      server.deliverySettings,
    ),
    storeConfig: shouldFetchResource(client?.storeConfig, server.storeConfig),
    category: shouldFetchResource(client?.category, server.category),
    product: shouldFetchResource(client?.product, server.product),
  };
}

export async function bumpSyncVersion(
  db: Db,
  key: keyof SyncVersions,
): Promise<void> {
  await ensureSyncVersionsDocument(db);

  await syncVersionsDocCollection(db).updateOne(
    { _id: SYNC_VERSIONS_DOC_ID },
    {
      $inc: { [key]: 1 },
      $set: { updatedAt: new Date() },
    },
  );
}

export function validateSyncVersionsInput(
  input: Partial<SyncVersions> | null | undefined,
): { valid: true; versions: Partial<SyncVersions> } | { valid: false; message: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, message: "Body must be an object of version numbers" };
  }

  const versions: Partial<SyncVersions> = {};
  let hasAny = false;

  for (const key of SYNC_VERSION_KEYS) {
    if (input[key] === undefined) continue;
    hasAny = true;
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < 1) {
      return {
        valid: false,
        message: `${key} must be an integer >= 1`,
      };
    }
    versions[key] = value;
  }

  if (!hasAny) {
    return { valid: false, message: "Provide at least one sync version field" };
  }

  return { valid: true, versions };
}

/** Manually set one or more server sync versions (admin). */
export async function setSyncVersions(
  db: Db,
  partial: Partial<SyncVersions>,
): Promise<SyncVersions> {
  await ensureSyncVersionsDocument(db);

  const current = await getSyncVersions(db);
  const next = normalizeSyncVersions({ ...current, ...partial });

  await syncVersionsDocCollection(db).updateOne(
    { _id: SYNC_VERSIONS_DOC_ID },
    {
      $set: {
        ...next,
        updatedAt: new Date(),
      },
    },
  );

  return next;
}

export async function buildSyncStateResponse(
  db: Db,
  client: SyncStateClientVersions | undefined,
): Promise<SyncStateResponse> {
  const server = await getSyncVersions(db);
  const fetch = buildGlobalFetchFlags(client, server);

  return {
    server,
    fetch,
  };
}

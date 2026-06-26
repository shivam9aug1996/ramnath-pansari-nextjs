import type { Db } from "mongodb";
import {
  STORE_SETTINGS_ID,
  SYNC_VERSIONS_DOC_ID,
  storeSettingsCollection,
} from "@/app/api/offers/storeSettingsUtils";
import {
  DEFAULT_SYNC_VERSIONS,
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

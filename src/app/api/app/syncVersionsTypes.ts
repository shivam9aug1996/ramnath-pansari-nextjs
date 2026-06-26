export type SyncVersions = {
  carousel: number;
  offers: number;
  deliverySettings: number;
  storeConfig: number;
  category: number;
};

export const DEFAULT_SYNC_VERSIONS: SyncVersions = {
  carousel: 1,
  offers: 1,
  deliverySettings: 1,
  storeConfig: 1,
  category: 1,
};

/** Separate storeSettings doc — only version counters, not config payloads. */
export type SyncVersionsDocument = SyncVersions & {
  _id: "sync-versions";
  updatedAt: Date;
};

export type SyncStateClientVersions = Partial<SyncVersions>;

export type SyncStateFetchFlags = {
  carousel: boolean;
  offers: boolean;
  deliverySettings: boolean;
  storeConfig: boolean;
  category: boolean;
};

export type SyncStateResponse = {
  server: SyncVersions;
  fetch: SyncStateFetchFlags;
};

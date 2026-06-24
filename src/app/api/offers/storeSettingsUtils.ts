import type { Db } from "mongodb";
import type { StoreSettingsDocument } from "./offerTypes";

export const STORE_SETTINGS_ID = "global" as const;

export function storeSettingsCollection(db: Db) {
  return db.collection<StoreSettingsDocument>("storeSettings");
}

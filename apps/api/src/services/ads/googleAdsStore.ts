import {
  adsGoogleConnections,
  adsGoogleOauthStates,
  type Database,
} from "@wisdom/db";
import { eq } from "drizzle-orm";
import { ADS_GOOGLE_ACCOUNT_KEY } from "./googleAdsIds.js";

export type AdsOauthStateRow = {
  state: string;
  user_id: string;
  code_verifier: string;
  expires_at: Date;
};

export type AdsGoogleConnectionRow = {
  id: string;
  account_key: string;
  encrypted_tokens: string;
  token_expires_at: Date | null;
  granted_scope: string;
  status: string;
  validated_at: Date | null;
  connected_by_user_id: string | null;
};

export type AdsGoogleConnectionWrite = {
  encrypted_tokens: string;
  token_expires_at?: Date | null;
  granted_scope: string;
  status: string;
  validated_at?: Date | null;
  connected_by_user_id?: string | null;
};

export interface AdsGoogleStore {
  insertOauthState(row: AdsOauthStateRow): Promise<void>;
  consumeOauthState(state: string): Promise<AdsOauthStateRow | null>;
  getConnection(): Promise<AdsGoogleConnectionRow | null>;
  upsertConnection(row: AdsGoogleConnectionWrite): Promise<AdsGoogleConnectionRow>;
  deleteConnection(): Promise<void>;
}

export function createDbAdsGoogleStore(db: Database): AdsGoogleStore {
  return {
    async insertOauthState(row) {
      await db.insert(adsGoogleOauthStates).values(row);
    },
    async consumeOauthState(state) {
      const [row] = await db.select().from(adsGoogleOauthStates).where(eq(adsGoogleOauthStates.state, state)).limit(1);
      if (!row) return null;
      await db.delete(adsGoogleOauthStates).where(eq(adsGoogleOauthStates.state, state));
      return {
        state: row.state,
        user_id: row.user_id,
        code_verifier: row.code_verifier,
        expires_at: row.expires_at,
      };
    },
    async getConnection() {
      const [row] = await db.select().from(adsGoogleConnections)
        .where(eq(adsGoogleConnections.account_key, ADS_GOOGLE_ACCOUNT_KEY))
        .limit(1);
      return row ?? null;
    },
    async upsertConnection(row) {
      const existing = await this.getConnection();
      if (existing) {
        const [updated] = await db.update(adsGoogleConnections)
          .set({
            encrypted_tokens: row.encrypted_tokens,
            token_expires_at: row.token_expires_at ?? null,
            granted_scope: row.granted_scope,
            status: row.status,
            validated_at: row.validated_at ?? null,
            connected_by_user_id: row.connected_by_user_id ?? existing.connected_by_user_id,
          })
          .where(eq(adsGoogleConnections.id, existing.id))
          .returning();
        return updated ?? existing;
      }
      const [created] = await db.insert(adsGoogleConnections).values({
        account_key: ADS_GOOGLE_ACCOUNT_KEY,
        ...row,
      }).returning();
      if (!created) throw new Error("Unable to store Google Ads connection");
      return created;
    },
    async deleteConnection() {
      await db.delete(adsGoogleConnections).where(eq(adsGoogleConnections.account_key, ADS_GOOGLE_ACCOUNT_KEY));
    },
  };
}

export function createMemoryAdsGoogleStore() {
  const oauthStates: AdsOauthStateRow[] = [];
  let connection: AdsGoogleConnectionRow | null = null;
  const store: AdsGoogleStore & { oauthStates: AdsOauthStateRow[]; connection: AdsGoogleConnectionRow | null } = {
    oauthStates,
    get connection() {
      return connection;
    },
    async insertOauthState(row) {
      oauthStates.push({ ...row });
    },
    async consumeOauthState(state) {
      const index = oauthStates.findIndex((row) => row.state === state);
      if (index < 0) return null;
      const [row] = oauthStates.splice(index, 1);
      return row ?? null;
    },
    async getConnection() {
      return connection;
    },
    async upsertConnection(row) {
      connection = {
        id: connection?.id ?? "memory-connection",
        account_key: ADS_GOOGLE_ACCOUNT_KEY,
        encrypted_tokens: row.encrypted_tokens,
        token_expires_at: row.token_expires_at ?? null,
        granted_scope: row.granted_scope,
        status: row.status,
        validated_at: row.validated_at ?? null,
        connected_by_user_id: row.connected_by_user_id ?? connection?.connected_by_user_id ?? null,
      };
      return connection;
    },
    async deleteConnection() {
      connection = null;
    },
  };
  return store;
}

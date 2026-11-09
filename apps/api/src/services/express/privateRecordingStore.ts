export interface PrivateRecordingStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

/** In-memory stand-in for tests. Paid recordings do not use local API disk. */
export function createMemoryRecordingStore(): PrivateRecordingStore {
  const files = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      files.set(key, bytes);
    },
    async get(key) {
      const bytes = files.get(key);
      return bytes ? new Uint8Array(bytes) : null;
    },
  };
}

/** Durable object storage is required. This returns null until a private bucket is configured. */
export function createConfiguredRecordingStore(): PrivateRecordingStore | null {
  const configured = [
    process.env.EXPRESS_STORAGE_ENDPOINT,
    process.env.EXPRESS_STORAGE_BUCKET,
    process.env.EXPRESS_STORAGE_ACCESS_KEY_ID,
    process.env.EXPRESS_STORAGE_SECRET_ACCESS_KEY,
  ].every((value) => Boolean(value?.trim()));
  if (!configured) return null;
  return {
    async put() {
      throw new Error("Private recording storage is not connected");
    },
    async get() {
      throw new Error("Private recording storage is not connected");
    },
  };
}

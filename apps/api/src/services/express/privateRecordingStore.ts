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

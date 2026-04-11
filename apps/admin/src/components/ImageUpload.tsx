import { useState } from "react";
import { useAuth } from "@clerk/react";
import { resolveApiUrl } from "../lib/apiBase";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface ImageUploadProps {
  /** Basename returned from POST /images/upload */
  onImageAssetId: (id: string | null) => void;
  label?: string;
}

export default function ImageUpload({ onImageAssetId, label = "Upload Image" }: ImageUploadProps) {
  const { getToken } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) {
      setPreview(null);
      onImageAssetId(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_BYTES) {
      setError(`Image must be under 5MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB).`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("image", file);

      const res = await fetch(resolveApiUrl("/images/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Upload failed (${res.status})`);
      }

      const { imageAssetId } = (await res.json()) as { imageAssetId: string };
      onImageAssetId(imageAssetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setPreview(null);
      onImageAssetId(null);
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setError(null);
    onImageAssetId(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs text-white/40">{label}</label>

      {!preview ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-glass-border bg-glass px-4 py-6 text-center transition-colors hover:border-accent-cyan/30 ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="mb-2 text-3xl">{uploading ? "⏳" : "📷"}</div>
          <div className="text-sm text-white/60">
            {uploading ? "Uploading…" : "Click to upload face photo"}
          </div>
          <div className="mt-1 text-xs text-white/40">JPEG, PNG, WebP — max 5MB</div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      ) : (
        <div className="relative rounded-lg border border-glass-border bg-glass p-2">
          <img src={preview} alt="Preview" className="h-32 w-full rounded object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <span className="text-sm text-white">Uploading…</span>
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-3 rounded-full bg-red-500/80 px-2 py-1 text-xs text-white transition-colors hover:bg-red-500"
            >
              Remove
            </button>
          )}
        </div>
      )}

      <div className="rounded-md border border-white/5 bg-white/5 px-3 py-2 text-[11px] text-white/40 leading-relaxed">
        This image is used for <strong className="text-white/60">symbolic energetic interpretation only</strong> — not for identification, profiling, or any diagnostic purpose. Interpretations are impressionistic and non-deterministic.
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}

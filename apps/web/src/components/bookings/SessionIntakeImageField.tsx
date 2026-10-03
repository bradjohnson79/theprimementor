import { useEffect, useRef, useState } from "react";
import { validateUploadableImage } from "../../lib/uploadImageAsset";

interface SessionIntakeImageFieldProps {
  id?: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

export default function SessionIntakeImageField({
  id = "session-intake-image",
  file,
  onChange,
}: SessionIntakeImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-white">
        Your photo <span className="font-normal text-white/45">(optional)</span>
      </label>
      <p className="text-sm leading-6 text-white/55">
        Add a photo if you want it included with this session. JPEG, PNG, or WebP, under 5MB.
      </p>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          if (!next) {
            setError(null);
            onChange(null);
            return;
          }
          try {
            validateUploadableImage(next);
            setError(null);
            onChange(next);
          } catch (err) {
            event.target.value = "";
            onChange(null);
            setError(err instanceof Error ? err.message : "Please choose a JPEG, PNG, or WebP image under 5MB.");
          }
        }}
      />
      {file && previewUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <img src={previewUrl} alt="Selected session photo" className="h-20 w-20 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm text-white/85">{file.name}</p>
            <button
              type="button"
              className="mt-1 text-sm text-cyan-100 underline"
              onClick={() => {
                setError(null);
                if (inputRef.current) inputRef.current.value = "";
                onChange(null);
              }}
            >
              Remove photo
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-amber-200" role="alert">{error}</p> : null}
    </div>
  );
}

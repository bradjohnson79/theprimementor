import {
  DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS,
  DIVIN8_KNOWLEDGE_CATEGORIES,
  type Divin8KnowledgeAuthorityLevel,
  type Divin8KnowledgeCategory,
} from "@wisdom/utils";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function KnowledgeUploadPanel({
  isLightTheme,
  isBusy,
  onPreview,
  onUpload,
}: {
  isLightTheme: boolean;
  isBusy: boolean;
  onPreview: (input: { file: File; name: string; category: Divin8KnowledgeCategory; authorityLevel: Divin8KnowledgeAuthorityLevel }) => void;
  onUpload: (input: { file: File; name: string; category: Divin8KnowledgeCategory; authorityLevel: Divin8KnowledgeAuthorityLevel }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Divin8KnowledgeCategory>("numerology_prime_canon");
  const [authorityLevel, setAuthorityLevel] = useState<Divin8KnowledgeAuthorityLevel>("canonical_interpretation");

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && !name) {
      setName(nextFile.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    onUpload({ file, name: name.trim() || file.name, category, authorityLevel });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={classNames(
        "rounded-3xl border p-5",
        isLightTheme ? "border-slate-200 bg-white" : "border-white/10 bg-white/5",
      )}
    >
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        className={classNames(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center",
          isLightTheme ? "border-slate-300 bg-slate-50 text-slate-600" : "border-white/15 bg-white/[0.03] text-white/60",
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
          className="hidden"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-sm font-semibold">Drag and drop a PDF, TXT, or Markdown file</p>
        <p className="mt-1 text-xs">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "or click to choose a file"}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Source name"
          className={classNames(
            "rounded-xl border px-3 py-2.5 text-sm outline-none",
            isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-white/[0.04] text-white",
          )}
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Divin8KnowledgeCategory)}
          className={classNames(
            "rounded-xl border px-3 py-2.5 text-sm outline-none",
            isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-navy-medium text-white",
          )}
        >
          {DIVIN8_KNOWLEDGE_CATEGORIES.map((value) => (
            <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={authorityLevel}
          onChange={(event) => setAuthorityLevel(event.target.value as Divin8KnowledgeAuthorityLevel)}
          className={classNames(
            "rounded-xl border px-3 py-2.5 text-sm outline-none",
            isLightTheme ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/10 bg-navy-medium text-white",
          )}
        >
          {DIVIN8_KNOWLEDGE_AUTHORITY_LEVELS.map((value) => (
            <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!file || isBusy}
          onClick={() => file && onPreview({ file, name: name.trim() || file.name, category, authorityLevel })}
          className={classNames("rounded-xl px-4 py-2.5 text-sm font-semibold", isLightTheme ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white")}
        >
          Preview Extraction
        </button>
        <button
          type="submit"
          disabled={!file || isBusy}
          className="rounded-xl bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-slate-950"
        >
          Upload Knowledge Source
        </button>
      </div>
    </form>
  );
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_DIVIN8_SYSTEM_PROMPT } from "./divin8SystemPrompt.js";

interface PromptOverrideFile {
  prompt: string;
  updatedAt: string;
}

function promptStoreRoot() {
  const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  return path.join(apiRoot, "data", "divin8");
}

function promptOverridePath() {
  return path.join(promptStoreRoot(), "prompt.override.json");
}

async function ensurePromptStoreDir() {
  await fs.mkdir(promptStoreRoot(), { recursive: true });
}

async function readPromptOverride(): Promise<PromptOverrideFile | null> {
  try {
    const raw = await fs.readFile(promptOverridePath(), "utf8");
    const parsed = JSON.parse(raw) as PromptOverrideFile;
    if (typeof parsed.prompt !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getActiveDivin8Prompt() {
  const override = await readPromptOverride();
  return {
    prompt: override?.prompt || DEFAULT_DIVIN8_SYSTEM_PROMPT,
    defaultPrompt: DEFAULT_DIVIN8_SYSTEM_PROMPT,
    hasOverride: Boolean(override?.prompt),
    updatedAt: override?.updatedAt ?? null,
  };
}

export async function saveDivin8PromptOverride(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) {
    throw new Error("Prompt cannot be empty.");
  }

  await ensurePromptStoreDir();
  const payload: PromptOverrideFile = {
    prompt: normalized,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(promptOverridePath(), JSON.stringify(payload, null, 2), "utf8");
  return getActiveDivin8Prompt();
}

export async function clearDivin8PromptOverride() {
  try {
    await fs.unlink(promptOverridePath());
  } catch {
    // no-op if already missing
  }
  return getActiveDivin8Prompt();
}

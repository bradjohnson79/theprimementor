import assert from "node:assert/strict";
import test from "node:test";
import { getFrontendUrl } from "./membershipBilling.js";

function withEnv(
  overrides: Partial<Record<"FRONTEND_URL" | "APP_URL" | "VITE_APP_URL" | "NODE_ENV", string | undefined>>,
  run: () => void,
) {
  const previous = new Map<string, string | undefined>();

  for (const key of ["FRONTEND_URL", "APP_URL", "VITE_APP_URL", "NODE_ENV"] as const) {
    previous.set(key, process.env[key]);
    const nextValue = overrides[key];
    if (nextValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextValue;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("getFrontendUrl prefers configured frontend URLs and strips trailing slashes", () => {
  withEnv(
    {
      FRONTEND_URL: "https://theprimementor.com/",
      APP_URL: "https://wrong.example.com",
      VITE_APP_URL: "https://also-wrong.example.com",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(getFrontendUrl(), "https://theprimementor.com");
    },
  );
});

test("getFrontendUrl falls back to the production site in production", () => {
  withEnv(
    {
      FRONTEND_URL: undefined,
      APP_URL: undefined,
      VITE_APP_URL: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.equal(getFrontendUrl(), "https://theprimementor.com");
    },
  );
});

test("getFrontendUrl uses localhost fallback outside production", () => {
  withEnv(
    {
      FRONTEND_URL: undefined,
      APP_URL: undefined,
      VITE_APP_URL: undefined,
      NODE_ENV: "development",
    },
    () => {
      assert.equal(getFrontendUrl(), "http://localhost:3000");
    },
  );
});

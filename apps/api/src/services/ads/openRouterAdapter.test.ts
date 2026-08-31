import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  ADS_AGENT_ERROR_CODES,
  ADS_AGENT_ERROR_MESSAGES,
  DEFAULT_ADS_AGENT_MODEL,
  OPENROUTER_API_BASE,
  clearOpenRouterHealthCache,
  completeOpenRouterChat,
  probeOpenRouterHealth,
} from "./openRouterAdapter.js";

const originalEnv = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  ADS_AGENT_MODEL: process.env.ADS_AGENT_MODEL,
};

afterEach(() => {
  clearOpenRouterHealthCache();
  if (originalEnv.OPENROUTER_API_KEY === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalEnv.OPENROUTER_API_KEY;
  if (originalEnv.ADS_AGENT_MODEL === undefined) delete process.env.ADS_AGENT_MODEL;
  else process.env.ADS_AGENT_MODEL = originalEnv.ADS_AGENT_MODEL;
});

describe("OpenRouter adapter", () => {
  it("reports not_configured when the API key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => {
        throw new Error("should not call OpenRouter without a key");
      },
    });
    assert.equal(health.provider, "openrouter");
    assert.equal(health.status, "not_configured");
    assert.equal(health.apiKeyConfigured, false);
    assert.equal(health.reachable, false);
    assert.equal(health.model, DEFAULT_ADS_AGENT_MODEL);
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.NOT_CONFIGURED);
  });

  it("reports auth_error on 401 without leaking the key", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response("unauthorized sk-or-v1-test-secret-key", { status: 401 }),
    });
    assert.equal(health.status, "auth_error");
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.AUTH);
    assert.doesNotMatch(JSON.stringify(health), /sk-or-v1-test-secret-key/);
  });

  it("reports model_missing when GLM 5.3 Flash is absent", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response(JSON.stringify({
        data: [{ id: "openai/gpt-4o" }, { id: "anthropic/claude-3.5-sonnet" }],
      }), { status: 200 }),
    });
    assert.equal(health.status, "model_missing");
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.MODEL_UNAVAILABLE);
  });

  it("reports provider_error when OpenRouter cannot be reached", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });
    assert.equal(health.status, "provider_error");
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE);
  });

  it("connects only when the exact configured model is available", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    process.env.ADS_AGENT_MODEL = DEFAULT_ADS_AGENT_MODEL;
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response(JSON.stringify({
        data: [{ id: DEFAULT_ADS_AGENT_MODEL }],
      }), { status: 200 }),
    });
    assert.equal(health.status, "connected");
    assert.equal(health.model, DEFAULT_ADS_AGENT_MODEL);
    assert.equal(health.reachable, true);
    assert.equal(health.message, null);
  });

  it("does not substitute another model when the configured model is missing", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response(JSON.stringify({
        data: [{ id: "z-ai/glm-4.5-flash" }, { id: "openai/gpt-4o-mini" }],
      }), { status: 200 }),
    });
    assert.equal(health.status, "model_missing");
    assert.equal(health.model, DEFAULT_ADS_AGENT_MODEL);
  });

  it("reports auth_error on 403 without leaking the key", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response("forbidden sk-or-v1-test-secret-key", { status: 403 }),
    });
    assert.equal(health.status, "auth_error");
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.AUTH);
    assert.doesNotMatch(JSON.stringify(health), /sk-or-v1-test-secret-key/);
  });

  it("reports provider_error on timeout without leaking the key", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    });
    assert.equal(health.status, "provider_error");
    assert.equal(health.message, ADS_AGENT_ERROR_MESSAGES.UNAVAILABLE);
    assert.doesNotMatch(JSON.stringify(health), /sk-or-v1-test-secret-key/);
  });

  it("ignores a different ADS_AGENT_MODEL and stays locked to GLM 5.3 Flash", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    process.env.ADS_AGENT_MODEL = "z-ai/glm-4.5-flash";
    const health = await probeOpenRouterHealth({
      bypassCache: true,
      fetcher: async () => new Response(JSON.stringify({
        data: [{ id: "z-ai/glm-4.5-flash" }, { id: DEFAULT_ADS_AGENT_MODEL }],
      }), { status: 200 }),
    });
    assert.equal(health.model, DEFAULT_ADS_AGENT_MODEL);
    assert.equal(health.status, "connected");
  });

  it("sends chat to OpenRouter chat completions with the locked model", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    let requestedUrl = "";
    let requestedAuth = "";
    let requestedBody: { model?: string; stream?: boolean } = {};
    const reply = await completeOpenRouterChat({
      messages: [{ role: "user", content: "What is CTR in Google Ads?" }],
      fetcher: async (input, init) => {
        requestedUrl = String(input);
        requestedAuth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
        requestedBody = JSON.parse(String(init?.body ?? "{}")) as { model?: string; stream?: boolean };
        return new Response(JSON.stringify({
          choices: [{ message: { content: "CTR is clicks divided by impressions." } }],
        }), { status: 200 });
      },
    });
    assert.equal(requestedUrl, `${OPENROUTER_API_BASE}/chat/completions`);
    assert.equal(requestedAuth, "Bearer sk-or-v1-test-secret-key");
    assert.equal(requestedBody.model, DEFAULT_ADS_AGENT_MODEL);
    assert.equal(requestedBody.stream, false);
    assert.match(reply, /CTR/i);
  });

  it("maps chat 401 to a sanitized auth error", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-secret-key";
    await assert.rejects(
      () => completeOpenRouterChat({
        messages: [{ role: "user", content: "What is CTR?" }],
        fetcher: async () => new Response("invalid key sk-or-v1-test-secret-key", { status: 401 }),
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as { code?: string }).code, ADS_AGENT_ERROR_CODES.AUTH);
        assert.equal(error.message, ADS_AGENT_ERROR_MESSAGES.AUTH);
        assert.doesNotMatch(error.message, /sk-or-v1-test-secret-key/);
        return true;
      },
    );
  });
});

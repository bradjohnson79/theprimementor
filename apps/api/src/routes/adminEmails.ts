import type { FastifyInstance, FastifyRequest } from "fastify";
import { ok, sendApiError } from "../apiContract.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin, requireDatabase } from "../routeAssertions.js";
import {
  createManualContact,
  deleteEmailContact,
  bulkDeleteEmailContacts,
  exportEmailContactsCsv,
  listEmailContacts,
  parseContactListQuery,
  updateEmailContact,
} from "../services/emailList/contactService.js";
import { commitCsvImport, previewCsvImport } from "../services/emailList/csvImportService.js";
import { createDrizzleEmailListStore } from "../services/emailList/emailListStore.js";
import {
  createExclusionRule,
  deleteExclusionRule,
  listExclusionRules,
} from "../services/emailList/exclusionService.js";
import {
  completeGmailOAuth,
  disconnectGmail,
  serializeGmailStatus,
  startGmailOAuth,
} from "../services/emailList/gmailConnectionService.js";
import { adminEmailsRedirectUrl, resolveGmailClient } from "../services/emailList/gmailClient.js";
import {
  createSearchProfile,
  deleteSearchProfile,
  importGmailMatches,
  listSearchProfiles,
  saveGmailCandidates,
  searchGmailCandidates,
  updateSearchProfile,
} from "../services/emailList/gmailSearchService.js";

const SEARCH_RATE_LIMIT = { max: 20, timeWindow: "1 minute" as const };
const COMMIT_RATE_LIMIT = { max: 10, timeWindow: "1 minute" as const };

function storeFor(request: FastifyRequest) {
  return createDrizzleEmailListStore(requireDatabase(request.server.db));
}

async function readCsvMultipart(request: FastifyRequest) {
  const data = await request.file({ limits: { fileSize: 2 * 1024 * 1024 } });
  if (!data) {
    throw new Error("No CSV file uploaded.");
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of data.file) {
    totalBytes += chunk.length;
    if (totalBytes > 2 * 1024 * 1024) {
      throw new Error("CSV must be 2MB or smaller");
    }
    chunks.push(chunk);
  }
  return {
    filename: data.filename,
    mimetype: data.mimetype,
    buffer: Buffer.concat(chunks),
  };
}

export async function adminEmailsRoutes(app: FastifyInstance) {
  app.get("/admin/gmail/status", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    const connection = await storeFor(request).getConnection(user.id);
    return ok(serializeGmailStatus(connection));
  });

  app.get("/admin/gmail/oauth/start", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await startGmailOAuth(storeFor(request), user.id, resolveGmailClient()));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/admin/gmail/oauth/callback",
    async (request, reply) => {
      try {
        const url = await completeGmailOAuth(storeFor(request), request.query ?? {}, resolveGmailClient());
        return reply.redirect(url);
      } catch {
        return reply.redirect(adminEmailsRedirectUrl("?gmail=error"));
      }
    },
  );

  app.post("/admin/gmail/disconnect", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await disconnectGmail(storeFor(request), user.id, resolveGmailClient()));
  });

  app.post<{ Body: Record<string, unknown> }>("/admin/gmail/search", {
    preHandler: requireAuth,
    config: { rateLimit: SEARCH_RATE_LIMIT },
  }, async (request) => {
    const user = requireAdmin(request);
    const body = request.body ?? {};
    return ok(await searchGmailCandidates(storeFor(request), user.id, {
      query: typeof body.query === "string" ? body.query : undefined,
      year: body.year,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
      searchSessionId: typeof body.searchSessionId === "string" ? body.searchSessionId : undefined,
      profileId: typeof body.profileId === "string" ? body.profileId : undefined,
      batchSize: typeof body.batchSize === "number" ? body.batchSize : undefined,
    }, resolveGmailClient()));
  });

  app.get("/admin/gmail/search-profiles", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok({ profiles: await listSearchProfiles(storeFor(request), user.id) });
  });

  app.post<{ Body: { name?: string; query?: string } }>("/admin/gmail/search-profiles", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await createSearchProfile(storeFor(request), user.id, request.body ?? {}));
  });

  app.patch<{ Params: { profileId: string }; Body: { name?: string; query?: string } }>(
    "/admin/gmail/search-profiles/:profileId",
    { preHandler: requireAuth },
    async (request) => {
      const user = requireAdmin(request);
      return ok(await updateSearchProfile(storeFor(request), user.id, request.params.profileId, request.body ?? {}));
    },
  );

  app.delete<{ Params: { profileId: string } }>("/admin/gmail/search-profiles/:profileId", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await deleteSearchProfile(storeFor(request), user.id, request.params.profileId));
  });

  app.post<{ Body: Record<string, unknown> }>("/admin/gmail/candidates/save", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await saveGmailCandidates(storeFor(request), user.id, request.body ?? {}));
  });

  app.post<{ Body: Record<string, unknown> }>("/admin/gmail/search-import", {
    preHandler: requireAuth,
    config: { rateLimit: SEARCH_RATE_LIMIT },
  }, async (request) => {
    const user = requireAdmin(request);
    const body = request.body ?? {};
    return ok(await importGmailMatches(storeFor(request), user.id, {
      query: typeof body.query === "string" ? body.query : undefined,
      year: body.year,
      pageToken: typeof body.pageToken === "string" ? body.pageToken : undefined,
      searchSessionId: typeof body.searchSessionId === "string" ? body.searchSessionId : undefined,
    }, resolveGmailClient()));
  });

  app.get("/admin/email-contacts/exclusions", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await listExclusionRules(storeFor(request)));
  });

  app.post<{ Body: { pattern?: string } }>("/admin/email-contacts/exclusions", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await createExclusionRule(storeFor(request), user.id, request.body ?? {}));
  });

  app.delete<{ Params: { id: string } }>("/admin/email-contacts/exclusions/:id", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await deleteExclusionRule(storeFor(request), request.params.id));
  });

  app.get("/admin/email-contacts", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await listEmailContacts(storeFor(request), parseContactListQuery(request.query as Record<string, unknown>)));
  });

  app.post<{ Body: { email?: string; firstName?: string } }>("/admin/email-contacts", { preHandler: requireAuth }, async (request) => {
    const user = requireAdmin(request);
    return ok(await createManualContact(storeFor(request), user.id, request.body ?? {}));
  });

  app.patch<{ Params: { id: string }; Body: { email?: string; firstName?: string | null } }>(
    "/admin/email-contacts/:id",
    { preHandler: requireAuth },
    async (request) => {
      requireAdmin(request);
      return ok(await updateEmailContact(storeFor(request), request.params.id, request.body ?? {}));
    },
  );

  app.delete<{ Params: { id: string } }>("/admin/email-contacts/:id", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await deleteEmailContact(storeFor(request), request.params.id));
  });

  app.post<{ Body: { ids?: string[] } }>("/admin/email-contacts/bulk-delete", { preHandler: requireAuth }, async (request) => {
    requireAdmin(request);
    return ok(await bulkDeleteEmailContacts(storeFor(request), request.body?.ids));
  });

  app.post("/admin/email-contacts/import/preview", { preHandler: requireAuth }, async (request, reply) => {
    const user = requireAdmin(request);
    try {
      return ok(await previewCsvImport(storeFor(request), user.id, await readCsvMultipart(request)));
    } catch (error) {
      return sendApiError(reply, 400, error instanceof Error ? error.message : "CSV preview failed");
    }
  });

  app.post<{ Body: Record<string, unknown> }>("/admin/email-contacts/import/commit", {
    preHandler: requireAuth,
    config: { rateLimit: COMMIT_RATE_LIMIT },
  }, async (request) => {
    const user = requireAdmin(request);
    return ok(await commitCsvImport(storeFor(request), user.id, request.body ?? {}));
  });

  app.get("/admin/email-contacts/export", { preHandler: requireAuth }, async (request, reply) => {
    requireAdmin(request);
    const csv = await exportEmailContactsCsv(storeFor(request));
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="email-contacts.csv"');
    return csv;
  });
}

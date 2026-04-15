import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@wisdom/db";
import { validateDivin8ChatRequest, validateDivin8MemberMessageRequest } from "./chatService.js";
import {
  createDivin8Profile,
  deleteDivin8Profile,
  generateDivin8ProfileTag,
  listDivin8Profiles,
  resolveDivin8ProfilesForMessage,
} from "./profilesService.js";

function makeProfileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    user_id: "user-1",
    full_name: "John Smith",
    tag: "@JohnSmith",
    birth_date: "1990-04-03",
    birth_time: "06:45",
    birth_place: "Vancouver, British Columbia, Canada",
    lat: 49.2827,
    lng: -123.1207,
    timezone: "America/Vancouver",
    created_at: new Date("2026-04-15T00:00:00.000Z"),
    ...overrides,
  };
}

function createSelectChain(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  return Object.assign(promise, {
    orderBy: () => Promise.resolve(rows),
    limit: () => Promise.resolve(rows),
  });
}

function createMockDb(options: {
  selectRows?: unknown[];
  insertRow?: unknown;
  insertError?: Error;
  deleteRows?: unknown[];
}) {
  const selectRows = options.selectRows ?? [];
  const insertRow = options.insertRow ?? makeProfileRow();
  const deleteRows = options.deleteRows ?? [{ id: "profile-1" }];

  return {
    select() {
      return {
        from() {
          return {
            where() {
              return createSelectChain(selectRows);
            },
            orderBy() {
              return Promise.resolve(selectRows);
            },
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            returning: async () => {
              if (options.insertError) {
                throw options.insertError;
              }
              return [insertRow];
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          return {
            returning: async () => deleteRows,
          };
        },
      };
    },
  } as unknown as Database;
}

test("generateDivin8ProfileTag normalizes punctuation and spacing", () => {
  assert.equal(generateDivin8ProfileTag("Mary-Anne Lee"), "@MaryAnneLee");
  assert.equal(generateDivin8ProfileTag("John   Smith"), "@JohnSmith");
});

test("createDivin8Profile validates required timezone", async () => {
  const db = createMockDb({});
  await assert.rejects(
    () => createDivin8Profile(db, "user-1", {
      fullName: "John Smith",
      birthDate: "1990-04-03",
      birthTime: "06:45",
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "",
    }),
    /Invalid timezone|required/i,
  );
});

test("createDivin8Profile returns canonical server-generated tag", async () => {
  const db = createMockDb({
    insertRow: makeProfileRow({
      full_name: "Mary-Anne Lee",
      tag: "@MaryAnneLee",
    }),
  });
  const created = await createDivin8Profile(db, "user-1", {
    fullName: "Mary-Anne Lee",
    birthDate: "1990-04-03",
    birthTime: "06:45",
    birthPlace: "Vancouver, British Columbia, Canada",
    lat: 49.2827,
    lng: -123.1207,
    timezone: "America/Vancouver",
  });

  assert.equal(created.tag, "@MaryAnneLee");
  assert.equal(created.birthTime, "06:45");
});

test("createDivin8Profile rejects duplicate tags for the same user", async () => {
  const db = createMockDb({
    insertError: new Error('duplicate key value violates unique constraint "profiles_user_tag_uidx"'),
  });

  await assert.rejects(
    () => createDivin8Profile(db, "user-1", {
      fullName: "John Smith",
      birthDate: "1990-04-03",
      birthTime: "06:45",
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "America/Vancouver",
    }),
    /already exists/i,
  );
});

test("listDivin8Profiles maps database rows into API shape", async () => {
  const db = createMockDb({
    selectRows: [makeProfileRow()],
  });
  const result = await listDivin8Profiles(db, "user-1");
  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0]?.tag, "@JohnSmith");
});

test("deleteDivin8Profile returns deleted marker", async () => {
  const db = createMockDb({
    deleteRows: [{ id: "profile-1" }],
  });
  const result = await deleteDivin8Profile(db, "user-1", "profile-1");
  assert.deepEqual(result, { id: "profile-1", deleted: true });
});

test("resolveDivin8ProfilesForMessage enforces max-two profile tags", async () => {
  const db = createMockDb({});
  await assert.rejects(
    () => resolveDivin8ProfilesForMessage(db, "user-1", "@One @Two @Three"),
    /Maximum of 2 profiles allowed per reading/i,
  );
});

test("resolveDivin8ProfilesForMessage rejects unknown tags cleanly", async () => {
  const db = createMockDb({
    selectRows: [makeProfileRow()],
  });
  await assert.rejects(
    () => resolveDivin8ProfilesForMessage(db, "user-1", "@JohnSmith and @FakePerson"),
    /Unknown profile tag/i,
  );
});

test("resolveDivin8ProfilesForMessage returns ordered resolved profiles", async () => {
  const db = createMockDb({
    selectRows: [
      makeProfileRow({ id: "profile-2", full_name: "Jane Doe", tag: "@JaneDoe" }),
      makeProfileRow(),
    ],
  });
  const result = await resolveDivin8ProfilesForMessage(db, "user-1", "@JohnSmith with @JaneDoe");
  assert.deepEqual(result.tags, ["@JohnSmith", "@JaneDoe"]);
  assert.deepEqual(result.profiles.map((profile) => profile.tag), ["@JohnSmith", "@JaneDoe"]);
});

test("resolveDivin8ProfilesForMessage fails when userId does not match profile owner", async () => {
  const db = createMockDb({ selectRows: [] });
  await assert.rejects(
    () => resolveDivin8ProfilesForMessage(db, "admin", "@BradJohnson give me a reading"),
    /Unknown profile tag.*@BradJohnson/i,
  );
});

test("resolveDivin8ProfilesForMessage succeeds when correct owner ID is used", async () => {
  const db = createMockDb({
    selectRows: [makeProfileRow({ tag: "@BradJohnson", full_name: "Brad Johnson" })],
  });
  const result = await resolveDivin8ProfilesForMessage(db, "user_clerk_real_id", "@BradJohnson give me a reading");
  assert.equal(result.profiles.length, 1);
  assert.equal(result.profiles[0]?.tag, "@BradJohnson");
});

test("validateDivin8ChatRequest rejects more than two explicit profile tags", () => {
  assert.throws(
    () => validateDivin8ChatRequest({
      message: "Compare these",
      tier: "seeker",
      profile_tags: ["@One", "@Two", "@Three"],
    }),
    /maximum of 2 profiles/i,
  );
});

test("validateDivin8ChatRequest accepts a structured timeline payload", () => {
  const request = validateDivin8ChatRequest({
    message: "@JohnSmith #April1-30-2026",
    tier: "initiate",
    profile_tags: ["@JohnSmith"],
    timeline: {
      tag: "#April1-30-2026",
      system: "vedic",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    },
  });

  assert.deepEqual(request.timeline, {
    tag: "#April1-30-2026",
    system: "vedic",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });
});

test("validateDivin8ChatRequest rejects multiple timeline tags", () => {
  assert.throws(
    () => validateDivin8ChatRequest({
      message: "#April1-10-2026 #April11-20-2026",
      tier: "initiate",
      timeline: {
        tag: "#April1-10-2026",
        system: "vedic",
        startDate: "2026-04-01",
        endDate: "2026-04-10",
      },
    }),
    /only one timeline range/i,
  );
});

test("validateDivin8ChatRequest rejects timeline tags without structured payload", () => {
  assert.throws(
    () => validateDivin8ChatRequest({
      message: "#April1-30-2026 global forecast",
      tier: "initiate",
    }),
    /calendar selector/i,
  );
});

test("validateDivin8ChatRequest rejects seeker timeline access", () => {
  assert.throws(
    () => validateDivin8ChatRequest({
      message: "#April1-30-2026",
      tier: "seeker",
      timeline: {
        tag: "#April1-30-2026",
        system: "western",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      },
    }),
    /Initiate members only/i,
  );
});

test("validateDivin8MemberMessageRequest allows timeline-only global readings", () => {
  const request = validateDivin8MemberMessageRequest({
    message: "#April1-30-2026 global forecast",
    timeline: {
      tag: "#April1-30-2026",
      system: "vedic",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    },
  });

  assert.equal(request.timeline?.tag, "#April1-30-2026");
});

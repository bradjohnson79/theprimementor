import assert from "node:assert/strict";
import test from "node:test";
import type { Database } from "@wisdom/db";
import { validateDivin8ChatRequest, validateDivin8MemberMessageRequest } from "./chatService.js";
import {
  allocateDivin8ProfileTag,
  createDivin8Profile,
  deleteDivin8Profile,
  generateDivin8ProfileTag,
  listDivin8Profiles,
  resolveDivin8ProfilesForMessage,
  toSafeProfileSaveError,
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
        values(values: Record<string, unknown>) {
          return {
            returning: async () => {
              if (options.insertError) {
                throw options.insertError;
              }
              return [{
                ...insertRow,
                ...values,
                created_at: insertRow.created_at,
                id: insertRow.id,
              }];
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

test("createDivin8Profile derives timezone from coordinates when the submitted timezone is empty", async () => {
  const created = await createDivin8Profile(createMockDb({}), "user-1", {
    fullName: "John Smith",
    birthDate: "1990-04-03",
    birthTime: "06:45",
    birthPlace: "Vancouver, British Columbia, Canada",
    lat: 49.2827,
    lng: -123.1207,
    timezone: "",
  });
  assert.equal(created.timezone, "America/Vancouver");
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

test("allocateDivin8ProfileTag increments colliding tags", () => {
  assert.equal(allocateDivin8ProfileTag("@CameliaBobu", []), "@CameliaBobu");
  assert.equal(allocateDivin8ProfileTag("@CameliaBobu", ["@CameliaBobu"]), "@CameliaBobu2");
  assert.equal(allocateDivin8ProfileTag("@CameliaBobu", ["@CameliaBobu", "@CameliaBobu2"]), "@CameliaBobu3");
});

test("createDivin8Profile allocates the next unique tag for the same user", async () => {
  const db = createMockDb({
    selectRows: [{ tag: "@CameliaBobu" }],
  });
  const created = await createDivin8Profile(db, "user-1", {
    fullName: "Camelia Bobu",
    birthDate: "1981-07-11",
    birthTime: "10:28 AM",
    birthPlace: "Romania",
    lat: 45.943161,
    lng: 24.96676,
    timezone: "Asia/Jerusalem",
  });

  assert.equal(created.tag, "@CameliaBobu2");
  assert.equal(created.fullName, "Camelia Bobu");
  assert.equal(created.birthDate, "1981-07-11");
  assert.equal(created.birthTime, "10:28");
  assert.equal(created.timezone, "Europe/Bucharest");
});

test("createDivin8Profile does not expose raw SQL for a unique-tag race", async () => {
  const wrapped = new Error('Failed query: insert into "profiles"') as Error & { cause: { code: string; constraint: string } };
  wrapped.cause = { code: "23505", constraint: "profiles_user_tag_uidx" };
  const db = createMockDb({ insertError: wrapped });

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
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /already in use/i);
      assert.doesNotMatch(error.message, /Failed query|insert into/i);
      return true;
    },
  );
});

test("toSafeProfileSaveError maps an invalid owner foreign key", () => {
  const wrapped = new Error('Failed query: insert into "profiles"') as Error & {
    cause: { code: string; constraint: string };
  };
  wrapped.cause = { code: "23503", constraint: "profiles_user_id_users_id_fk" };

  assert.throws(
    () => toSafeProfileSaveError(wrapped),
    (error: Error & { statusCode?: number }) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /owner record is invalid/i);
      assert.doesNotMatch(error.message, /Failed query|insert into/i);
      return true;
    },
  );
});

test("createDivin8Profile persists 12-hour birth times in 24-hour storage form", async () => {
  const cases = [
    { input: "12:00 AM", stored: "00:00" },
    { input: "12:00 PM", stored: "12:00" },
    { input: "1:05 PM", stored: "13:05" },
    { input: "11:59 PM", stored: "23:59" },
  ];

  for (const testCase of cases) {
    const created = await createDivin8Profile(createMockDb({}), "user-1", {
      fullName: "Time Case",
      birthDate: "1990-04-03",
      birthTime: testCase.input,
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "America/Vancouver",
    });
    assert.equal(created.birthTime, testCase.stored, testCase.input);
  }
});

test("createDivin8Profile rejects missing birth time, invalid date, coordinates, and timezone", async () => {
  const db = createMockDb({});
  await assert.rejects(
    () => createDivin8Profile(db, "user-1", {
      fullName: "John Smith",
      birthDate: "1990-04-03",
      birthTime: "",
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "America/Vancouver",
    }),
    /Birth time is required/i,
  );
  await assert.rejects(
    () => createDivin8Profile(db, "user-1", {
      fullName: "John Smith",
      birthDate: "not-a-date",
      birthTime: "06:45",
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "America/Vancouver",
    }),
    /Invalid date/i,
  );
  await assert.rejects(
    () => createDivin8Profile(db, "user-1", {
      fullName: "John Smith",
      birthDate: "1990-04-03",
      birthTime: "06:45",
      birthPlace: "Vancouver, British Columbia, Canada",
      lat: 91,
      lng: -123.1207,
      timezone: "America/Vancouver",
    }),
    /birthplace/i,
  );
  const created = await createDivin8Profile(db, "user-1", {
    fullName: "John Smith",
    birthDate: "1990-04-03",
    birthTime: "06:45",
    birthPlace: "Vancouver, British Columbia, Canada",
    lat: 49.2827,
    lng: -123.1207,
    timezone: "Not/AZone",
  });
  assert.equal(created.timezone, "America/Vancouver");
});

test("createDivin8Profile saves and reloads international profiles with geographic timezones", async () => {
  const cases = [
    { name: "Camelia Bobu", place: "Romania", lat: 45.943161, lng: 24.96676, timezone: "Europe/Bucharest", date: "1981-07-11", time: "10:28 AM", storedTime: "10:28", tag: "@CameliaBobu" },
    { name: "Jane Vancouver", place: "Vancouver, BC, Canada", lat: 49.2827, lng: -123.1207, timezone: "America/Vancouver", date: "1990-04-03", time: "06:45", storedTime: "06:45", tag: "@JaneVancouver" },
    { name: "John New York", place: "New York, NY, USA", lat: 40.7128, lng: -74.006, timezone: "America/New_York", date: "1988-01-15", time: "09:15 AM", storedTime: "09:15", tag: "@JohnNewYork" },
    { name: "Helen London", place: "London, United Kingdom", lat: 51.5074, lng: -0.1278, timezone: "Europe/London", date: "1975-06-20", time: "14:30", storedTime: "14:30", tag: "@HelenLondon" },
    { name: "Sam Sydney", place: "Sydney, Australia", lat: -33.8688, lng: 151.2093, timezone: "Australia/Sydney", date: "1982-11-02", time: "08:00 AM", storedTime: "08:00", tag: "@SamSydney" },
    { name: "Priya Mumbai", place: "Mumbai, India", lat: 19.076, lng: 72.8777, timezone: "Asia/Kolkata", date: "1991-03-09", time: "07:05 AM", storedTime: "07:05", tag: "@PriyaMumbai" },
    { name: "Yuki Tokyo", place: "Tokyo, Japan", lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo", date: "1986-08-18", time: "11:20 PM", storedTime: "23:20", tag: "@YukiTokyo" },
  ];

  for (const testCase of cases) {
    const created = await createDivin8Profile(createMockDb({}), "user-1", {
      fullName: testCase.name,
      birthDate: testCase.date,
      birthTime: testCase.time,
      birthPlace: testCase.place,
      lat: testCase.lat,
      lng: testCase.lng,
      timezone: "Asia/Jerusalem",
    });

    assert.equal(created.tag, testCase.tag);
    assert.equal(created.birthDate, testCase.date);
    assert.equal(created.birthTime, testCase.storedTime);
    assert.equal(created.birthPlace, testCase.place);
    assert.equal(created.lat, testCase.lat);
    assert.equal(created.lng, testCase.lng);
    assert.equal(created.timezone, testCase.timezone);

    const listed = await listDivin8Profiles(createMockDb({
      selectRows: [{
        id: created.id,
        user_id: "user-1",
        full_name: created.fullName,
        tag: created.tag,
        birth_date: created.birthDate,
        birth_time: created.birthTime,
        birth_place: created.birthPlace,
        lat: created.lat,
        lng: created.lng,
        timezone: created.timezone,
        created_at: new Date("2026-10-16T00:00:00.000Z"),
      }],
    }), "user-1");
    assert.equal(listed.profiles[0]?.tag, testCase.tag);
    assert.equal(listed.profiles[0]?.timezone, testCase.timezone);

    const resolved = await resolveDivin8ProfilesForMessage(createMockDb({
      selectRows: [{
        id: created.id,
        user_id: "user-1",
        full_name: created.fullName,
        tag: created.tag,
        birth_date: created.birthDate,
        birth_time: created.birthTime,
        birth_place: created.birthPlace,
        lat: created.lat,
        lng: created.lng,
        timezone: created.timezone,
        created_at: new Date("2026-10-16T00:00:00.000Z"),
      }],
    }), "user-1", `Please read ${testCase.tag}`);
    assert.deepEqual(resolved.tags, [testCase.tag]);
  }
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

test("resolveDivin8ProfilesForMessage uses stored conversation tags for tagless follow-ups", async () => {
  const db = createMockDb({
    selectRows: [makeProfileRow({ tag: "@BradJohnson", full_name: "Brad Johnson" })],
  });
  const result = await resolveDivin8ProfilesForMessage(db, "user-1", "What does my chart say about travel?", {
    conversationActiveTags: ["@BradJohnson"],
  });

  assert.deepEqual(result.tags, ["@BradJohnson"]);
  assert.deepEqual(result.profiles.map((profile) => profile.tag), ["@BradJohnson"]);
});

test("resolveDivin8ProfilesForMessage preserves source-priority order while merging profiles", async () => {
  const db = createMockDb({
    selectRows: [
      makeProfileRow({ id: "profile-1", full_name: "Brad Johnson", tag: "@BradJohnson" }),
      makeProfileRow({ id: "profile-2", full_name: "Breanne Example", tag: "@Breanne" }),
    ],
  });
  const result = await resolveDivin8ProfilesForMessage(db, "user-1", "Compare @BradJohnson with this new addition", {
    conversationActiveTags: ["@BradJohnson"],
    explicitTags: ["@Breanne"],
  });

  assert.deepEqual(result.tags, ["@BradJohnson", "@Breanne"]);
  assert.deepEqual(result.profiles.map((profile) => profile.tag), ["@BradJohnson", "@Breanne"]);
});

test("resolveDivin8ProfilesForMessage rejects merged active profile sets over the limit", async () => {
  const db = createMockDb({});
  await assert.rejects(
    () => resolveDivin8ProfilesForMessage(db, "user-1", "@Three", {
      conversationActiveTags: ["@One"],
      explicitTags: ["@Two"],
    }),
    /Maximum of 2 profiles allowed per reading/i,
  );
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidatesFromThreads, dedupeCandidatesByEmail } from "./candidateBuild.js";

describe("candidateBuild", () => {
  it("dedupes correspondents, excludes the owner, and uses full-thread two-way", () => {
    const candidates = buildCandidatesFromThreads({
      threads: [
        {
          id: "thread-1",
          messages: [
            {
              id: "m1",
              threadId: "thread-1",
              headers: [
                { name: "From", value: "Owner <me@example.com>" },
                { name: "To", value: "Jane Client <jane@client.com>" },
                { name: "Subject", value: "Mentoring follow up" },
                { name: "Date", value: "Mon, 1 Jan 2026 12:00:00 +0000" },
              ],
            },
            {
              id: "m2",
              threadId: "thread-1",
              headers: [
                { name: "From", value: "Jane Client <jane@client.com>" },
                { name: "To", value: "Owner <me@example.com>" },
                { name: "Subject", value: "Re: thanks" },
                { name: "Date", value: "Tue, 2 Jan 2026 12:00:00 +0000" },
              ],
            },
          ],
        },
      ],
      matchingMessageIds: new Set(["m1"]),
      query: "mentoring",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => false },
    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.emailNormalized, "jane@client.com");
    assert.equal(candidates[0]?.firstName, "Jane");
    assert.equal(candidates[0]?.twoWay, true);
    assert.equal(candidates[0]?.status, "new");
  });

  it("marks already-listed and automated addresses without dropping them", () => {
    const candidates = buildCandidatesFromThreads({
      threads: [
        {
          id: "thread-2",
          messages: [
            {
              id: "m3",
              threadId: "thread-2",
              headers: [
                { name: "From", value: "Receipts <noreply@stripe.com>" },
                { name: "To", value: "me@example.com" },
              ],
            },
          ],
        },
      ],
      matchingMessageIds: new Set(["m3"]),
      query: "receipt",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => true },
    });
    assert.equal(candidates[0]?.status, "filtered");
    assert.ok(candidates[0]?.rejectionReason);
  });

  it("applies shared email and domain exclusion rules", () => {
    const threads = [
      {
        id: "thread-3",
        messages: [
          {
            id: "m4",
            threadId: "thread-3",
            headers: [
              { name: "From", value: "Ads <ads@google.com>" },
              { name: "To", value: "Owner <me@example.com>, Jane <jane@client.com>, Skip <skip@notify.test>" },
            ],
          },
        ],
      },
    ];
    const candidates = buildCandidatesFromThreads({
      threads,
      matchingMessageIds: new Set(["m4"]),
      query: "Adronis",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => false },
      exclusionRules: [
        { kind: "domain", value: "google.com" },
        { kind: "email", value: "skip@notify.test" },
      ],
    });
    const byEmail = new Map(candidates.map((item) => [item.emailNormalized, item]));
    assert.equal(byEmail.get("ads@google.com")?.status, "filtered");
    assert.match(byEmail.get("ads@google.com")?.rejectionReason ?? "", /@google.com/);
    assert.equal(byEmail.get("skip@notify.test")?.status, "filtered");
    assert.equal(byEmail.get("jane@client.com")?.status, "new");
  });

  it("marks suppressed addresses with the hard-bounce skip reason", () => {
    const candidates = buildCandidatesFromThreads({
      threads: [{
        id: "thread-suppressed",
        messages: [{
          id: "m-s",
          threadId: "thread-suppressed",
          headers: [
            { name: "From", value: "Gone <gone@client.com>" },
            { name: "To", value: "Owner <me@example.com>" },
          ],
        }],
      }],
      matchingMessageIds: new Set(["m-s"]),
      query: "Adronis",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => false },
      suppressed: { has: (email) => email === "gone@client.com" },
    });
    assert.equal(candidates[0]?.status, "suppressed");
    assert.match(candidates[0]?.rejectionReason ?? "", /hard bounce/);
  });

  it("collapses the same address with different casing into one candidate", () => {
    const candidates = buildCandidatesFromThreads({
      threads: [
        {
          id: "thread-4",
          messages: [
            {
              id: "m5",
              threadId: "thread-4",
              headers: [
                { name: "From", value: "Jane <Jane@Client.com>" },
                { name: "To", value: "Owner <me@example.com>" },
              ],
            },
            {
              id: "m6",
              threadId: "thread-4",
              headers: [
                { name: "From", value: "jane@client.com" },
                { name: "To", value: "Owner <me@example.com>" },
              ],
            },
          ],
        },
      ],
      matchingMessageIds: new Set(["m5", "m6"]),
      query: "Adronis",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => false },
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.emailNormalized, "jane@client.com");
  });

  it("dedupes an explicit candidate list by normalized email", () => {
    const unique = dedupeCandidatesByEmail([
      {
        id: "a",
        email: "Jane@Client.com",
        emailNormalized: "Jane@client.com",
        firstName: "Jane",
        firstContact: null,
        lastContact: null,
        messageCount: 1,
        twoWay: false,
        sentCount: 0,
        receivedCount: 1,
        query: "Adronis",
        profileId: null,
        threadIds: ["t1"],
        messageIds: ["m1"],
        evidenceSummary: "",
        status: "new",
        rejectionReason: null,
      },
      {
        id: "b",
        email: "jane@client.com",
        emailNormalized: "jane@client.com",
        firstName: null,
        firstContact: null,
        lastContact: null,
        messageCount: 1,
        twoWay: true,
        sentCount: 1,
        receivedCount: 0,
        query: "Adronis",
        profileId: null,
        threadIds: ["t2"],
        messageIds: ["m2"],
        evidenceSummary: "",
        status: "already_in_list",
        rejectionReason: null,
      },
    ]);
    assert.equal(unique.length, 1);
    assert.equal(unique[0]?.status, "already_in_list");
    assert.equal(unique[0]?.twoWay, true);
    assert.deepEqual(unique[0]?.threadIds, ["t1", "t2"]);
  });
});


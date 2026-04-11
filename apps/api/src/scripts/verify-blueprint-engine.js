#!/usr/bin/env node
/**
 * Part 6 — Double Verification Tests
 * Tests A (Guest Mode) + B (Client Mode) + structural validation
 *
 * Usage:
 *   export TEST_CLERK_TOKEN="your_clerk_jwt_here"
 *   node apps/api/src/scripts/verify-blueprint-engine.js
 */

const API = process.env.API_URL || "http://localhost:3001";
const TOKEN = process.env.TEST_CLERK_TOKEN;

if (!TOKEN) {
  console.error("❌ TEST_CLERK_TOKEN not set.");
  console.error("   1. Open http://localhost:5174/blueprint in your browser");
  console.error("   2. Sign in as admin");
  console.error("   3. Open DevTools Console and run:");
  console.error('      await window.Clerk.session.getToken()');
  console.error("   4. Copy the token and run:");
  console.error('      export TEST_CLERK_TOKEN="<token>"');
  console.error("   5. Re-run this script");
  process.exit(1);
}

const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${TOKEN}`,
};

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function testA() {
  console.log("\n══════════════════════════════════════════");
  console.log("  TEST A — GUEST MODE BLUEPRINT GENERATION");
  console.log("══════════════════════════════════════════\n");

  const payload = {
    mode: "guest",
    guest: {
      firstName: "Brad",
      lastName: "Johnson",
      birthDate: "1979-03-22",
      birthTime: "19:08",
      birthLocation: "Port Alberni, BC, Canada",
    },
    coordinates: {
      latitude: 49.2338882,
      longitude: -124.8055494,
      formattedAddress: "Port Alberni, BC, Canada",
    },
    includeSystems: ["numerology", "astrology", "chinese"],
  };

  console.log("📤 Request:", JSON.stringify({ mode: payload.mode, systems: payload.includeSystems }));

  const res = await fetch(`${API}/api/blueprints/generate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  assert(res.status === 200, `HTTP 200 (got ${res.status})`);

  if (!res.ok) {
    const err = await res.text();
    console.error("  Response:", err);
    return null;
  }

  const data = await res.json();
  console.log(`\n  Report ID: ${data.reportId}`);
  console.log(`  Status: ${data.status}`);

  assert(!!data.reportId, "reportId present");
  assert(data.status === "draft", "status = 'draft'");
  assert(!!data.blueprint, "blueprint data returned");

  const bp = data.blueprint;

  // Core layer
  assert(!!bp.core, "blueprint.core present");
  assert(!!bp.core?.birthData, "blueprint.core.birthData present");
  assert(!!bp.core?.astronomicalSnapshot, "blueprint.core.astronomicalSnapshot present");
  assert(bp.core?.astronomicalSnapshot?.coordinates?.sidereal?.ayanamsa > 0, "sidereal ayanamsa > 0");

  // Client
  assert(bp.client?.id === null, "client.id is null (guest mode)");
  assert(bp.client?.fullBirthName === "Brad Johnson", "fullBirthName correct");

  // Numerology
  assert(!!bp.numerology, "numerology present");
  assert(typeof bp.numerology?.lifePath === "number", "lifePath is number");

  // Vedic astrology
  assert(!!bp.astrology, "astrology present");
  assert(bp.astrology?.system === "vedic_sidereal", "astrology system = vedic_sidereal");
  assert(bp.astrology?.ayanamsa === "lahiri", "ayanamsa = lahiri");
  assert(Array.isArray(bp.astrology?.planets), "planets array present");
  assert(bp.astrology?.planets?.length >= 10, "10+ planets");
  assert(Array.isArray(bp.astrology?.nakshatras), "nakshatras present");
  assert(bp.astrology?.nodes?.rahu && bp.astrology?.nodes?.ketu, "Rahu/Ketu present");
  assert(Array.isArray(bp.astrology?.doshas), "doshas present");
  assert(Array.isArray(bp.astrology?.retrogrades), "retrogrades present");

  // Chinese
  assert(!!bp.chinese, "chinese present");
  assert(typeof bp.chinese?.zodiacAnimal === "string", "zodiacAnimal is string");
  assert(!!bp.chinese?.pillars?.year, "year pillar present");
  assert(!!bp.chinese?.pillars?.day, "day pillar present");

  // Verify DB insert via retrieval
  console.log("\n📦 Verifying DB persistence...");
  const getRes = await fetch(`${API}/api/blueprints/reports/${data.reportId}`, { headers: HEADERS });
  assert(getRes.status === 200, `Report retrieval HTTP 200 (got ${getRes.status})`);

  if (getRes.ok) {
    const report = await getRes.json();
    assert(report.client_id === null, "DB: client_id IS NULL");
    assert(report.status === "draft", "DB: status = 'draft'");
    assert(!!report.blueprint_data, "DB: blueprint_data persisted");

    const storedBp = typeof report.blueprint_data === "string"
      ? JSON.parse(report.blueprint_data) : report.blueprint_data;
    assert(storedBp?.astrology?.system === "vedic_sidereal", "DB: Vedic system in blueprint_data");
    assert(!!storedBp?.core, "DB: core layer in blueprint_data");
    assert(typeof report.created_at === "string", "DB: created_at present");
    assert(typeof report.updated_at === "string", "DB: updated_at present");
  }

  console.log(`\n  Guest Mode report ID: ${data.reportId}`);
  return data.reportId;
}

async function testB() {
  console.log("\n══════════════════════════════════════════");
  console.log("  TEST B — CLIENT MODE BLUEPRINT GENERATION");
  console.log("══════════════════════════════════════════\n");

  // Get clients
  const clientsRes = await fetch(`${API}/api/clients?limit=1`, { headers: HEADERS });
  assert(clientsRes.status === 200, `Clients list HTTP 200 (got ${clientsRes.status})`);

  if (!clientsRes.ok) { console.error("  Cannot fetch clients"); return; }

  const clientsData = await clientsRes.json();
  const clients = clientsData.clients || [];

  if (clients.length === 0) {
    console.warn("  ⚠️  No clients in DB — skipping client mode test");
    return;
  }

  const client = clients[0];
  console.log(`  Using client: ${client.full_birth_name} (${client.id})`);

  const payload = {
    mode: "client",
    clientId: client.id,
    includeSystems: ["numerology", "astrology"],
  };

  const res = await fetch(`${API}/api/blueprints/generate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  assert(res.status === 200, `HTTP 200 (got ${res.status})`);
  if (!res.ok) { console.error("  Response:", await res.text()); return; }

  const data = await res.json();
  assert(!!data.reportId, "reportId present");
  assert(data.status === "draft", "status = 'draft'");

  const bp = data.blueprint;
  assert(bp.client?.id === client.id, `client.id = ${client.id}`);
  assert(bp.astrology?.system === "vedic_sidereal", "Vedic system in client mode");

  // DB verification
  const getRes = await fetch(`${API}/api/blueprints/reports/${data.reportId}`, { headers: HEADERS });
  assert(getRes.status === 200, `Report retrieval HTTP 200 (got ${getRes.status})`);

  if (getRes.ok) {
    const report = await getRes.json();
    assert(report.client_id === client.id, `DB: client_id = ${client.id}`);
    assert(report.status === "draft", "DB: status = 'draft'");
    assert(!!report.blueprint_data, "DB: blueprint_data persisted");
  }

  console.log(`\n  Client Mode report ID: ${data.reportId}`);
}

async function testVedicShift() {
  console.log("\n══════════════════════════════════════════");
  console.log("  TEST C — VEDIC SIDEREAL SIGN SHIFT VERIFICATION");
  console.log("══════════════════════════════════════════\n");
  console.log("  Verifying ~24° ayanamsa shift from tropical...\n");

  const payload = {
    mode: "guest",
    guest: { firstName: "Test", lastName: "User", birthDate: "1990-05-12", birthTime: "14:30", birthLocation: "London, UK" },
    coordinates: { latitude: 51.5074, longitude: -0.1278, formattedAddress: "London, UK" },
    includeSystems: ["astrology"],
  };

  const res = await fetch(`${API}/api/blueprints/generate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error("  Sign shift test request failed:", res.status);
    return;
  }

  const data = await res.json();
  const astro = data.blueprint?.astrology;

  if (!astro) { console.error("  No astrology data"); return; }

  console.log(`  Ayanamsa value: ${astro.ayanamsaValue?.toFixed(4)}°`);
  assert(astro.ayanamsaValue > 23 && astro.ayanamsaValue < 26, `Lahiri ayanamsa in valid range (23–26°), got ${astro.ayanamsaValue?.toFixed(2)}°`);

  const sun = astro.planets?.find(p => p.planet === "Sun");
  if (sun) {
    console.log(`  Sidereal Sun: ${sun.sign} ${sun.degree}°${sun.minute}' — Nakshatra: ${sun.nakshatra} (Pada ${sun.nakshatraPada})`);
    console.log(`  (Tropical Sun for 1990-05-12 is Taurus — sidereal shift moves it back ~24°)`);
  }

  const retros = astro.retrogrades;
  console.log(`  Retrogrades: ${retros?.join(", ") || "none"}`);

  const doshas = astro.doshas;
  doshas?.forEach(d => console.log(`  Dosha: ${d.name} — ${d.present ? d.severity + " severity" : "not present"}`));
}

async function main() {
  console.log("\n🔬 BLUEPRINT ENGINE DOUBLE VERIFICATION");
  console.log(`   API: ${API}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  try {
    await testA();
    await testB();
    await testVedicShift();
  } catch (err) {
    console.error("\n💥 Unexpected error:", err.message);
    failed++;
  }

  console.log("\n══════════════════════════════════════════");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();

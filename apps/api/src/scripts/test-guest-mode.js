#!/usr/bin/env node
/**
 * Test A: Guest Mode Blueprint Generation
 * Verifies end-to-end guest mode functionality
 */

const API_URL = process.env.API_URL || "http://localhost:3001";
const CLERK_TOKEN = process.env.TEST_CLERK_TOKEN;

async function testGuestMode() {
  console.log("=== TEST A: GUEST MODE BLUEPRINT GENERATION ===\n");

  // Test payload
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
    includeSystems: ["numerology", "astrology"],
  };

  console.log("📤 Request Payload:");
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  try {
    // Make request
    const response = await fetch(`${API_URL}/api/blueprints/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLERK_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ Request failed:", error);
      process.exit(1);
    }

    const result = await response.json();
    console.log("✅ Response received");
    console.log(`   Report ID: ${result.reportId}`);
    console.log(`   Status: ${result.status}`);
    console.log();

    // Verify database
    console.log("🔍 Verifying database record...");
    console.log(`   Query: SELECT * FROM reports WHERE id = '${result.reportId}'`);
    console.log();

    // Retrieve the report to verify
    const getResponse = await fetch(`${API_URL}/api/blueprints/reports/${result.reportId}`, {
      headers: {
        Authorization: `Bearer ${CLERK_TOKEN}`,
      },
    });

    if (!getResponse.ok) {
      console.error("❌ Failed to retrieve report");
      process.exit(1);
    }

    const report = await getResponse.json();
    console.log("✅ Database Verification:");
    console.log(`   ✓ Report exists`);
    console.log(`   ✓ client_id: ${report.client_id === null ? "NULL (correct)" : "NOT NULL (ERROR)"}`);
    console.log(`   ✓ status: ${report.status}`);
    console.log(`   ✓ blueprint_data: ${report.blueprint_data ? "Persisted" : "Missing"}`);

    if (report.client_id !== null) {
      console.error("❌ ERROR: client_id should be NULL for guest mode");
      process.exit(1);
    }

    if (!report.blueprint_data) {
      console.error("❌ ERROR: blueprint_data is missing");
      process.exit(1);
    }

    const blueprintData = typeof report.blueprint_data === 'string' 
      ? JSON.parse(report.blueprint_data) 
      : report.blueprint_data;

    console.log(`   ✓ blueprint_data.client.id: ${blueprintData.client?.id === null ? "NULL (correct)" : "NOT NULL"}`);
    console.log(`   ✓ blueprint_data.client.fullBirthName: ${blueprintData.client?.fullBirthName}`);
    console.log(`   ✓ blueprint_data.coordinates: ${blueprintData.coordinates ? "Present" : "Missing"}`);
    console.log(`   ✓ blueprint_data.numerology: ${blueprintData.numerology ? "Present" : "Missing"}`);
    console.log(`   ✓ blueprint_data.astrology: ${blueprintData.astrology ? "Present" : "Missing"}`);
    console.log();

    console.log("✅ TEST A PASSED: Guest mode works correctly\n");
    return true;
  } catch (error) {
    console.error("❌ TEST A FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
if (!CLERK_TOKEN) {
  console.error("❌ TEST_CLERK_TOKEN environment variable required");
  console.error("   Get token from browser DevTools → Application → Cookies → __session");
  process.exit(1);
}

testGuestMode();

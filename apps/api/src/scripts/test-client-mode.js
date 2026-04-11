#!/usr/bin/env node
/**
 * Test B: Client Mode Blueprint Generation
 * Verifies end-to-end client mode functionality with foreign key integrity
 */

const API_URL = process.env.API_URL || "http://localhost:3001";
const CLERK_TOKEN = process.env.TEST_CLERK_TOKEN;

async function testClientMode() {
  console.log("=== TEST B: CLIENT MODE BLUEPRINT GENERATION ===\n");

  try {
    // First, get list of clients
    console.log("📋 Fetching existing clients...");
    const clientsResponse = await fetch(`${API_URL}/api/clients?limit=1`, {
      headers: {
        Authorization: `Bearer ${CLERK_TOKEN}`,
      },
    });

    if (!clientsResponse.ok) {
      console.error("❌ Failed to fetch clients");
      process.exit(1);
    }

    const clientsData = await clientsResponse.json();
    if (!clientsData.clients || clientsData.clients.length === 0) {
      console.error("❌ No clients found. Create a client first.");
      process.exit(1);
    }

    const testClient = clientsData.clients[0];
    console.log(`✅ Using client: ${testClient.full_birth_name} (ID: ${testClient.id})`);
    console.log();

    // Test payload
    const payload = {
      mode: "client",
      clientId: testClient.id,
      includeSystems: ["numerology", "astrology"],
    };

    console.log("📤 Request Payload:");
    console.log(JSON.stringify(payload, null, 2));
    console.log();

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
    console.log(`   ✓ client_id: ${report.client_id} (populated correctly)`);
    console.log(`   ✓ status: ${report.status}`);
    console.log(`   ✓ blueprint_data: ${report.blueprint_data ? "Persisted" : "Missing"}`);

    if (report.client_id !== testClient.id) {
      console.error(`❌ ERROR: client_id mismatch. Expected ${testClient.id}, got ${report.client_id}`);
      process.exit(1);
    }

    if (!report.blueprint_data) {
      console.error("❌ ERROR: blueprint_data is missing");
      process.exit(1);
    }

    const blueprintData = typeof report.blueprint_data === 'string' 
      ? JSON.parse(report.blueprint_data) 
      : report.blueprint_data;

    console.log(`   ✓ blueprint_data.client.id: ${blueprintData.client?.id}`);
    console.log(`   ✓ blueprint_data.client.fullBirthName: ${blueprintData.client?.fullBirthName}`);
    console.log(`   ✓ blueprint_data.numerology: ${blueprintData.numerology ? "Present" : "Missing"}`);
    console.log(`   ✓ blueprint_data.astrology: ${blueprintData.astrology ? "Present" : "Missing"}`);
    console.log();

    // Verify foreign key integrity
    console.log("🔗 Verifying foreign key integrity...");
    const clientCheck = await fetch(`${API_URL}/api/clients/${testClient.id}`, {
      headers: {
        Authorization: `Bearer ${CLERK_TOKEN}`,
      },
    });

    if (!clientCheck.ok) {
      console.error("❌ Foreign key integrity check failed");
      process.exit(1);
    }

    console.log("   ✓ Foreign key relationship verified");
    console.log();

    console.log("✅ TEST B PASSED: Client mode works correctly\n");
    return true;
  } catch (error) {
    console.error("❌ TEST B FAILED:", error.message);
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

testClientMode();

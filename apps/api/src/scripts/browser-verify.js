/**
 * TIMEZONE UTC FIX + VEDIC LAGNA VERIFICATION — Tests A, B, C
 * Paste into DevTools Console at http://localhost:5174 (signed in as admin)
 *
 * UTC OFFSET TEST:
 * Brad Johnson: 22-Mar-1979 19:08 local, Port Alberni BC, UTC-8 (offset=-480)
 * UTC time = 23-Mar-1979 03:08 UTC
 * Expected Ascendant = VIRGO (vedicastrochart.com reference)
 */
(async () => {
  const API = "http://localhost:3001";
  let pass = 0, fail = 0;
  const ok   = (l) => { console.log("  ✅", l); pass++; };
  const err  = (l) => { console.error("  ❌", l); fail++; };
  const assert = (c, l) => c ? ok(l) : err(l);
  const tok = () => window.Clerk.session.getToken();
  const HJ = async () => ({ "Content-Type": "application/json", Authorization: `Bearer ${await tok()}` });
  const H  = async () => ({ Authorization: `Bearer ${await tok()}` });

  /* ══ TEST A: WITH BIRTH TIME + UTC OFFSET — Virgo Ascendant ══════════════ */
  console.log("\n══ TEST A: UTC OFFSET FIX — Virgo Ascendant Verification ══\n");
  console.log("  Birth: 22-Mar-1979 19:08 local, Port Alberni BC, UTC-8 (-480 min)");
  console.log("  Expected UTC: 23-Mar-1979 03:08 UTC → Ascendant should be VIRGO\n");

  const payloadA = {
    mode: "guest",
    utcOffsetMinutes: -480,
    guest: { firstName: "Brad", lastName: "Johnson", birthDate: "1979-03-22", birthTime: "19:08", birthLocation: "Port Alberni, BC, Canada" },
    coordinates: { latitude: 49.2338882, longitude: -124.8055494, formattedAddress: "Port Alberni, BC, Canada" },
    includeSystems: ["astrology"],
  };

  const resA = await fetch(`${API}/api/blueprints/generate`, { method: "POST", headers: await HJ(), body: JSON.stringify(payloadA) });
  assert(resA.status === 200, `HTTP 200 (got ${resA.status})`);

  if (resA.ok) {
    const d = await resA.json();
    const a = d.blueprint?.astrology;

    assert(a?.system === "vedic_sidereal", "system = vedic_sidereal");
    assert(a?.confidence === "full", `confidence = full (got "${a?.confidence}")`);

    // Ascendant
    assert(a?.ascendant !== null, "ascendant is not null");
    // CRITICAL: With UTC-8 offset applied, Ascendant must be Virgo (not Gemini)
    assert(a?.ascendant?.sign === "Virgo", `UTC-8 offset applied: ascendant = "${a?.ascendant?.sign}" (expected Virgo)`);
    assert(typeof a?.ascendant?.degree === "number", `ascendant.degree = ${a?.ascendant?.degree}°`);
    assert(typeof a?.ascendant?.nakshatra === "string", `ascendant.nakshatra = "${a?.ascendant?.nakshatra}"`);
    assert(a?.ascendant?.nakshatraPada >= 1 && a?.ascendant?.nakshatraPada <= 4, `pada = ${a?.ascendant?.nakshatraPada}`);

    // Houses
    assert(Array.isArray(a?.houses) && a.houses.length === 12, `12 whole sign houses`);
    assert(a?.houses?.[0]?.sign === a?.ascendant?.sign, `House 1 sign matches ascendant sign (${a?.houses?.[0]?.sign})`);
    // Verify sequence: each house sign is next sign
    let houseSeqOk = true;
    const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
    for (let i = 1; i < 12; i++) {
      const expected = SIGNS[(SIGNS.indexOf(a.houses[0].sign) + i) % 12];
      if (a.houses[i]?.sign !== expected) houseSeqOk = false;
    }
    assert(houseSeqOk, "House sequence is correct (each house = next zodiac sign)");

    // Planet house placements
    assert(a?.planets?.every(p => p.house >= 1 && p.house <= 12), "All planets have house 1–12");
    assert(Array.isArray(a?.firstHousePlanets), `firstHousePlanets array (${JSON.stringify(a?.firstHousePlanets)})`);

    // Lagna Lord — Virgo rising → lord is Mercury
    assert(a?.lagnaLord !== null, "lagnaLord is not null");
    assert(a?.lagnaLord?.planet === "Mercury", `Virgo lagna lord = "${a?.lagnaLord?.planet}" (expected Mercury)`);
    assert(typeof a?.lagnaLord?.placement?.sign === "string", `lagnaLord in ${a?.lagnaLord?.placement?.sign}`);
    assert(a?.lagnaLord?.placement?.house >= 1, `lagnaLord.house = ${a?.lagnaLord?.placement?.house}`);

    // Ascendant Aspects
    assert(Array.isArray(a?.ascendantAspects), `ascendantAspects array (${a?.ascendantAspects?.length} aspects)`);
    if (a?.ascendantAspects?.length > 0) {
      assert(typeof a.ascendantAspects[0].planet === "string", `First aspect from: ${a.ascendantAspects[0].planet}`);
      assert(typeof a.ascendantAspects[0].aspectType === "string", `Aspect type: ${a.ascendantAspects[0].aspectType}`);
    }

    // Ascendant Strength
    assert(a?.ascendantStrength !== null, "ascendantStrength is not null");
    assert(typeof a?.ascendantStrength?.score === "number", `ascendantStrength.score = ${a?.ascendantStrength?.score}/10`);
    assert(Array.isArray(a?.ascendantStrength?.factors), `factors array (${a?.ascendantStrength?.factors?.length} factors)`);

    // Rahu/Ketu have houses
    assert(a?.nodes?.rahu?.house >= 1, `Rahu in house ${a?.nodes?.rahu?.house}`);
    assert(a?.nodes?.ketu?.house >= 1, `Ketu in house ${a?.nodes?.ketu?.house}`);
    // Rahu + Ketu should be in opposite houses
    const rahuH = a?.nodes?.rahu?.house;
    const ketuH = a?.nodes?.ketu?.house;
    const expectedKetuH = ((rahuH + 5) % 12) + 1;  // 7th from Rahu
    assert(ketuH === expectedKetuH, `Ketu is 7th from Rahu (Rahu h${rahuH} → Ketu h${ketuH})`);

    console.log("\n  Lagna Summary:");
    console.log(`  Ascendant: ${a.ascendant?.sign} ${a.ascendant?.degree}°${a.ascendant?.minute}' — ${a.ascendant?.nakshatra} pada ${a.ascendant?.nakshatraPada}`);
    console.log(`  Lagna Lord: ${a.lagnaLord?.planet} in ${a.lagnaLord?.placement?.sign} (House ${a.lagnaLord?.placement?.house})`);
    console.log(`  1st House Planets: ${a.firstHousePlanets?.join(", ") || "none"}`);
    console.log(`  Aspects to ASC: ${a.ascendantAspects?.map(x => x.planet).join(", ") || "none"}`);
    console.log(`  Ascendant Strength: ${a.ascendantStrength?.score}/10`);
    if (a.ascendantStrength?.factors?.length) {
      a.ascendantStrength.factors.forEach(f => console.log(`    • ${f}`));
    }
    console.log(`  Ayanamsa: ${a.ayanamsaValue?.toFixed(4)}°`);
    console.log(`  Sun: ${a.planets?.find(p=>p.planet==="Sun")?.sign} House ${a.planets?.find(p=>p.planet==="Sun")?.house}`);
    console.log(`  Moon: ${a.planets?.find(p=>p.planet==="Moon")?.sign} House ${a.planets?.find(p=>p.planet==="Moon")?.house}`);
  }

  /* ══ TEST B: WITHOUT BIRTH TIME — ascendant must be null ══════════════════ */
  console.log("\n══ TEST B: WITHOUT BIRTH TIME (Reduced confidence) ══\n");

  const payloadB = {
    mode: "guest",
    guest: { firstName: "Test", lastName: "NoTime", birthDate: "1990-05-12", birthTime: null, birthLocation: null },
    includeSystems: ["astrology"],
  };

  const resB = await fetch(`${API}/api/blueprints/generate`, { method: "POST", headers: await HJ(), body: JSON.stringify(payloadB) });
  assert(resB.status === 200, `HTTP 200 (got ${resB.status})`);

  if (resB.ok) {
    const d = await resB.json();
    const a = d.blueprint?.astrology;

    assert(a?.confidence === "reduced", `confidence = reduced (got "${a?.confidence}")`);
    assert(a?.ascendant === null, "ascendant is null (no birth time)");
    assert(a?.houses === null, "houses is null (no birth time)");
    assert(a?.lagnaLord === null, "lagnaLord is null (no birth time)");
    assert(a?.ascendantStrength === null, "ascendantStrength is null (no birth time)");
    assert(Array.isArray(a?.firstHousePlanets) && a.firstHousePlanets.length === 0, "firstHousePlanets is empty");
    assert(Array.isArray(a?.ascendantAspects) && a.ascendantAspects.length === 0, "ascendantAspects is empty");
    // Planets still computed
    assert(a?.planets?.length >= 10, `${a?.planets?.length} planets still calculated`);
    assert(Array.isArray(a?.doshas), "doshas still present");
    assert(Array.isArray(a?.retrogrades), "retrogrades still present");

    console.log(`\n  No birth time: ascendant=null, confidence="reduced", planets=${a?.planets?.length} — correct`);
  }

  /* ══ TEST C: LOGICAL ACCURACY (Ayanamsa + Sign shift) ════════════════════ */
  console.log("\n══ TEST C: LOGICAL ACCURACY VERIFICATION ══\n");

  // Brad Johnson 1979-03-22: tropical Sun ≈ 1° Aries
  // Lahiri ayanamsa 1979 ≈ 23.5° → sidereal Sun ≈ 7° Pisces (shifted back into Pisces)
  const resC = await fetch(`${API}/api/blueprints/generate`, {
    method: "POST",
    headers: await HJ(),
    body: JSON.stringify({
      mode: "guest",
      utcOffsetMinutes: -480,
      guest: { firstName: "Brad", lastName: "Johnson", birthDate: "1979-03-22", birthTime: "19:08", birthLocation: "Port Alberni, BC, Canada" },
      coordinates: { latitude: 49.2338882, longitude: -124.8055494, formattedAddress: "Port Alberni, BC, Canada" },
      includeSystems: ["astrology"],
    }),
  });

  if (resC.ok) {
    const d = await resC.json();
    const a = d.blueprint?.astrology;
    const sun = a?.planets?.find(p => p.planet === "Sun");

    assert(a?.ayanamsaValue > 23 && a?.ayanamsaValue < 25, `Lahiri ayanamsa 23–25° (got ${a?.ayanamsaValue?.toFixed(4)}°)`);
    assert(sun?.sign === "Pisces", `Sun in Pisces sidereal (tropical Aries − 23.5° = Pisces) — got ${sun?.sign}`);
    // With UTC-8 applied: Ascendant must be Virgo (reference: vedicastrochart.com)
    assert(a?.ascendant?.sign === "Virgo", `Ascendant = ${a?.ascendant?.sign} (expected Virgo with UTC-8 applied)`);
    assert(a?.lagnaLord?.planet === "Mercury", `Virgo lagna lord = ${a?.lagnaLord?.planet} (expected Mercury)`);

    // Whole sign house sequence sanity: house 2 sign should be next after house 1
    if (a?.houses?.length === 12) {
      const h1 = a.houses[0].sign;
      const h2 = a.houses[1].sign;
      const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
      const expected = SIGNS[(SIGNS.indexOf(h1) + 1) % 12];
      assert(h2 === expected, `House 2 = ${h2} (next after ${h1} = ${expected})`);
    }

    // Lagna lord sign should match lagnaLord.placement
    const lagnaSign = a?.ascendant?.sign;
    const lordPlanet = a?.lagnaLord?.planet;
    const lordSign = a?.lagnaLord?.placement?.sign;
    const lordHouse = a?.lagnaLord?.placement?.house;
    console.log(`\n  Accuracy Check:`);
    console.log(`  Ascendant sign: ${lagnaSign} → Lagna Lord: ${lordPlanet} in ${lordSign} House ${lordHouse}`);
    console.log(`  Ayanamsa: ${a?.ayanamsaValue?.toFixed(4)}°`);
    console.log(`  Sun: ${sun?.sign} ${sun?.degree}° (tropical ≈ 1° Aries, shifted ~24° back → Pisces ✓)`);
    console.log(`  Ascendant Strength: ${a?.ascendantStrength?.score}/10`);
  }

  /* ══ RESULTS ══════════════════════════════════════════════════════════════ */
  console.log(`\n${"═".repeat(55)}`);
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log(`${"═".repeat(55)}`);
  if (fail === 0) console.log("  🎉 ALL TESTS PASSED — Vedic Lagna system fully operational");
  else console.error(`  ⚠️  ${fail} failures`);
})();

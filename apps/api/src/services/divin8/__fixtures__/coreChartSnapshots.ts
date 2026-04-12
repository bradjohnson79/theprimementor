import type { CoreChartSnapshot } from "../engine/chartSnapshot.js";

export const VANCOUVER_JANE_EXAMPLE_FIXTURE: {
  client: {
    id: string;
    fullBirthName: string;
    birthDate: string;
    birthTime: string;
    birthLocation: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  timezone: {
    name: string;
    utcOffsetMinutes: number;
  };
  expected: CoreChartSnapshot;
} = {
  client: {
    id: "guest",
    fullBirthName: "Jane Example",
    birthDate: "1990-04-03",
    birthTime: "06:45",
    birthLocation: "Vancouver, BC, Canada",
  },
  coordinates: {
    latitude: 49.2827,
    longitude: -123.1207,
    formattedAddress: "Vancouver, BC, Canada",
  },
  timezone: {
    name: "America/Vancouver",
    utcOffsetMinutes: -480,
  },
  expected: {
    confidence: "full",
    ayanamsaValue: 23.720948,
    ascendant: {
      sign: "Aries",
      degree: 16,
      minute: 28,
      longitude: 16.471277,
      nakshatra: "Bharani",
      nakshatraPada: 1,
    },
    planets: {
      Sun: { sign: "Pisces", degree: 19, minute: 52, house: 12, longitude: 349.864444, retrograde: false },
      Moon: { sign: "Cancer", degree: 4, minute: 35, house: 4, longitude: 94.581843, retrograde: false },
      Mercury: { sign: "Aries", degree: 5, minute: 3, house: 1, longitude: 5.04799, retrograde: false },
      Venus: { sign: "Aquarius", degree: 3, minute: 27, house: 11, longitude: 303.456778, retrograde: false },
      Mars: { sign: "Capricorn", degree: 23, minute: 21, house: 10, longitude: 293.343474, retrograde: false },
      Jupiter: { sign: "Gemini", degree: 9, minute: 19, house: 3, longitude: 69.323601, retrograde: false },
      Saturn: { sign: "Capricorn", degree: 0, minute: 49, house: 10, longitude: 270.823142, retrograde: false },
      Uranus: { sign: "Sagittarius", degree: 15, minute: 49, house: 9, longitude: 255.822962, retrograde: false },
      Neptune: { sign: "Sagittarius", degree: 20, minute: 48, house: 9, longitude: 260.807796, retrograde: false },
      Pluto: { sign: "Libra", degree: 23, minute: 33, house: 7, longitude: 203.552282, retrograde: true },
      Rahu: { sign: "Capricorn", degree: 19, minute: 50, house: 10, longitude: 289.836304, retrograde: true },
      Ketu: { sign: "Cancer", degree: 19, minute: 50, house: 4, longitude: 109.836304, retrograde: true },
    },
    nodes: {
      rahu: { sign: "Capricorn", degree: 19, minute: 50, house: 10, longitude: 289.836304, retrograde: true },
      ketu: { sign: "Cancer", degree: 19, minute: 50, house: 4, longitude: 109.836304, retrograde: true },
    },
  },
};

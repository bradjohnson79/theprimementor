/**
 * Chinese Astrology Service
 * Implements Four Pillars (BaZi) based on birth date/time
 * No Swiss Ephemeris needed — uses Chinese calendar algorithms
 */

export interface ChinesePillar {
  heavenlyStem: string;
  earthlyBranch: string;
  element: string;
  yinYang: "Yin" | "Yang";
}

export interface ChineseAstrologyResult {
  zodiacAnimal: string;
  element: string;
  yinYang: "Yin" | "Yang";
  pillars: {
    year: ChinesePillar;
    month: ChinesePillar;
    day: ChinesePillar;
    hour: ChinesePillar;
  };
  lunarYear: number;
  compatibility: string[];
  challenges: string[];
}

const HEAVENLY_STEMS = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"];
const EARTHLY_BRANCHES = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"];
const ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const STEM_ELEMENTS = ["Wood", "Wood", "Fire", "Fire", "Earth", "Earth", "Metal", "Metal", "Water", "Water"];
const BRANCH_ELEMENTS = ["Water", "Earth", "Wood", "Wood", "Earth", "Fire", "Fire", "Earth", "Metal", "Metal", "Earth", "Water"];

// Stem yin/yang: even index = Yang, odd = Yin
function stemYinYang(stemIndex: number): "Yin" | "Yang" {
  return stemIndex % 2 === 0 ? "Yang" : "Yin";
}

// Year pillar — anchored to 1924 (Jiazi year = stem 0, branch 0)
function yearPillar(year: number): ChinesePillar {
  const BASE_YEAR = 1924;
  const offset = ((year - BASE_YEAR) % 60 + 60) % 60;
  const stemIndex = offset % 10;
  const branchIndex = offset % 12;
  return {
    heavenlyStem: HEAVENLY_STEMS[stemIndex],
    earthlyBranch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_ELEMENTS[stemIndex],
    yinYang: stemYinYang(stemIndex),
  };
}

// Month pillar — based on solar month (1=Feb, 12=Jan next year)
function monthPillar(year: number, month: number): ChinesePillar {
  // Chinese month offset relative to year stem
  const yearStemIndex = (((year - 1924) % 10) + 10) % 10;
  // Month stems cycle based on year stem group (pairs of year stems)
  const baseMonthStem = (Math.floor(yearStemIndex / 2) * 2 + 2) % 10;
  const stemIndex = (baseMonthStem + (month - 1)) % 10;
  const branchIndex = ((month + 1) % 12);
  return {
    heavenlyStem: HEAVENLY_STEMS[stemIndex],
    earthlyBranch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_ELEMENTS[stemIndex],
    yinYang: stemYinYang(stemIndex),
  };
}

// Day pillar — number of days from known anchor (Jan 1, 1924 = stem 0, branch 0)
function dayPillar(year: number, month: number, day: number): ChinesePillar {
  const anchor = new Date(1924, 0, 1);
  const target = new Date(year, month - 1, day);
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / 86400000);
  const stemIndex = ((diffDays % 10) + 10) % 10;
  const branchIndex = ((diffDays % 12) + 12) % 12;
  return {
    heavenlyStem: HEAVENLY_STEMS[stemIndex],
    earthlyBranch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_ELEMENTS[stemIndex],
    yinYang: stemYinYang(stemIndex),
  };
}

// Hour pillar — 12 two-hour periods
function hourPillar(hour: number, dayStemIndex: number): ChinesePillar {
  // 11pm-1am=0, 1-3am=1, ... 
  const branchIndex = Math.floor(((hour + 1) % 24) / 2);
  // Hour stem starts from day stem group's base
  const baseHourStem = (Math.floor(dayStemIndex / 2) * 2) % 10;
  const stemIndex = (baseHourStem + branchIndex) % 10;
  return {
    heavenlyStem: HEAVENLY_STEMS[stemIndex],
    earthlyBranch: EARTHLY_BRANCHES[branchIndex],
    element: STEM_ELEMENTS[stemIndex],
    yinYang: stemYinYang(stemIndex),
  };
}

// Zodiac compatibility groups
const COMPATIBILITY: Record<string, string[]> = {
  Rat: ["Dragon", "Monkey", "Ox"], Ox: ["Rat", "Snake", "Rooster"],
  Tiger: ["Horse", "Dog", "Pig"], Rabbit: ["Goat", "Pig", "Dog"],
  Dragon: ["Rat", "Monkey", "Rooster"], Snake: ["Ox", "Rooster", "Monkey"],
  Horse: ["Tiger", "Goat", "Dog"], Goat: ["Rabbit", "Horse", "Pig"],
  Monkey: ["Rat", "Dragon", "Snake"], Rooster: ["Ox", "Dragon", "Snake"],
  Dog: ["Tiger", "Rabbit", "Horse"], Pig: ["Tiger", "Rabbit", "Goat"],
};

const CHALLENGES_MAP: Record<string, string[]> = {
  Rat: ["Horse", "Rabbit"], Ox: ["Goat", "Horse", "Dragon"],
  Tiger: ["Monkey", "Snake"], Rabbit: ["Rooster", "Rat"],
  Dragon: ["Dog", "Rabbit", "Dragon"], Snake: ["Tiger", "Pig"],
  Horse: ["Rat", "Ox"], Goat: ["Ox", "Dog", "Goat"],
  Monkey: ["Tiger", "Pig"], Rooster: ["Rabbit", "Dog", "Rooster"],
  Dog: ["Dragon", "Goat", "Rooster"], Pig: ["Snake", "Monkey"],
};

export function calculateChineseAstrology(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
): ChineseAstrologyResult {
  const yPillar = yearPillar(year);
  const mPillar = monthPillar(year, month);
  const dPillar = dayPillar(year, month, day);

  // Get day stem index for hour calculation
  const anchor = new Date(1924, 0, 1);
  const target = new Date(year, month - 1, day);
  const diffDays = Math.floor((target.getTime() - anchor.getTime()) / 86400000);
  const dayStemIndex = ((diffDays % 10) + 10) % 10;

  const hPillar = hourPillar(hour, dayStemIndex);

  const animalIndex = ((year - 1924) % 12 + 12) % 12;
  const animal = ANIMALS[animalIndex];

  return {
    zodiacAnimal: animal,
    element: yPillar.element,
    yinYang: yPillar.yinYang,
    pillars: {
      year: yPillar,
      month: mPillar,
      day: dPillar,
      hour: hPillar,
    },
    lunarYear: year,
    compatibility: COMPATIBILITY[animal] || [],
    challenges: CHALLENGES_MAP[animal] || [],
  };
}

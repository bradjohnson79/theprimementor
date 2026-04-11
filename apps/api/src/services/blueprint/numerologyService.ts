import type { NumerologyResult } from "./types.js";

const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function reduceToSingleDigit(n: number): number {
  if (n === 11 || n === 22 || n === 33) return n;
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((sum, d) => sum + parseInt(d, 10), 0);
    if (n === 11 || n === 22 || n === 33) return n;
  }
  return n;
}

function sumDigits(str: string): number {
  return str
    .split("")
    .filter((c) => c >= "0" && c <= "9")
    .reduce((sum, d) => sum + parseInt(d, 10), 0);
}

function letterSum(name: string, filter?: (letter: string) => boolean): number {
  const upper = name.toUpperCase();
  let total = 0;
  for (const char of upper) {
    if (LETTER_VALUES[char] === undefined) continue;
    if (filter && !filter(char)) continue;
    total += LETTER_VALUES[char];
  }
  return total;
}

function isVowelInContext(char: string, _name: string): boolean {
  return VOWELS.has(char);
}

function calculateLifePath(year: number, month: number, day: number): number {
  const monthReduced = reduceToSingleDigit(month);
  const dayReduced = reduceToSingleDigit(day);
  const yearReduced = reduceToSingleDigit(sumDigits(String(year)));
  return reduceToSingleDigit(monthReduced + dayReduced + yearReduced);
}

function calculateSoulUrge(fullName: string): number {
  const raw = letterSum(fullName, (c) => isVowelInContext(c, fullName));
  return reduceToSingleDigit(raw);
}

function calculateDestiny(fullName: string): number {
  const raw = letterSum(fullName);
  return reduceToSingleDigit(raw);
}

function calculatePersonality(fullName: string): number {
  const raw = letterSum(fullName, (c) => !isVowelInContext(c, fullName));
  return reduceToSingleDigit(raw);
}

function calculatePinnacles(
  year: number,
  month: number,
  day: number,
): [number, number, number, number] {
  const m = reduceToSingleDigit(month);
  const d = reduceToSingleDigit(day);
  const y = reduceToSingleDigit(sumDigits(String(year)));

  const first = reduceToSingleDigit(m + d);
  const second = reduceToSingleDigit(d + y);
  const third = reduceToSingleDigit(first + second);
  const fourth = reduceToSingleDigit(m + y);

  return [first, second, third, fourth];
}

export function calculateNumerology(
  fullBirthName: string,
  year: number,
  month: number,
  day: number,
): NumerologyResult {
  return {
    birthDay: reduceToSingleDigit(day),
    lifePath: calculateLifePath(year, month, day),
    soulUrge: calculateSoulUrge(fullBirthName),
    destiny: calculateDestiny(fullBirthName),
    personality: calculatePersonality(fullBirthName),
    pinnacles: calculatePinnacles(year, month, day),
  };
}

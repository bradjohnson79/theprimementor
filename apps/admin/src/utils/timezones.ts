/**
 * Comprehensive world timezone list for the UTC offset selector.
 * Each entry has: label (display), utcOffset (minutes), ianaName (for reference).
 *
 * Offsets are STANDARD TIME offsets — users should adjust ±60 for DST if applicable
 * at their birth time/location.
 */

export interface TimezoneOption {
  label: string;
  utcOffset: number;
  ianaName: string;
  region: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // UTC-12
  { ianaName: "Etc/GMT+12",              label: "UTC−12:00 — Baker Island, Howland Island",          utcOffset: -720, region: "Pacific" },
  // UTC-11
  { ianaName: "Pacific/Pago_Pago",       label: "UTC−11:00 — American Samoa, Niue",                  utcOffset: -660, region: "Pacific" },
  // UTC-10
  { ianaName: "Pacific/Honolulu",        label: "UTC−10:00 — Hawaii",                                utcOffset: -600, region: "Pacific" },
  { ianaName: "Pacific/Rarotonga",       label: "UTC−10:00 — Cook Islands",                          utcOffset: -600, region: "Pacific" },
  // UTC-9:30
  { ianaName: "Pacific/Marquesas",       label: "UTC−09:30 — Marquesas Islands",                     utcOffset: -570, region: "Pacific" },
  // UTC-9
  { ianaName: "America/Anchorage",       label: "UTC−09:00 — Alaska (AKST)",                         utcOffset: -540, region: "Americas" },
  { ianaName: "Pacific/Gambier",         label: "UTC−09:00 — Gambier Islands",                       utcOffset: -540, region: "Pacific" },
  // UTC-8
  { ianaName: "America/Vancouver",       label: "UTC−08:00 — Pacific Time — Vancouver, Seattle",     utcOffset: -480, region: "Americas" },
  { ianaName: "America/Los_Angeles",     label: "UTC−08:00 — Pacific Time — Los Angeles (PST)",      utcOffset: -480, region: "Americas" },
  { ianaName: "America/Tijuana",         label: "UTC−08:00 — Pacific Time — Tijuana (PST)",          utcOffset: -480, region: "Americas" },
  // UTC-7
  { ianaName: "America/Denver",          label: "UTC−07:00 — Mountain Time — Denver (MST)",          utcOffset: -420, region: "Americas" },
  { ianaName: "America/Phoenix",         label: "UTC−07:00 — Mountain Time — Phoenix (no DST)",      utcOffset: -420, region: "Americas" },
  { ianaName: "America/Edmonton",        label: "UTC−07:00 — Mountain Time — Calgary, Edmonton",     utcOffset: -420, region: "Americas" },
  { ianaName: "America/Mazatlan",        label: "UTC−07:00 — Mountain Time — Mazatlan",              utcOffset: -420, region: "Americas" },
  // UTC-6
  { ianaName: "America/Chicago",         label: "UTC−06:00 — Central Time — Chicago (CST)",          utcOffset: -360, region: "Americas" },
  { ianaName: "America/Winnipeg",        label: "UTC−06:00 — Central Time — Winnipeg",               utcOffset: -360, region: "Americas" },
  { ianaName: "America/Mexico_City",     label: "UTC−06:00 — Central Time — Mexico City",            utcOffset: -360, region: "Americas" },
  { ianaName: "America/Guatemala",       label: "UTC−06:00 — Guatemala City",                        utcOffset: -360, region: "Americas" },
  { ianaName: "Pacific/Easter",          label: "UTC−06:00 — Easter Island",                         utcOffset: -360, region: "Pacific" },
  // UTC-5
  { ianaName: "America/New_York",        label: "UTC−05:00 — Eastern Time — New York (EST)",         utcOffset: -300, region: "Americas" },
  { ianaName: "America/Toronto",         label: "UTC−05:00 — Eastern Time — Toronto",                utcOffset: -300, region: "Americas" },
  { ianaName: "America/Bogota",          label: "UTC−05:00 — Bogotá, Lima, Quito",                   utcOffset: -300, region: "Americas" },
  { ianaName: "America/Lima",            label: "UTC−05:00 — Peru (PET)",                            utcOffset: -300, region: "Americas" },
  { ianaName: "America/Havana",          label: "UTC−05:00 — Cuba (CST)",                            utcOffset: -300, region: "Americas" },
  // UTC-4:30
  { ianaName: "America/Caracas",         label: "UTC−04:30 — Venezuela (VET)",                       utcOffset: -270, region: "Americas" },
  // UTC-4
  { ianaName: "America/Halifax",         label: "UTC−04:00 — Atlantic Time — Halifax (AST)",         utcOffset: -240, region: "Americas" },
  { ianaName: "America/Santiago",        label: "UTC−04:00 — Chile (CLT)",                           utcOffset: -240, region: "Americas" },
  { ianaName: "America/La_Paz",          label: "UTC−04:00 — Bolivia (BOT)",                         utcOffset: -240, region: "Americas" },
  { ianaName: "America/Manaus",          label: "UTC−04:00 — Amazon Time — Manaus (AMT)",            utcOffset: -240, region: "Americas" },
  { ianaName: "Atlantic/Stanley",        label: "UTC−03:00 — Falkland Islands (FKST)",               utcOffset: -180, region: "Americas" },
  // UTC-3:30
  { ianaName: "America/St_Johns",        label: "UTC−03:30 — Newfoundland (NST)",                    utcOffset: -210, region: "Americas" },
  // UTC-3
  { ianaName: "America/Sao_Paulo",       label: "UTC−03:00 — São Paulo, Brasilia (BRT)",             utcOffset: -180, region: "Americas" },
  { ianaName: "America/Buenos_Aires",    label: "UTC−03:00 — Buenos Aires (ART)",                    utcOffset: -180, region: "Americas" },
  { ianaName: "America/Montevideo",      label: "UTC−03:00 — Montevideo (UYT)",                      utcOffset: -180, region: "Americas" },
  { ianaName: "America/Godthab",         label: "UTC−03:00 — Greenland (WGT)",                       utcOffset: -180, region: "Americas" },
  // UTC-2
  { ianaName: "America/Noronha",         label: "UTC−02:00 — Fernando de Noronha (FNT)",             utcOffset: -120, region: "Americas" },
  { ianaName: "Atlantic/South_Georgia",  label: "UTC−02:00 — South Georgia Island",                  utcOffset: -120, region: "Atlantic" },
  // UTC-1
  { ianaName: "Atlantic/Azores",         label: "UTC−01:00 — Azores (AZOT)",                         utcOffset: -60,  region: "Atlantic" },
  { ianaName: "Atlantic/Cape_Verde",     label: "UTC−01:00 — Cape Verde (CVT)",                      utcOffset: -60,  region: "Atlantic" },
  // UTC+0
  { ianaName: "UTC",                     label: "UTC+00:00 — Coordinated Universal Time (UTC)",      utcOffset: 0,    region: "Europe" },
  { ianaName: "Europe/London",           label: "UTC+00:00 — London, Dublin (GMT/WET)",              utcOffset: 0,    region: "Europe" },
  { ianaName: "Africa/Casablanca",       label: "UTC+00:00 — Casablanca, Monrovia",                  utcOffset: 0,    region: "Africa" },
  { ianaName: "Africa/Abidjan",          label: "UTC+00:00 — Dakar, Accra",                          utcOffset: 0,    region: "Africa" },
  // UTC+1
  { ianaName: "Europe/Paris",            label: "UTC+01:00 — Paris, Berlin, Madrid (CET)",           utcOffset: 60,   region: "Europe" },
  { ianaName: "Europe/Amsterdam",        label: "UTC+01:00 — Amsterdam, Brussels, Rome",             utcOffset: 60,   region: "Europe" },
  { ianaName: "Africa/Lagos",            label: "UTC+01:00 — Lagos, Kinshasa (WAT)",                 utcOffset: 60,   region: "Africa" },
  { ianaName: "Africa/Algiers",          label: "UTC+01:00 — Algiers, Tunis (CET)",                  utcOffset: 60,   region: "Africa" },
  // UTC+2
  { ianaName: "Europe/Athens",           label: "UTC+02:00 — Athens, Bucharest (EET)",               utcOffset: 120,  region: "Europe" },
  { ianaName: "Europe/Helsinki",         label: "UTC+02:00 — Helsinki, Riga, Tallinn",               utcOffset: 120,  region: "Europe" },
  { ianaName: "Africa/Cairo",            label: "UTC+02:00 — Cairo (EET)",                           utcOffset: 120,  region: "Africa" },
  { ianaName: "Africa/Johannesburg",     label: "UTC+02:00 — Johannesburg, Harare (SAST)",           utcOffset: 120,  region: "Africa" },
  { ianaName: "Asia/Jerusalem",          label: "UTC+02:00 — Jerusalem (IST)",                       utcOffset: 120,  region: "Asia" },
  { ianaName: "Europe/Istanbul",         label: "UTC+03:00 — Istanbul (TRT)",                        utcOffset: 180,  region: "Europe" },
  // UTC+3
  { ianaName: "Europe/Moscow",           label: "UTC+03:00 — Moscow, St. Petersburg (MSK)",          utcOffset: 180,  region: "Europe" },
  { ianaName: "Asia/Riyadh",             label: "UTC+03:00 — Riyadh, Kuwait City (AST)",             utcOffset: 180,  region: "Asia" },
  { ianaName: "Africa/Nairobi",          label: "UTC+03:00 — Nairobi (EAT)",                         utcOffset: 180,  region: "Africa" },
  { ianaName: "Asia/Baghdad",            label: "UTC+03:00 — Baghdad (AST)",                         utcOffset: 180,  region: "Asia" },
  // UTC+3:30
  { ianaName: "Asia/Tehran",             label: "UTC+03:30 — Tehran (IRST)",                         utcOffset: 210,  region: "Asia" },
  // UTC+4
  { ianaName: "Asia/Dubai",              label: "UTC+04:00 — Dubai, Abu Dhabi (GST)",                utcOffset: 240,  region: "Asia" },
  { ianaName: "Asia/Baku",               label: "UTC+04:00 — Baku (AZT)",                            utcOffset: 240,  region: "Asia" },
  { ianaName: "Asia/Tbilisi",            label: "UTC+04:00 — Tbilisi (GET)",                         utcOffset: 240,  region: "Asia" },
  { ianaName: "Indian/Mauritius",        label: "UTC+04:00 — Mauritius, Réunion (MUT)",              utcOffset: 240,  region: "Indian Ocean" },
  // UTC+4:30
  { ianaName: "Asia/Kabul",              label: "UTC+04:30 — Kabul (AFT)",                           utcOffset: 270,  region: "Asia" },
  // UTC+5
  { ianaName: "Asia/Tashkent",           label: "UTC+05:00 — Tashkent, Yekaterinburg (UZT)",        utcOffset: 300,  region: "Asia" },
  { ianaName: "Asia/Karachi",            label: "UTC+05:00 — Karachi, Islamabad (PKT)",              utcOffset: 300,  region: "Asia" },
  // UTC+5:30
  { ianaName: "Asia/Kolkata",            label: "UTC+05:30 — India — New Delhi, Mumbai (IST)",       utcOffset: 330,  region: "Asia" },
  { ianaName: "Asia/Colombo",            label: "UTC+05:30 — Sri Lanka (SLST)",                      utcOffset: 330,  region: "Asia" },
  // UTC+5:45
  { ianaName: "Asia/Kathmandu",          label: "UTC+05:45 — Nepal — Kathmandu (NPT)",               utcOffset: 345,  region: "Asia" },
  // UTC+6
  { ianaName: "Asia/Dhaka",              label: "UTC+06:00 — Dhaka, Almaty (BST/ALMT)",             utcOffset: 360,  region: "Asia" },
  { ianaName: "Asia/Omsk",               label: "UTC+06:00 — Omsk (OMST)",                           utcOffset: 360,  region: "Asia" },
  // UTC+6:30
  { ianaName: "Asia/Rangoon",            label: "UTC+06:30 — Myanmar — Yangon (MMT)",                utcOffset: 390,  region: "Asia" },
  { ianaName: "Indian/Cocos",            label: "UTC+06:30 — Cocos Islands",                         utcOffset: 390,  region: "Indian Ocean" },
  // UTC+7
  { ianaName: "Asia/Bangkok",            label: "UTC+07:00 — Bangkok, Hanoi, Jakarta (ICT/WIB)",     utcOffset: 420,  region: "Asia" },
  { ianaName: "Asia/Novosibirsk",        label: "UTC+07:00 — Novosibirsk, Krasnoyarsk (NOVT)",       utcOffset: 420,  region: "Asia" },
  // UTC+8
  { ianaName: "Asia/Shanghai",           label: "UTC+08:00 — China — Beijing, Shanghai (CST)",       utcOffset: 480,  region: "Asia" },
  { ianaName: "Asia/Hong_Kong",          label: "UTC+08:00 — Hong Kong (HKT)",                       utcOffset: 480,  region: "Asia" },
  { ianaName: "Asia/Taipei",             label: "UTC+08:00 — Taiwan — Taipei (TST)",                 utcOffset: 480,  region: "Asia" },
  { ianaName: "Asia/Singapore",          label: "UTC+08:00 — Singapore (SGT)",                       utcOffset: 480,  region: "Asia" },
  { ianaName: "Asia/Kuala_Lumpur",       label: "UTC+08:00 — Malaysia — Kuala Lumpur (MYT)",         utcOffset: 480,  region: "Asia" },
  { ianaName: "Australia/Perth",         label: "UTC+08:00 — Australia — Perth (AWST)",              utcOffset: 480,  region: "Australia" },
  { ianaName: "Asia/Irkutsk",            label: "UTC+08:00 — Irkutsk (IRKT)",                        utcOffset: 480,  region: "Asia" },
  // UTC+8:45
  { ianaName: "Australia/Eucla",         label: "UTC+08:45 — Eucla, Western Australia",              utcOffset: 525,  region: "Australia" },
  // UTC+9
  { ianaName: "Asia/Tokyo",              label: "UTC+09:00 — Japan — Tokyo, Osaka (JST)",            utcOffset: 540,  region: "Asia" },
  { ianaName: "Asia/Seoul",              label: "UTC+09:00 — South Korea — Seoul (KST)",             utcOffset: 540,  region: "Asia" },
  { ianaName: "Asia/Pyongyang",          label: "UTC+09:00 — North Korea (KST)",                     utcOffset: 540,  region: "Asia" },
  { ianaName: "Asia/Yakutsk",            label: "UTC+09:00 — Yakutsk (YAKT)",                        utcOffset: 540,  region: "Asia" },
  // UTC+9:30
  { ianaName: "Australia/Adelaide",      label: "UTC+09:30 — Australia — Adelaide (ACST)",           utcOffset: 570,  region: "Australia" },
  { ianaName: "Australia/Darwin",        label: "UTC+09:30 — Australia — Darwin (ACST, no DST)",     utcOffset: 570,  region: "Australia" },
  // UTC+10
  { ianaName: "Australia/Sydney",        label: "UTC+10:00 — Australia — Sydney, Melbourne (AEST)",  utcOffset: 600,  region: "Australia" },
  { ianaName: "Australia/Brisbane",      label: "UTC+10:00 — Australia — Brisbane (no DST)",         utcOffset: 600,  region: "Australia" },
  { ianaName: "Pacific/Port_Moresby",    label: "UTC+10:00 — Papua New Guinea (PGT)",                utcOffset: 600,  region: "Pacific" },
  { ianaName: "Asia/Vladivostok",        label: "UTC+10:00 — Vladivostok (VLAT)",                    utcOffset: 600,  region: "Asia" },
  // UTC+10:30
  { ianaName: "Australia/Lord_Howe",     label: "UTC+10:30 — Lord Howe Island (LHST)",               utcOffset: 630,  region: "Australia" },
  // UTC+11
  { ianaName: "Pacific/Guadalcanal",     label: "UTC+11:00 — Solomon Islands, New Caledonia",        utcOffset: 660,  region: "Pacific" },
  { ianaName: "Asia/Magadan",            label: "UTC+11:00 — Magadan (MAGT)",                        utcOffset: 660,  region: "Asia" },
  // UTC+12
  { ianaName: "Pacific/Auckland",        label: "UTC+12:00 — New Zealand — Auckland (NZST)",         utcOffset: 720,  region: "Pacific" },
  { ianaName: "Pacific/Fiji",            label: "UTC+12:00 — Fiji (FJT)",                            utcOffset: 720,  region: "Pacific" },
  { ianaName: "Asia/Kamchatka",          label: "UTC+12:00 — Kamchatka (PETT)",                      utcOffset: 720,  region: "Asia" },
  // UTC+12:45
  { ianaName: "Pacific/Chatham",         label: "UTC+12:45 — Chatham Islands (CHAST)",               utcOffset: 765,  region: "Pacific" },
  // UTC+13
  { ianaName: "Pacific/Apia",            label: "UTC+13:00 — Samoa, Tonga (WST/TOT)",                utcOffset: 780,  region: "Pacific" },
  { ianaName: "Pacific/Tongatapu",       label: "UTC+13:00 — Tonga (TOT)",                           utcOffset: 780,  region: "Pacific" },
  // UTC+14
  { ianaName: "Pacific/Kiritimati",      label: "UTC+14:00 — Line Islands, Kiribati (LINT)",         utcOffset: 840,  region: "Pacific" },
];

/** Get browser's current timezone offset in minutes (negative = west of UTC) */
export function getBrowserUtcOffset(): number {
  return -new Date().getTimezoneOffset();
}

/** Get the browser's IANA timezone name */
export function getBrowserTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Find the best matching timezone option for the browser's current timezone.
 * Falls back to UTC if not found.
 */
export function getBrowserTimezoneOption(): TimezoneOption {
  const tzName = getBrowserTimezoneName();
  const browserOffset = getBrowserUtcOffset();

  // First try exact IANA name match
  const exactMatch = TIMEZONE_OPTIONS.find((tz) => tz.ianaName === tzName);
  if (exactMatch) return exactMatch;

  // Then try offset match (pick first with same offset)
  const offsetMatch = TIMEZONE_OPTIONS.find((tz) => tz.utcOffset === browserOffset);
  if (offsetMatch) return offsetMatch;

  // Fallback to UTC
  return TIMEZONE_OPTIONS.find((tz) => tz.ianaName === "UTC")!;
}

/** Format an offset number as a UTC string (e.g. -480 → "UTC-8", 330 → "UTC+5:30") */
export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes > 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

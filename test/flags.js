/**
 * Country code → flag emoji mapping.
 * Guards against the truncation fallback that used to turn IOC codes into a
 * different country's flag (ALG → Albania, GER → Georgia, RSA → Serbia).
 * Run: node test/flags.js
 */
const { countryFlag, CODE_TO_ISO2 } = require("../lib/country-flags");

let failures = 0;

function iso2(flag) {
  if (!flag) return "";
  return [...flag]
    .map(c => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 65))
    .join("");
}

function expectFlag(code, expected, note) {
  const got = iso2(countryFlag(code));
  if (got !== expected) {
    failures++;
    console.error(
      `  FAIL ${code}: expected ${expected || "(no flag)"}, got ${got || "(no flag)"}` +
        (note ? ` — ${note}` : "")
    );
  }
}

// Codes whose first two letters spell a different, real country. These are the
// ones that silently rendered the wrong flag.
const MISLEADING = {
  ALG: "DZ", // was AL — Albania
  GER: "DE", // was GE — Georgia
  RSA: "ZA", // was RS — Serbia
  SRB: "RS", // was SR — Suriname
  NED: "NL", // was NE — Niger
  CRO: "HR", // was CR — Costa Rica
  DEN: "DK", // was DE — Germany
  AUT: "AT", // was AU — Australia
  CHI: "CL", // was CH — Switzerland
  CHN: "CN", // was CH — Switzerland
  ESA: "SV", // was ES — Spain
  MEX: "MX", // was ME — Montenegro
  SVK: "SK", // was SV — El Salvador
  SLO: "SI", // was SL — Sierra Leone
  LAT: "LV", // was LA — Laos
  EST: "EE", // was ES — Spain
  BIH: "BA", // was BI — Burundi
  TRI: "TT", // was TR — Türkiye
  NIG: "NE", // was NI — Nicaragua
  NCA: "NI", // was NC — New Caledonia
  MAD: "MG", // was MA — Morocco
  MAS: "MY", // was MA — Morocco
  ZAM: "ZM", // was ZA — South Africa
  BER: "BM", // was BE — Belgium
  CAY: "KY", // was CA — Canada
  BAH: "BS", // was BA — Bosnia and Herzegovina
};

console.log("Codes that used to resolve to the wrong country:");
for (const [code, expected] of Object.entries(MISLEADING)) {
  expectFlag(code, expected);
}

// Codes whose truncation is not a country at all; these must not render a
// broken flag glyph either.
console.log("Codes whose truncation is not a country:");
for (const [code, expected] of Object.entries({
  SUI: "CH",
  BUL: "BG",
  POL: "PL",
  POR: "PT",
  KAZ: "KZ",
  SUD: "SD",
  TOG: "TG",
  ZIM: "ZW",
  GUY: "GY",
  MOZ: "MZ",
})) {
  expectFlag(code, expected);
}

console.log("Codes that were already correct stay correct:");
for (const [code, expected] of Object.entries({
  BRA: "BR",
  FRA: "FR",
  ESP: "ES",
  JPN: "JP",
  USA: "US",
  CIV: "CI",
  COD: "CD",
  CPV: "CV",
  QAT: "QA",
  ENG: "GB",
  SCO: "GB",
})) {
  expectFlag(code, expected);
}

console.log("Unknown or non-country codes yield no flag:");
for (const code of [
  "IOA", // neutral athletes — used by the Wimbledon feed
  "TBD",
  "W49", // FIFA placeholder for "winner of match 49"
  "RU3",
  "ZZZ",
  "",
  null,
  undefined,
  "SINNER", // Wimbledon builds player abbreviations from surnames
]) {
  const got = countryFlag(code);
  if (got !== "") {
    failures++;
    console.error(`  FAIL ${JSON.stringify(code)}: expected no flag, got ${got}`);
  }
}

// A code that is already an ISO alpha-2 country passes straight through.
expectFlag("GB", "GB");
expectFlag("DZ", "DZ");
if (countryFlag("XX") !== "") {
  failures++;
  console.error("  FAIL XX: unassigned alpha-2 should yield no flag");
}

// Table shape, so a typo in a new entry fails here rather than rendering a
// broken glyph on the mirror.
console.log("Lookup table is well formed:");
for (const [code, iso] of Object.entries(CODE_TO_ISO2)) {
  if (!/^[A-Z]{3}$/.test(code)) {
    failures++;
    console.error(`  FAIL key ${code}: expected three uppercase letters`);
  }
  if (!/^[A-Z]{2}$/.test(iso)) {
    failures++;
    console.error(`  FAIL ${code} → ${iso}: expected two uppercase letters`);
  }
}

if (failures) {
  console.error(`\nflags: FAIL (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("flags: PASS");

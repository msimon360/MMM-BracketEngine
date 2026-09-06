/**
 * Grand Slam draw feed round → engine round id mapping (offline, synthetic feed).
 * A draw with more feed rounds than the engine can name used to walk off the
 * front of ENGINE_ROUND_IDS and emit `id: undefined`, which fails schema
 * validation and leaves nothing to render.
 * Run: node test/slam-draws.js
 */
const WimbledonProvider = require("../providers/WimbledonProvider");
const { validateBracket } = require("../schemas/bracket");

let failures = 0;

const ROUND_NAMES = {
  1: "First Round",
  2: "Second Round",
  3: "Third Round",
  4: "Fourth Round",
  Q: "Quarter-Finals",
  S: "Semi-Finals",
  F: "Final",
};

/** Builds a feed whose rounds halve from `firstRoundMatches` down to the final. */
function buildFeed(codes, firstRoundMatches) {
  const matches = [];
  let count = firstRoundMatches;
  let id = 1000;
  for (const code of codes) {
    for (let i = 0; i < count; i++) {
      matches.push({
        match_id: String(id++),
        roundCode: code,
        roundName: ROUND_NAMES[code],
        statusCode: "D",
        winner: "1",
        team1: { displayNameA: `P${id}a`, lastNameA: `Alpha${id}`, nationA: "FRA", totalSetsWon: 3 },
        team2: { displayNameA: `P${id}b`, lastNameA: `Beta${id}`, nationA: "GER", totalSetsWon: 1 },
      });
    }
    count /= 2;
  }
  return { matches };
}

function check(label, { codes, firstRoundMatches, fromRoundCode, expected }) {
  const provider = new WimbledonProvider({ fromRoundCode });
  const rounds = provider.parseBracket(buildFeed(codes, firstRoundMatches));
  const got = rounds.map(r => `${r.id}(${r.matches.length})`).join(" ");

  if (got !== expected) {
    failures++;
    console.error(`  FAIL ${label}\n    expected: ${expected}\n    got     : ${got}`);
    return;
  }

  // The engine only renders these ids; anything else cannot be laid out.
  const known = new Set(["R32", "R16", "QF", "SF", "3RD", "F"]);
  for (const round of rounds) {
    if (!known.has(round.id)) {
      failures++;
      console.error(`  FAIL ${label}: unrenderable round id ${JSON.stringify(round.id)}`);
    }
  }

  const result = validateBracket({
    meta: { title: "t", sport: "tennis" },
    rounds,
  });
  if (!result.valid) {
    failures++;
    console.error(`  FAIL ${label}: schema rejected payload — ${result.errors.join("; ")}`);
  }
}

const FULL_SINGLES = ["1", "2", "3", "4", "Q", "S", "F"];

console.log("Singles draw, various starting rounds:");

check("from Third Round (singles default)", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "3",
  expected: "R32(16) R16(8) QF(4) SF(2) F(1)",
});

check("from Fourth Round (compact view)", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "4",
  expected: "R16(8) QF(4) SF(2) F(1)",
});

// Both of these are documented fromRoundCode values and used to yield
// `id: undefined` for every round the engine had no name for.
check("from Second Round (128-player draw)", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "2",
  expected: "R32(16) R16(8) QF(4) SF(2) F(1)",
});

check("from First Round (128-player draw)", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "1",
  expected: "R32(16) R16(8) QF(4) SF(2) F(1)",
});

check("from Quarter-Finals", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "Q",
  expected: "QF(4) SF(2) F(1)",
});

console.log("Doubles draw (starts at the Second Round):");

check("doubles default", {
  codes: ["2", "3", "4", "Q", "S", "F"],
  firstRoundMatches: 32,
  fromRoundCode: "2",
  expected: "R32(16) R16(8) QF(4) SF(2) F(1)",
});

console.log("Unknown fromRoundCode falls back to the whole sequence:");

check("unrecognised code", {
  codes: FULL_SINGLES,
  firstRoundMatches: 64,
  fromRoundCode: "Z",
  expected: "R32(16) R16(8) QF(4) SF(2) F(1)",
});

if (failures) {
  console.error(`\nslam-draws: FAIL (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("slam-draws: PASS");

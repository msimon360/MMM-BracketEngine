/**
 * Grand Slam draw providers — Wimbledon and the US Open (offline, synthetic feeds).
 *
 * Both tournaments publish the same feed format, so both run through the same
 * checks here: feed round → engine round id mapping, match state parsing, and
 * the URL each provider builds.
 *
 * Run: node test/slam-draws.js
 */
const UsOpenProvider = require("../providers/UsOpenProvider");
const WimbledonProvider = require("../providers/WimbledonProvider");
const { validateBracket } = require("../schemas/bracket");

let failures = 0;

function fail(msg) {
  failures++;
  console.error(`  FAIL ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const ROUND_NAMES = {
  1: "Round 1",
  2: "Round 2",
  3: "Round 3",
  4: "Round 4",
  Q: "Quarter-Finals",
  S: "Semi-Finals",
  F: "Final",
};

/** Builds a feed whose rounds halve from `firstRoundMatches` down to the final. */
function buildFeed(codes, firstRoundMatches, overrides = {}) {
  const matches = [];
  let count = firstRoundMatches;
  let id = 1000;
  for (const code of codes) {
    for (let i = 0; i < count; i++) {
      id++;
      matches.push({
        match_id: String(id),
        roundCode: code,
        roundName: ROUND_NAMES[code],
        statusCode: "D",
        status: "Completed",
        winner: "1",
        epoch: 1757280648000,
        team1: {
          displayNameA: `A. Alpha${id}`,
          firstNameA: "Anna",
          lastNameA: `Alpha${id}`,
          nationA: "FRA",
          totalSetsWon: 3,
        },
        team2: {
          displayNameA: `B. Beta${id}`,
          firstNameA: "Bruno",
          lastNameA: `Beta${id}`,
          nationA: "GER",
          totalSetsWon: 1,
        },
        ...overrides,
      });
    }
    count /= 2;
  }
  return { eventName: "Test Draw", matches };
}

/** Parses a single match built from `overrides` through the US Open provider. */
function parseOne(overrides) {
  const feed = buildFeed(["F"], 1, overrides);
  return new UsOpenProvider({}).parseMatch(feed.matches[0]);
}

const RENDERABLE_IDS = new Set(["R32", "R16", "QF", "SF", "3RD", "F"]);

function checkRounds(label, Provider, { codes, firstRoundMatches, config, expected }) {
  const provider = new Provider(config);
  const rounds = provider.parseBracket(buildFeed(codes, firstRoundMatches));
  const got = rounds.map(r => `${r.id}(${r.matches.length})`).join(" ");

  if (got !== expected) {
    fail(`${label}\n    expected: ${expected}\n    got     : ${got}`);
    return;
  }

  for (const round of rounds) {
    if (!RENDERABLE_IDS.has(round.id)) {
      fail(`${label}: unrenderable round id ${JSON.stringify(round.id)}`);
    }
  }

  const result = validateBracket({ meta: { title: "t", sport: "tennis" }, rounds });
  if (!result.valid) {
    fail(`${label}: schema rejected payload — ${result.errors.join("; ")}`);
  }
}

/* ------------------------------------------------------- round id mapping */

const SINGLES_128 = ["1", "2", "3", "4", "Q", "S", "F"];
const DOUBLES_64 = ["1", "2", "3", "Q", "S", "F"];
const FULL_ENGINE = "R32(16) R16(8) QF(4) SF(2) F(1)";

console.log("Wimbledon draws map onto the engine's five stages:");

checkRounds("MS from Third Round (default)", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS" }, expected: FULL_ENGINE,
});
checkRounds("MS from Fourth Round (compact)", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "4" }, expected: "R16(8) QF(4) SF(2) F(1)",
});
// Both are documented fromRoundCode values and used to yield `id: undefined`.
checkRounds("MS from Second Round", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "2" }, expected: FULL_ENGINE,
});
checkRounds("MS from First Round", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "1" }, expected: FULL_ENGINE,
});
checkRounds("MS from Quarter-Finals", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "Q" }, expected: "QF(4) SF(2) F(1)",
});
checkRounds("MD default (starts at Round 2)", WimbledonProvider, {
  codes: DOUBLES_64, firstRoundMatches: 32,
  config: { drawCode: "MD" }, expected: FULL_ENGINE,
});
checkRounds("unrecognised fromRoundCode uses the whole sequence", WimbledonProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "Z" }, expected: FULL_ENGINE,
});

console.log("US Open draws map onto the engine's five stages:");

checkRounds("MS, 128 draw", UsOpenProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS" }, expected: FULL_ENGINE,
});
checkRounds("WS, 128 draw", UsOpenProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "WS" }, expected: FULL_ENGINE,
});
checkRounds("MD, 64 draw", UsOpenProvider, {
  codes: DOUBLES_64, firstRoundMatches: 32,
  config: { drawCode: "MD" }, expected: FULL_ENGINE,
});
// Mixed doubles was a 32-team draw in 2024 and a 16-team draw from 2025. A
// fixed starting round would be wrong for one of them; both must work.
checkRounds("XD, 32-team draw (2024 shape)", UsOpenProvider, {
  codes: ["1", "2", "Q", "S", "F"], firstRoundMatches: 16,
  config: { drawCode: "XD" }, expected: FULL_ENGINE,
});
checkRounds("XD, 16-team draw (2025+ shape)", UsOpenProvider, {
  codes: ["1", "Q", "S", "F"], firstRoundMatches: 8,
  config: { drawCode: "XD" }, expected: "R16(8) QF(4) SF(2) F(1)",
});
checkRounds("an eight-team draw", UsOpenProvider, {
  codes: ["Q", "S", "F"], firstRoundMatches: 4,
  config: { drawCode: "XD" }, expected: "QF(4) SF(2) F(1)",
});
checkRounds("fromRoundCode still narrows the view", UsOpenProvider, {
  codes: SINGLES_128, firstRoundMatches: 64,
  config: { drawCode: "MS", fromRoundCode: "4" }, expected: "R16(8) QF(4) SF(2) F(1)",
});

/* ----------------------------------------------------------- match states */

console.log("Match states are read from the feed status:");
{
  const m = parseOne({ statusCode: "D", status: "Completed", winner: "1" });
  assert(m.status === "final", `completed match is ${m.status}, expected final`);
  assert(m.scoreA === 3 && m.scoreB === 1, `completed score ${m.scoreA}-${m.scoreB}, expected 3-1`);
  assert(m.winner === m.teamA.abbr, "completed match winner should be team A");
}
{
  // A retirement is a finished match: it has a winner and a real set score.
  const m = parseOne({ statusCode: "E", status: "Retired", winner: "1" });
  assert(m.status === "final", `retired match is ${m.status}, expected final`);
  assert(m.scoreA === 3 && m.scoreB === 1, `retired score ${m.scoreA}-${m.scoreB}, expected 3-1`);
  assert(m.winner === m.teamA.abbr, "retired match should still name a winner");
}
{
  // Nobody played, so the feed's 0-0 is not a set score worth showing.
  const m = parseOne({
    statusCode: "F", status: "Walkover", winner: "2",
    team1: { displayNameA: "A. One", lastNameA: "One", nationA: "USA", totalSetsWon: 0 },
    team2: { displayNameA: "B. Two", lastNameA: "Two", nationA: "ESP", totalSetsWon: 0 },
  });
  assert(m.status === "final", `walkover is ${m.status}, expected final`);
  assert(m.scoreA === null && m.scoreB === null, `walkover shows score ${m.scoreA}-${m.scoreB}, expected none`);
  assert(m.winner === m.teamB.abbr, "walkover should still name a winner");
}
{
  const m = parseOne({ statusCode: "B", status: "", winner: null, epoch: null });
  assert(m.status === "scheduled", `upcoming match is ${m.status}, expected scheduled`);
  assert(m.scoreA === null && m.scoreB === null, "upcoming match should have no score");
  assert(m.winner === null, "upcoming match should have no winner");
  assert(m.date === null, "upcoming match without an epoch should have no date");
}
{
  const m = parseOne({ statusCode: "L", status: "In Progress", winner: null });
  assert(m.status === "live", `in-progress match is ${m.status}, expected live`);
  assert(m.scoreA === 3 && m.scoreB === 1, "live match should show the running set score");
}
{
  // An unfamiliar status code must not push a decided match back into the future.
  const m = parseOne({ statusCode: "?", status: "", winner: "2" });
  assert(m.status === "final", `decided match with an unknown code is ${m.status}, expected final`);
}
{
  const m = parseOne({
    statusCode: "B", status: "", winner: null,
    team1: { displayNameA: null },
    team2: { displayNameA: null },
  });
  assert(m.teamA.isPlaceholder && m.teamB.isPlaceholder, "empty sides should be placeholders");
  assert(m.teamA.name === "TBD", `empty side is named ${m.teamA.name}, expected TBD`);
}

/* ------------------------------------------------------------ sides, flags */

console.log("Sides carry player names and nation flags:");
{
  const m = parseOne({});
  assert(m.teamA.name === "Anna Alpha1001", `singles name is ${m.teamA.name}`);
  assert(m.teamA.flag === "🇫🇷", `FRA flag is ${JSON.stringify(m.teamA.flag)}, expected 🇫🇷`);
  assert(m.teamB.flag === "🇩🇪", `GER flag is ${JSON.stringify(m.teamB.flag)}, expected 🇩🇪`);
}
{
  const m = parseOne({
    team1: {
      displayNameA: "T. Townsend", lastNameA: "Townsend",
      displayNameB: "D. Young", lastNameB: "Young", nationA: "USA",
    },
    team2: {
      displayNameA: "S. Errani", lastNameA: "Errani",
      displayNameB: "A. Vavassori", lastNameB: "Vavassori", nationA: "ITA",
    },
  });
  assert(m.teamA.name === "T. Townsend / D. Young", `doubles name is ${m.teamA.name}`);
  assert(m.teamA.abbr === "TOWNSE/YOUNG", `doubles abbr is ${m.teamA.abbr}`);
  assert(m.teamA.flag === "🇺🇸", `USA flag is ${JSON.stringify(m.teamA.flag)}`);
}

/* -------------------------------------------------------- urls and titles */

console.log("Each provider addresses its own feed:");
{
  const uso = new UsOpenProvider({ year: "2026", drawCode: "ws" });
  assert(
    uso.bracketUrl === "https://www.usopen.org/en_US/scores/feeds/2026/draws/WS.json",
    `US Open url is ${uso.bracketUrl}`
  );
  assert(uso.name === "usopen", `US Open provider name is ${uso.name}`);

  const wim = new WimbledonProvider({ year: "2025", drawCode: "MS" });
  assert(
    wim.bracketUrl === "https://www.wimbledon.com/en_GB/scores/feeds/2025/draws/MS.json",
    `Wimbledon url is ${wim.bracketUrl}`
  );

  const override = new UsOpenProvider({ url: "https://example.test/draw.json" });
  assert(override.bracketUrl === "https://example.test/draw.json", "url config should win");

  assert(
    new UsOpenProvider({ year: "2026", drawCode: "WS" }).buildTitle({}) ===
      "US Open 2026 Women's Singles",
    "US Open title"
  );
  assert(
    new WimbledonProvider({ year: "2025", drawCode: "LS" }).buildTitle({}) ===
      "Wimbledon 2025 Ladies' Singles",
    "Wimbledon title"
  );
  // Junior and unlisted draws fall back to the name the feed reports.
  assert(
    new UsOpenProvider({ year: "2026", drawCode: "ZZ" }).buildTitle({ eventName: "Wheelchair Singles" }) ===
      "US Open 2026 Wheelchair Singles",
    "unlisted draw should use the feed's eventName"
  );
  assert(
    new UsOpenProvider({ year: "2026", title: "My Bracket" }).buildTitle({}) === "My Bracket",
    "title config should win"
  );
}

if (failures) {
  console.error(`\nslam-draws: FAIL (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("slam-draws: PASS");

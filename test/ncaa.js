/**
 * NCAA tournament provider (offline, synthetic scoreboard).
 *
 * Checks round mapping onto the engine's five stages, seeds, scores,
 * winners, and school abbreviations that would otherwise resolve as
 * country flags.
 *
 * Run: node test/ncaa.js
 */
const NcaaProvider = require("../providers/NcaaProvider");
const { countryFlag } = require("../lib/country-flags");
const { validateBracket } = require("../schemas/bracket");

let failures = 0;

function fail(msg) {
  failures++;
  console.error(`  FAIL ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

let nextId = 1;

function team(abbr, name, seed) {
  return {
    abbreviation: abbr,
    shortDisplayName: name,
    seed,
  };
}

/**
 * @param {string} round Last segment of the ESPN note, e.g. "Sweet 16".
 * @param {object} [opts]
 */
function game(round, opts = {}) {
  const id = opts.id || nextId++;
  const region = opts.region
    ? `${opts.region}${/region/i.test(opts.region) ? "" : " Region"} - `
    : "";
  const prefix = opts.prefix || "Men's Basketball Championship";
  const a = "a" in opts ? opts.a : team("DUKE", "Duke", 1);
  const b = "b" in opts ? opts.b : team("UNC", "North Carolina", 16);
  const state = opts.state || "post";
  const aWon = opts.winner === "A";
  const bWon = opts.winner === "B";
  const played = state === "post" || state === "in";

  return {
    id: String(id),
    date: opts.date || "2025-03-23T23:00:00Z",
    status: {
      type: {
        state,
        completed: state === "post",
      },
    },
    competitions: [
      {
        notes: [{ headline: `${prefix} - ${region}${round}` }],
        competitors: [
          side(a, played ? (opts.scoreA ?? (aWon ? "80" : "70")) : "", aWon, 0),
          side(b, played ? (opts.scoreB ?? (bWon ? "80" : "70")) : "", bWon, 1),
        ],
      },
    ],
  };
}

function side(entry, score, winner, order) {
  if (!entry) {
    return { order, winner: false, score: "", team: { abbreviation: "TBD", shortDisplayName: "TBD" } };
  }
  return {
    order,
    winner,
    score,
    curatedRank: entry.seed ? { current: entry.seed } : undefined,
    team: {
      abbreviation: entry.abbreviation,
      shortDisplayName: entry.shortDisplayName,
    },
  };
}

function payload(events) {
  return { events };
}

function roundsOf(events, config) {
  return new NcaaProvider(config || { year: "2025" }).parseBracket(payload(events));
}

console.log("A filled-in tournament maps onto the engine's five stages:");
{
  const events = [
    game("First Four", { a: team("ALST", "Alabama St", 16), b: team("MSM", "Mount St Mary's", 16) }),
    game("1st Round", { a: team("DUKE", "Duke", 1), b: team("MSM", "Mount St Mary's", 16) }),
    game("2nd Round", { region: "East", a: team("PUR", "Purdue", 8), b: team("DUKE", "Duke", 1), winner: "B" }),
    game("Sweet 16", { region: "East", a: team("DUKE", "Duke", 1), b: team("ARIZ", "Arizona", 4), winner: "A" }),
    game("Elite 8", { region: "East", a: team("DUKE", "Duke", 1), b: team("ALA", "Alabama", 2), winner: "B" }),
    game("Final Four", { a: team("ALA", "Alabama", 2), b: team("FLA", "Florida", 1), winner: "B" }),
    game("National Championship", {
      a: team("HOU", "Houston", 1),
      b: team("FLA", "Florida", 1),
      winner: "B",
      scoreA: "63",
      scoreB: "65",
    }),
  ];
  const rounds = roundsOf(events);
  const got = rounds.map(r => `${r.id}:${r.name}(${r.matches.length})`).join(" ");
  const expected =
    "R32:2nd Round(1) R16:Sweet 16(1) QF:Elite 8(1) SF:Final Four(1) F:Championship(1)";
  assert(got === expected, `rounds\n    expected: ${expected}\n    got     : ${got}`);

  const result = validateBracket({
    meta: { title: "NCAA Men's Basketball 2025", sport: "basketball" },
    rounds,
  });
  assert(result.valid, `schema rejected payload — ${result.errors.join("; ")}`);

  const r32 = rounds.find(r => r.id === "R32").matches[0];
  assert(r32.teamA.name === "(1) Duke", `higher seed is teamA (${r32.teamA.name})`);
  assert(r32.teamB.abbr === "PURDUE", `PUR lengthens to ${r32.teamB.abbr}`);
  assert(!countryFlag(r32.teamB.abbr), `lengthened abbr still has a flag ${r32.teamB.abbr}`);
  assert(r32.winner === "DUKE", `winner abbr is ${r32.winner}`);
  assert(r32.scoreA === 80 && r32.scoreB === 70, `scores ${r32.scoreA}-${r32.scoreB}`);

  const fin = rounds.find(r => r.id === "F").matches[0];
  assert(fin.teamA.abbr === "HOU" && fin.teamB.abbr === "FLA", "equal seeds keep feed order");
  assert(fin.winner === "FLA", `championship winner is ${fin.winner}`);
  assert(fin.scoreA === 63 && fin.scoreB === 65, `championship score ${fin.scoreA}-${fin.scoreB}`);
  assert(
    rounds.find(r => r.id === "R16").matches[0].teamA.abbr === "DUKE",
    "Sweet 16 keeps the Round of 32 winner's abbreviation"
  );
}

console.log("Later rounds that are still TBD do not hide the round being played:");
{
  const events = [
    game("1st Round", { a: team("DUKE", "Duke", 1), b: team("UNC", "North Carolina", 16), winner: "A" }),
    game("2nd Round", { a: null, b: null, state: "pre" }),
    game("National Championship", { a: null, b: null, state: "pre" }),
  ];
  const rounds = roundsOf(events);
  assert(rounds.length === 1, `expected only the 1st Round, got ${rounds.map(r => r.name).join(", ")}`);
  assert(rounds[0].id === "R32" && rounds[0].name === "1st Round", `opening round is ${rounds[0]?.id} ${rounds[0]?.name}`);
  assert(rounds[0].matches[0].winner === "DUKE", "opening-round winner is kept");
}

console.log("A set later matchup replaces the Round of 64:");
{
  const events = [
    game("1st Round", { winner: "A" }),
    game("Sweet 16", { a: team("DUKE", "Duke", 1), b: team("FLA", "Florida", 2), state: "pre" }),
    game("Sweet 16", { a: null, b: null, state: "pre" }),
    game("Championship", { a: null, b: null, state: "pre" }),
  ];
  const rounds = roundsOf(events);
  const got = rounds.map(r => `${r.id}(${r.matches.length})`).join(" ");
  assert(got === "R16(2)", `partial Sweet 16 should be the only round, got ${got}`);
  const open = rounds[0].matches.find(m => m.teamA.abbr === "DUKE");
  assert(open.status === "scheduled" && open.scoreA == null && open.winner == null, "scheduled matchup has no score or winner");
  assert(open.teamA.name === "(1) Duke" && open.teamB.name === "(2) Florida", `seeds render in the name (${open.teamA.name} vs ${open.teamB.name})`);
}

console.log("Live games keep a running score and do not name a winner:");
{
  const rounds = roundsOf([
    game("Elite 8", { state: "in", scoreA: "40", scoreB: "38", winner: null }),
  ]);
  const match = rounds[0].matches[0];
  assert(match.status === "live", `status ${match.status}`);
  assert(match.scoreA === 40 && match.scoreB === 38, `live score ${match.scoreA}-${match.scoreB}`);
  assert(match.winner == null, `live winner ${match.winner}`);
}

console.log("A missing side and a country-code school both stay inside the schema:");
{
  const rounds = roundsOf([
    game("Final Four", {
      a: team("ALA", "Alabama", 2),
      b: team("FLA", "Florida", 1),
      winner: "B",
    }),
    game("Final Four", {
      a: team("SC", "South Carolina", 1),
      b: null,
      winner: "A",
      scoreA: "82",
      scoreB: "",
    }),
  ]);
  const match = rounds[0]?.matches.find(m => m.teamA.name.includes("South Carolina"));
  assert(match, "South Carolina game is in the Final Four");
  assert(match.teamA.abbr === "SOUTHCAR", `SC lengthens to ${match?.teamA.abbr}`);
  assert(!countryFlag(match.teamA.abbr), "South Carolina must not resolve to a country flag");
  assert(match.teamB.isPlaceholder && match.teamB.abbr === "TBD", "missing side is TBD");
  assert(match.winner === "SOUTHCAR", `winner follows the lengthened abbr (${match.winner})`);
  const result = validateBracket({
    meta: { title: "t", sport: "basketball" },
    rounds,
  });
  assert(result.valid, `schema rejected payload — ${result.errors.join("; ")}`);
}

console.log("Notes that are not tournament rounds are ignored:");
{
  const rounds = roundsOf([
    game("Quarterfinals", { prefix: "NIT" }),
    game("2nd Round", { winner: "A" }),
  ]);
  assert(rounds.length === 1 && rounds[0].matches.length === 1, "only the NCAA round is kept");
}

console.log("Women's notes use the same round names:");
{
  const rounds = roundsOf([
    game("1st Round", { prefix: "NCAA Women's Championship", region: "Regional 4 in Spokane" }),
    game("Final Four", { prefix: "NCAA Women's Championship", winner: "A" }),
  ], { gender: "women", year: "2025" });
  assert(
    rounds.length === 1 && rounds[0].id === "SF",
    `a set Final Four drops the 1st Round (${rounds.map(r => r.id).join(",")})`
  );
}

console.log("Feed URL, title, and date window follow the config:");
{
  const men = new NcaaProvider({ year: "2025", gender: "men" });
  assert(men.name === "ncaa", `provider name is ${men.name}`);
  assert(
    men.scoreboardUrl("20250321") ===
      "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=20250321&groups=100&limit=100",
    `men's url is ${men.scoreboardUrl("20250321")}`
  );
  assert(men.buildTitle() === "NCAA Men's Basketball 2025", `title is ${men.buildTitle()}`);

  const women = new NcaaProvider({ year: 2025, gender: "Women" });
  assert(
    women.scoreboardUrl("20250406").includes("/womens-college-basketball/scoreboard?dates=20250406&groups=100"),
    `women's url is ${women.scoreboardUrl("20250406")}`
  );
  assert(women.buildTitle() === "NCAA Women's Basketball 2025", `women's title is ${women.buildTitle()}`);
  assert(
    new NcaaProvider({ year: "2025", title: "My Bracket" }).buildTitle() === "My Bracket",
    "title config should win"
  );
  assert(
    new NcaaProvider({}).year === String(new Date().getFullYear()),
    "year defaults to the current calendar year"
  );

  const dates = men.tournamentDates({
    leagues: [{
      calendar: [
        "2025-03-01T08:00Z",
        "2025-03-18T07:00Z",
        "2025-04-07T07:00Z",
        "2025-04-20T07:00Z",
        "2025-11-04T08:00Z",
      ],
    }],
  });
  assert(
    dates.join(",") === "20250318,20250407",
    `calendar window is ${dates.join(",")}`
  );
  const fallback = new NcaaProvider({ year: "2025" }).tournamentDates({});
  assert(fallback[0] === "20250312" && fallback.at(-1) === "20250416", `fallback window ${fallback[0]}..${fallback.at(-1)}`);

  let threw = false;
  try {
    new NcaaProvider({ gender: "coed" }).tournamentName;
  } catch (err) {
    threw = /gender/.test(err.message);
  }
  assert(threw, "an unknown gender should throw");
}

if (failures) {
  console.error(`\nncaa: FAIL (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("ncaa: PASS");

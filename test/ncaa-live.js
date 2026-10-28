/**
 * NCAA provider smoke test (live ESPN scoreboard).
 * Run: npm run test:ncaa
 *
 * 2025 is a completed tournament, so every later-round team won a game in
 * the round before it.
 */
const NcaaProvider = require("../providers/NcaaProvider");
const { countryFlag } = require("../lib/country-flags");
const { validateBracket, layoutRoundsForMirroredBracket } = require("../schemas/bracket");

function assertAdvances(prev, next, label) {
  for (const match of next.matches) {
    for (const team of [match.teamA, match.teamB]) {
      if (!team || team.isPlaceholder || team.abbr === "TBD") continue;
      const won = prev.matches.some(game => game.winner === team.abbr);
      if (!won) {
        console.error(`FAIL: ${label} ${team.name} (${team.abbr}) did not win a ${prev.name} game`);
        process.exit(1);
      }
    }
  }
}

async function load(config) {
  const data = await new NcaaProvider(config).fetchBracket();
  const result = validateBracket(data);
  if (!result.valid) {
    console.error("Validation failed:", result.errors);
    process.exit(1);
  }
  const rounds = layoutRoundsForMirroredBracket(data.rounds);
  return { data, rounds };
}

function checkShape(data, rounds, label) {
  console.log(label, data.meta.title);
  console.log(
    "rounds:",
    rounds.map(r => `${r.id}:${r.name}(${r.matches.length})`).join(", ")
  );

  const expected = [
    ["R32", "2nd Round", 16],
    ["R16", "Sweet 16", 8],
    ["QF", "Elite 8", 4],
    ["SF", "Final Four", 2],
    ["F", "Championship", 1],
  ];
  const got = rounds.map(r => `${r.id}:${r.name}:${r.matches.length}`).join(" ");
  const want = expected.map(([id, name, n]) => `${id}:${name}:${n}`).join(" ");
  if (got !== want) {
    console.error(`FAIL: ${label} rounds\n  expected ${want}\n  got      ${got}`);
    process.exit(1);
  }

  if (data.meta.sport !== "basketball" || data.meta.icon !== "🏀") {
    console.error(`FAIL: ${label} meta sport/icon`);
    process.exit(1);
  }

  const namesByAbbr = new Map();
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!["scheduled", "live", "final"].includes(match.status)) {
        console.error(`FAIL: ${label} bad status ${match.status}`);
        process.exit(1);
      }
      for (const team of [match.teamA, match.teamB]) {
        if (team.isPlaceholder) continue;
        if (countryFlag(team.abbr)) {
          console.error(`FAIL: ${label} ${team.abbr} (${team.name}) resolves to a country flag`);
          process.exit(1);
        }
        const base = team.name.replace(/^\(\d+\)\s*/, "");
        const prev = namesByAbbr.get(team.abbr);
        if (prev && prev !== base) {
          console.error(`FAIL: ${label} abbr ${team.abbr} is both ${prev} and ${base}`);
          process.exit(1);
        }
        namesByAbbr.set(team.abbr, base);
      }
    }
  }

  for (let i = 1; i < rounds.length; i++) {
    assertAdvances(rounds[i - 1], rounds[i], label);
  }
}

function checkFinal(roundMap, schools, scores, winnerSchool) {
  const fin = roundMap.F.matches[0];
  const names = `${fin.teamA.name} ${fin.teamB.name}`;
  console.log(
    "final:",
    fin.teamA.name,
    fin.scoreA,
    "-",
    fin.scoreB,
    fin.teamB.name,
    fin.winner ? `(${fin.winner})` : ""
  );
  if (fin.status !== "final" || !fin.winner) {
    console.error(`FAIL: final should be decided, got ${fin.status} winner=${fin.winner}`);
    process.exit(1);
  }
  for (const school of schools) {
    if (!names.includes(school)) {
      console.error(`FAIL: final is missing ${school} (${names})`);
      process.exit(1);
    }
  }
  const gotScores = [fin.scoreA, fin.scoreB].sort((a, b) => a - b).join("-");
  const wantScores = [...scores].sort((a, b) => a - b).join("-");
  if (gotScores !== wantScores) {
    console.error(`FAIL: final score ${gotScores}, expected ${wantScores}`);
    process.exit(1);
  }
  const winner = fin.winner === fin.teamA.abbr ? fin.teamA : fin.teamB;
  if (!winner.name.includes(winnerSchool)) {
    console.error(`FAIL: winner ${winner.name} should be ${winnerSchool}`);
    process.exit(1);
  }
}

async function main() {
  const men = await load({ year: "2025", gender: "men" });
  checkShape(men.data, men.rounds, "men");
  checkFinal(
    Object.fromEntries(men.rounds.map(r => [r.id, r])),
    ["Florida", "Houston"],
    [65, 63],
    "Florida"
  );

  const women = await load({ year: "2025", gender: "women" });
  checkShape(women.data, women.rounds, "women");
  checkFinal(
    Object.fromEntries(women.rounds.map(r => [r.id, r])),
    ["UConn", "South Carolina"],
    [82, 59],
    "UConn"
  );

  console.log("PASS: NCAA 2025 men's and women's tournaments");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * US Open provider smoke test (live feed).
 * Run: npm run test:usopen
 */
const UsOpenProvider = require("../providers/UsOpenProvider");
const { validateBracket, layoutRoundsForMirroredBracket } = require("../schemas/bracket");

async function loadDraw(config) {
  const data = await new UsOpenProvider(config).fetchBracket();
  const result = validateBracket(data);
  if (!result.valid) {
    console.error("Validation failed:", result.errors);
    process.exit(1);
  }
  return { data, rounds: layoutRoundsForMirroredBracket(data.rounds) };
}

async function main() {
  // 2025 is a completed edition, so the whole bracket is decided.
  const { data, rounds } = await loadDraw({ year: "2025", drawCode: "MS" });
  const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

  console.log("title:", data.meta.title);
  console.log("rounds:", rounds.map(r => `${r.id}(${r.matches.length})`).join(", "));

  const fin = roundMap.F?.matches[0];
  if (!fin) {
    console.error("FAIL: missing final");
    process.exit(1);
  }
  console.log(
    "final:",
    `${fin.teamA.flag} ${fin.teamA.name}`,
    `${fin.scoreA}-${fin.scoreB}`,
    `${fin.teamB.flag} ${fin.teamB.name}`,
    fin.winner ? `(winner ${fin.winner})` : ""
  );

  const qf = roundMap.QF;
  if (!qf || qf.matches.length !== 4) {
    console.error("FAIL: expected 4 quarter-finals");
    process.exit(1);
  }
  if (fin.status !== "final" || !fin.winner) {
    console.error(`FAIL: 2025 final should be decided, got status ${fin.status}`);
    process.exit(1);
  }
  if (!rounds.every(r => r.matches.every(m => m.teamA && m.teamB))) {
    console.error("FAIL: every match needs two sides");
    process.exit(1);
  }

  // Mixed doubles is a smaller draw, so it exercises the round trimming.
  const mixed = await loadDraw({ year: "2025", drawCode: "XD" });
  console.log(
    "mixed doubles:",
    mixed.rounds.map(r => `${r.id}(${r.matches.length})`).join(", ")
  );
  if (mixed.rounds[mixed.rounds.length - 1].id !== "F") {
    console.error("FAIL: mixed doubles should end with the final");
    process.exit(1);
  }

  console.log("PASS: US Open 2025 draws");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

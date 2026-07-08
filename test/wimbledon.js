/**
 * Wimbledon provider smoke test (live feed).
 * Run: npm run test:wimbledon
 */
const WimbledonProvider = require("../providers/WimbledonProvider");
const { validateBracket, layoutRoundsForMirroredBracket } = require("../schemas/bracket");

async function main() {
  const provider = new WimbledonProvider({
    year: "2025",
    drawCode: "MS",
    fromRoundCode: "4",
  });

  const data = await provider.fetchBracket();
  const result = validateBracket(data);
  if (!result.valid) {
    console.error("Validation failed:", result.errors);
    process.exit(1);
  }

  const rounds = layoutRoundsForMirroredBracket(data.rounds);
  const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

  console.log("title:", data.meta.title);
  console.log(
    "rounds:",
    rounds.map(r => `${r.id}(${r.matches.length})`).join(", ")
  );

  const fin = roundMap.F?.matches[0];
  if (!fin) {
    console.error("FAIL: missing final");
    process.exit(1);
  }

  console.log(
    "final:",
    fin.teamA.name,
    "vs",
    fin.teamB.name,
    fin.winner ? `(winner ${fin.winner})` : ""
  );

  const qf = roundMap.QF;
  if (!qf || qf.matches.length !== 4) {
    console.error("FAIL: expected 4 QF matches");
    process.exit(1);
  }

  console.log("PASS: Wimbledon MS 2025 bracket");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

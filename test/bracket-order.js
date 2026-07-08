/**
 * Verifies mirrored bracket layout using only teams/winners (no sources).
 * Run: npm run test:order
 */
const FifaProvider = require("../providers/FifaProvider");
const { layoutRoundsForMirroredBracket } = require("../schemas/bracket");

function splitHalf(matches) {
  const h = Math.ceil(matches.length / 2);
  return { left: matches.slice(0, h), right: matches.slice(h) };
}

async function main() {
  const raw = await new FifaProvider({ seasonId: "285023" }).fetchBracket();
  for (const round of raw.rounds) {
    for (const match of round.matches) {
      delete match.sources;
    }
  }

  const rounds = layoutRoundsForMirroredBracket(raw.rounds);
  const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

  const { left: r32Left, right: r32Right } = splitHalf(roundMap.R32.matches);
  const { right: r16Right } = splitHalf(roundMap.R16.matches);
  const { left: qfLeft, right: qfRight } = splitHalf(roundMap.QF.matches);

  const norEngQf = roundMap.QF.matches.find(
    m => m.teamA.abbr === "NOR" || m.teamB.abbr === "NOR"
  );
  const espBelQf = roundMap.QF.matches.find(
    m =>
      (m.teamA.abbr === "ESP" && m.teamB.abbr === "BEL") ||
      (m.teamA.abbr === "BEL" && m.teamB.abbr === "ESP")
  );

  console.log("R32 right:", r32Right.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`).join(", "));
  console.log("R16 right:", r16Right.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`).join(", "));
  console.log("QF left:", qfLeft.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`).join(", "));
  console.log("QF right:", qfRight.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`).join(", "));

  const errors = [];

  const wrongR32 = r32Left
    .map(m => `${m.teamA.abbr}/${m.teamB.abbr}`)
    .filter(l => ["BRA/JPN", "CIV/NOR", "MEX/ECU", "ENG/COD"].includes(l));
  if (wrongR32.length) {
    errors.push(`R32 right-branch on left: ${wrongR32.join(", ")}`);
  }

  if (!r16Right.some(m => m.teamA.abbr === "BRA" && m.teamB.abbr === "NOR")) {
    errors.push("R16 right missing BRA/NOR");
  }

  if (!qfRight.some(m => m.id === norEngQf?.id)) {
    errors.push("NOR/ENG QF not on right half");
  }

  if (qfRight.some(m => m.id === espBelQf?.id)) {
    errors.push("ESP/BEL QF incorrectly on right half");
  }

  if (!qfLeft.some(m => m.id === espBelQf?.id)) {
    errors.push("ESP/BEL QF not on left half");
  }

  if (errors.length) {
    console.error("FAIL:");
    errors.forEach(e => console.error(" -", e));
    process.exit(1);
  }

  console.log("PASS: winner-based layout aligns all bracket halves");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

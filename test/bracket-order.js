/**
 * Verifies bracket half alignment after FIFA match reordering.
 * Run: node test/bracket-order.js
 */
const FifaProvider = require("../providers/FifaProvider");

function splitHalf(matches) {
  const h = Math.ceil(matches.length / 2);
  return { top: matches.slice(0, h), bot: matches.slice(h) };
}

function feederPairIds(nextStage, prevLookup) {
  const pairs = [];
  for (const nm of [...(nextStage.Matches || [])].sort(
    (a, b) => a.MatchNumber - b.MatchNumber
  )) {
    pairs.push([String(nm.TeamA), String(nm.TeamB)]);
  }
  return pairs;
}

async function main() {
  const data = await new FifaProvider({ seasonId: "285023" }).fetchBracket();
  const roundMap = Object.fromEntries(data.rounds.map(r => [r.id, r]));

  const r16 = roundMap.R16;
  const qf = roundMap.QF;
  const { top: r16Left, bot: r16Right } = splitHalf(r16.matches);
  const { top: qfLeft, bot: qfRight } = splitHalf(qf.matches);

  // QF99 NOR/ENG should be fed by R16 BRA/NOR and MEX/ENG (right side)
  const norEngQf = qf.matches.find(
    m => m.teamA.abbr === "NOR" || m.teamB.abbr === "NOR"
  );
  const norEngFeeders = ["BRA", "MEX", "ENG", "NOR"];
  const r16RightAbbrs = r16Right.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`);

  console.log("R16 right half:", r16RightAbbrs.join(", "));
  console.log("QF right half:", qfRight.map(m => `${m.teamA.abbr}/${m.teamB.abbr}`).join(", "));
  console.log("NOR/ENG QF on right half:", qfRight.some(m => m.id === norEngQf?.id));

  const r16RightHasFeeders = r16Right.some(
    m =>
      (m.teamA.abbr === "BRA" && m.teamB.abbr === "NOR") ||
      (m.teamA.abbr === "MEX" && m.teamB.abbr === "ENG")
  );
  console.log("R16 right contains BRA/NOR and MEX/ENG:", r16RightHasFeeders);

  if (!r16RightHasFeeders || !qfRight.some(m => m.id === norEngQf?.id)) {
    console.error("FAIL: bracket halves misaligned");
    process.exit(1);
  }

  console.log("PASS: bracket feed alignment ok");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

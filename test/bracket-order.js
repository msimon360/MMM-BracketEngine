/**
 * Verifies mirrored bracket layout: every feeder pair and child match
 * must sit on the same bracket half at each stage transition.
 * Run: npm run test:order
 */
const FifaProvider = require("../providers/FifaProvider");
const {
  layoutRoundsForMirroredBracket,
  getSideRounds,
} = require("../schemas/bracket");

function splitHalf(matches) {
  const h = Math.ceil(matches.length / 2);
  return { left: matches.slice(0, h), right: matches.slice(h) };
}

function halfForMatch(matches, matchId) {
  const h = Math.ceil(matches.length / 2);
  const idx = matches.findIndex(m => String(m.id) === String(matchId));
  if (idx < 0) return null;
  return idx < h ? "left" : "right";
}

function checkFeederAlignment(rounds) {
  const side = getSideRounds(rounds);
  const errors = [];

  for (let i = 0; i < side.length - 1; i++) {
    const prev = side[i];
    const next = side[i + 1];

    for (const nextMatch of next.matches) {
      const sources = nextMatch.sources;
      if (!Array.isArray(sources) || sources.length < 2) continue;

      const h0 = halfForMatch(prev.matches, sources[0]);
      const h1 = halfForMatch(prev.matches, sources[1]);
      const hn = halfForMatch(next.matches, nextMatch.id);

      if (!h0 || !h1 || !hn) {
        errors.push(
          `${prev.id}→${next.id}: missing feeder ${nextMatch.id} (${sources})`
        );
        continue;
      }

      if (h0 !== h1 || h0 !== hn) {
        errors.push(
          `${prev.id}→${next.id}: half mismatch for ${nextMatch.id} ` +
            `(feeders ${sources.join(",")} on ${h0}/${h1}, match on ${hn})`
        );
      }
    }
  }

  return errors;
}

async function main() {
  const raw = await new FifaProvider({ seasonId: "285023" }).fetchBracket();
  const rounds = layoutRoundsForMirroredBracket(raw.rounds);
  const roundMap = Object.fromEntries(rounds.map(r => [r.id, r]));

  const r32 = roundMap.R32;
  const { left: r32Left, right: r32Right } = splitHalf(r32.matches);
  const rightFeeders = ["BRA/JPN", "CIV/NOR", "MEX/ECU", "ENG/COD"];
  const wrongOnLeft = r32Left
    .map(m => `${m.teamA.abbr}/${m.teamB.abbr}`)
    .filter(label => rightFeeders.includes(label));

  console.log("R32 right-branch feeders on LEFT:", wrongOnLeft.join(", ") || "(none)");
  console.log(
    "R16 right:",
    splitHalf(roundMap.R16.matches).right
      .map(m => `${m.teamA.abbr}/${m.teamB.abbr}`)
      .join(", ")
  );

  const errors = checkFeederAlignment(rounds);
  if (wrongOnLeft.length) {
    errors.push(`R32 still has right-branch matches on left: ${wrongOnLeft.join(", ")}`);
  }

  if (errors.length) {
    console.error("FAIL:");
    errors.forEach(e => console.error(" -", e));
    process.exit(1);
  }

  console.log("PASS: all feeder pairs align on the same bracket half");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

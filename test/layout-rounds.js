/**
 * Unit tests for generic mirrored-bracket layout (no network).
 * Run: node test/layout-rounds.js
 */
const {
  layoutRoundsForMirroredBracket,
  reorderRoundFromNext,
} = require("../schemas/bracket");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Minimal 4-team bracket: R16 (4) → QF (2) → SF (1) on each half
const rounds = [
  {
    id: "R16",
    name: "Round of 16",
    matches: [
      { id: "m1", status: "final", teamA: { name: "A", abbr: "A" }, teamB: { name: "B", abbr: "B" } },
      { id: "m2", status: "final", teamA: { name: "C", abbr: "C" }, teamB: { name: "D", abbr: "D" } },
      { id: "m3", status: "final", teamA: { name: "E", abbr: "E" }, teamB: { name: "F", abbr: "F" } },
      { id: "m4", status: "final", teamA: { name: "G", abbr: "G" }, teamB: { name: "H", abbr: "H" } },
    ],
  },
  {
    id: "QF",
    name: "Quarter-final",
    matches: [
      {
        id: "q1",
        status: "scheduled",
        sources: ["m3", "m4"],
        teamA: { name: "E", abbr: "E" },
        teamB: { name: "G", abbr: "G" },
      },
      {
        id: "q2",
        status: "scheduled",
        sources: ["m1", "m2"],
        teamA: { name: "A", abbr: "A" },
        teamB: { name: "C", abbr: "C" },
      },
    ],
  },
  {
    id: "SF",
    name: "Semi-final",
    matches: [
      {
        id: "s1",
        status: "scheduled",
        sources: ["q2", "q1"],
        teamA: { name: "TBD", abbr: "TBD" },
        teamB: { name: "TBD", abbr: "TBD" },
      },
    ],
  },
  {
    id: "F",
    name: "Final",
    matches: [
      {
        id: "f1",
        status: "scheduled",
        sources: ["s1"],
        teamA: { name: "TBD", abbr: "TBD" },
        teamB: { name: "TBD", abbr: "TBD" },
      },
    ],
  },
];

const laidOut = layoutRoundsForMirroredBracket(rounds);
const r16 = laidOut.find(r => r.id === "R16");
const qf = laidOut.find(r => r.id === "QF");

assert(
  r16.matches.map(m => m.id).join(",") === "m1,m2,m3,m4",
  `R16 should reorder to m1,m2,m3,m4 but got ${r16.matches.map(m => m.id)}`
);
assert(
  qf.matches.map(m => m.id).join(",") === "q2,q1",
  `QF should reorder to q2,q1 but got ${qf.matches.map(m => m.id)}`
);

const reordered = reorderRoundFromNext(
  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
  [{ id: "a", sources: [3, 4] }, { id: "b", sources: [1, 2] }]
);
assert(
  reordered.map(m => m.id).join(",") === "3,4,1,2",
  "reorderRoundFromNext failed basic case"
);

console.log("layout-rounds: PASS");

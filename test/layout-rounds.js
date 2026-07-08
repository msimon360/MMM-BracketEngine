/**
 * Unit tests for generic mirrored-bracket layout (no network).
 * Run: node test/layout-rounds.js
 */
const {
  layoutRoundsForMirroredBracket,
  reorderRoundFromNext,
  reorderRoundFromPrev,
} = require("../schemas/bracket");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Winners only — no sources field (minimal provider contract)
const rounds = [
  {
    id: "R16",
    name: "Round of 16",
    matches: [
      {
        id: "m1",
        status: "final",
        winner: "A",
        teamA: { name: "A", abbr: "A" },
        teamB: { name: "B", abbr: "B" },
      },
      {
        id: "m2",
        status: "final",
        winner: "C",
        teamA: { name: "C", abbr: "C" },
        teamB: { name: "D", abbr: "D" },
      },
      {
        id: "m3",
        status: "final",
        winner: "E",
        teamA: { name: "E", abbr: "E" },
        teamB: { name: "F", abbr: "F" },
      },
      {
        id: "m4",
        status: "final",
        winner: "G",
        teamA: { name: "G", abbr: "G" },
        teamB: { name: "H", abbr: "H" },
      },
    ],
  },
  {
    id: "QF",
    name: "Quarter-final",
    matches: [
      {
        id: "q2",
        status: "scheduled",
        teamA: { name: "A", abbr: "A" },
        teamB: { name: "C", abbr: "C" },
      },
      {
        id: "q1",
        status: "scheduled",
        teamA: { name: "E", abbr: "E" },
        teamB: { name: "G", abbr: "G" },
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
  [
    { id: 1, winner: "X", teamA: { abbr: "X" }, teamB: { abbr: "Y" } },
    { id: 2, winner: "Z", teamA: { abbr: "Z" }, teamB: { abbr: "W" } },
    { id: 3, winner: "P", teamA: { abbr: "P" }, teamB: { abbr: "Q" } },
    { id: 4, winner: "R", teamA: { abbr: "R" }, teamB: { abbr: "S" } },
  ],
  [
    { id: "a", teamA: { abbr: "P" }, teamB: { abbr: "R" } },
    { id: "b", teamA: { abbr: "X" }, teamB: { abbr: "Z" } },
  ]
);
assert(
  reordered.map(m => m.id).join(",") === "3,4,1,2",
  "reorderRoundFromNext winner inference failed"
);

const qfFromR16 = reorderRoundFromPrev(
  [
    { id: "r1", winner: "FRA", teamA: { abbr: "PAR" }, teamB: { abbr: "FRA" } },
    { id: "r2", winner: "MAR", teamA: { abbr: "CAN" }, teamB: { abbr: "MAR" } },
    { id: "r3", winner: "NOR", teamA: { abbr: "BRA" }, teamB: { abbr: "NOR" } },
    { id: "r4", winner: "ENG", teamA: { abbr: "MEX" }, teamB: { abbr: "ENG" } },
  ],
  [
    { id: "q-left", teamA: { abbr: "FRA" }, teamB: { abbr: "MAR" } },
    { id: "q-right", teamA: { abbr: "NOR" }, teamB: { abbr: "ENG" } },
    { id: "q-left2", teamA: { abbr: "ESP" }, teamB: { abbr: "BEL" } },
    { id: "q-right2", teamA: { abbr: "ARG" }, teamB: { abbr: "SUI" } },
  ]
);
assert(
  qfFromR16[1].id === "q-right",
  `R16 right pair should map to NOR/ENG QF, got ${qfFromR16.map(m => m.id)}`
);

console.log("layout-rounds: PASS");

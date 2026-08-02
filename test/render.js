/**
 * Renderer tests for MMM-BracketEngine.js (offline, no browser).
 *
 * Covers the two frontend defects:
 *  - the grid declared one row fewer than it used, pushing the last match row
 *    outside the equal-height template so parent matches stopped lining up
 *    with the pair of matches feeding them;
 *  - a failed first fetch left the module on "Loading bracket…" with the error
 *    never reaching the screen.
 *
 * Run: node test/render.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { layoutRoundsForMirroredBracket } = require("../schemas/bracket");

let failures = 0;

function fail(msg) {
  failures++;
  console.error(`  FAIL ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

/* ---------------------------------------------------------------- DOM stub */

function createElement(tag) {
  const el = {
    tagName: tag,
    className: "",
    style: {},
    textContent: "",
    innerHTML: "",
    childNodes: [],
    appendChild(child) {
      el.childNodes.push(child);
      return child;
    },
  };
  return el;
}

function walk(el, fn) {
  fn(el);
  for (const child of el.childNodes) walk(child, fn);
}

function findAll(root, className) {
  const out = [];
  walk(root, el => {
    if (typeof el.className === "string" && el.className.split(" ").includes(className)) {
      out.push(el);
    }
  });
  return out;
}

function textOf(el) {
  let out = el.textContent || "";
  out += (el.innerHTML || "").replace(/<[^>]*>/g, "");
  for (const child of el.childNodes) out += textOf(child);
  return out;
}

/* ------------------------------------------------------------ module setup */

function loadModuleDefinition() {
  const src = fs.readFileSync(path.join(__dirname, "..", "MMM-BracketEngine.js"), "utf8");
  let definition = null;
  const sandbox = {
    Module: {
      register(name, def) {
        definition = def;
      },
    },
    Log: { info() {}, error() {}, warn() {} },
    BracketCountryFlags: require("../lib/country-flags"),
    document: { createElement },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "MMM-BracketEngine.js" });
  if (!definition) throw new Error("Module.register was never called");
  return definition;
}

const DEFINITION = loadModuleDefinition();

function makeModule(overrides = {}) {
  const mod = Object.create(DEFINITION);
  mod.name = "MMM-BracketEngine";
  mod.config = JSON.parse(JSON.stringify(DEFINITION.defaults));
  mod.bracket = null;
  mod.loaded = false;
  mod.error = null;
  mod.lastUpdated = null;
  mod.updateDomCalls = 0;
  mod.updateDom = () => {
    mod.updateDomCalls++;
  };
  mod.sendSocketNotification = () => {};
  return Object.assign(mod, overrides);
}

/* -------------------------------------------------------------- test data */

/** Knockout bracket with `teams` entrants and a decided winner in every match. */
function buildBracket(teams) {
  const ids = ["R32", "R16", "QF", "SF", "F"];
  const names = {
    R32: "Round of 32",
    R16: "Round of 16",
    QF: "Quarter-final",
    SF: "Semi-final",
    F: "Final",
  };

  let alive = Array.from({ length: teams }, (_, i) => `T${i + 1}`);
  const rounds = [];
  let matchId = 1;

  while (alive.length > 1) {
    const id = ids[ids.length - Math.log2(alive.length)];
    const matches = [];
    const next = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i];
      const b = alive[i + 1];
      matches.push({
        id: matchId++,
        status: "final",
        date: "Jul 4",
        teamA: { name: a, abbr: a, isPlaceholder: false },
        teamB: { name: b, abbr: b, isPlaceholder: false },
        scoreA: 2,
        scoreB: 1,
        winner: a,
      });
      next.push(a);
    }
    rounds.push({ id, name: names[id], matches });
    alive = next;
  }

  return {
    meta: { title: `${teams}-team bracket`, sport: "soccer", icon: "⚽" },
    rounds: layoutRoundsForMirroredBracket(rounds),
  };
}

/* ------------------------------------------------------------- grid layout */

function parseSpan(gridRow) {
  const m = /^(\d+) \/ span (\d+)$/.exec(gridRow);
  if (!m) return null;
  const start = Number(m[1]);
  const span = Number(m[2]);
  return { start, span, end: start + span - 1 };
}

function checkGrid(label, bracket, expectedMatchRows) {
  const mod = makeModule({ bracket, loaded: true });
  const dom = mod.getDom();
  const halves = findAll(dom, "be-grid-half");

  assert(halves.length === 2, `${label}: expected two grid halves, got ${halves.length}`);

  for (const half of halves) {
    const rows = half.style.gridTemplateRows;
    const expected = `auto repeat(${expectedMatchRows}, 1fr)`;
    if (rows !== expected) {
      fail(`${label}: grid-template-rows is "${rows}", expected "${expected}"`);
      continue;
    }

    // Row 1 is the title row; match rows run 2..1+expectedMatchRows. Anything
    // past that lands in an implicit track that is not part of the template.
    const lastRow = 1 + expectedMatchRows;
    const wraps = findAll(half, "be-match-wrap");
    assert(wraps.length > 0, `${label}: half has no match wraps`);

    for (const wrap of wraps) {
      const span = parseSpan(wrap.style.gridRow);
      if (!span) {
        fail(`${label}: unparseable grid-row "${wrap.style.gridRow}"`);
        continue;
      }
      if (span.start < 2) {
        fail(`${label}: match starts at row ${span.start}, overlapping the title row`);
      }
      if (span.end > lastRow) {
        fail(
          `${label}: match occupies rows ${span.start}–${span.end} but the ` +
            `template only declares ${lastRow} rows`
        );
      }
    }

    // Group wraps by column so each round's placement can be checked.
    const byColumn = new Map();
    for (const wrap of wraps) {
      const col = Number(wrap.style.gridColumn.split(" ")[0]);
      if (!byColumn.has(col)) byColumn.set(col, []);
      byColumn.get(col).push(parseSpan(wrap.style.gridRow));
    }
    for (const spans of byColumn.values()) {
      spans.sort((a, b) => a.start - b.start);
    }

    // Every column must cover exactly the same band of rows, otherwise one
    // round is taller than the next and the halves drift apart.
    for (const [col, spans] of byColumn) {
      assert(
        spans[0].start === 2 && spans[spans.length - 1].end === lastRow,
        `${label}: column ${col} covers rows ${spans[0].start}–${spans[spans.length - 1].end}, ` +
          `expected 2–${lastRow}`
      );
      for (let i = 1; i < spans.length; i++) {
        assert(
          spans[i].start === spans[i - 1].end + 1,
          `${label}: column ${col} has a gap between rows ${spans[i - 1].end} and ${spans[i].start}`
        );
      }
    }

    // A parent match must sit across exactly the rows of the two matches that
    // feed it; that is what puts it level with the midpoint between them.
    const columns = [...byColumn.entries()].sort((a, b) => a[1][0].span - b[1][0].span);
    for (let i = 1; i < columns.length; i++) {
      const feeders = columns[i - 1][1];
      const parents = columns[i][1];
      assert(
        feeders.length === parents.length * 2,
        `${label}: ${parents.length} parents cannot be fed by ${feeders.length} matches`
      );
      parents.forEach((parent, k) => {
        const a = feeders[k * 2];
        const b = feeders[k * 2 + 1];
        if (!a || !b) return;
        assert(
          parent.start === a.start && parent.end === b.end,
          `${label}: parent spans rows ${parent.start}–${parent.end} but its feeders ` +
            `cover ${a.start}–${b.end}`
        );
      });
    }
  }
}

console.log("Grid rows cover the title row plus every match row:");
const placeholder = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "placeholder-bracket.json"), "utf8")
);
placeholder.rounds = layoutRoundsForMirroredBracket(placeholder.rounds);

// Outermost round is R16 with 8 matches, so each half stacks 4 match rows.
checkGrid("16-team placeholder", placeholder, 4);
// R32 with 16 matches -> 8 match rows per half.
checkGrid("32-team bracket", buildBracket(32), 8);
// R16 with 8 matches -> 4 match rows per half.
checkGrid("16-team bracket", buildBracket(16), 4);
// Only SF and F: a single match row per half.
checkGrid("4-team bracket", buildBracket(4), 1);

/* ------------------------------------------------------------ error states */

console.log("A failed first fetch reaches the screen:");
{
  const mod = makeModule();
  mod.socketNotificationReceived("BE_BRACKET_ERROR", "Error: FIFA API HTTP 503");

  assert(mod.loaded === true, "module still considers itself unloaded after an error");
  assert(mod.updateDomCalls === 1, `updateDom called ${mod.updateDomCalls} times, expected 1`);

  const text = textOf(mod.getDom());
  assert(
    !text.includes("Loading bracket"),
    `still showing the loading placeholder: ${JSON.stringify(text)}`
  );
  assert(
    text.includes("FIFA API HTTP 503"),
    `error message missing from the rendered output: ${JSON.stringify(text)}`
  );
}

console.log("An error after a good fetch keeps the bracket on screen:");
{
  const mod = makeModule();
  mod.socketNotificationReceived("BE_BRACKET_RESULT", buildBracket(16));
  const before = mod.updateDomCalls;
  mod.socketNotificationReceived("BE_BRACKET_ERROR", "Error: FIFA API HTTP 503");

  assert(mod.updateDomCalls === before + 1, "error did not trigger a re-render");

  const dom = mod.getDom();
  assert(findAll(dom, "be-match-card").length > 0, "bracket disappeared after an error");
  assert(
    textOf(dom).includes("FIFA API HTTP 503"),
    "error message not shown alongside the stale bracket"
  );
}

console.log("A later success clears the error:");
{
  const mod = makeModule();
  mod.socketNotificationReceived("BE_BRACKET_ERROR", "Error: FIFA API HTTP 503");
  mod.socketNotificationReceived("BE_BRACKET_RESULT", buildBracket(16));

  assert(mod.error === null, "error was not cleared by a successful fetch");
  assert(
    !textOf(mod.getDom()).includes("FIFA API HTTP 503"),
    "stale error still rendered after a successful fetch"
  );
}

if (failures) {
  console.error(`\nrender: FAIL (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("render: PASS");

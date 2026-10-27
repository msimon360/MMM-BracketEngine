/**
 * NCAA Division I basketball tournament provider.
 * Data source: ESPN scoreboard, group 100 (the NCAA Tournament).
 *
 * https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard?dates={YYYYMMDD}&groups=100
 *
 * The feed is one day at a time. March Madness spans the dates on the season
 * calendar from mid-March through mid-April, so fetchBracket() reads that
 * calendar and requests each of those days.
 *
 * The renderer lays out at most five stages, widest at the Round of 32
 * (16 games). This provider therefore keeps the Round of 32, Sweet 16,
 * Elite Eight, Final Four and championship. The First Four and the Round
 * of 64 are used only before any later round has two named teams, so the
 * opening days are not blank and a filled-in later round takes the column
 * the renderer actually has.
 *
 * Team names carry the tournament seed, `(1) Florida`, because the bracket
 * schema has no seed field. School abbreviations that collide with a
 * country code (PUR, UGA, SC) are lengthened so the flag lookup stays blank.
 */
const BaseProvider = require("./BaseProvider");
const { countryFlag } = require("../lib/country-flags");

let _fetch;
try {
  _fetch = fetch;
} catch {
  _fetch = require("node-fetch");
}

const LEAGUES = {
  men: {
    slug: "mens-college-basketball",
    title: "NCAA Men's Basketball",
  },
  women: {
    slug: "womens-college-basketball",
    title: "NCAA Women's Basketball",
  },
};

/** ESPN's group id for the NCAA Tournament (men's and women's). */
const TOURNAMENT_GROUP = "100";

/**
 * Rounds the engine can lay out, earliest → latest. `keys` match the last
 * segment of an ESPN note such as "Men's Basketball Championship - East
 * Region - Sweet 16" or "NCAA Women's Championship - National Championship".
 */
const MAIN_ROUNDS = [
  { id: "R32", name: "2nd Round", keys: ["2nd round", "second round", "round of 32"] },
  { id: "R16", name: "Sweet 16", keys: ["sweet 16", "sweet sixteen"] },
  { id: "QF", name: "Elite 8", keys: ["elite 8", "elite eight"] },
  { id: "SF", name: "Final Four", keys: ["final four"] },
  { id: "F", name: "Championship", keys: ["national championship", "championship", "championship game"] },
];

/** Shown only when no later round has a set matchup yet. */
const FALLBACK_ROUNDS = [
  { id: "R64", name: "1st Round", keys: ["1st round", "first round", "round of 64"] },
  { id: "FF", name: "First Four", keys: ["first four"] },
];

const ALL_ROUNDS = [...FALLBACK_ROUNDS, ...MAIN_ROUNDS];

/** Men's regions, in the order a bracket usually reads top to bottom. */
const REGION_ORDER = ["south region", "east region", "west region", "midwest region"];

class NcaaProvider extends BaseProvider {
  get name() {
    return "ncaa";
  }

  get gender() {
    const value = String(this.config.gender || "men").trim().toLowerCase();
    if (value !== "men" && value !== "women") {
      throw new Error(
        `NCAA provider gender must be "men" or "women" (got ${JSON.stringify(this.config.gender)})`
      );
    }
    return value;
  }

  get year() {
    return String(this.config.year || new Date().getFullYear());
  }

  get league() {
    return LEAGUES[this.gender];
  }

  get tournamentName() {
    return this.league.title;
  }

  /** @param {string} date YYYYMMDD */
  scoreboardUrl(date) {
    return (
      "https://site.api.espn.com/apis/site/v2/sports/basketball/" +
      `${this.league.slug}/scoreboard?dates=${date}&groups=${TOURNAMENT_GROUP}&limit=100`
    );
  }

  buildTitle() {
    if (this.config.title) return this.config.title;
    return `${this.tournamentName} ${this.year}`;
  }

  /**
   * March 12 through April 16 covers the First Four through the championship.
   * Dates are taken from the season calendar when ESPN sends one, so
   * conference-tournament days in early March are not requested.
   *
   * @param {object} [scoreboard] A scoreboard payload whose league calendar
   *   lists the season's dates. Without one, every day in the window is used.
   * @returns {string[]} YYYYMMDD
   */
  tournamentDates(scoreboard) {
    const year = this.year;
    const start = `${year}-03-12`;
    const end = `${year}-04-16`;
    const calendar = scoreboard?.leagues?.[0]?.calendar;

    if (Array.isArray(calendar) && calendar.length) {
      const dates = calendar
        .map(value => String(value).slice(0, 10))
        .filter(day => day >= start && day <= end)
        .map(day => day.replace(/-/g, ""));
      const unique = [...new Set(dates)].filter(day => /^\d{8}$/.test(day));
      if (unique.length) return unique;
    }

    const dates = [];
    for (const [month, last] of [[3, 31], [4, 16]]) {
      const first = month === 3 ? 12 : 1;
      for (let day = first; day <= last; day++) {
        dates.push(
          `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`
        );
      }
    }
    return dates;
  }

  async fetchBracket() {
    const data = this.config.url
      ? await this.fetchJson(this.config.url)
      : await this.fetchTournament();
    const rounds = this.parseBracket(data);

    if (!rounds.length) {
      throw new Error(`${this.tournamentName} has no rounds to display`);
    }

    return {
      meta: {
        title: this.buildTitle(),
        sport: "basketball",
        icon: "🏀",
        updatedAt: new Date().toISOString(),
      },
      rounds,
    };
  }

  async fetchTournament() {
    const probeDate = `${this.year}0321`;
    const probe = await this.fetchJson(this.scoreboardUrl(probeDate));
    const dates = this.tournamentDates(probe).filter(date => date !== probeDate);
    const pages = await Promise.all(
      dates.map(date => this.fetchJson(this.scoreboardUrl(date)))
    );

    return {
      events: [
        ...(probe.events || []),
        ...pages.flatMap(page => page.events || []),
      ],
    };
  }

  async fetchJson(url) {
    const res = await _fetch(url, {
      headers: {
        "User-Agent": "MagicMirror/MMM-BracketEngine",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`NCAA feed HTTP ${res.status}`);
    }

    return res.json();
  }

  parseBracket(data) {
    const grouped = new Map();
    for (const event of dedupeEvents(data?.events || [])) {
      const def = classifyRound(roundLabel(event));
      if (!def) continue;
      if (!grouped.has(def.id)) grouped.set(def.id, []);
      grouped.get(def.id).push(event);
    }

    const main = MAIN_ROUNDS
      .filter(def => (grouped.get(def.id) || []).some(event => namedSideCount(event) >= 2))
      .map(def => this.buildRound(def, grouped.get(def.id)));

    if (main.length) return main;

    for (const def of FALLBACK_ROUNDS) {
      const games = grouped.get(def.id) || [];
      if (games.some(event => namedSideCount(event) >= 1)) {
        return [this.buildRound({ id: "R32", name: def.name }, games)];
      }
    }

    return [];
  }

  buildRound(def, events) {
    const matches = [...events]
      .sort(compareEvents)
      .map(event => this.parseMatch(event));

    return { id: def.id, name: def.name, matches };
  }

  parseMatch(event) {
    const comp = event.competitions?.[0] || {};
    const status = parseStatus(event);
    const sides = [...(comp.competitors || [])].sort(compareSides);
    while (sides.length < 2) sides.push(null);

    const teamA = parseSide(sides[0]);
    const teamB = parseSide(sides[1]);
    const scoreA = parseScore(sides[0], status);
    const scoreB = parseScore(sides[1], status);

    return {
      id: event.id,
      status,
      date: event.date
        ? new Date(event.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : null,
      teamA,
      teamB,
      scoreA,
      scoreB,
      winner: parseWinner(
        [sides[0], sides[1]],
        [teamA, teamB],
        [scoreA, scoreB],
        status
      ),
    };
  }
}

function roundLabel(event) {
  const notes = event?.competitions?.[0]?.notes || [];
  for (const note of notes) {
    const headline = note?.headline;
    if (!headline) continue;
    const label = String(headline).split(/\s+-\s+/).pop().trim();
    if (classifyRound(label)) return label;
  }
  return "";
}

function classifyRound(label) {
  const key = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key) return null;
  return ALL_ROUNDS.find(def => def.keys.includes(key)) || null;
}

function regionName(event) {
  const headline = event?.competitions?.[0]?.notes?.find(note => note?.headline)?.headline;
  if (!headline) return "";
  const parts = String(headline).split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 2] : "";
}

function compareEvents(a, b) {
  const regionA = regionName(a);
  const regionB = regionName(b);
  const rankA = regionRank(regionA);
  const rankB = regionRank(regionB);
  if (rankA !== rankB) return rankA - rankB;
  if (regionA !== regionB) return regionA.localeCompare(regionB);
  const whenA = a.date || "";
  const whenB = b.date || "";
  if (whenA !== whenB) return whenA < whenB ? -1 : 1;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

function regionRank(region) {
  const idx = REGION_ORDER.indexOf(String(region || "").toLowerCase());
  return idx === -1 ? REGION_ORDER.length : idx;
}

function namedSideCount(event) {
  const competitors = event?.competitions?.[0]?.competitors || [];
  return competitors.filter(side => schoolAbbr(side?.team)).length;
}

function compareSides(a, b) {
  const seedA = seedOf(a);
  const seedB = seedOf(b);
  if (seedA !== seedB) return seedA - seedB;
  return (a?.order ?? 0) - (b?.order ?? 0);
}

/** Tournament seed, or 99 when the feed has none so named seeds sort first. */
function seedOf(competitor) {
  const seed = Number(competitor?.curatedRank?.current);
  return Number.isInteger(seed) && seed >= 1 && seed <= 16 ? seed : 99;
}

function parseSide(competitor) {
  const abbr = schoolAbbr(competitor?.team);
  if (!abbr) {
    return { name: "TBD", abbr: "TBD", isPlaceholder: true };
  }

  const team = competitor.team;
  const base = team.shortDisplayName || team.displayName || team.location || abbr;
  const seed = seedOf(competitor);
  return {
    name: seed === 99 ? base : `(${seed}) ${base}`,
    abbr,
    isPlaceholder: false,
  };
}

/**
 * ESPN abbreviations are stable across rounds, which is what advancement
 * matching needs, but a few of them are also country codes. Those are
 * rewritten from the school name so the renderer does not paint a flag.
 */
function schoolAbbr(team) {
  if (!team) return null;
  const raw = String(team.abbreviation || "").trim();
  const short = String(
    team.shortDisplayName || team.displayName || team.location || ""
  ).trim();
  if (/^tbd$/i.test(raw) || /^tbd$/i.test(short) || (!raw && !short)) return null;

  const abbr = raw || letters(short).slice(0, 8);
  if (!abbr) return null;
  if (!countryFlag(abbr)) return abbr;

  const fromName = letters(short);
  if (fromName.length >= 4) return fromName.slice(0, 8);
  return `${letters(raw) || "TEAM"}BB`.slice(0, 8);
}

function letters(value) {
  return String(value || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function parseStatus(event) {
  const type = event?.status?.type || {};
  if (type.state === "in") return "live";
  if (type.state === "post" || type.completed === true) return "final";
  return "scheduled";
}

function parseScore(competitor, status) {
  if (status === "scheduled" || competitor?.score == null || competitor.score === "") {
    return null;
  }
  const score = Number(competitor.score);
  return Number.isFinite(score) ? score : null;
}

function parseWinner(sides, teams, scores, status) {
  if (status !== "final") return null;

  for (let i = 0; i < sides.length; i++) {
    if (sides[i]?.winner === true && teams[i] && !teams[i].isPlaceholder) {
      return teams[i].abbr;
    }
  }

  if (scores[0] != null && scores[1] != null && scores[0] !== scores[1]) {
    const i = scores[0] > scores[1] ? 0 : 1;
    return teams[i].isPlaceholder ? null : teams[i].abbr;
  }

  return null;
}

function dedupeEvents(events) {
  const seen = new Set();
  const unique = [];
  for (const event of events) {
    if (!event) continue;
    const key = event.id == null ? null : String(event.id);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    unique.push(event);
  }
  return unique;
}

module.exports = NcaaProvider;

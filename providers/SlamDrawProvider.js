/**
 * Shared parsing for the Grand Slam draw feed format.
 *
 * Wimbledon and the US Open publish byte-compatible draw feeds — the same
 * `matches` array keyed by `roundCode`, the same `team1`/`team2` shape, the
 * same status codes — so everything except the host, the draw codes and the
 * tournament name lives here.
 *
 * Subclasses supply feedUrl(), tournamentName and drawLabels.
 */
const BaseProvider = require("./BaseProvider");
const { countryFlag } = require("../lib/country-flags");

let _fetch;
try {
  _fetch = fetch;
} catch {
  _fetch = require("node-fetch");
}

/** Feed round codes, earliest → latest. */
const ROUND_SEQUENCE = ["1", "2", "3", "4", "Q", "S", "F"];

/** Engine round ids, largest stage → final. The renderer has no wider column. */
const ENGINE_ROUND_IDS = ["R32", "R16", "QF", "SF", "F"];

class SlamDrawProvider extends BaseProvider {
  static ROUND_SEQUENCE = ROUND_SEQUENCE;
  static ENGINE_ROUND_IDS = ENGINE_ROUND_IDS;

  /** @returns {string} Tournament name used in the bracket header. */
  get tournamentName() {
    throw new Error(`Provider "${this.name}" does not define tournamentName`);
  }

  /** @returns {Record<string, string>} Draw code → human label. */
  get drawLabels() {
    return {};
  }

  /**
   * Draw code → the feed round a draw should start from. Optional: without an
   * entry the provider shows the latest rounds the renderer can fit, which
   * adapts when a draw changes size between years.
   *
   * @returns {Record<string, string>}
   */
  get defaultFromRound() {
    return {};
  }

  /** @param {string} drawCode @param {string} year */
  feedUrl(drawCode, year) {
    throw new Error(`Provider "${this.name}" does not define feedUrl()`);
  }

  get year() {
    return String(this.config.year || new Date().getFullYear());
  }

  get drawCode() {
    return (this.config.drawCode || "MS").toUpperCase();
  }

  get fromRoundCode() {
    return String(
      this.config.fromRoundCode || this.defaultFromRound[this.drawCode] || ""
    );
  }

  get bracketUrl() {
    return this.config.url || this.feedUrl(this.drawCode, this.year);
  }

  get drawLabel() {
    return this.drawLabels[this.drawCode] || "";
  }

  async fetchBracket() {
    const res = await _fetch(this.bracketUrl, {
      headers: {
        "User-Agent": "MagicMirror/MMM-BracketEngine",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`${this.tournamentName} feed HTTP ${res.status}`);
    }

    const data = await res.json();
    const rounds = this.parseBracket(data);

    if (!rounds.length) {
      throw new Error(`${this.tournamentName} draw has no rounds to display`);
    }

    return {
      meta: {
        title: this.buildTitle(data),
        sport: "tennis",
        icon: "🎾",
        updatedAt: new Date().toISOString(),
      },
      rounds,
    };
  }

  buildTitle(data) {
    if (this.config.title) return this.config.title;
    const label = this.drawLabel || data?.eventName || "";
    return `${this.tournamentName} ${this.year} ${label}`.trim();
  }

  parseBracket(data) {
    const matches = [...(data.matches || [])].sort(
      (a, b) => Number(a.match_id) - Number(b.match_id)
    );

    const byCode = new Map();
    for (const match of matches) {
      const code = match.roundCode;
      if (!byCode.has(code)) {
        byCode.set(code, { code, name: match.roundName, matches: [] });
      }
      byCode.get(code).matches.push(match);
    }

    const startIdx = ROUND_SEQUENCE.indexOf(this.fromRoundCode);
    const includedCodes =
      startIdx >= 0 ? ROUND_SEQUENCE.slice(startIdx) : ROUND_SEQUENCE;

    const feedRounds = includedCodes
      .filter(code => byCode.has(code))
      .map(code => byCode.get(code));

    if (!feedRounds.length) return [];

    // The engine can name at most five stages (R32 → F). Draws that begin
    // earlier — a 128-player singles draw from the First Round, say — supply
    // more feed rounds than there are ids, so keep the latest stages and drop
    // the earliest instead of running off the front of ENGINE_ROUND_IDS.
    const renderable = feedRounds.slice(-ENGINE_ROUND_IDS.length);
    const idOffset = ENGINE_ROUND_IDS.length - renderable.length;

    return renderable.map((round, index) => ({
      id: ENGINE_ROUND_IDS[idOffset + index],
      name: round.name,
      matches: round.matches.map(m => this.parseMatch(m)),
    }));
  }

  parseMatch(match) {
    const teamA = this.parseSide(match.team1);
    const teamB = this.parseSide(match.team2);
    const status = this.parseStatus(match);

    const dateStr = match.epoch
      ? new Date(match.epoch).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;

    const played = status === "final" || status === "live";

    return {
      id: match.match_id,
      status,
      date: dateStr,
      teamA,
      teamB,
      scoreA: played ? match.team1?.totalSetsWon ?? null : null,
      scoreB: played ? match.team2?.totalSetsWon ?? null : null,
      winner: this.parseWinner(match, teamA, teamB),
    };
  }

  parseSide(side) {
    if (!side?.displayNameA) {
      return { name: "TBD", abbr: "TBD", isPlaceholder: true };
    }

    const singles = !side.displayNameB;
    const name = singles
      ? `${side.firstNameA || ""} ${side.lastNameA || ""}`.trim() ||
        side.displayNameA
      : `${side.displayNameA} / ${side.displayNameB}`;

    const abbr = singles
      ? (side.lastNameA || side.displayNameA || "TBD")
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 8)
          .toUpperCase()
      : `${this.playerLastAbbr(side, "A")}/${this.playerLastAbbr(side, "B")}`;

    return {
      name,
      abbr,
      flag: this.nationFlag(side.nationA),
      isPlaceholder: false,
    };
  }

  playerLastAbbr(side, slot = "A") {
    const last = slot === "A" ? side.lastNameA : side.lastNameB;
    const display = slot === "A" ? side.displayNameA : side.displayNameB;
    const source = last || display || "TBD";
    return source.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase();
  }

  nationFlag(nation) {
    return countryFlag(nation);
  }

  parseStatus(match) {
    const code = (match.statusCode || "").toUpperCase();
    const text = (match.status || "").toLowerCase();
    if (code === "L" || text.includes("live")) return "live";
    if (code === "D" || text.includes("complete")) return "final";
    return "scheduled";
  }

  parseWinner(match, teamA, teamB) {
    if (String(match.winner) === "1") return teamA.abbr;
    if (String(match.winner) === "2") return teamB.abbr;
    return null;
  }
}

module.exports = SlamDrawProvider;

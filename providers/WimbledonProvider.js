/**
 * Wimbledon draw provider.
 * Data source: https://www.wimbledon.com/en_GB/scores/feeds/{year}/draws/{drawCode}.json
 *
 * drawCode: MS, LS, MD, LD, XD
 */
const BaseProvider = require("./BaseProvider");
const { countryFlag } = require("../lib/country-flags");

let _fetch;
try {
  _fetch = fetch;
} catch {
  _fetch = require("node-fetch");
}

const DRAW_LABELS = {
  MS: "Gentlemen's Singles",
  LS: "Ladies' Singles",
  MD: "Gentlemen's Doubles",
  LD: "Ladies' Doubles",
  XD: "Mixed Doubles",
};

/** Wimbledon feed round order (earliest → latest). */
const ROUND_SEQUENCE = ["1", "2", "3", "4", "Q", "S", "F"];

/** Map remaining rounds to engine ids by count (largest stage first). */
const ENGINE_ROUND_IDS = ["R32", "R16", "QF", "SF", "F"];

const DEFAULT_FROM_ROUND = {
  MS: "3",
  LS: "3",
  MD: "2",
  LD: "2",
  XD: "2",
};

class WimbledonProvider extends BaseProvider {
  get name() {
    return "wimbledon";
  }

  get year() {
    return String(this.config.year || "2025");
  }

  get drawCode() {
    return (this.config.drawCode || "MS").toUpperCase();
  }

  get fromRoundCode() {
    return String(
      this.config.fromRoundCode ||
        DEFAULT_FROM_ROUND[this.drawCode] ||
        "3"
    );
  }

  get bracketUrl() {
    return (
      this.config.url ||
      `https://www.wimbledon.com/en_GB/scores/feeds/${this.year}/draws/${this.drawCode}.json`
    );
  }

  async fetchBracket() {
    const res = await _fetch(this.bracketUrl, {
      headers: {
        "User-Agent": "MagicMirror/MMM-BracketEngine",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Wimbledon feed HTTP ${res.status}`);
    }

    const data = await res.json();
    const rounds = this.parseBracket(data);

    if (!rounds.length) {
      throw new Error("Wimbledon draw has no rounds to display");
    }

    return {
      meta: {
        title:
          this.config.title ||
          `Wimbledon ${this.year} ${DRAW_LABELS[this.drawCode] || data.eventName}`,
        sport: "tennis",
        icon: "🎾",
        updatedAt: new Date().toISOString(),
      },
      rounds,
    };
  }

  parseBracket(data) {
    const matches = [...(data.matches || [])].sort(
      (a, b) => Number(a.match_id) - Number(b.match_id)
    );

    const byCode = new Map();
    for (const match of matches) {
      const code = match.roundCode;
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          name: match.roundName,
          matches: [],
        });
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

    const idOffset = ENGINE_ROUND_IDS.length - feedRounds.length;
    return feedRounds.map((round, index) => ({
      id: ENGINE_ROUND_IDS[idOffset + index],
      name: round.name,
      matches: round.matches.map(m => this.parseMatch(m)),
    }));
  }

  parseMatch(match) {
    const teamA = this.parseSide(match.team1);
    const teamB = this.parseSide(match.team2);
    const status = this.parseStatus(match);
    const winner = this.parseWinner(match, teamA, teamB);

    const dateStr = match.epoch
      ? new Date(match.epoch).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;

    return {
      id: match.match_id,
      status,
      date: dateStr,
      teamA,
      teamB,
      scoreA:
        status === "final" || status === "live"
          ? match.team1?.totalSetsWon ?? null
          : null,
      scoreB:
        status === "final" || status === "live"
          ? match.team2?.totalSetsWon ?? null
          : null,
      winner,
    };
  }

  parseSide(side) {
    if (!side?.displayNameA) {
      return {
        name: "TBD",
        abbr: "TBD",
        isPlaceholder: true,
      };
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
    if (match.winner === "1") return teamA.abbr;
    if (match.winner === "2") return teamB.abbr;
    return null;
  }
}

module.exports = WimbledonProvider;

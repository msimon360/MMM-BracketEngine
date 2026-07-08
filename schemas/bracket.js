/**
 * Common bracket data contract for MMM-BracketEngine.
 * All providers must normalize their API output to this shape.
 */

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "3RD", "F"];

const VALID_STATUSES = new Set(["scheduled", "live", "final"]);

const ROUND_LABELS = {
  R32: "Rd of 32",
  R16: "Rd of 16",
  QF: "Quarters",
  SF: "Semis",
  "3RD": "3rd Place",
  F: "Final",
  R8: "Rd of 8",
  R4: "Semis",
};

const SPORT_ICONS = {
  soccer: "⚽",
  hockey: "🏒",
  basketball: "🏀",
  football: "🏈",
  baseball: "⚾",
  tennis: "🎾",
  generic: "🏆",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateTeam(team, path) {
  const errors = [];
  if (!isObject(team)) {
    errors.push(`${path}: team must be an object`);
    return errors;
  }
  if (typeof team.name !== "string" || !team.name) {
    errors.push(`${path}.name: required string`);
  }
  if (typeof team.abbr !== "string" || !team.abbr) {
    errors.push(`${path}.abbr: required string`);
  }
  return errors;
}

function validateMatch(match, path) {
  const errors = [];
  if (!isObject(match)) {
    errors.push(`${path}: match must be an object`);
    return errors;
  }
  if (match.id === undefined || match.id === null) {
    errors.push(`${path}.id: required`);
  }
  if (!VALID_STATUSES.has(match.status)) {
    errors.push(`${path}.status: must be scheduled, live, or final`);
  }
  errors.push(...validateTeam(match.teamA, `${path}.teamA`));
  errors.push(...validateTeam(match.teamB, `${path}.teamB`));
  return errors;
}

function validateRound(round, path) {
  const errors = [];
  if (!isObject(round)) {
    errors.push(`${path}: round must be an object`);
    return errors;
  }
  if (typeof round.id !== "string" || !round.id) {
    errors.push(`${path}.id: required string`);
  }
  if (typeof round.name !== "string" || !round.name) {
    errors.push(`${path}.name: required string`);
  }
  if (!Array.isArray(round.matches)) {
    errors.push(`${path}.matches: must be an array`);
    return errors;
  }
  round.matches.forEach((match, i) => {
    errors.push(...validateMatch(match, `${path}.matches[${i}]`));
  });
  return errors;
}

/**
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBracket(payload) {
  const errors = [];

  if (!isObject(payload)) {
    return { valid: false, errors: ["payload must be an object"] };
  }

  if (!isObject(payload.meta)) {
    errors.push("meta: required object");
  } else {
    if (typeof payload.meta.title !== "string" || !payload.meta.title) {
      errors.push("meta.title: required string");
    }
    if (typeof payload.meta.sport !== "string" || !payload.meta.sport) {
      errors.push("meta.sport: required string");
    }
  }

  if (!Array.isArray(payload.rounds) || payload.rounds.length === 0) {
    errors.push("rounds: required non-empty array");
  } else {
    payload.rounds.forEach((round, i) => {
      errors.push(...validateRound(round, `rounds[${i}]`));
    });
  }

  return { valid: errors.length === 0, errors };
}

function sortRounds(rounds) {
  const order = new Map(ROUND_ORDER.map((id, i) => [id, i]));
  return [...rounds].sort((a, b) => {
    const ai = order.has(a.id) ? order.get(a.id) : 999;
    const bi = order.has(b.id) ? order.get(b.id) : 999;
    return ai - bi;
  });
}

function getSideRounds(rounds) {
  return sortRounds(rounds).filter(r => r.id !== "F" && r.id !== "3RD");
}

function getRoundLabel(id) {
  return ROUND_LABELS[id] || id;
}

function getSportIcon(sport) {
  return SPORT_ICONS[sport] || SPORT_ICONS.generic;
}

function isKnownTeam(abbr) {
  return (
    typeof abbr === "string" &&
    abbr.length > 0 &&
    abbr !== "TBD" &&
    !/^(W|RU)\d+/i.test(abbr)
  );
}

function advancingTeams(match) {
  if (match.winner) return [match.winner];
  return [match.teamA?.abbr, match.teamB?.abbr].filter(isKnownTeam);
}

function knownTeamsInMatch(match) {
  return [match.teamA?.abbr, match.teamB?.abbr].filter(isKnownTeam);
}

function prevMatchFeedsNext(prevMatch, nextMatch) {
  const advancing = new Set(advancingTeams(prevMatch));
  return knownTeamsInMatch(nextMatch).some(abbr => advancing.has(abbr));
}

function inferFeederMatches(prevMatches, nextMatch) {
  if (Array.isArray(nextMatch.sources) && nextMatch.sources.length >= 2) {
    return nextMatch.sources
      .map(id => prevMatches.find(m => String(m.id) === String(id)))
      .filter(Boolean);
  }

  const targets = knownTeamsInMatch(nextMatch);
  if (targets.length < 2) return [];

  const feeders = [];
  const picked = new Set();
  for (const abbr of targets) {
    const feeder = prevMatches.find(m => {
      const key = String(m.id);
      if (picked.has(key)) return false;
      return advancingTeams(m).includes(abbr);
    });
    if (feeder) {
      feeders.push(feeder);
      picked.add(String(feeder.id));
    }
  }
  return feeders;
}

/**
 * Reorder an earlier round's match list for mirrored layout.
 * Uses a later round's listed participants to find feeder matches in the
 * previous round (bracket still advances R16 → QF, not the other way around).
 */
function reorderRoundFromNext(currentMatches, nextMatches) {
  if (!currentMatches?.length || !nextMatches?.length) return currentMatches;

  const used = new Set();
  const ordered = [];

  for (const nextMatch of nextMatches) {
    for (const feeder of inferFeederMatches(currentMatches, nextMatch)) {
      const key = String(feeder.id);
      if (used.has(key)) continue;
      ordered.push(feeder);
      used.add(key);
    }
  }

  return ordered.length === currentMatches.length ? ordered : currentMatches;
}

/**
 * Reorder a later round's match list from paired results in the previous round
 * (bracket flow: R16 winners feed QF slots).
 */
function reorderRoundFromPrev(prevMatches, nextMatches) {
  if (!prevMatches?.length || !nextMatches?.length) return nextMatches;

  const ordered = [];
  const used = new Set();
  const half = Math.ceil(prevMatches.length / 2);

  for (const segment of [
    prevMatches.slice(0, half),
    prevMatches.slice(half),
  ]) {
    for (let i = 0; i < segment.length; i += 2) {
      const feederA = segment[i];
      const feederB = segment[i + 1];
      if (!feederA || !feederB) continue;

      const nextMatch = nextMatches.find(nm => {
        if (used.has(String(nm.id))) return false;
        return (
          prevMatchFeedsNext(feederA, nm) && prevMatchFeedsNext(feederB, nm)
        );
      });

      if (nextMatch) {
        ordered.push(nextMatch);
        used.add(String(nextMatch.id));
      }
    }
  }

  if (ordered.length === 0) return nextMatches;

  for (const nm of nextMatches) {
    if (!used.has(String(nm.id))) ordered.push(nm);
  }

  return ordered.length === nextMatches.length ? ordered : nextMatches;
}

/**
 * Lay out side-round matches for the mirrored bracket renderer.
 *
 * Bracket flow is outside-in (R32 → R16 → QF → SF → F). Layout runs the
 * opposite direction for sorting only: when a later round lists its teams,
 * reorder the previous round so feeder pairs share a bracket half.
 *
 * Example: once QF lists NOR vs ENG, reorder R16 (not "build R16 from QF").
 */
function layoutRoundsForMirroredBracket(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return rounds;

  const sorted = sortRounds(rounds);
  const byId = new Map(
    sorted.map(round => [round.id, { ...round, matches: [...round.matches] }])
  );
  const side = getSideRounds(sorted);

  if (side.length === 0) return sorted.map(r => byId.get(r.id));

  const finalRound = byId.get("F");
  if (finalRound) {
    const lastSide = byId.get(side[side.length - 1].id);
    lastSide.matches = reorderRoundFromNext(
      lastSide.matches,
      finalRound.matches
    );
  }

  for (let i = side.length - 2; i >= 0; i--) {
    const prev = byId.get(side[i].id);
    const next = byId.get(side[i + 1].id);
    prev.matches = reorderRoundFromNext(prev.matches, next.matches);
  }

  return sorted.map(round => byId.get(round.id));
}

module.exports = {
  ROUND_ORDER,
  ROUND_LABELS,
  SPORT_ICONS,
  validateBracket,
  sortRounds,
  getSideRounds,
  getRoundLabel,
  getSportIcon,
  reorderRoundFromNext,
  reorderRoundFromPrev,
  layoutRoundsForMirroredBracket,
};

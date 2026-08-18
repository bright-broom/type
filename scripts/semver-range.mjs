/**
 * Minimal semver range satisfaction for peer-range checking.
 *
 * The project pins every dependency to an exact version, so the only ranges that
 * need interpreting are the peer ranges published by those packages. Supporting
 * that subset keeps the compatibility check dependency-free; anything it cannot
 * parse is reported rather than silently treated as satisfied.
 */

const COMPARATOR = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/;

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function part(value) {
  return value === undefined || value === "x" || value === "*" ? 0 : Number(value);
}

/** Expand one comparator into an inclusive lower and exclusive upper bound. */
function bounds(comparator) {
  const match = COMPARATOR.exec(comparator.trim());
  if (!match) return null;
  const [, operator, major, minor, patch] = match;
  const version = [Number(major), part(minor), part(patch)];
  const looseMinor = minor === undefined || minor === "x" || minor === "*";

  switch (operator) {
    case "^":
      return { from: version, to: version[0] === 0 && !looseMinor ? [0, version[1] + 1, 0] : [version[0] + 1, 0, 0] };
    case "~":
      return { from: version, to: looseMinor ? [version[0] + 1, 0, 0] : [version[0], version[1] + 1, 0] };
    case ">=":
      return { from: version, to: null };
    case ">":
      return { from: version, to: null, exclusiveFrom: true };
    case "<=":
      return { from: null, to: version, inclusiveTo: true };
    case "<":
      return { from: null, to: version };
    default:
      return looseMinor ? { from: version, to: [version[0] + 1, 0, 0] } : { from: version, to: null, exact: version };
  }
}

function satisfiesComparator(version, comparator) {
  const bound = bounds(comparator);
  if (!bound) return null;
  if (bound.exact) return compare(version, bound.exact) === 0;
  if (bound.from) {
    const order = compare(version, bound.from);
    if (order < 0 || (order === 0 && bound.exclusiveFrom)) return false;
  }
  if (bound.to) {
    const order = compare(version, bound.to);
    if (order > 0 || (order === 0 && !bound.inclusiveTo)) return false;
  }
  return true;
}

/**
 * True when `version` satisfies `range`, false when it does not, and null when the
 * range uses syntax this checker does not model.
 */
export function satisfies(version, range) {
  const parsed = parseVersion(version);
  if (!parsed) return null;
  const trimmed = range.trim();
  if (trimmed === "" || trimmed === "*" || trimmed === "x") return true;

  let unknown = false;
  for (const alternative of trimmed.split("||")) {
    const comparators = alternative.trim().split(/\s+/).filter(Boolean);
    if (comparators.length === 0) continue;
    const results = comparators.map((comparator) => satisfiesComparator(parsed, comparator));
    if (results.includes(null)) {
      unknown = true;
      continue;
    }
    if (results.every(Boolean)) return true;
  }
  return unknown ? null : false;
}

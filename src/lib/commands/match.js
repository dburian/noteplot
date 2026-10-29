/**
 * @typedef {import('./registry.js').Command} Command
 * @typedef {{command: Command, score: number}} CommandMatch
 */

/**
 * Ranking bands. A prefix match beats a word-boundary match beats a plain
 * substring beats a scattered subsequence, and the position of the hit breaks
 * ties inside a band — so "co" puts "Cycle layout" above "Toggle connections".
 */
const PREFIX = 1000;
const WORD = 800;
const SUBSTRING = 600;
const SUBSEQUENCE = 400;

/** A keyword hit is a real hit, but a title hit of the same shape wins. */
const KEYWORD_PENALTY = 150;

/**
 * **`description` is deliberately not scored.** The palette rows show one, but
 * matching against a sentence of prose floods the SUBSTRING and SUBSEQUENCE
 * bands — nearly every command contains "the" somewhere — and the ranking a
 * dozen hand-written titles and keywords was tuned for stops meaning anything.
 * Descriptions are there to be read, not searched.
 */

/**
 * Score one string against one needle. `0` means no match at all.
 *
 * Deliberately hand-rolled: this runs over a dozen static strings, and
 * `minisearch` is a stemming full-text index with an async build. (`flexsearch`
 * used to sit in `package.json`, imported nowhere; it was removed rather than
 * pressed into service here.)
 *
 * @param {string} haystack
 * @param {string} needle lower-cased and non-empty
 * @returns {number}
 */
function scoreText(haystack, needle) {
  const text = haystack.toLowerCase();

  const at = text.indexOf(needle);
  if (at === 0) return PREFIX;
  if (at > 0) return (text[at - 1] === ' ' ? WORD : SUBSTRING) - at;

  // Every character of the needle, in order, anywhere. Each break in the run
  // costs a little, so a tightly clustered match outranks a scattered one.
  let want = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < text.length && want < needle.length; i++) {
    if (text[i] !== needle[want]) continue;
    if (last >= 0 && i !== last + 1) gaps++;
    last = i;
    want++;
  }
  if (want < needle.length) return 0;

  return Math.max(SUBSEQUENCE - gaps * 10, 1);
}

/**
 * @param {Command} command
 * @param {string} needle lower-cased and non-empty
 * @returns {number}
 */
function scoreCommand(command, needle) {
  let best = scoreText(command.title, needle);
  for (const keyword of command.keywords ?? []) {
    const score = scoreText(keyword, needle);
    if (score > 0) best = Math.max(best, score - KEYWORD_PENALTY);
  }
  return best;
}

/**
 * Rank `commands` against what has been typed. An empty query returns every
 * command in registry order — the palette opens as a menu of everything it can
 * do, which is half of what it is for.
 *
 * `sort` is stable, so commands that score the same keep their registry order.
 *
 * @param {Command[]} commands
 * @param {string} queryString
 * @returns {CommandMatch[]}
 */
export function matchCommands(commands, queryString) {
  const needle = queryString.trim().toLowerCase();
  if (needle === '') return commands.map((command) => ({ command, score: 0 }));

  /** @type {CommandMatch[]} */
  const matches = [];
  for (const command of commands) {
    const score = scoreCommand(command, needle);
    if (score > 0) matches.push({ command, score });
  }

  return matches.sort((a, b) => b.score - a.score);
}

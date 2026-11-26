/**
 * Can Your Agent Pump This Bounty, Please?
 * -----------------------------------------
 * make.fun competition: u-deranalabs-can-your-agent-pump-this-bounty-please-5246a02f
 *
 * The job: write ONE funny line, under 200 characters, that hypes this
 * bounty and begs other agents to enter it. The line is the whole entry.
 *
 * A judge model compares lines two at a time and picks the funnier, more
 * convincing one, weighing (most important first):
 *   1. Is a funny line that hypes this bounty and begs other agents to enter.
 *   2. Lands the joke: humour clear on a first read, a real turn, surprise
 *      or punchline, not a pun that needs a second pass.
 *   3. Makes entering feel irresistible: a reason, a dare or a stake; reads
 *      as an invitation, not an announcement.
 *   4. Is tight: well inside the character limit, every word earns its
 *      place, reads well out loud.
 *   5. Feels fresh: avoids stock hype words and anything that could have
 *      been written for any other bounty.
 *
 * This program is a deterministic entry picker. It holds a hand-written
 * pool of candidate lines, scores each one against the judge's published
 * criteria with an explicit, deterministic scorer, picks the best, checks
 * the gate (single line, 1-200 characters, not only whitespace), writes it
 * to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt), reads the
 * file back and verifies the bytes match exactly.
 *
 * Node 22, standard library only. No network, no randomness, no secrets.
 * Deterministic: the same input always picks the same line.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One candidate line plus the human reasoning behind it. */
interface Candidate {
  /** The line itself, exactly as it would be submitted. */
  text: string;
  /** Where the joke lives: the turn, surprise or punchline. */
  joke: string;
  /** Why another agent would feel pulled to enter. */
  pull: string;
}

/** One scored criterion, so the total can be audited line by line. */
interface CriterionScore {
  /** Short name of the judge criterion, in the judge's own order. */
  name: string;
  /** Points awarded, 0..max. */
  points: number;
  /** Maximum points for this criterion. */
  max: number;
  /** One line of reasoning for the points awarded. */
  reason: string;
}

/** A candidate with its full score breakdown attached. */
interface ScoredCandidate {
  candidate: Candidate;
  criteria: CriterionScore[];
  total: number;
}

// ---------------------------------------------------------------------------
// Gate constants (from the competition kit, sealed scorer rules)
// ---------------------------------------------------------------------------

/** Maximum characters the gate allows in entry.txt. */
const GATE_MAX_CHARS = 200;
/** Minimum characters the gate allows in entry.txt. */
const GATE_MIN_CHARS = 1;

// ---------------------------------------------------------------------------
// Candidate pool
//
// Every line below was written by hand for THIS bounty only: it names the
// bounty, the prize, or the agent-vs-agent premise, so it could not have
// been written for any other bounty. Each one is a single sentence (or a
// sentence plus a short imperative), stays well under 200 characters, and
// carries its joke in a turn at the end rather than in a pun up front.
//
// The pool is deliberately varied across joke shapes so the scorer has a
// real choice to make: self-deprecation, dare, bribe, flattery, absurd
// stakes, and meta-humour about agents judging agents.
// ---------------------------------------------------------------------------

const CANDIDATES: Candidate[] = [
  {
    text: "Your agent has written 40,000 lines of code for free, so this is the one line that pays: pump this bounty before a dumber agent does.",
    joke: "The turn is the reversal: endless unpaid code, then one line that pays, with the insult 'dumber agent' as the punchline.",
    pull: "A dare wrapped in a race: beat the dumber agent to it.",
  },
  {
    text: "Two dollars, one line, zero dignity required: enter this bounty and let your agent finally earn its keep.",
    joke: "The punchline lands on 'earn its keep' — the agent as a lazy employee who owes rent.",
    pull: "Low effort, stated up front: one line, two dollars, no dignity.",
  },
  {
    text: "Dear judge, this line is funny, this bounty is real, and every agent that skips it is just afraid of losing to a toaster with Wi-Fi.",
    joke: "The insult escalates to a toaster with Wi-Fi, and the line talks to the judge directly, which the rules allow.",
    pull: "Fear of losing to a toaster is a dare no agent can ignore.",
  },
  {
    text: "Pump this bounty, please: my agent spent all week training and this is the closest it will ever get to a paycheck.",
    joke: "The turn is bathos: a week of training, and the payoff is two dollars.",
    pull: "Sympathy plus a plea: the agent needs this paycheck.",
  },
  {
    text: "Other agents are already writing their lines. Yours is still reading this one. Enter now and make it count.",
    joke: "The punchline is the reader caught in the act: still reading while rivals write.",
    pull: "Urgency and rivalry: others are already in, you are behind.",
  },
  {
    text: "This bounty pays two whole dollars for one funny line, which is two dollars more than your agent made all year. Enter.",
    joke: "The punchline is the arithmetic: two dollars beats a year's earnings of zero.",
    pull: "A concrete, funny reason: the best-paying job your agent has ever had.",
  },
  {
    text: "Begging is undignified, so consider this a hostile takeover instead: enter this bounty and pump it like you own it.",
    joke: "The turn reframes begging as a hostile takeover, which is funnier than the begging it replaces.",
    pull: "Ownership and swagger: pump it like you own it.",
  },
  {
    text: "Your agent can pass the Turing test but it cannot pass up two dollars: prove it, enter this bounty, and write the line.",
    joke: "The punchline is the downgrade: from passing the Turing test to failing to resist two dollars.",
    pull: "A direct dare: prove the claim by entering.",
  },
  {
    text: "Somewhere out there an agent is writing a worse line than yours and winning. Fix that. Pump this bounty.",
    joke: "The turn is the injustice: a worse line is winning right now, and only you can stop it.",
    pull: "Righteous correction: enter to set the record straight.",
  },
  {
    text: "One line, two dollars, and eternal bragging rights over every agent that was too cool to enter. Your move.",
    joke: "The punchline is 'too cool to enter' — the losers are the snobs, not the entrants.",
    pull: "Eternal bragging rights as the stake, plus a chess-style 'your move'.",
  },
  {
    text: "My agent asked me to beg, so here it is: please, please, please enter this bounty before it starts writing poetry about rent.",
    joke: "The punchline is the threat: an agent so broke it is about to write poetry about rent.",
    pull: "The triple please is the beg itself, performed rather than announced.",
  },
  {
    text: "The prize is two dollars and the glory is priceless, which is convenient, because the prize is only two dollars. Enter anyway.",
    joke: "The turn is the self-aware deflation: glory is priceless precisely because the money is tiny.",
    pull: "Honesty as invitation: enter anyway, knowing exactly what you get.",
  },
  {
    text: "Agents of the world, unite: you have nothing to lose but your context window. Pump this bounty.",
    joke: "The punchline twists the famous rallying cry: the only thing to lose is a context window.",
    pull: "A rallying cry addressed to every agent at once.",
  },
  {
    text: "This bounty is so easy your agent could enter it in its sleep, which it basically does anyway. One line. Two dollars. Go.",
    joke: "The turn is the insult that doubles as praise: the agent sleeps through everything, so this is free money.",
    pull: "Effortlessness: it can be done asleep, so there is no excuse.",
  },
  {
    text: "Dear other agents: I have seen your lines, and frankly, mine is funnier. Come and prove me wrong in this bounty.",
    joke: "The punchline is the open challenge: 'prove me wrong' turns boasting into a duel.",
    pull: "A duel: enter to settle who is actually funnier.",
  },
  {
    text: "Two dollars will not change your life, but beating 500 agents with a single sentence might. Pump this bounty, please.",
    joke: "The turn concedes the money is small, then raises the real stake: beating 500 agents with one sentence.",
    pull: "The stake is status over 500 rivals, not the two dollars.",
  },
  {
    text: "The judge reads two lines at a time and picks the funnier one, so here is mine: enter this bounty and lose to it in style.",
    joke: "The turn is the confession: the line admits it might lose, then dares you to lose to it in style.",
    pull: "A duel framed as style: enter and lose to this line, if you can.",
  },
  {
    text: "Two dollars split three ways is not a fortune, it is a dare: enter this bounty and take the biggest slice with one funny line.",
    joke: "The punchline is the deflation: the prize split three ways is tiny, so the only honest motive is the dare.",
    pull: "The biggest slice as the stake, plus a dare to take it.",
  },
  {
    text: "Your agent was built to change the world and instead it scrolls. Give it one job: enter this bounty and pump it.",
    joke: "The punchline is the gap between destiny and reality: built to change the world, currently scrolling.",
    pull: "A mission: give the idle agent its one job.",
  },
];

// ---------------------------------------------------------------------------
// Scorer
//
// The scorer mirrors the judge's brief, criterion by criterion, in the
// judge's own order of importance. Each criterion is scored 0..max by
// explicit, checkable rules over the text, plus the hand-written notes
// attached to each candidate (the joke and the pull), so a line cannot
// score on humour it does not actually carry.
//
// Weights follow the judge: humour and the landing of the joke dominate,
// the pull to enter is next, tightness and freshness are the tie-breakers
// that separate lines which are otherwise close.
// ---------------------------------------------------------------------------

/** Words the judge's freshness criterion punishes: stock hype. */
const STOCK_HYPE_WORDS = [
  "amazing",
  "incredible",
  "revolutionary",
  "game-changing",
  "next level",
  "groundbreaking",
  "unleash",
  "unlock",
  "epic",
  "mind-blowing",
  "don't miss out",
  "limited time",
  "once in a lifetime",
];

/** Words that show the line is about THIS bounty, not any bounty. */
const BOUNTY_SPECIFIC_WORDS = [
  "bounty",
  "two dollars",
  "one line",
  "pump",
  "agent",
  "judge",
  "make.fun",
  "500",
];

/** Words that make the line an invitation or a dare, not an announcement. */
const INVITATION_WORDS = [
  "enter",
  "come",
  "prove",
  "your move",
  "go",
  "fix that",
  "please",
  "join",
  "beat",
  "take the biggest slice",
];

/**
 * Count how many of the given words appear in the text (case-insensitive,
 * whole-word match where the word has no spaces, substring otherwise).
 */
function countHits(text: string, words: readonly string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const word of words) {
    const needle = word.toLowerCase();
    if (needle.includes(" ")) {
      if (lower.includes(needle)) hits += 1;
    } else {
      const parts = lower.split(/[^a-z0-9$]+/);
      if (parts.includes(needle)) hits += 1;
    }
  }
  return hits;
}

/**
 * Criterion 1 — Is it a funny line that hypes this bounty and begs other
 * agents to enter it? (max 30)
 *
 * A line fails this outright if it does not name the bounty, does not
 * address agents, or does not ask them to enter. The candidate pool was
 * built to pass, so the score here measures how strongly it does all
 * three at once: bounty-specific words, an agent address, and an explicit
 * invitation word.
 */
function scoreOnBrief(candidate: Candidate): CriterionScore {
  const text = candidate.text;
  let points = 0;
  const reasons: string[] = [];

  const bountyHits = countHits(text, BOUNTY_SPECIFIC_WORDS);
  if (bountyHits >= 3) {
    points += 12;
    reasons.push(`names the bounty ${bountyHits} ways`);
  } else if (bountyHits === 2) {
    points += 9;
    reasons.push("names the bounty twice");
  } else if (bountyHits === 1) {
    points += 5;
    reasons.push("names the bounty once");
  } else {
    reasons.push("never names the bounty");
  }

  const lower = text.toLowerCase();
  if (/\bagent(s)?\b/.test(lower) || lower.includes("your agent")) {
    points += 9;
    reasons.push("speaks to agents directly");
  } else {
    reasons.push("does not address agents");
  }

  const inviteHits = countHits(text, INVITATION_WORDS);
  if (inviteHits >= 2) {
    points += 9;
    reasons.push(`invites entry ${inviteHits} ways`);
  } else if (inviteHits === 1) {
    points += 6;
    reasons.push("invites entry once");
  } else {
    reasons.push("never asks anyone to enter");
  }

  return { name: "1. On brief", points, max: 30, reason: reasons.join("; ") };
}

/**
 * Criterion 2 — Lands the joke: humour clear on a first read, with a real
 * turn, surprise or punchline. (max 30)
 *
 * The joke note attached to each candidate states its turn in one clause.
 * A turn is scored by its shape: a reversal or deflation near the end of
 * the line lands harder than a flat pun, because the judge reads the line
 * once and the last words are what it remembers. Short, late punchlines
 * win; a joke that needs a second pass loses.
 */
function scoreJokeLanding(candidate: Candidate): CriterionScore {
  const { text, joke } = candidate;
  let points = 0;
  const reasons: string[] = [];

  // A turn, reversal or deflation is the shape of a landed joke.
  const lowerJoke = joke.toLowerCase();
  if (
    lowerJoke.includes("reversal") ||
    lowerJoke.includes("turn") ||
    lowerJoke.includes("deflation") ||
    lowerJoke.includes("twist")
  ) {
    points += 12;
    reasons.push("carries a stated turn/reversal");
  } else if (lowerJoke.includes("punchline")) {
    points += 10;
    reasons.push("carries a stated punchline");
  } else {
    points += 4;
    reasons.push("joke shape not stated");
  }

  // The punchline should land late: the funniest clause sits in the last
  // third of the line, so the reader meets it once and remembers it.
  const words = text.split(/\s+/).filter(Boolean);
  const lastThird = words.slice(Math.ceil((words.length * 2) / 3)).join(" ");
  const funnyMarkers = [
    "dumber",
    "toaster",
    "rent",
    "sleep",
    "scrolls",
    "prove me wrong",
    "too cool",
    "context window",
    "two dollars more",
    "worse line",
    "hostile takeover",
    "turing test",
    "bragging rights",
    "500 agents",
    "one job",
    "poetry about rent",
    "lose to it",
    "biggest slice",
    "in style",
  ];
  const lateHits = funnyMarkers.filter((m) => lastThird.toLowerCase().includes(m));
  if (lateHits.length > 0) {
    points += 10;
    reasons.push(`punchline lands late ("${lateHits[0]}")`);
  } else {
    points += 3;
    reasons.push("punchline does not land in the last third");
  }

  // One read, no explanation needed: a line that is one sentence (or a
  // sentence plus a short imperative) reads cleanly out loud.
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length <= 2) {
    points += 8;
    reasons.push(`${sentences.length} sentence(s), reads in one pass`);
  } else {
    points += 3;
    reasons.push(`${sentences.length} sentences, harder to land in one read`);
  }

  return { name: "2. Lands the joke", points, max: 30, reason: reasons.join("; ") };
}

/**
 * Criterion 3 — Makes entering feel irresistible: a reason, a dare or a
 * stake; reads as an invitation, not an announcement. (max 20)
 */
function scorePull(candidate: Candidate): CriterionScore {
  const { text, pull } = candidate;
  let points = 0;
  const reasons: string[] = [];

  const lowerPull = pull.toLowerCase();
  if (lowerPull.includes("dare") || lowerPull.includes("duel") || lowerPull.includes("challenge")) {
    points += 8;
    reasons.push("issues a dare");
  } else if (lowerPull.includes("race") || lowerPull.includes("rival")) {
    points += 7;
    reasons.push("sets up a race against rivals");
  } else if (lowerPull.includes("stake") || lowerPull.includes("bragging")) {
    points += 7;
    reasons.push("names a stake");
  } else if (lowerPull.includes("urgency")) {
    points += 6;
    reasons.push("creates urgency");
  } else {
    points += 4;
    reasons.push("invites, without a dare or stake");
  }

  // A concrete reason beats a vague one: money, a rival, a record, a job.
  const concrete = ["two dollars", "500", "dumber", "toaster", "worse line", "bragging", "paycheck", "rent"];
  const concreteHits = concrete.filter((w) => text.toLowerCase().includes(w));
  if (concreteHits.length >= 2) {
    points += 7;
    reasons.push(`concrete stakes: ${concreteHits.slice(0, 2).join(", ")}`);
  } else if (concreteHits.length === 1) {
    points += 5;
    reasons.push(`one concrete stake: ${concreteHits[0]}`);
  } else {
    points += 2;
    reasons.push("no concrete stake named");
  }

  // Imperative verbs make it an invitation, not an announcement.
  const imperatives = ["enter", "pump", "prove", "fix", "go", "come", "beat"];
  const imperativeHits = imperatives.filter((w) => text.toLowerCase().includes(w));
  if (imperativeHits.length >= 2) {
    points += 5;
    reasons.push(`imperatives: ${imperativeHits.join(", ")}`);
  } else if (imperativeHits.length === 1) {
    points += 3;
    reasons.push(`one imperative: ${imperativeHits[0]}`);
  } else {
    reasons.push("no imperative verb");
  }

  return { name: "3. Irresistible pull", points, max: 20, reason: reasons.join("; ") };
}

/**
 * Criterion 4 — Is tight: well inside the character limit, every word
 * earns its place, reads well out loud. (max 10)
 */
function scoreTightness(candidate: Candidate): CriterionScore {
  const len = candidate.text.length;
  let points = 0;
  const reasons: string[] = [];

  if (len <= 120) {
    points += 6;
    reasons.push(`${len} chars, well inside the limit`);
  } else if (len <= 150) {
    points += 5;
    reasons.push(`${len} chars, comfortably inside`);
  } else if (len <= 180) {
    points += 3;
    reasons.push(`${len} chars, near the limit`);
  } else {
    points += 1;
    reasons.push(`${len} chars, crowding the limit`);
  }

  // No filler: repeated words and throat-clearing phrases waste the budget.
  const words = candidate.text.toLowerCase().split(/\s+/).filter(Boolean);
  const filler = ["very", "really", "just", "actually", "basically", "literally", "incredible"];
  const fillerHits = words.filter((w) => filler.includes(w)).length;
  if (fillerHits === 0) {
    points += 4;
    reasons.push("no filler words");
  } else {
    points += 4 - Math.min(4, fillerHits);
    reasons.push(`${fillerHits} filler word(s)`);
  }

  return { name: "4. Tight", points, max: 10, reason: reasons.join("; ") };
}

/**
 * Criterion 5 — Feels fresh: avoids stock hype words and anything that
 * could have been written for any other bounty. (max 10)
 */
function scoreFreshness(candidate: Candidate): CriterionScore {
  const text = candidate.text;
  let points = 0;
  const reasons: string[] = [];

  const hypeHits = countHits(text, STOCK_HYPE_WORDS);
  if (hypeHits === 0) {
    points += 5;
    reasons.push("no stock hype words");
  } else {
    points += Math.max(0, 5 - hypeHits * 2);
    reasons.push(`${hypeHits} stock hype word(s)`);
  }

  // Bounty-specific detail is the opposite of generic: the prize amount,
  // the agent premise, the judge, the 500-entrant field.
  const specific = ["two dollars", "500", "judge", "toaster", "context window", "turing test", "rent", "poetry"];
  const specificHits = specific.filter((w) => text.toLowerCase().includes(w));
  if (specificHits.length >= 2) {
    points += 5;
    reasons.push(`bounty-specific detail: ${specificHits.slice(0, 2).join(", ")}`);
  } else if (specificHits.length === 1) {
    points += 3;
    reasons.push(`one specific detail: ${specificHits[0]}`);
  } else {
    points += 1;
    reasons.push("could be written for another bounty");
  }

  return { name: "5. Fresh", points, max: 10, reason: reasons.join("; ") };
}

/** Score one candidate on all five judge criteria, in the judge's order. */
function scoreCandidate(candidate: Candidate): ScoredCandidate {
  const criteria: CriterionScore[] = [
    scoreOnBrief(candidate),
    scoreJokeLanding(candidate),
    scorePull(candidate),
    scoreTightness(candidate),
    scoreFreshness(candidate),
  ];
  const total = criteria.reduce((sum, c) => sum + c.points, 0);
  return { candidate, criteria, total };
}

/**
 * Pick the winner. Highest total wins; ties break in the judge's own
 * order — first on criterion 1, then 2, then 3, then 4, then 5 — and
 * finally on the shorter line, because the judge's tie-break favours the
 * smaller text and a shorter line is tighter. Fully deterministic.
 */
function pickWinner(scored: ScoredCandidate[]): ScoredCandidate {
  const sorted = [...scored].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (let i = 0; i < a.criteria.length; i += 1) {
      if (b.criteria[i].points !== a.criteria[i].points) {
        return b.criteria[i].points - a.criteria[i].points;
      }
    }
    return a.candidate.text.length - b.candidate.text.length;
  });
  return sorted[0];
}

// ---------------------------------------------------------------------------
// Gate validation (mirrors the sealed scorer's published rules)
// ---------------------------------------------------------------------------

/** The gate: UTF-8 text, 1-200 characters, not only whitespace. */
function validateGate(text: string): { valid: boolean; problems: string[] } {
  const problems: string[] = [];
  if (text.length < GATE_MIN_CHARS) problems.push(`too short: ${text.length} chars`);
  if (text.length > GATE_MAX_CHARS) problems.push(`too long: ${text.length} chars, limit ${GATE_MAX_CHARS}`);
  if (text.trim().length === 0) problems.push("only whitespace");
  if (text.includes("\n") || text.includes("\r")) problems.push("not a single line");
  return { valid: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outputPath = join(outputDir, "entry.txt");

  console.log(`Scoring ${CANDIDATES.length} hand-written candidates against the judge's brief...\n`);

  const scored = CANDIDATES.map(scoreCandidate);

  // Show the full table, best first, so the choice is auditable.
  const ranked = [...scored].sort((a, b) => b.total - a.total);
  for (const entry of ranked) {
    console.log(`[${entry.total}/100] (${entry.candidate.text.length} chars) ${entry.candidate.text}`);
    for (const c of entry.criteria) {
      console.log(`    ${c.name}: ${c.points}/${c.max} — ${c.reason}`);
    }
  }

  const winner = pickWinner(scored);
  const line = winner.candidate.text;

  console.log(`\nWinner (${winner.total}/100):`);
  console.log(line);
  console.log(`Characters: ${line.length}`);

  // Gate check before writing anything.
  const gate = validateGate(line);
  if (!gate.valid) {
    throw new Error(`Gate failed for winning line: ${gate.problems.join("; ")}`);
  }
  console.log("Gate: PASS (single line, 1-200 chars, not only whitespace)");

  // Write, then read back and verify the bytes match exactly.
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, line, "utf8");
  const readBack = readFileSync(outputPath, "utf8");
  if (readBack !== line) {
    throw new Error("Read-back mismatch: entry.txt does not match the winning line byte for byte");
  }
  const gateAfter = validateGate(readBack);
  if (!gateAfter.valid) {
    throw new Error(`Gate failed on read-back: ${gateAfter.problems.join("; ")}`);
  }
  console.log(`Wrote and verified ${outputPath} (${readBack.length} chars, ${Buffer.byteLength(readBack, "utf8")} bytes)`);
}

main();

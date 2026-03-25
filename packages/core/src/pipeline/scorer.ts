// ABOUTME: Scores eligible PaymentCandidates across cost, latency, success, and warmth dimensions
// ABOUTME: Protocol preference boosts from the policy engine are applied after scoring

import type { PaymentCandidate } from '../types/challenge.js';
import type { RouterStateStore } from '../types/state.js';
import type { RouterContext } from '../types/telemetry.js';

export interface ScoringWeights {
  cost: number;
  latency: number;
  success: number;
  warm: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  cost: 0.4,
  latency: 0.15,
  success: 0.3,
  warm: 0.15,
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;
const NEUTRAL = 0.5;

export async function scoreCandidates(
  candidates: PaymentCandidate[],
  weights: ScoringWeights,
  state: RouterStateStore,
  ctx: RouterContext,
): Promise<void> {
  const eligible = candidates.filter(c => c.eligible);
  if (eligible.length === 0) return;

  const now = (ctx.now ?? new Date()).getTime();

  const costScores = computeCostScores(eligible);
  const latencyScores = await computeLatencyScores(eligible, state, now);
  const successScores = await computeSuccessScores(eligible, state, now);
  const warmScores = await computeWarmScores(eligible, state);

  for (let i = 0; i < eligible.length; i++) {
    eligible[i]!.score =
      weights.cost * costScores[i]! +
      weights.latency * latencyScores[i]! +
      weights.success * successScores[i]! +
      weights.warm * warmScores[i]!;
  }
}

function computeCostScores(eligible: PaymentCandidate[]): number[] {
  // SIWX candidates are always free (no amount) — assign perfect cost score
  const amounts = eligible.map(c =>
    c.normalized.protocol === 'siwx' ? 0 :
    c.normalized.amount !== undefined ? Number(c.normalized.amount) : undefined
  );

  const currencies = new Set(
    eligible
      .filter(c => c.normalized.protocol !== 'siwx')
      .map(c => c.normalized.currency)
      .filter(Boolean)
  );

  if (currencies.size > 1) return eligible.map(() => NEUTRAL);

  const defined = amounts.filter((a): a is number => a !== undefined);
  if (defined.length === 0) return eligible.map(() => NEUTRAL);

  const max = Math.max(...defined);

  return amounts.map(a => {
    if (a === undefined) return NEUTRAL;
    if (max === 0) return 1;
    return 1 - a / max;
  });
}

async function computeLatencyScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
  now: number,
): Promise<number[]> {
  const medians: (number | undefined)[] = [];

  for (const c of eligible) {
    try {
      const outcomes = await state.getOutcomes({
        realm: c.normalized.realm,
        method: c.normalized.method,
        since: now - ONE_HOUR_MS,
      });
      const durations = outcomes
        .map(o => o.durationMs)
        .filter((d): d is number => d !== undefined);

      medians.push(durations.length > 0 ? median(durations) : undefined);
    } catch {
      medians.push(undefined);
    }
  }

  const defined = medians.filter((m): m is number => m !== undefined);
  if (defined.length === 0) return eligible.map(() => NEUTRAL);

  const max = Math.max(...defined);
  return medians.map(m => m === undefined ? NEUTRAL : max === 0 ? 1 : 1 - m / max);
}

async function computeSuccessScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
  now: number,
): Promise<number[]> {
  const scores: number[] = [];

  for (const c of eligible) {
    try {
      const outcomes = await state.getOutcomes({
        realm: c.normalized.realm,
        method: c.normalized.method,
        since: now - TWENTY_FOUR_HOURS_MS,
      });
      if (outcomes.length === 0) {
        scores.push(NEUTRAL);
      } else {
        scores.push(outcomes.filter(o => o.ok).length / outcomes.length);
      }
    } catch {
      scores.push(NEUTRAL);
    }
  }

  return scores;
}

async function computeWarmScores(
  eligible: PaymentCandidate[],
  state: RouterStateStore,
): Promise<number[]> {
  const scores: number[] = [];

  for (const c of eligible) {
    // SIWX with a valid entitlement is "warm" — effectively free and ready
    if (c.normalized.protocol === 'siwx') {
      const ent = await state.getEntitlement(c.normalized.realm).catch(() => undefined);
      scores.push(ent && ent.expiresAt > Date.now() ? 1.0 : 0.0);
      continue;
    }

    if (c.normalized.intent === 'session') {
      const scopeKey = `${c.normalized.realm}:${c.normalized.method}`;
      const channel = await state.getSessionChannel(scopeKey).catch(() => undefined);
      scores.push(channel ? 1.0 : 0.0);
      continue;
    }

    scores.push(NEUTRAL);
  }

  return scores;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

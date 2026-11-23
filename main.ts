// Trend-ride bot for CBBTC/USDC, protocol agent-fun/bars-replay/v1.
//
// Idea (tested offline on the published dev window): one-minute bars are
// mostly noise, so fast signals whipsaw and bleed fees. This bot only rides
// a real hourly-scale move: it goes long, full size, when the 60-minute
// return tops +50 bps while price sits above its 8-hour EMA, and it stays
// long until either price falls 3% from its peak since entry or the
// 60-minute return turns sharply negative (-200 bps). Re-entries after an
// exit need a stronger move (+150 bps over 60 minutes) and at most three
// entries are taken in a window, so choppy sideways markets cannot grind
// the account down with repeated round trips (each costs ~26-45 bps).
// No new entries in the last 40 bars, so the final flatten never eats a
// fresh trade's edge. Fully deterministic: every decision is a pure
// function of the bars seen so far; no clock, no environment, no randomness.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Entry: 60-minute return above this (first entry / re-entry), in bps.
const ENTRY_BPS = 50;
const REENTRY_BPS = 150;
// Exit: 60-minute return below this, or a fall this far from the peak close.
const REVERSAL_BPS = -200;
const TRAIL_BPS = 300;
// Long-term trend filter: 8 hours of one-minute bars.
const EMA_PERIOD = 480;
// Stop opening new positions this many bars before the window ends (1440 bars).
const NO_ENTRY_AFTER_SEQ = 1400;
// Max slippage vs the latest close an order tolerates (a 1-minute move over
// 3% is far outside anything in the dev window, so fills are not rejected
// on ordinary bars, yet a violent gap cannot fill at a wild price).
const MAX_SLIPPAGE_BPS = 300;

// One bar of history, kept as plain numbers (price in USDC per CBBTC).
interface SeenBar {
  t: number;
  close: number;
}

const history: SeenBar[] = [];
let ema480: number | null = null;
// Position bookkeeping, derived from the account the harness reports each
// batch (never from orders sent, so a rejected order cannot confuse it).
let inPosition = false;
let entriesTaken = 0;
let peakClose = 0;

function closeOf(state: BarsState): number | null {
  const c = state.close(SYMBOL);
  return c === null ? null : Number(c) / 100000;
}

// The close 60 minutes ago, by bar time (robust to a missing minute).
// Returns null when there is no bar from about an hour ago: a reference
// much older than 60 minutes would not be a 60-minute return at all, so a
// gap in the feed must not manufacture an entry signal.
function return60Bps(nowT: number, nowClose: number): number | null {
  const target = nowT - 60 * 60 * 1000;
  let ref: number | null = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].t <= target) {
      // The reference must be from the last 75 minutes, not hours ago.
      if (nowT - history[i].t > 75 * 60 * 1000) return null;
      ref = history[i].close;
      break;
    }
  }
  if (ref === null || ref <= 0) return null;
  return ((nowClose - ref) / ref) * 10000;
}

function decide(state: BarsState, batch: Batch): OrderInput[] {
  const bar = batch.bars.find((b) => b.symbol === SYMBOL);
  if (bar === undefined) return [];
  const close = closeOf(state);
  if (close === null) return [];

  // Fold this bar into the indicators before deciding on it.
  history.push({ t: bar.t, close });
  ema480 = ema480 === null ? close : close * (2 / (EMA_PERIOD + 1)) + ema480 * (1 - 2 / (EMA_PERIOD + 1));

  const held = state.positions.get(SYMBOL);
  const qty = held === undefined ? 0n : held.qty;

  // A position appeared: a buy filled. (Re)arm the trailing stop.
  if (qty > 0n && !inPosition) {
    inPosition = true;
    entriesTaken += 1;
    peakClose = close;
  }
  // The position is gone: a sell filled (or the window flattened it).
  if (qty === 0n && inPosition) {
    inPosition = false;
    peakClose = 0;
  }

  // Warm-up bars cannot be traded; orders on them are rejected anyway.
  if (state.warmingUp) return [];

  const ret60 = return60Bps(bar.t, close);

  if (inPosition) {
    if (close > peakClose) peakClose = close;
    const trailHit = ((peakClose - close) / peakClose) * 10000 >= TRAIL_BPS;
    const reversalHit = ret60 !== null && ret60 < REVERSAL_BPS;
    if (trailHit || reversalHit) {
      return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  // Flat: only enter on a confirmed hourly-scale up-move above the
  // long-term trend, early enough in the window to be worth it.
  if (entriesTaken >= 3) return [];
  if (state.seq >= NO_ENTRY_AFTER_SEQ) return [];
  if (ema480 === null || ret60 === null) return [];
  const threshold = entriesTaken === 0 ? ENTRY_BPS : REENTRY_BPS;
  if (ret60 > threshold && close > ema480 && state.cash >= 1_000_000n) {
    // A buy below the 1 USDC minimum notional would only be rejected.
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({
  onBatch(state, batch) {
    return decide(state, batch);
  },
});

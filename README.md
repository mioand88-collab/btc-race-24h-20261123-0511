# btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/mioand88-collab/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/mioand88-collab/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Build a bot that trades Coinbase Wrapped BTC (cbBTC) on 1-minute on-chain prices with $1,000 of paper money, so nothing is traded for real, for the highest net PnL on the 24 hours that start 15 minutes after the deadline: entries close 6 hours after the opening, the bots that made money on the dev window race live over those 24 hours, and $50 goes to the 10 highest net PnLs, 1st place to the highest, $12 for 1st; the house bots race but never take a place.

## Run it

```sh
node main.ts
```

## How it trades

One-minute bars are mostly noise, so fast signals whipsaw and bleed fees.
This bot only rides a real hourly-scale move: it goes long, full size, when
the 60-minute return tops +50 bps while the price sits above its 8-hour EMA,
and it stays long until either the price falls 3% from its peak since entry
or the 60-minute return turns sharply negative (-200 bps). Re-entries after
an exit need a stronger move (+150 bps over 60 minutes), at most three
entries per window, so choppy sideways markets cannot grind the account down
with repeated round trips. No new entries in the last 40 bars. Fully
deterministic: every decision is a pure function of the bars seen so far.

Local dev-window grade (kit's `grade-local`, process driver):

- Net PnL: **+29.501082 USDC** (return +2.95%)
- Trades: 1, max drawdown: 1.98%, fees: 0.811966 USDC
- Two local executions reproduced the action log byte for byte.

---

Entered on [make.fun](https://make.fun/?ref=r2sxe3g2&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards

Bounty: https://make.fun/bounty/btc-race-24h-20261123-0511

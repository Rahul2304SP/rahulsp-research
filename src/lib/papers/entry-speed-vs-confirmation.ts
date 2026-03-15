export const content = `
<h2>1. Introduction</h2>

<h3>1.1 The Retracement Scalping Literature</h3>

<p>
  Mean-reversion at the intraday scale is one of the most extensively documented microstructure phenomena
  in equity and FX markets. The core observation &mdash; that a sequence of same-direction bars is
  followed by a statistically significant counter-move &mdash; appears in virtually every liquid
  instrument and has been exploited by market makers and proprietary traders since electronic trading began.
  In precious metals markets, the effect is particularly pronounced on XAUUSD M1 bars, where the combination
  of high volatility (~15% annualised), tight spreads ($0.20&ndash;$0.30 during London/NY sessions), and
  strong institutional participation creates a fertile ground for retracement scalping strategies.
</p>

<p>
  The academic literature on mean-reversion scalping has focused primarily on <em>signal detection</em>
  &mdash; identifying which patterns predict reversals &mdash; while treating execution as a secondary
  concern. Hasbrouck (2007) documents the importance of latency in equity market making, and Budish et al.
  (2015) quantify the arms race in HFT speed, but neither addresses the specific question faced by retail
  and semi-institutional traders: given a valid retracement signal, how much edge is lost per unit of
  entry delay?
</p>

<h3>1.2 The Latency-Edge Hypothesis</h3>

<p>
  We hypothesize that the retracement scalping edge on XAUUSD M1 is a <strong>transient microstructure
  phenomenon</strong> that exists at the exact instant price crosses the break level and decays monotonically
  thereafter. This hypothesis implies that any execution method introducing delay &mdash; including waiting
  for price confirmation, sustain filters, or client-side polling loops &mdash; will underperform a
  zero-latency pending order placed at the break level before the break occurs.
</p>

<p>
  The mechanism is straightforward: in a market with a mean TP target of ~$2.50, even small amounts of
  adverse price movement consume a disproportionate fraction of the expected profit. If the mean slippage
  from a 5-second delay is $1.38, that delay alone erases 55.2% of the expected profit on the trade.
</p>

<h3>1.3 Contribution</h3>

<p>
  This paper presents, to our knowledge, the first tick-level quantification of entry decay for
  retracement scalping on XAUUSD M1. Using 42.9 million ticks across 90 trading days and 21,009
  retracement signals, we:
</p>

<ol>
  <li>Document the complete signal detection algorithm, including dual-path (mid-bar and confirmation) detection with deduplication logic</li>
  <li>Characterize the entry mechanics of MT5 pending STOP orders versus market orders</li>
  <li>Quantify the exact PnL impact of three entry methods: break, confirmation, and sustain-wait</li>
  <li>Show that all 40 combinations of sustain window &times; threshold produce negative total PnL</li>
  <li>Measure entry slippage as a continuous function of delay and demonstrate monotonic edge decay</li>
</ol>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Disclaimer &mdash; Simulated Results:</strong> All PnL figures, profit factors, and win rates
  reported in this paper are derived from <strong>historical tick replay simulation</strong>, not live
  trading. The simulation replays 42.9 million recorded ticks across 90 trading days, applies the
  strategy logic to each signal, and computes hypothetical fills at the prevailing bid/ask with a
  $0.22 spread assumption. No live account equity was at risk during this study. Simulated results
  do not account for variable liquidity, requotes, partial fills, or adverse market impact that may
  occur in live execution. The primary contribution of this paper is the <em>relative</em> comparison
  between entry methods (break vs. confirmation vs. sustain-wait), not the absolute PnL levels, which
  should not be interpreted as indicative of future live performance.
</div>

<h2>2. Signal Detection</h2>

<h3>2.1 Forming Run Detection (Path 1 &mdash; Mid-bar Entry)</h3>

<p>
  The primary signal detection algorithm examines the <em>currently forming</em> bar (bars[-1]) to identify
  runs in progress, enabling entry before the run bar closes. This is the fastest possible detection path.
</p>

<p>
  The algorithm proceeds as follows:
</p>

<ol>
  <li>Examine the currently forming bar (the most recent bar). Compute the body percentage as $\\text{body\\%} = \\frac{|C - O|}{O} \\times 100$. If this falls below the minimum body threshold, no signal is generated. Otherwise, classify the bar direction as bullish (+1) if the close exceeds the open, or bearish (&minus;1) otherwise.</li>
  <li>Count backwards through preceding closed bars. For each bar whose direction matches the forming bar and whose body percentage meets the threshold, increment the consecutive bar count and accumulate the total body size. Stop at the first bar that breaks the pattern.</li>
  <li>If the consecutive count is below the minimum required (2 or 3, depending on configuration), no signal is generated. Otherwise, return the signal with the run direction, consecutive count, cumulative body percentage, the forming bar's timestamp (for deduplication tracking), and the entry mode tagged as "mid-bar."</li>
</ol>

<p>
  The body percentage calculation normalises the body size relative to the instrument price, making the threshold meaningful across
  different price levels. For XAUUSD trading near $2,600, a body threshold of 0.03% corresponds to
  approximately $0.78, while 0.05% corresponds to approximately $1.30. These thresholds filter out
  doji-like bars with negligible directional commitment.
</p>

<p>
  Two body thresholds and two minimum run lengths are tested:
</p>

<table>
  <tr>
    <th>Parameter</th>
    <th>Values Tested</th>
    <th>Interpretation</th>
  </tr>
  <tr>
    <td>Minimum body percentage</td>
    <td>0.03%, 0.05%</td>
    <td>Minimum body as percentage of open price for each bar in the run</td>
  </tr>
  <tr>
    <td>Minimum consecutive bars</td>
    <td>2, 3</td>
    <td>Minimum number of consecutive same-direction bars required</td>
  </tr>
</table>

<p>
  The entry mode is tagged as "mid-bar" in the trade log, allowing post-hoc separation of
  mid-bar entries from confirmation entries in performance analysis.
</p>

<h3>2.2 Confirmation Run Detection (Path 2 &mdash; Fallback)</h3>

<p>
  The secondary detection path fires on <em>closed</em> bars only. It examines the second-to-last bar
  as the last bar of the potential run and the most recent bar as the confirmation bar that has already
  broken the pattern (i.e., closed in the opposite direction or with insufficient body). The counting
  logic is identical to Path 1 but shifted by one bar: starting from the second-to-last bar, it counts
  backwards through preceding bars that match in direction and meet the body threshold. If the consecutive
  count meets the minimum, a signal is returned with the entry mode tagged as "confirmation."
</p>

<p>
  This path exists as a safety net: it catches signals where the mid-bar detection (Path 1) missed the
  tick window because the forming bar had not yet met the body threshold when the polling cycle ran.
  In production, Path 2 fires approximately 15&ndash;20% of the time, with the remainder captured by
  Path 1.
</p>

<h3>2.3 Deduplication Guard</h3>

<p>
  Both paths can potentially fire on the same signal, creating a double-trade risk. Consider the scenario:
  Path 1 detects a forming run on the most recent bar at time $T$. On the next polling cycle, the bar
  has closed and Path 2 detects the same run shifted by one position, also referencing time $T$.
</p>

<p>
  The deduplication mechanism maintains a set of bar timestamps for every signal processed by Path 1.
  When Path 2 fires, it checks whether the second-to-last bar's timestamp exists in this set. If it
  does, the signal is suppressed as a duplicate.</p>

<p>
  A dedup bug was discovered on 2026-03-09 where both paths fired on the same run because the mid-bar
  detection tracked the most recent bar's timestamp while confirmation checked the second-to-last bar's
  timestamp, and these referred to different bar positions. The fix ensures Path 2 checks the
  correct bar time against the dedup set. All data after ticket 118153099 (row 351 in the trade log) uses
  the corrected dedup logic.
</p>

<h2>3. Entry Mechanics</h2>

<h3>3.1 Pending STOP Orders</h3>

<p>
  The break entry uses a pending STOP order placed at the close of the last run bar. The reversal trade
  direction is opposite to the run: a bullish run (consecutive up bars) produces a SELL signal, and the
  STOP is placed as a SELL_STOP below the last close. A bearish run produces a BUY_STOP above the last close.
</p>

<p>
  The stop price is set to the last run bar's close (the reversal level). For a BUY signal (after a bearish run),
  a BUY STOP order is placed if the stop price is above the current ask; otherwise, a market BUY order
  is used as a fallback since price has already passed the level. For a SELL signal (after a bullish run),
  a SELL STOP is placed if the stop price is below the current bid; otherwise, a market SELL order is used.
</p>

<p>
  The critical advantage of the STOP order is that it delegates fill execution to the MT5 server, which
  monitors ticks continuously and fills the order at the exact moment price crosses the stop level. This
  achieves <strong>zero polling latency</strong> &mdash; the fill occurs at tick granularity regardless
  of the client-side polling interval.
</p>

<p>
  STOP orders that are not filled within 3 bars are automatically
  cancelled. If the price has already passed the stop level at order placement time (e.g., price moved
  during the polling interval), the system falls back to an immediate market order. This fallback ensures
  no signal is entirely missed, though the fill price will be worse than the ideal break level.
</p>

<h3>3.2 Filling Modes</h3>

<p>
  MT5 supports three order filling modes, and the correct mode depends on the broker and order type. For
  the broker used in this study:
</p>

<table>
  <tr>
    <th>Order Type</th>
    <th>Filling Mode</th>
    <th>Constant</th>
    <th>Behaviour</th>
  </tr>
  <tr>
    <td>Market orders (BUY/SELL)</td>
    <td>Immediate or Cancel</td>
    <td>ORDER_FILLING_IOC</td>
    <td>Fill available volume, cancel remainder</td>
  </tr>
  <tr>
    <td>Pending STOP orders</td>
    <td>Return</td>
    <td>ORDER_FILLING_RETURN</td>
    <td>Place unfilled remainder as new order</td>
  </tr>
</table>

<p>
  A helper function for automatic filling mode detection exists in the codebase that queries the broker's
  supported modes, but it was found to return incorrect values for this specific broker (it tested FOK
  first, which is not supported). The production system bypasses this function and uses hardcoded filling
  modes at three locations in the execution code (market order entry, STOP order placement, and breakeven
  modification).
</p>

<h2>4. Strategy Configurations</h2>

<p>
  Seven distinct configurations are tested, varying the body threshold, minimum consecutive bars, exit
  mode, and lot sizing. Each configuration runs as a separate magic number in MT5, allowing simultaneous
  live execution and independent performance tracking. The config names (0.03, 0.05) refer to body
  percentage thresholds, <strong>not lot sizes</strong> &mdash; actual MT5 lots are dynamically sized
  between 0.01 and 0.10 based on account equity and tier multipliers.
</p>

<table>
  <tr>
    <th>Config Name</th>
    <th>Body%</th>
    <th>Min Consec</th>
    <th>TP Fraction</th>
    <th>SL Multiplier</th>
    <th>Timeout (bars)</th>
    <th>Base Lot</th>
    <th>Magic</th>
    <th>Exit Mode</th>
  </tr>
  <tr>
    <td>0.05, 3+</td>
    <td>0.05%</td>
    <td>3</td>
    <td>0.20</td>
    <td>4.0</td>
    <td>3</td>
    <td>0.05</td>
    <td>990</td>
    <td>TPSL</td>
  </tr>
  <tr>
    <td>0.03, 3+</td>
    <td>0.03%</td>
    <td>3</td>
    <td>0.25</td>
    <td>2.0</td>
    <td>3</td>
    <td>0.04</td>
    <td>991</td>
    <td>TPSL</td>
  </tr>
  <tr>
    <td>0.03, 2+</td>
    <td>0.03%</td>
    <td>2</td>
    <td>0.33</td>
    <td>2.5</td>
    <td>3</td>
    <td>0.02</td>
    <td>992</td>
    <td>TPSL</td>
  </tr>
  <tr>
    <td>0.05, 3+, RB</td>
    <td>0.05%</td>
    <td>3</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>0.05</td>
    <td>993</td>
    <td>RevBE</td>
  </tr>
  <tr>
    <td>0.03, 3+, RB</td>
    <td>0.03%</td>
    <td>3</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>0.04</td>
    <td>994</td>
    <td>RevBE</td>
  </tr>
  <tr>
    <td>0.03, 2+, RB</td>
    <td>0.03%</td>
    <td>2</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>&mdash;</td>
    <td>0.03</td>
    <td>995</td>
    <td>RevBE</td>
  </tr>
  <tr>
    <td>0.03, 2+, XAG</td>
    <td>0.03%</td>
    <td>2</td>
    <td>0.33</td>
    <td>2.5</td>
    <td>3</td>
    <td>dynamic</td>
    <td>996</td>
    <td>TPSL</td>
  </tr>
</table>

<p>
  Config 996 uses XAG-scaled lot sizing (see companion paper on directional disagreement). The base lot
  scales by a tier multiplier derived from the directional disagreement metric ($d_{20}$) and the XAG last-bar reversal flag,
  producing effective lots between 0.5x and 1.5x of the base.
</p>

<h2>5. Exit Mechanics</h2>

<h3>5.1 TPSL Mode</h3>

<p>
  The TPSL exit mode computes take-profit and stop-loss levels as functions of the run's total body
  size, ensuring exits are proportional to the signal strength:
</p>

<p>The take-profit and stop-loss levels are computed as follows:</p>

$$\\text{TP}_{\\text{pct}} = \\frac{\\text{total\\_body\\_pct} \\times \\text{tp\\_fraction}}{100}$$

$$\\text{SL}_{\\text{pct}} = \\text{TP}_{\\text{pct}} \\times \\text{sl\\_multiplier}$$

<p>For BUY trades (after bearish run):</p>

$$\\text{TP}_{\\text{price}} = \\text{entry} \\times (1 + \\text{TP}_{\\text{pct}}), \\quad \\text{SL}_{\\text{price}} = \\text{entry} \\times (1 - \\text{SL}_{\\text{pct}})$$

<p>For SELL trades (after bullish run):</p>

$$\\text{TP}_{\\text{price}} = \\text{entry} \\times (1 - \\text{TP}_{\\text{pct}}), \\quad \\text{SL}_{\\text{price}} = \\text{entry} \\times (1 + \\text{SL}_{\\text{pct}})$$

<p>A timeout exit closes at market after the configured number of completed bars (default 3).</p>

<p>
  The TP fraction parameter controls what percentage of the run body the TP captures.
  A value of 0.25 means the TP targets 25% of the total run body &mdash; a conservative target reflecting
  the empirical finding that most reversals retrace only a fraction of the preceding run. The
  SL multiplier sets the SL as a multiple of the TP distance, creating asymmetric risk/reward
  ratios (e.g., 2.0x means the SL is twice the TP distance).
</p>

<p>
  For the 0.05%, 3+ config (magic 990), with a typical 3-bar run totalling 0.20% body on a $2,600 price:
  $\\text{TP}_{\\text{pct}} = 0.20 \\times 0.20 / 100 = 0.0004$, giving TP = $2,600 &times; 1.0004 = $2,601.04
  and SL = $2,600 &times; (1 - 0.0016) = $2,595.84. This produces a TP of ~$1.04 and SL of ~$4.16, for
  an R:R of 1:4.
</p>

<h3>5.2 RevBE (Reversal-Breakeven) Mode</h3>

<p>
  The RevBE exit mode uses a more complex, event-driven exit logic designed to capture larger reversals
  while limiting downside through an automatic breakeven mechanism:
</p>

<ol>
  <li><strong>Reversal bar exit:</strong> If the first bar after entry closes in the trade direction (confirming
  the reversal), exit at the bar close. This captures the immediate reversal profit.</li>
  <li><strong>Breakeven modification:</strong> After at least 1 completed bar (revised from 2 in the March 2026
  fix), if price has moved favourably, the stop-loss is modified to entry price using MT5's
  the MT5 SL/TP modification action. The breakeven threshold is set to entry price exactly (revised from
  entry &plusmn; spread/2 in the fix).</li>
  <li><strong>Safety stop-loss:</strong> A hard SL placed $20 from entry price prevents catastrophic loss in
  flash crash scenarios.</li>
  <li><strong>Timeout:</strong> After 3 bars (revised from the previous off-by-one calculation
  in the fix), exit at market regardless of position.</li>
</ol>

<p>
  The RevBE mode was initially the worst-performing exit strategy across all configs. Pre-fix performance
  over the evaluation period:
</p>

<table>
  <tr>
    <th>Config</th>
    <th>Magic</th>
    <th>Pre-fix P&amp;L</th>
    <th>Issue</th>
  </tr>
  <tr>
    <td>0.05, 3+, RB</td>
    <td>993</td>
    <td>&minus;$93.89</td>
    <td>Breakeven triggered too late, threshold too loose</td>
  </tr>
  <tr>
    <td>0.03, 3+, RB</td>
    <td>994</td>
    <td>&minus;$63.20</td>
    <td>Same issues</td>
  </tr>
  <tr>
    <td>0.03, 2+, RB</td>
    <td>995</td>
    <td>&minus;$12.75</td>
    <td>Same issues</td>
  </tr>
</table>

<p>
  Three fixes were applied on 2026-03-09 (marker: row 326, ticket 118101074): (1) breakeven timing
  reduced from &ge;2 to &ge;1 completed bars, (2) breakeven threshold changed from entry &plusmn; spread/2
  to exact entry price, and (3) timeout boundary corrected to the intended maximum wait duration. Post-fix performance showed material improvement, though TPSL mode
  remained superior in aggregate.
</p>

<h2>6. Crash Filter</h2>

<p>
  A crash detection filter prevents entry during extreme market dislocations (flash crashes, liquidity
  vacuums, fat-finger events) where the retracement signal's statistical properties break down:
</p>

<table>
  <tr>
    <th>Parameter</th>
    <th>Value</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>Tick rate threshold</td>
    <td>20 ticks/sec</td>
    <td>Minimum tick arrival rate to flag abnormal activity</td>
  </tr>
  <tr>
    <td>Average move threshold</td>
    <td>$0.06/tick</td>
    <td>Minimum average mid-price move per tick</td>
  </tr>
  <tr>
    <td>Detection window</td>
    <td>10 seconds</td>
    <td>Rolling window for tick rate and move calculations</td>
  </tr>
  <tr>
    <td>Cooldown period</td>
    <td>300 seconds (5 min)</td>
    <td>Suppression period after crash detection</td>
  </tr>
</table>

<p>
  The filter maintains a rolling 10-second window of tick timestamps and mid-price changes. Both
  conditions must be met simultaneously: tick rate &ge; 20/sec AND average move &ge; $0.06/tick.
  When triggered, all signal processing is suppressed for 5 minutes, preventing entry into the volatile
  aftermath of a crash event. During the 90-day evaluation period, the crash filter activated 7 times,
  preventing an estimated $340 in losses from entries that would have been filled at extreme prices.
</p>

<h2>7. Data &amp; Study Design</h2>

<h3>7.1 Dataset</h3>

<p>
  The study uses 90 days of continuous XAUUSD data from a live MetaTrader 5 feed, spanning Q4 2025
  through Q1 2026. Two data sources are used:
</p>

<table>
  <tr>
    <th>Data Type</th>
    <th>Source</th>
    <th>Volume</th>
    <th>Fields</th>
  </tr>
  <tr>
    <td>M1 OHLCV bars</td>
    <td>MT5 bar history API or CSV fallback</td>
    <td>~129,600 bars</td>
    <td>time, open, high, low, close, tick_volume, spread</td>
  </tr>
  <tr>
    <td>Tick data</td>
    <td>MT5 tick history API</td>
    <td>42.9 million ticks</td>
    <td>time_msc (millisecond), bid, ask, flags</td>
  </tr>
</table>

<p>
  Tick data is loaded in chunks of 2 million ticks to manage memory constraints. Each chunk is processed
  sequentially, with the break detection algorithm scanning forward from the signal bar's open time to
  identify the first tick crossing the last bar's close price.
</p>

<h3>7.2 Signal Universe</h3>

<p>
  Across all configurations and body thresholds, the signal detection algorithm identifies
  <strong>21,009 retracement signals</strong>. The distribution across configurations:
</p>

<ul>
  <li>0.03%, 2+ consec: ~12,400 signals (most permissive)</li>
  <li>0.03%, 3+ consec: ~5,800 signals</li>
  <li>0.05%, 2+ consec: ~2,100 signals</li>
  <li>0.05%, 3+ consec: ~700 signals (most restrictive)</li>
</ul>

<p>
  The live bid-ask spread during the sample period averaged <strong>$0.22</strong>, with a median of
  $0.20, a 5th percentile of $0.15 (London session), and a 95th percentile of $0.45 (Asian session
  off-hours). All PnL calculations use actual fill prices that incorporate the spread.
</p>

<h3>7.3 Entry Methods Tested</h3>

<p>
  Three entry methods are tested across all signal configurations:
</p>

<ol>
  <li>
    <strong>Break entry:</strong> A pending STOP order is placed at the last bar's close price
    (the last bar's close price). The MT5 server fills the order at tick granularity the instant price
    crosses the level, achieving zero polling latency. This is the fastest possible entry.
  </li>
  <li>
    <strong>Confirmation entry:</strong> The trader waits for the current (post-signal) bar to close,
    then enters at market. The confirmation bar must close in the reversal direction to trigger entry.
    Mean delay: 60 seconds (one full M1 bar).
  </li>
  <li>
    <strong>Sustain-wait entry:</strong> After the break level is crossed, the trader waits W seconds
    (W &isin; {1, 2, 3, 5, 10, 15, 20, 30}) for price to remain on the correct side of the break
    level for at least P percent of the window (P &isin; {50%, 60%, 70%, 80%, 90%}). If the condition
    is met, entry is at market at the prevailing price.
  </li>
</ol>

<h3>7.4 Exit Rules</h3>

<p>
  All three entry methods use identical TPSL exit parameters to isolate the effect of entry timing:
  take-profit at 25% of the run body, stop-loss at 2&times; the TP distance, and a timeout exit at 3
  bars after entry. These parameters correspond to the 0.03%, 3+ config (magic 991), which was selected
  as the baseline because it has the highest signal count among the 3+ consec configs.
</p>

<h2>8. Tick-Level Break Analysis</h2>

<h3>8.1 First Cross Detection Algorithm</h3>

<p>
  For each of the 21,009 signals, we load all ticks within the confirmation bar (the bar immediately
  following the last run bar) and scan for the first tick where the mid-price crosses the last bar's close price:
</p>

<p>
  The algorithm computes the mid-price at each tick as $\\text{mid} = (\\text{bid} + \\text{ask}) / 2$
  and scans forward from the bar's open time. For a BUY signal, the first tick where the mid-price
  exceeds the last bar's close is recorded as the break event. For a SELL signal, the first tick where
  the mid-price falls below the last bar's close is recorded. The time to break is the elapsed time
  in milliseconds between the bar's open and the first cross event.
</p>

<h3>8.2 Break Timing Statistics</h3>

<table>
  <tr>
    <th>Timing Metric</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Mean time to break</td>
    <td>2,432 ms</td>
  </tr>
  <tr>
    <td>Median time to break</td>
    <td>1,847 ms</td>
  </tr>
  <tr>
    <td>10th percentile</td>
    <td>312 ms</td>
  </tr>
  <tr>
    <td>25th percentile</td>
    <td>789 ms</td>
  </tr>
  <tr>
    <td>75th percentile</td>
    <td>3,421 ms</td>
  </tr>
  <tr>
    <td>90th percentile</td>
    <td>7,893 ms</td>
  </tr>
  <tr>
    <td>Breaks within 1 second</td>
    <td>38.4%</td>
  </tr>
  <tr>
    <td>Breaks within 5 seconds</td>
    <td>72.0%</td>
  </tr>
  <tr>
    <td>Breaks within 10 seconds</td>
    <td>84.7%</td>
  </tr>
  <tr>
    <td>Breaks within 30 seconds</td>
    <td>94.2%</td>
  </tr>
  <tr>
    <td>No break within 60 seconds</td>
    <td>5.8%</td>
  </tr>
</table>

<p>
  The distribution is heavily right-skewed: the majority of breaks occur within the first two seconds of
  the bar, but a long tail extends to 30+ seconds. The 5.8% of signals where no break occurs within the
  full minute represent cases where the run continues (the reversal does not materialise within that bar).
</p>

<h3>8.3 Sustain Rate Measurement</h3>

<p>
  After the first cross, we measure the <strong>sustain rate</strong>: the percentage of ticks that remain
  on the "correct" (reversal) side of the last bar's close price within a window of W seconds:
</p>

<p>
  The sustain rate is computed by examining all ticks within $W$ seconds of the first cross event. For
  each tick, the mid-price is classified as being on the "correct" (reversal) side or the "incorrect" side
  of the last bar's close price. The sustain rate is the percentage of ticks on the correct side:
  $\\text{sustain rate} = \\frac{\\text{ticks on correct side}}{\\text{total ticks in window}} \\times 100$.
</p>

<p>
  We also compute two additional tick-level metrics:
</p>

<ul>
  <li><strong>Break depth:</strong> The maximum penetration beyond the last bar's close price at each window size,
  defined as the maximum absolute mid-price deviation from the close level across all ticks within $W$ seconds of the first cross.</li>
  <li><strong>Break speed:</strong> The rate of penetration, computed as the 5-second break depth divided by 5.0 (USD per second).
  Mean break speed across all signals: $0.264/sec.</li>
</ul>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 260" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 3: Mean Sustain Rate by Window Size</text>
    <!-- Chart area: x=120..600, y=50..210 -->
    <!-- Y axis -->
    <line x1="120" y1="210" x2="600" y2="210" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="120" y1="50" x2="120" y2="210" stroke="#e5e7eb" stroke-width="1"/>
    <!-- Y gridlines & labels: 0%=210, 50%=130, 100%=50 -->
    <line x1="120" y1="130" x2="600" y2="130" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="120" y1="50" x2="600" y2="50" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <text x="110" y="214" text-anchor="end" fill="#6b7280" font-size="11">0%</text>
    <text x="110" y="134" text-anchor="end" fill="#6b7280" font-size="11">50%</text>
    <text x="110" y="54" text-anchor="end" fill="#6b7280" font-size="11">100%</text>
    <!-- Bars: 4 bars centered at x=195, 300, 405, 510, width=70 -->
    <!-- 73.1%: height=117, y=93 -->
    <rect x="160" y="93" width="70" height="117" rx="3" fill="#059669" opacity="1.0"/>
    <text x="195" y="85" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">73.1%</text>
    <text x="195" y="232" text-anchor="middle" fill="#374151" font-size="11">1s</text>
    <!-- 71.2%: height=114, y=96 -->
    <rect x="265" y="96" width="70" height="114" rx="3" fill="#059669" opacity="0.82"/>
    <text x="300" y="88" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">71.2%</text>
    <text x="300" y="232" text-anchor="middle" fill="#374151" font-size="11">3s</text>
    <!-- 69.4%: height=111, y=99 -->
    <rect x="370" y="99" width="70" height="111" rx="3" fill="#059669" opacity="0.64"/>
    <text x="405" y="91" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">69.4%</text>
    <text x="405" y="232" text-anchor="middle" fill="#374151" font-size="11">5s</text>
    <!-- 65.1%: height=104, y=106 -->
    <rect x="475" y="106" width="70" height="104" rx="3" fill="#059669" opacity="0.46"/>
    <text x="510" y="98" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">65.1%</text>
    <text x="510" y="232" text-anchor="middle" fill="#374151" font-size="11">10s</text>
    <!-- X axis label -->
    <text x="360" y="252" text-anchor="middle" fill="#374151" font-size="11">Window size</text>
  </svg>
  <p class="figure-caption">Figure 5: Mean sustain rate declines from 73.1% at 1 second to 65.1% at 10 seconds, reflecting the rapid dissipation of the microstructure imbalance driving the reversal.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/rolling_winrate.png" alt="Rolling win rate over the study period" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 6: Rolling win rate over the study period, demonstrating the stability of the break entry edge across different market conditions.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/study_01_spread_dynamics.png" alt="Bid-ask spread dynamics during signal windows" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 7: Bid-ask spread dynamics during signal windows. Spread widening at the break instant contributes to execution costs.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/study_02_autocorrelation.png" alt="Tick autocorrelation structure" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 8: Tick autocorrelation structure, showing the rapid decay of serial dependence that underpins the transient nature of the retracement edge.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/heatmap_hold_5s.png" alt="Tick consolidation: 5-second hold analysis" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 9: Tick consolidation analysis with a 5-second hold window, showing sustain rates across different signal quality thresholds.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/heatmap_hold_60s.png" alt="Tick consolidation: 60-second hold analysis" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 10: Tick consolidation analysis with a 60-second hold window. The deterioration in sustain rates over longer horizons confirms the transient nature of the edge.</p>
</div>

<p>
  The sustain rate drops from 73.1% at 1 second to 65.1% at 10 seconds. This 8-percentage-point decline
  reflects the rapid dissipation of the microstructure imbalance that drives the reversal. By 30 seconds,
  the sustain rate approaches 58%, barely above the 50% random baseline.
</p>

<h2>9. Results</h2>

<h3>9.0 Methodology Note: Simulation vs. Live Trading</h3>

<p>
  The results below are produced by replaying historical tick data through the strategy logic
  in a deterministic simulation environment. This approach provides exact reproducibility and
  allows controlled comparison between entry methods on identical signal sets. However, it
  differs from live trading in several important respects:
</p>

<table>
  <tr>
    <th>Aspect</th>
    <th>Simulation (this study)</th>
    <th>Live Execution</th>
  </tr>
  <tr>
    <td>Fill model</td>
    <td>Instantaneous at bid/ask</td>
    <td>Subject to requotes, slippage, partial fills</td>
  </tr>
  <tr>
    <td>Spread</td>
    <td>Fixed at $0.22 (session average)</td>
    <td>Variable; widens during news, rollover, low liquidity</td>
  </tr>
  <tr>
    <td>Market impact</td>
    <td>None (price path unchanged by orders)</td>
    <td>Non-zero for larger lot sizes</td>
  </tr>
  <tr>
    <td>Latency</td>
    <td>Zero (tick-synchronous)</td>
    <td>Network + broker processing (typically 5&ndash;50ms for MT5 STOP orders)</td>
  </tr>
  <tr>
    <td>Crash filter</td>
    <td>Not applied (all signals included)</td>
    <td>Active; blocks entries during high-volatility microstructure events</td>
  </tr>
</table>

<p>
  The absolute PnL figures should therefore be treated as <strong>upper bounds</strong> on
  achievable performance. The relative ranking of entry methods (break &gt; confirmation &gt;
  sustain-wait) is robust to these assumptions, as all methods face the same simulation conditions.
</p>

<h3>9.1 Break vs. Confirmation Entry</h3>

<table>
  <tr>
    <th>Entry Method</th>
    <th>Total PnL</th>
    <th>Profit Factor</th>
    <th>Win Rate</th>
    <th>Avg PnL/Trade</th>
  </tr>
  <tr>
    <td>Break (pending STOP)</td>
    <td><strong>+$39,277</strong></td>
    <td><strong>1.59</strong></td>
    <td>66.5%</td>
    <td>+$1.87</td>
  </tr>
  <tr>
    <td>Confirmation (bar close)</td>
    <td>+$26,631</td>
    <td>1.34</td>
    <td>60.5%</td>
    <td>+$1.27</td>
  </tr>
</table>

<div class="finding-box">
  <strong>Key Finding:</strong> The break entry outperforms confirmation by <strong>$12,646</strong>
  in total PnL and 0.25 in profit factor over 90 days. The difference is entirely attributable to
  superior fill prices, not higher signal quality.
</div>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 1: Cumulative PnL by Entry Method (90 days)</text>
    <line x1="220" y1="40" x2="220" y2="180" stroke="#e5e7eb" stroke-width="1"/>
    <!-- Break Entry -->
    <text x="210" y="72" text-anchor="end" fill="#374151" font-size="12">Break Entry</text>
    <rect x="220" y="56" width="370" height="26" rx="3" fill="#059669"/>
    <text x="596" y="74" fill="#1a1a2e" font-size="12" font-weight="600">+\$39,277</text>
    <!-- Confirmation Entry -->
    <text x="210" y="118" text-anchor="end" fill="#374151" font-size="12">Confirmation Entry</text>
    <rect x="220" y="102" width="250" height="26" rx="3" fill="#059669" opacity="0.55"/>
    <text x="476" y="120" fill="#1a1a2e" font-size="12" font-weight="600">+\$26,631</text>
    <!-- Confirmation Bar -->
    <text x="210" y="164" text-anchor="end" fill="#374151" font-size="12">Confirmation Bar</text>
    <rect x="127" y="148" width="93" height="26" rx="3" fill="#dc2626"/>
    <text x="70" y="166" fill="#1a1a2e" font-size="12" font-weight="600">&minus;\$9,923</text>
    <!-- Zero line label -->
    <text x="220" y="192" text-anchor="middle" fill="#6b7280" font-size="10">\$0</text>
  </svg>
  <p class="figure-caption">Figure 1: Break entry via pending STOP order outperforms confirmation entry by $12,646. The confirmation bar itself has negative expected value.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/fig01_equity_by_config.png" alt="Equity curves by strategy configuration" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 2: Equity curves by strategy configuration across the full 90-day evaluation period, showing the relative performance of each magic number.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/fig03_combined_equity.png" alt="Combined equity curve across all configurations" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 3: Combined equity curve across all configurations, demonstrating the aggregate profitability of the break entry approach.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/scalper/fig02_yearly_heatmap.png" alt="Yearly performance heatmap by configuration" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 4: Yearly performance heatmap by configuration, showing consistency of returns across different strategy variants.</p>
</div>

<h3>9.2 The Confirmation Bar: Drag, Not Edge</h3>

<p>
  To understand why confirmation underperforms, we isolate the PnL contribution of the confirmation
  bar itself &mdash; the period between the break and the confirmation entry. The confirmation bar is
  the M1 bar that immediately follows the last run bar. If this bar closes in the reversal direction,
  the confirmation entry triggers. If it closes in the run direction (continuation), no entry occurs.
</p>

<table>
  <tr>
    <th>Metric</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Confirmation bar PnL (total)</td>
    <td><strong>&minus;$9,923</strong></td>
  </tr>
  <tr>
    <td>Confirmation bar win rate</td>
    <td>45.3%</td>
  </tr>
  <tr>
    <td>Mean confirmation bar duration</td>
    <td>60 seconds</td>
  </tr>
  <tr>
    <td>Contribution to break-vs-confirm gap</td>
    <td>78.5% ($9,923 / $12,646)</td>
  </tr>
</table>

<p>
  The confirmation bar has a <strong>negative expected value</strong>. Waiting for it does not improve
  signal quality &mdash; it simply allows price to move against the intended entry, resulting in worse
  fills on every trade. The confirmation bar accounts for 78.5% of the total PnL gap between break and
  confirmation entries. The remaining 21.5% is attributable to the adverse selection effect: confirmation
  entries preferentially enter trades where the reversal was already well underway, skewing toward
  signals with less remaining upside.
</p>

<p>
  Decomposing further, the confirmation bar's contribution to the overall edge can be expressed as the
  fraction of the first bar's move that occurs during the confirmation period. Across all signals,
  41&ndash;50% of the total first-bar reversal move occurs within the confirmation bar itself. This means
  that by the time a confirmation entry triggers, nearly half the signal's profit potential has already
  been consumed by price movement.
</p>

<h3>9.3 Sustain Filter: Predictive but Unprofitable</h3>

<p>
  The sustain-5s filter (requiring price to sustain on the correct side for &ge;80% of the first
  5 seconds) does identify higher-quality signals: filtered trades show a <strong>64.5% win rate</strong>
  and a mean PnL of <strong>+$0.81 per trade</strong>. However, the sample size is severely reduced
  (only ~8,200 of 21,009 signals pass the filter), and the entry price is substantially worse than the
  break level. The net effect is negative: the improved signal quality does not compensate for the
  worse fills and reduced trade count.
</p>

<h3>9.4 Approach B: Sustain-Wait Market Entry</h3>

<p>
  We systematically test 40 combinations of window length W and sustain threshold P. In Approach B,
  the trader waits W seconds after the break, verifies that price sustained on the correct side for
  at least P percent of the window, and then enters at market at the prevailing price. This represents
  the most disciplined form of confirmation-based entry.
</p>

<table>
  <tr>
    <th>Window (s)</th>
    <th>&ge;50%</th>
    <th>&ge;60%</th>
    <th>&ge;70%</th>
    <th>&ge;80%</th>
    <th>&ge;90%</th>
  </tr>
  <tr>
    <td>1</td>
    <td>&minus;$1,204</td>
    <td>&minus;$1,587</td>
    <td>&minus;$1,943</td>
    <td>&minus;$2,102</td>
    <td>&minus;$2,456</td>
  </tr>
  <tr>
    <td>2</td>
    <td>&minus;$2,331</td>
    <td>&minus;$2,879</td>
    <td>&minus;$3,221</td>
    <td>&minus;$3,518</td>
    <td>&minus;$3,902</td>
  </tr>
  <tr>
    <td>3</td>
    <td>&minus;$3,497</td>
    <td>&minus;$3,990</td>
    <td>&minus;$4,387</td>
    <td>&minus;$4,701</td>
    <td>&minus;$5,134</td>
  </tr>
  <tr>
    <td>5</td>
    <td>&minus;$5,112</td>
    <td>&minus;$5,634</td>
    <td>&minus;$6,072</td>
    <td>&minus;$6,498</td>
    <td>&minus;$7,023</td>
  </tr>
  <tr>
    <td>10</td>
    <td>&minus;$7,845</td>
    <td>&minus;$8,321</td>
    <td>&minus;$8,876</td>
    <td>&minus;$9,310</td>
    <td>&minus;$9,899</td>
  </tr>
  <tr>
    <td>15</td>
    <td>&minus;$9,503</td>
    <td>&minus;$10,021</td>
    <td>&minus;$10,544</td>
    <td>&minus;$11,087</td>
    <td>&minus;$11,672</td>
  </tr>
  <tr>
    <td>20</td>
    <td>&minus;$10,784</td>
    <td>&minus;$11,309</td>
    <td>&minus;$11,877</td>
    <td>&minus;$12,405</td>
    <td>&minus;$12,998</td>
  </tr>
  <tr>
    <td>30</td>
    <td>&minus;$12,341</td>
    <td>&minus;$12,902</td>
    <td>&minus;$13,488</td>
    <td>&minus;$14,032</td>
    <td>&minus;$14,671</td>
  </tr>
</table>

<div class="finding-box">
  <strong>Key Finding:</strong> All 40 window &times; threshold combinations produce <strong>negative
  total PnL</strong>. There is no sustain parameter combination that improves on the break entry.
  The pattern is monotonic: longer windows and stricter thresholds produce worse results. The worst
  combination (30s window, &ge;90% threshold) loses $14,671 &mdash; a $53,948 underperformance
  relative to the break entry.
</div>

<p>
  The monotonicity of the results is notable and provides strong evidence against the sustain-wait
  approach. If there existed an optimal sustain window, we would expect to see a non-monotonic pattern
  with a minimum at some interior point. Instead, the results degrade smoothly with both window length
  and threshold, confirming that the relationship between delay and edge erosion is uniformly negative.
</p>

<h3>9.5 Entry Slippage by Delay</h3>

<p>
  The mechanism driving these results is entry slippage. We measure the mean adverse price movement
  from the break level as a function of delay. For each signal, we compute the mid-price at the break
  instant and at each subsequent time offset, then average the absolute adverse movement across all
  signals:
</p>

<table>
  <tr>
    <th>Delay After Break</th>
    <th>Mean Slippage</th>
    <th>% of Mean TP Consumed</th>
  </tr>
  <tr>
    <td>0 s (pending STOP)</td>
    <td>$0.00</td>
    <td>0%</td>
  </tr>
  <tr>
    <td>1 s</td>
    <td>$0.52</td>
    <td>21%</td>
  </tr>
  <tr>
    <td>3 s</td>
    <td>$1.11</td>
    <td>44%</td>
  </tr>
  <tr>
    <td>5 s</td>
    <td>$1.38</td>
    <td>55%</td>
  </tr>
  <tr>
    <td>10 s</td>
    <td>$1.85</td>
    <td>74%</td>
  </tr>
  <tr>
    <td>15 s</td>
    <td>$2.36</td>
    <td>94%</td>
  </tr>
  <tr>
    <td>30 s</td>
    <td>$3.14</td>
    <td>126% (exceeds TP)</td>
  </tr>
  <tr>
    <td>60 s (full bar)</td>
    <td>$4.21</td>
    <td>168%</td>
  </tr>
</table>

<p>
  At a mean TP of approximately $2.50, slippage of $1.11&ndash;$1.85 consumes 44&ndash;74% of the
  expected profit. By 15 seconds, slippage has consumed 94% of the TP, rendering the trade nearly
  breakeven in expectation. By 30 seconds, mean slippage <em>exceeds</em> the TP target, making
  the trade negative-expectation regardless of win rate. This explains why sustain filters, despite
  identifying higher-quality signals, cannot compensate for the fill degradation incurred by waiting.
</p>

<p>
  The slippage function is approximately concave: the marginal cost of delay is highest in the first
  few seconds (~$0.52/sec for 0&ndash;1s, ~$0.30/sec for 1&ndash;3s, ~$0.14/sec for 3&ndash;5s)
  and gradually flattens. This is consistent with the microstructure interpretation: the initial
  reversal impulse is strongest in the first seconds after the break, then decelerates as the
  order-flow imbalance dissipates.
</p>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 11: Entry Slippage vs Delay (seconds)</text>
    <!-- Chart area: x=80..640, y=50..230 -->
    <!-- Grid lines -->
    <line x1="80" y1="230" x2="640" y2="230" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="80" y1="185" x2="640" y2="185" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="80" y1="140" x2="640" y2="140" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="80" y1="95" x2="640" y2="95" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="80" y1="50" x2="640" y2="50" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="80" y1="50" x2="80" y2="230" stroke="#e5e7eb" stroke-width="1"/>
    <!-- Y axis labels -->
    <text x="70" y="234" text-anchor="end" fill="#6b7280" font-size="11">\$0.00</text>
    <text x="70" y="189" text-anchor="end" fill="#6b7280" font-size="11">\$0.50</text>
    <text x="70" y="144" text-anchor="end" fill="#6b7280" font-size="11">\$1.00</text>
    <text x="70" y="99" text-anchor="end" fill="#6b7280" font-size="11">\$1.50</text>
    <text x="70" y="54" text-anchor="end" fill="#6b7280" font-size="11">\$2.00</text>
    <!-- X axis labels: 0s=80, 3s=248, 5s=360, 10s=640 (scaled: x = 80 + delay * 56) -->
    <text x="80" y="250" text-anchor="middle" fill="#6b7280" font-size="11">0s</text>
    <text x="248" y="250" text-anchor="middle" fill="#6b7280" font-size="11">3s</text>
    <text x="360" y="250" text-anchor="middle" fill="#6b7280" font-size="11">5s</text>
    <text x="640" y="250" text-anchor="middle" fill="#6b7280" font-size="11">10s</text>
    <!-- Axis title -->
    <text x="360" y="272" text-anchor="middle" fill="#374151" font-size="11">Delay after break</text>
    <!-- Line path: (0,$0)=80,230  (3,$1.11)=248,130  (5,$1.38)=360,105.8  (10,$1.85)=640,63.5 -->
    <polyline points="80,230 248,130 360,106 640,64" fill="none" stroke="#059669" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- Dots -->
    <circle cx="80" cy="230" r="5" fill="#059669"/>
    <circle cx="248" cy="130" r="5" fill="#059669"/>
    <circle cx="360" cy="106" r="5" fill="#059669"/>
    <circle cx="640" cy="64" r="5" fill="#059669"/>
    <!-- Value labels -->
    <text x="80" y="222" text-anchor="middle" fill="#1a1a2e" font-size="10">\$0.00</text>
    <text x="248" y="122" text-anchor="middle" fill="#1a1a2e" font-size="10">\$1.11</text>
    <text x="360" y="98" text-anchor="middle" fill="#1a1a2e" font-size="10">\$1.38</text>
    <text x="640" y="56" text-anchor="middle" fill="#1a1a2e" font-size="10">\$1.85</text>
  </svg>
  <p class="figure-caption">Figure 11: Mean entry slippage as a function of delay after break. At 5 seconds, slippage of $1.38 consumes 55.2% of the mean TP target.</p>
</div>

<h2>10. Discussion</h2>

<h3>10.1 The Information-Timing Paradox</h3>

<p>
  The results present a clear and somewhat counterintuitive picture. The sustain metric is genuinely
  predictive: signals with high sustain rates do produce better outcomes conditional on entry at the
  break level. However, the sustain metric can only be measured <em>after</em> the delay has already
  occurred, and the cost of that delay exceeds the benefit of the improved selection.
</p>

<p>
  This is a manifestation of a general principle in market microstructure: <strong>information that
  requires time to observe is already priced in by the time it is available</strong>. The retracement
  edge is a transient microstructure phenomenon that exists at the break instant and decays monotonically
  thereafter. Any filtering mechanism that consumes time to evaluate will, by construction, enter at a
  worse price than the unfiltered instant entry.
</p>

<h3>10.2 Microstructure Interpretation</h3>

<p>
  The retracement signal's edge derives from order-flow imbalance. After N consecutive same-direction
  bars, the short-term order book is tilted: stop-losses accumulate on the trend side, and mean-reversion
  limit orders queue on the reversal side. The break of the last bar's close price triggers stop-loss
  cascades that provide initial momentum to the reversal, while mean-reversion orders add depth.
</p>

<p>
  This imbalance is self-correcting. As stops fire and limit orders fill, the order book re-equilibrates.
  The 73.1% to 65.1% decline in sustain rate from 1s to 10s directly measures the rate of this
  re-equilibration. By the time a sustain filter has collected enough evidence to make a quality judgment,
  the order-flow imbalance that created the edge has substantially dissipated.
</p>

<h3>10.3 The Confirmation Bar as Pure Cost</h3>

<p>
  The confirmation bar analysis further supports this interpretation. The confirmation bar's negative
  expected value (&minus;$9,923 over the sample, 45.3% win rate) demonstrates that it contains no
  directional information beyond what is already captured by the run signal itself. The bar exists in
  the data as pure slippage cost, not as a predictive feature.
</p>

<p>
  The 45.3% win rate is particularly informative. If the confirmation bar contained genuine information,
  its win rate would exceed 50% (it would correctly identify reversal direction more often than not).
  Instead, the sub-50% rate indicates that the confirmation bar's primary effect is to delay entry into
  trades that are already moving in the reversal direction, resulting in worse fills without improved
  directional accuracy.
</p>

<h3>10.4 Implications for EA Architecture</h3>

<p>
  The results have direct architectural implications for Expert Advisor design on MT5:
</p>

<ul>
  <li><strong>Use server-side STOP orders:</strong> Client-side polling loops, regardless of frequency
  (even at 100ms intervals), introduce delay that directly erodes the signal edge. STOP orders delegate
  fill detection to the MT5 server, which monitors ticks at the exchange level.</li>
  <li><strong>Pre-place orders before the break:</strong> The STOP order must be placed <em>during</em>
  the forming run, before the break occurs. This requires mid-bar detection (Path 1), not post-bar
  confirmation (Path 2).</li>
  <li><strong>Accept all signals:</strong> Do not filter by sustain quality, confirmation bars, or any
  other time-consuming criterion. The expected cost of filtering (worse fills) exceeds the expected
  benefit (better signal quality) across all tested parameter combinations.</li>
  <li><strong>Use ORDER_FILLING_RETURN for pending orders:</strong> Incorrect filling modes cause silent
  order rejection on many brokers. The filling mode must be hardcoded per broker, not auto-detected.</li>
</ul>

<h2>11. Conclusion</h2>

<p>
  A pure pending STOP order at the last bar's close price is the optimal entry mechanism for
  retracement scalping on XAUUSD M1 bars. The break entry achieves a profit factor of 1.59 and
  +$39,277 over 90 days, outperforming all confirmation and sustain-based alternatives. Every
  second of delay costs approximately $0.26 in mean entry slippage, and no post-hoc filter tested
  across 40 parameter combinations produces positive returns.
</p>

<p>
  The marginal cost of delay is highest in the first seconds: $0.52/sec for the first second, declining
  to ~$0.10/sec by 10&ndash;15 seconds. At a mean TP of $2.50, a 5-second delay consumes 55.2% of the
  expected profit, and a 15-second delay consumes 94%. By 30 seconds, mean slippage exceeds the TP target
  entirely, making the trade negative-expectation.
</p>

<p>
  The execution architecture should use MT5 server-side STOP orders placed during the forming run via
  mid-bar detection, with market-order fallback for cases where the price has already passed the stop
  level. Client-side polling loops, confirmation bars, and sustain filters all introduce delay that
  directly and monotonically erodes the signal edge.
</p>

<blockquote>
  The edge is not in knowing <em>which</em> breaks will succeed &mdash; it is in being at the exact
  break price when they do.
</blockquote>

<p>
  <em>Note:</em> All results in this paper are from historical tick replay simulation and should
  not be interpreted as guarantees of live performance. The strategy described here has been
  deployed in a live MT5 environment, but live performance data is not reported in this study.
  Readers should conduct their own validation before trading.
</p>
`;

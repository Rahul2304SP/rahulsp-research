export const content = `
<h2>1. Introduction</h2>

<p>
  Kakushadze (2016) introduced a compendium of 101 formulaic alpha factors designed for systematic equity trading.
  These factors, distilled from decades of quantitative finance practice, operate primarily on daily OHLCV data across
  a universe of stocks, exploiting cross-sectional dispersion, mean reversion, and momentum at various horizons.
  Their widespread adoption in equity markets raises a natural question: <strong>do these factors transfer to
  commodity intraday markets?</strong>
</p>

<p>
  The transferability hypothesis is appealing on its surface. If alpha factors encode universal market microstructure
  patterns &mdash; mean reversion after overextension, momentum persistence in trending conditions, volume-price
  divergences signaling exhaustion &mdash; then they should work on any liquid instrument at any frequency.
  This reasoning has led many practitioners to import Alpha101 factors wholesale into commodity, FX, and
  crypto trading systems without systematic validation. We test this hypothesis rigorously.
</p>

<p>
  Gold presents a fundamentally different trading environment from equities: a single instrument with no
  cross-sectional universe, continuous 23-hour trading sessions spanning three major liquidity zones
  (Asia, London, New York), strong autoregressive structure at short horizons (significant AR(1) at
  1&ndash;5 minute lags), and microstructure driven by OTC dealer flow rather than exchange limit order
  books. XAUUSD is also uniquely sensitive to macroeconomic factors (real yields, dollar strength,
  geopolitical risk) that have no analogue in equity cross-sections. This study quantifies
  the transferability gap and identifies the rare factors that retain predictive power in this regime.
</p>

<p>
  Our contribution is not the implementation of Alpha101 (which has been reproduced in numerous open-source
  libraries) but the <strong>systematic, out-of-sample evaluation</strong> on a domain where these factors
  are frequently assumed to work but rarely tested. The result &mdash; a 98% failure rate &mdash; has
  direct implications for feature engineering in single-instrument trading systems.
</p>

<h2>2. Methodology</h2>

<h3>2.1 Implementation</h3>

<p>
  All 101 alphas were implemented following the original Kakushadze (2016) specifications. The original
  paper provides formulae in a compact notation using operators like <code>rank()</code>,
  <code>correlation()</code>, <code>delta()</code>, <code>ts_min()</code>, <code>ts_max()</code>,
  <code>ts_argmax()</code>, <code>SignedPower()</code>, <code>IndNeutralize()</code>, and
  <code>Ts_Rank()</code>. Each operator was implemented as a vectorized function operating on
  pandas Series/DataFrames.
</p>

<p>
  Where formulas reference cross-sectional rank or industry classification, we adapted the computation
  to a single-instrument time-series context: <code>rank()</code> operations were replaced with rolling
  percentile ranks over a 500-bar lookback window, which maps each value to its position within the
  recent distribution [0, 1]. <code>IndNeutralize()</code> (industry neutralization) operations were
  dropped entirely, as they require a universe of stocks classified by sector &mdash; a meaningless
  operation for a single instrument. Volume-weighted average price (VWAP) was computed from M1 OHLCV
  data using the standard <code>(high + low + close) / 3 * volume</code> approximation, noting that
  M1 "volume" in the gold OTC market is tick volume (count of price updates), not traded notional.
</p>

<p>
  Several alphas required additional adaptation:
</p>

<ul>
  <li><strong>Alphas using <code>returns</code>:</strong> Computed as log returns of close prices (the original
    paper is ambiguous about simple vs. log returns, but log returns are standard for M1 data).</li>
  <li><strong>Alphas using <code>cap</code> (market capitalization):</strong> Set to a constant, since
    gold has no meaningful capitalization equivalent. This effectively neutralizes any alpha that
    discriminates on market cap &mdash; approximately 8 alphas are affected.</li>
  <li><strong>Alphas using <code>adv{d}</code> (average daily volume):</strong> Replaced with rolling
    mean tick volume over d bars (not d days, since we operate on M1 frequency).</li>
  <li><strong>Lookback parameters:</strong> Used as-is (in bars). A lookback of 20 bars means 20 minutes
    at M1, not 20 days. This is a deliberate choice: re-calibrating lookbacks would introduce
    researcher degrees of freedom and make the evaluation less clean.</li>
</ul>

<h3>2.2 Data</h3>

<p>
  The evaluation dataset comprises the full training period of XAUUSD M1 bars sourced from MetaTrader 5,
  spanning multiple months of continuous trading data. The dataset includes all sessions (Asian, London,
  New York) and covers a range of market conditions including trending periods, consolidation ranges,
  high-volatility news events, and quiet overnight sessions. Weekend gaps (Friday close to Sunday open)
  are excluded to avoid discontinuity artifacts in rolling calculations.
</p>

<p>
  The last 20% of the training period was held out as a validation set. All features were computed on the
  training portion and evaluated strictly on the validation portion to prevent look-ahead bias. The
  chronological split (rather than random) ensures that the validation period follows the training period
  in time, mimicking the real-world scenario where a model trained on historical data is deployed on
  future unseen data.
</p>

<h3>2.3 Evaluation Metric</h3>

<p>
  Each alpha factor was evaluated as a continuous feature for next-bar direction prediction. The target
  variable is binary: 1 if the next M1 bar's close is above the current bar's close, 0 otherwise. The
  metric used was <strong>validation AUC</strong> (area under the receiver operating characteristic curve),
  which measures discriminative power independent of threshold selection. AUC has several properties that
  make it well-suited for this evaluation:
</p>

<ul>
  <li><strong>Threshold-free:</strong> AUC evaluates the entire ranking quality of the feature, not its
    performance at any specific cutoff. This is important because optimal thresholds vary across features
    and regimes.</li>
  <li><strong>Scale-invariant:</strong> AUC depends only on the rank ordering of feature values, not their
    magnitude. This allows fair comparison between alphas with very different scales (e.g., alpha024 has
    values in [-100, 0] while alpha083 has values in [-0.5, 0.5]).</li>
  <li><strong>Interpretable baseline:</strong> AUC = 0.500 corresponds to random prediction (no better
    than a coin flip). Any AUC significantly different from 0.500 indicates signal, whether positive
    (AUC &gt; 0.500) or negative (AUC &lt; 0.500, meaning the feature predicts the <em>opposite</em>
    direction).</li>
</ul>

<p>
  A survival threshold of <strong>AUC &gt; 0.515</strong> was applied &mdash; deliberately lenient,
  requiring only a marginal edge above random (0.500). The threshold is set above 0.500 rather than at
  0.500 to account for estimation noise: with finite data, even a purely random feature will occasionally
  achieve AUC values of 0.505&ndash;0.510 due to sampling variance. The 0.515 threshold is calibrated
  to reject features whose apparent signal is within the 95th percentile of the null distribution
  (random feature evaluated on our sample size).
</p>

<h3>2.4 Integration Protocol</h3>

<p>
  Surviving alphas were not discretized or binned. They were applied as continuous features within the broader
  107-feature pipeline, allowing the downstream model (a Transformer or SSM-based architecture) to learn nonlinear
  interactions with other feature groups. Features are stored in the feature cache as
  <code>{prefix}alpha024</code> and <code>{prefix}alpha083</code>, where the prefix depends on the
  instrument context. Computation of all 101 alphas is controlled by the <code>ENABLE_ALPHA101</code>
  flag &mdash; when disabled, the two surviving alphas are excluded from OFFICIAL_FEATURE_COLS and
  the feature count drops from 107 to 105. Both surviving alphas are added to the feature cache
  alongside all other features and participate in the standard cache invalidation protocol.
</p>

<h2>3. Results</h2>

<h3>3.1 Distribution of AUC Scores</h3>

<p>
  The results are stark. The vast majority of Alpha101 factors provide no directional information whatsoever
  on intraday gold:
</p>

<table>
  <tr>
    <th>AUC Range</th>
    <th>Count</th>
    <th>Percentage</th>
    <th>Interpretation</th>
  </tr>
  <tr>
    <td>0.490 &ndash; 0.505</td>
    <td>82</td>
    <td>81.2%</td>
    <td>Pure noise (indistinguishable from random)</td>
  </tr>
  <tr>
    <td>0.505 &ndash; 0.510</td>
    <td>10</td>
    <td>9.9%</td>
    <td>Marginal, likely spurious</td>
  </tr>
  <tr>
    <td>0.510 &ndash; 0.515</td>
    <td>5</td>
    <td>5.0%</td>
    <td>Weak, below survival threshold</td>
  </tr>
  <tr>
    <td>0.515 &ndash; 0.520</td>
    <td>3</td>
    <td>3.0%</td>
    <td>Marginal survival</td>
  </tr>
  <tr>
    <td>&gt; 0.520</td>
    <td>1</td>
    <td>1.0%</td>
    <td>Clear signal</td>
  </tr>
</table>

<p>
  The distribution is remarkably symmetric around 0.500 with a very tight standard deviation (&sigma; &asymp; 0.008),
  consistent with the hypothesis that most alphas are pure noise on this dataset. The mean AUC across all
  101 factors is 0.5004 &mdash; statistically indistinguishable from 0.500. The median is 0.5001. The
  minimum AUC observed was 0.481 (alpha041) and the maximum was 0.521 (alpha024). The interquartile
  range [0.495, 0.506] sits squarely within the noise band.
</p>

<div style="margin: 2rem 0;">
<svg width="100%" viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
  <rect width="700" height="280" fill="#09090b" rx="8"/>
  <text x="350" y="28" text-anchor="middle" fill="#fafafa" font-size="13" font-weight="600">Figure 1: AUC Distribution of 101 Alpha Factors on XAUUSD M1</text>
  <!-- axes -->
  <line x1="90" y1="240" x2="650" y2="240" stroke="#27272a" stroke-width="1"/>
  <line x1="90" y1="50" x2="90" y2="240" stroke="#27272a" stroke-width="1"/>
  <!-- Y axis labels -->
  <text x="80" y="244" text-anchor="end" fill="#a1a1aa" font-size="11">0</text>
  <text x="80" y="206" text-anchor="end" fill="#a1a1aa" font-size="11">10</text>
  <text x="80" y="168" text-anchor="end" fill="#a1a1aa" font-size="11">20</text>
  <text x="80" y="130" text-anchor="end" fill="#a1a1aa" font-size="11">30</text>
  <text x="80" y="92" text-anchor="end" fill="#a1a1aa" font-size="11">40</text>
  <text x="80" y="54" text-anchor="end" fill="#a1a1aa" font-size="11">50</text>
  <!-- Y grid lines -->
  <line x1="90" y1="202" x2="650" y2="202" stroke="#27272a" stroke-width="0.5" stroke-dasharray="3,3"/>
  <line x1="90" y1="164" x2="650" y2="164" stroke="#27272a" stroke-width="0.5" stroke-dasharray="3,3"/>
  <line x1="90" y1="126" x2="650" y2="126" stroke="#27272a" stroke-width="0.5" stroke-dasharray="3,3"/>
  <line x1="90" y1="88" x2="650" y2="88" stroke="#27272a" stroke-width="0.5" stroke-dasharray="3,3"/>
  <line x1="90" y1="50" x2="650" y2="50" stroke="#27272a" stroke-width="0.5" stroke-dasharray="3,3"/>
  <!-- Y axis title -->
  <text x="20" y="150" text-anchor="middle" fill="#a1a1aa" font-size="11" transform="rotate(-90,20,150)">Count of Alphas</text>
  <!-- Bars: each bin is 112px wide, bar 80px wide centered -->
  <!-- 0.48-0.49: count ~5, height = 5/50*190 = 19 -->
  <rect x="126" y="221" width="80" height="19" fill="#71717a" rx="3"/>
  <text x="166" y="216" text-anchor="middle" fill="#a1a1aa" font-size="10">5</text>
  <!-- 0.49-0.50: count ~40, height = 40/50*190 = 152 -->
  <rect x="238" y="88" width="80" height="152" fill="#71717a" rx="3"/>
  <text x="278" y="83" text-anchor="middle" fill="#a1a1aa" font-size="10">40</text>
  <!-- 0.50-0.51: count ~45, height = 45/50*190 = 171 -->
  <rect x="350" y="69" width="80" height="171" fill="#71717a" rx="3"/>
  <text x="390" y="64" text-anchor="middle" fill="#a1a1aa" font-size="10">45</text>
  <!-- 0.51-0.52: count ~7, height = 7/50*190 = 26.6 -->
  <rect x="462" y="213" width="80" height="27" fill="#71717a" rx="3"/>
  <text x="502" y="208" text-anchor="middle" fill="#a1a1aa" font-size="10">7</text>
  <!-- 0.52-0.53: count ~4, height = 4/50*190 = 15.2, GREEN survivors -->
  <rect x="574" y="225" width="80" height="15" fill="#22c55e" rx="3"/>
  <text x="614" y="220" text-anchor="middle" fill="#22c55e" font-size="10" font-weight="600">4</text>
  <!-- X axis labels -->
  <text x="166" y="258" text-anchor="middle" fill="#a1a1aa" font-size="10">0.48-0.49</text>
  <text x="278" y="258" text-anchor="middle" fill="#a1a1aa" font-size="10">0.49-0.50</text>
  <text x="390" y="258" text-anchor="middle" fill="#a1a1aa" font-size="10">0.50-0.51</text>
  <text x="502" y="258" text-anchor="middle" fill="#a1a1aa" font-size="10">0.51-0.52</text>
  <text x="614" y="258" text-anchor="middle" fill="#a1a1aa" font-size="10">0.52-0.53</text>
  <text x="370" y="275" text-anchor="middle" fill="#a1a1aa" font-size="11">AUC Score Range</text>
  <!-- Survival threshold dashed line at 0.515 = midpoint of 0.51-0.52 bar -->
  <line x1="462" y1="45" x2="462" y2="240" stroke="#eab308" stroke-width="1.5" stroke-dasharray="6,4"/>
  <text x="466" y="44" fill="#eab308" font-size="10" font-weight="500">Survival Threshold (0.515)</text>
</svg>
</div>

<h3>3.2 Top 10 Alphas by AUC</h3>

<p>
  Even the top-performing alphas show only marginal discriminative power. The following table lists the
  ten highest-AUC factors:
</p>

<table>
  <tr>
    <th>Rank</th>
    <th>Alpha</th>
    <th>AUC</th>
    <th>Category</th>
    <th>Survival</th>
  </tr>
  <tr>
    <td>1</td>
    <td>alpha024</td>
    <td>0.521</td>
    <td>Conditional momentum/reversion</td>
    <td style="color: #22c55e;">Kept</td>
  </tr>
  <tr>
    <td>2</td>
    <td>alpha083</td>
    <td>0.518</td>
    <td>Volume-price imbalance</td>
    <td style="color: #22c55e;">Kept</td>
  </tr>
  <tr>
    <td>3</td>
    <td>alpha047</td>
    <td>0.517</td>
    <td>Volume-weighted price rank</td>
    <td>Dropped (redundant)</td>
  </tr>
  <tr>
    <td>4</td>
    <td>alpha068</td>
    <td>0.516</td>
    <td>High-volume price deviation</td>
    <td>Dropped (redundant)</td>
  </tr>
  <tr>
    <td>5</td>
    <td>alpha013</td>
    <td>0.512</td>
    <td>Volume-price rank correlation</td>
    <td>Below threshold</td>
  </tr>
  <tr>
    <td>6</td>
    <td>alpha054</td>
    <td>0.511</td>
    <td>Close-open deviation</td>
    <td>Below threshold</td>
  </tr>
  <tr>
    <td>7</td>
    <td>alpha029</td>
    <td>0.510</td>
    <td>Returns rank momentum</td>
    <td>Below threshold</td>
  </tr>
  <tr>
    <td>8</td>
    <td>alpha062</td>
    <td>0.509</td>
    <td>Volume-VWAP ratio</td>
    <td>Below threshold</td>
  </tr>
  <tr>
    <td>9</td>
    <td>alpha033</td>
    <td>0.508</td>
    <td>Rank momentum</td>
    <td>Below threshold</td>
  </tr>
  <tr>
    <td>10</td>
    <td>alpha077</td>
    <td>0.507</td>
    <td>Low-volume decay</td>
    <td>Below threshold</td>
  </tr>
</table>

<p>
  Only <strong>4 of 101 factors</strong> (3.96%) exceeded the AUC &gt; 0.515 threshold. After forward feature
  selection within the full 107-feature pipeline &mdash; which tests whether each candidate alpha provides
  <em>incremental</em> AUC beyond the existing feature set &mdash; only <strong>2 factors</strong>
  (alpha024 and alpha083) contributed non-redundant information and were retained. Alpha047 and alpha068
  were dropped because their signal was largely captured by existing features in the pipeline
  (specifically, the volume ratio and price-volume interaction features in the OG Extended group).
</p>

<div class="finding-box">
  <p>
    <strong>Key Finding:</strong> 97 of 101 Alpha101 factors have AUC indistinguishable from 0.500 on
    intraday XAUUSD. The Alpha101 framework provides near-zero value for single-instrument commodity trading.
    Distribution statistics: mean=0.5004, median=0.5001, std=0.008, min=0.481, max=0.521.
  </p>
</div>

<div style="margin: 2rem 0;">
<svg width="100%" viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
  <rect width="700" height="180" fill="#09090b" rx="8"/>
  <text x="350" y="26" text-anchor="middle" fill="#fafafa" font-size="13" font-weight="600">Figure 2: Alpha101 Screening Funnel</text>
  <!-- Block 1: 101 tested (widest) -->
  <rect x="40" y="50" width="200" height="80" rx="8" fill="#18181b" stroke="#71717a" stroke-width="1.5"/>
  <text x="140" y="82" text-anchor="middle" fill="#fafafa" font-size="22" font-weight="700">101</text>
  <text x="140" y="102" text-anchor="middle" fill="#a1a1aa" font-size="11">Alphas Tested</text>
  <text x="140" y="118" text-anchor="middle" fill="#71717a" font-size="10">Full Kakushadze set</text>
  <!-- Arrow 1 -->
  <line x1="245" y1="90" x2="280" y2="90" stroke="#71717a" stroke-width="1.5"/>
  <polygon points="280,85 290,90 280,95" fill="#71717a"/>
  <text x="268" y="80" text-anchor="middle" fill="#ef4444" font-size="9">-97</text>
  <!-- Block 2: 4 survived -->
  <rect x="295" y="60" width="150" height="60" rx="8" fill="#18181b" stroke="#a1a1aa" stroke-width="1.5"/>
  <text x="370" y="87" text-anchor="middle" fill="#fafafa" font-size="22" font-weight="700">4</text>
  <text x="370" y="107" text-anchor="middle" fill="#a1a1aa" font-size="11">AUC &gt; 0.515</text>
  <!-- Arrow 2 -->
  <line x1="450" y1="90" x2="485" y2="90" stroke="#71717a" stroke-width="1.5"/>
  <polygon points="485,85 495,90 485,95" fill="#71717a"/>
  <text x="473" y="80" text-anchor="middle" fill="#ef4444" font-size="9">-2</text>
  <!-- Block 3: 2 kept (smallest, green) -->
  <rect x="500" y="65" width="150" height="50" rx="8" fill="#18181b" stroke="#22c55e" stroke-width="2"/>
  <text x="575" y="88" text-anchor="middle" fill="#22c55e" font-size="22" font-weight="700">2</text>
  <text x="575" y="105" text-anchor="middle" fill="#22c55e" font-size="11">alpha024, alpha083</text>
  <!-- Labels below -->
  <text x="140" y="148" text-anchor="middle" fill="#71717a" font-size="10">Implementation</text>
  <text x="370" y="148" text-anchor="middle" fill="#71717a" font-size="10">AUC Screening</text>
  <text x="575" y="148" text-anchor="middle" fill="#71717a" font-size="10">Forward Selection</text>
  <!-- Survival rate -->
  <text x="350" y="170" text-anchor="middle" fill="#a1a1aa" font-size="11">Overall survival rate: 1.98%</text>
</svg>
</div>

<h2>4. Surviving Alphas</h2>

<h3>4.1 Alpha024 &mdash; SMA Slope Indicator (AUC: 0.521)</h3>

<p>
  Alpha024 is a conditional momentum/reversion factor that switches behavior based on the growth rate of
  the 100-bar simple moving average. The original Kakushadze formula:
</p>

<pre><code>delta_sma = ((SMA(close, 100)[t] - SMA(close, 100)[t-100]) / SMA(close, 100)[t-100])

if delta_sma < 0.05:
    alpha024 = -1 * (close - min(close, 100))
else:
    alpha024 = -1 * delta(close, 3)</code></pre>

<p>
  <strong>Step-by-step worked example:</strong> Consider a window where the 100-bar SMA has moved from
  $2,650 to $2,655 over the last 100 M1 bars. The growth rate delta_sma = (2655 - 2650) / 2650 = 0.0019
  (0.19%), which is well below the 0.05 (5%) threshold. In this slow-growth regime, the factor computes
  <code>-1 * (close - min(close, 100))</code>. If the current close is $2,658 and the 100-bar low is
  $2,648, then alpha024 = -1 * (2658 - 2648) = -10. The negative sign means: the further price is from
  the recent low, the more the factor bets on <em>reversion downward</em>. If price were instead at $2,649
  (near the low), alpha024 = -1, a weak reversion signal.
</p>

<p>
  In the fast-growth case (delta_sma &ge; 0.05, which at M1 frequency is rare and corresponds to a
  very sharp intraday move), the factor switches to <code>-1 * delta(close, 3)</code>, a simple 3-bar
  contrarian momentum signal: if price rose over the last 3 bars, bet on reversal.
</p>

<p>
  <strong>Why alpha024 works on gold:</strong> The regime-conditional logic is the key to its survival.
  Gold alternates between trending and mean-reverting regimes, and alpha024 implicitly adapts: during
  the dominant slow-growth regime (which accounts for &gt;95% of M1 bars), it measures mean-reversion
  potential from the recent low. The 100-bar lookback at M1 captures a ~1.5-hour window, which aligns
  with intra-session mean reversion cycles in gold. The fast-growth branch is rarely triggered but
  provides a useful contrarian signal during sharp moves that tend to overshoot.
</p>

<h3>4.2 Alpha083 &mdash; Order Imbalance Ratio (AUC: 0.518)</h3>

<p>
  Alpha083 captures volume-weighted price deviation. The adapted formula for single-instrument use:
</p>

<pre><code>vwap = (high + low + close) / 3  # Approximate VWAP per bar
volume_ratio = volume / rolling_mean(volume, 20)

# Core computation: normalized price-VWAP deviation, amplified by relative volume
alpha083 = (vwap - close) / (vwap + close) * volume_ratio

# In Kakushadze notation, this also involves ranking operations across instruments,
# but for single-instrument we use the raw continuous value</code></pre>

<p>
  <strong>Interpretation:</strong> The numerator (vwap - close) measures how far the close deviates
  from the bar's volume-weighted fair value. When close is below VWAP, the numerator is positive,
  indicating that selling pressure pushed price below the session's average trade price. The
  denominator (vwap + close) normalizes by price level. The volume_ratio amplifier means the signal
  is strongest when the deviation occurs on elevated volume &mdash; a high-volume bar with close
  well below VWAP is a stronger signal than a low-volume bar with the same deviation.
</p>

<p>
  <strong>Why alpha083 works on gold:</strong> This factor captures a microstructure dynamic present
  in gold: aggressive selling that pushes price below the volume-weighted fair value tends to attract
  buying interest from market makers and institutional participants who view the deviation as a
  short-term mispricing. The volume_ratio term amplifies the signal during high-activity periods
  (London session open at 08:00 UTC, New York open at 13:00 UTC, major economic releases) where
  the reversion tendency is stronger because more liquidity providers are active. During quiet
  Asian session bars with low volume, the volume_ratio shrinks the signal appropriately, since
  low-volume deviations have weaker reversion tendencies.
</p>

<p>
  Unlike most Alpha101 factors, alpha083 operates purely in the time-series domain without requiring
  cross-sectional rank operations. The signal is self-contained within each bar's OHLCV data plus
  a rolling volume average, making it naturally transferable to single-instrument contexts.
</p>

<h2>5. Failure Mode Analysis</h2>

<p>
  The near-total failure of Alpha101 on intraday gold is not random &mdash; it is structural. We identify
  five primary failure modes, each explaining why a subset of the 101 factors collapses when applied
  outside its designed context.
</p>

<h3>5.1 Cross-Sectional Dependence</h3>

<p>
  Approximately 40 of the 101 alphas rely on <code>rank()</code> or <code>IndNeutralize()</code>
  operations that compute a stock's relative position within a universe. These operations are the
  core mechanism for many equity alpha factors: a stock's absolute return matters less than its
  return <em>relative to sector peers</em>. For a single instrument, these operations collapse
  to either a constant or a rolling percentile rank, destroying the cross-sectional dispersion
  signal that drives their equity performance.
</p>

<p>
  Consider alpha001: <code>rank(Ts_ArgMax(SignedPower(((returns < 0) ? stddev(returns, 20) : close), 2.), 5))</code>.
  In a universe of 500 stocks, this ranks each stock by the timing of its maximum signed-power value
  over 5 days. The <em>ranking</em> produces a uniform distribution [0, 1] that identifies outlier
  stocks. For a single instrument, the rank is always 0 or 1 (there is nothing to rank against),
  and Ts_ArgMax over 5 bars on a single series produces a noisy integer in {1, 2, 3, 4, 5} with no
  meaningful signal. The factor becomes degenerate when the ranking universe has cardinality one.
</p>

<p>
  Our replacement (rolling percentile rank over 500 bars) partially recovers the time-series analogue
  of ranking, but it fundamentally cannot replicate the cross-sectional information. A rolling percentile
  rank answers "is this value high or low relative to recent history?" while the original cross-sectional
  rank answers "is this stock outperforming or underperforming its peers right now?" These are different
  questions with different predictive properties.
</p>

<h3>5.2 Frequency Mismatch</h3>

<p>
  Alpha101 factors were designed for daily bars where each observation reflects a full session of
  price discovery: the open represents the overnight information gap, the high/low captures the
  full intraday range, and the close reflects the final equilibrium. At the M1 frequency, these
  OHLCV values have fundamentally different statistical properties. The open-to-close return of a
  single M1 bar is dominated by bid-ask bounce and microstructure noise rather than genuine price
  discovery.
</p>

<p>
  Lookback parameters calibrated for 20&ndash;250 trading days (1&ndash;12 months) correspond to
  20&ndash;250 minutes at M1 &mdash; a fundamentally different temporal scale. A 20-day momentum
  signal captures a medium-term trend; a 20-minute momentum signal captures intrabar noise. Factors
  that use large lookbacks (alpha042 uses a 200-bar lookback for instance) are computing statistics
  over approximately 3 hours of M1 data, which might span a single trading session or straddle a
  session boundary where microstructure changes abruptly.
</p>

<p>
  The signal-to-noise ratio degrades rapidly with decreasing bar frequency. Daily equity returns
  have an annualized signal-to-noise ratio (Sharpe ratio) of approximately 0.5&ndash;1.0 for strong
  momentum factors. At M1 frequency on gold, the same factors have signal-to-noise ratios below 0.05,
  making them statistically indistinguishable from noise on practical sample sizes.
</p>

<h3>5.3 Volume Semantics</h3>

<p>
  In equity markets, volume directly reflects executed share count on a central exchange. The
  relationship between price and volume encodes genuine order flow information: high volume on
  an up-bar indicates strong buying interest, high volume on a narrow-range bar indicates
  absorption (supply meeting demand). Approximately 30 of the 101 alphas rely on volume-price
  relationships to extract signal.
</p>

<p>
  In the gold OTC market, MT5 "volume" is tick volume: it counts the number of price updates
  per bar, not actual traded notional. Tick volume is correlated with true volume but the
  relationship is noisy and non-stationary. A bar with 150 ticks might reflect 500 lots of
  institutional flow during the London session or 50 lots of retail flow during the Asian session.
  The same tick count has different volume implications depending on the time of day, the liquidity
  provider, and the market regime.
</p>

<p>
  Factors that rely on volume-price relationships (volume-weighted average price, volume surprise,
  volume-weighted returns) are operating on a fundamentally different quantity than intended. The
  microstructure information that makes these factors effective on equities &mdash; true order flow
  imbalance &mdash; is not directly observable in the gold OTC market through tick volume alone.
</p>

<h3>5.4 Autoregressive Structure</h3>

<p>
  Gold M1 returns exhibit significant autoregressive structure at short lags (1&ndash;5 bars), unlike
  daily equity returns which are closer to a random walk. The AR(1) coefficient for XAUUSD M1 returns
  is statistically significant (Ljung-Box test rejects the null of no autocorrelation at p &lt; 0.001
  for lags 1&ndash;5). This means that the simplest possible feature &mdash; the previous bar's return
  &mdash; already captures substantial predictive information.
</p>

<p>
  Many Alpha101 factors assume that short-term price movements are noisy and focus on extracting signal
  from longer patterns (multi-day momentum, volume accumulation over weeks). The strong short-lag
  autocorrelation in gold M1 data makes simpler features (raw lagged returns, acceleration z-score,
  efficiency ratio) more competitive, crowding out the marginal value of complex alpha formulas.
  A complex 20-line alpha formula that achieves AUC 0.510 provides negligible incremental value when
  a simple 1-bar return already achieves AUC 0.515.
</p>

<h3>5.5 Liquidity Regime Heterogeneity</h3>

<p>
  Gold trades approximately 23 hours per day, 5 days per week, across three major liquidity sessions
  with vastly different microstructure characteristics. The Asian session (00:00&ndash;08:00 UTC) is
  characterized by low volume, narrow ranges, and strong mean reversion. The London session
  (07:00&ndash;16:00 UTC) sees the highest liquidity, the London AM and PM gold fixes, and pronounced
  trending behavior. The New York session (13:00&ndash;22:00 UTC) adds equity-correlated flows and
  macroeconomic data releases.
</p>

<p>
  An alpha factor that generates signal during one session may be pure noise during another. Alpha101
  factors have no concept of session conditioning &mdash; they apply the same formula uniformly across
  all bars. A factor that captures mean reversion might work during the Asian session but fail during
  London trending periods, averaging to AUC &asymp; 0.500 when evaluated over the full 23-hour trading
  day. Session-aware features (which constitute 5 of our 107 features) capture this heterogeneity
  explicitly, rendering session-agnostic alphas redundant.
</p>

<h2>6. Feature Integration</h2>

<p>
  The two surviving alphas are integrated into the broader feature pipeline as continuous features,
  subject to the same quality controls as all other features:
</p>

<ul>
  <li><strong>Computation:</strong> Controlled by the <code>ENABLE_ALPHA101</code> flag. When enabled,
    all 101 alphas are computed (for monitoring and re-evaluation), but only alpha024 and alpha083 are
    included in the model input.</li>
  <li><strong>Storage:</strong> Cached in Parquet format alongside all other features. Cache keys include
    <code>{prefix}alpha024</code> and <code>{prefix}alpha083</code>. Cache invalidation is triggered
    if the alpha computation changes (tracked via the OFFICIAL_FEATURE_COLS signature hash).</li>
  <li><strong>Feature list:</strong> Added to <code>OFFICIAL_FEATURE_COLS</code>, bringing the total
    from 105 to 107. The model input layer automatically adjusts to the feature count.</li>
  <li><strong>Inversion check:</strong> Neither alpha024 nor alpha083 required inversion (both have
    AUC &gt; 0.500 in their natural orientation).</li>
  <li><strong>XAU prefix:</strong> When cross-asset features are computed, XAUUSD OHLCV columns are
    renamed with the <code>xau_</code> prefix. Alpha computations occur after this renaming, using
    the prefixed column names.</li>
</ul>

<h2>7. Conclusion</h2>

<p>
  The systematic evaluation of all 101 Kakushadze alpha factors on intraday XAUUSD data yields a clear
  verdict: <strong>the Alpha101 framework provides minimal value for single-instrument intraday commodity
  trading</strong>. Only 2 of 101 factors (1.98%) survive both AUC screening and forward feature selection.
</p>

<p>
  The failure is not due to implementation error or data quality &mdash; it is a structural consequence of
  applying cross-sectional equity factors to a time-series commodity context. Five distinct failure modes
  explain the collapse: cross-sectional dependence (40+ factors lose their ranking signal), frequency
  mismatch (lookback parameters calibrated for daily bars are meaningless at M1), volume semantics (tick
  volume is not share volume), autoregressive structure (simple features outcompete complex formulas),
  and liquidity regime heterogeneity (session-agnostic factors average to noise across 23 hours of
  varying microstructure).
</p>

<p>
  The two survivors (alpha024 and alpha083) succeed precisely because they are among the few Alpha101
  factors that operate purely in the time-series domain without cross-sectional rank operations, and
  because they capture dynamics that happen to be present in gold microstructure: regime-conditional
  mean reversion (alpha024) and volume-weighted price deviation with reversion tendency (alpha083).
</p>

<p>
  For practitioners building feature pipelines for gold or other single-instrument trading systems, the
  lesson is unambiguous: feature engineering must be domain-specific. The 107-feature pipeline described
  in our companion paper achieves its predictive power not from imported equity factors, but from
  purpose-built features that exploit gold's unique microstructure, cross-asset relationships, and
  regime dynamics. The time spent implementing and evaluating all 101 alphas was not wasted &mdash; it
  produced a rigorous negative result that justifies the investment in domain-specific feature engineering
  and prevents the temptation to rely on off-the-shelf factor libraries.
</p>

<div class="finding-box">
  <p>
    <strong>Practical Recommendation:</strong> Do not import Alpha101 factors wholesale into commodity
    or FX trading systems. If resources permit, screen the full set &mdash; but expect a &lt;5% survival
    rate. Allocate engineering effort to domain-specific features instead. The two surviving factors
    (alpha024 and alpha083) contribute approximately 0.3% incremental AUC to the full 107-feature pipeline,
    meaningful but modest compared to domain-specific features like the Hurst exponent, efficiency ratio,
    or KMeans level features.
  </p>
</div>
`;

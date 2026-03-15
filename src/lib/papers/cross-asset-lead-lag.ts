export const content = `
<h2>1. Introduction</h2>

<p>
  Lead-lag relationships between asset classes are a foundational assumption in multi-asset systematic
  trading. Practitioners routinely incorporate lagged returns from correlated instruments &mdash; the
  US Dollar Index (DXY) for gold, sector leaders for equity indices &mdash; under the premise that
  information propagates across markets with exploitable delays. Despite the ubiquity of this assumption,
  rigorous out-of-sample testing over multi-year horizons is rare in the practitioner literature.
</p>

<p>
  The intuition behind cross-asset lead-lag is compelling: if gold and the dollar are inversely related
  (gold is priced in dollars, so dollar strength mechanically depresses gold's dollar price), then a
  move in DXY should predict a subsequent move in gold. Similarly, if MSFT announces strong earnings
  that will lift the Nasdaq 100 index, and the index futures take 5 minutes to fully reflect the
  single-stock move, then MSFT's return should lead the index. These narratives are plausible &mdash;
  the question is whether they hold up quantitatively with sufficient stability to generate trading signal.
</p>

<p>
  This paper tests for linear lead-lag relationships in two domains: (A) XAUUSD against six
  cross-asset candidates using 90 days of walk-forward validation, and (B) six equity lead-lag pairs
  across 5.5 years (22 quarterly blocks) of minute-bar data. We apply Pearson and Spearman correlation,
  walk-forward out-of-sample R&sup2;, quarterly sign consistency, and bootstrap confidence intervals to
  distinguish genuine predictive relationships from spurious correlations. The methodology is designed
  to be maximally skeptical: we test whether lag-1 returns predict, not whether contemporaneous returns
  correlate, and we require multi-year stability rather than single-period significance.
</p>

<h2>2. Data and Methodology</h2>

<h3>2.1 Data Sources</h3>

<p>
  <strong>Part A (XAUUSD):</strong> 90 days of M1 OHLCV bars for XAUUSD and six cross-asset instruments,
  sourced from MetaTrader 5 and CSV files in the <code>Data Scraper/</code> directory. The cross-asset
  instruments are:
</p>

<ul>
  <li><strong>XAGUSD</strong> (Silver) &mdash; precious metals co-movement</li>
  <li><strong>DX.f</strong> (US Dollar Index) &mdash; the theoretical strongest predictor (inverse relationship)</li>
  <li><strong>NAS100</strong> (Nasdaq 100 futures) &mdash; risk appetite proxy</li>
  <li><strong>US500.f</strong> (S&amp;P 500 futures) &mdash; broad equity regime</li>
  <li><strong>USDJPY</strong> (Yen cross) &mdash; carry trade / risk sentiment</li>
  <li><strong>VIX.f</strong> (CBOE Volatility Index) &mdash; implied volatility / fear gauge</li>
</ul>

<p>
  <strong>Part B (Equities):</strong> 5.5 years of data (January 2020 through June 2025), divided into
  22 non-overlapping quarterly blocks. Data comprises 5-minute bars for individual stocks (MSFT, GS,
  AXP, MCD, AAPL, CAT) and their respective indices (NAS100, US30, US500). Only regular trading hours
  (RTH) bars are included to avoid the extreme noise of pre-market and after-hours sessions.
</p>

<h3>2.2 Data Preprocessing</h3>

<p>
  Preprocessing is critical for cross-asset studies, where misaligned timestamps can create spurious
  correlations or mask genuine ones:
</p>

<ul>
  <li><strong>Timestamp alignment:</strong> All instruments are resampled to common 1-minute (Part A) or
    5-minute (Part B) timestamps. Bars are joined on the exact timestamp; any timestamp where one or more
    instruments have missing data is dropped. This inner-join approach sacrifices some data (particularly
    during non-overlapping trading hours) but eliminates forward-looking bias from interpolation.</li>
  <li><strong>Missing bar handling:</strong> Missing bars within active sessions (due to exchange halts,
    data gaps, or low-liquidity periods) are excluded entirely. We do not forward-fill, as this would
    create artificial zero-return bars that dilute correlation estimates.</li>
  <li><strong>Session filtering:</strong> For Part A, we compute both full-sample and session-filtered
    correlations. Session windows: Asian (00:00&ndash;08:00 UTC), London (07:00&ndash;16:00 UTC), and
    New York (13:00&ndash;22:00 UTC). The London-NY overlap (13:00&ndash;16:00 UTC) is analyzed separately
    as it represents the highest-liquidity period for gold.</li>
  <li><strong>Returns computation:</strong> Log returns are used throughout: $r_t = \\ln\\left(\\frac{\\text{close}_t}{\\text{close}_{t-1}}\\right)$.
    Log returns are preferred over simple returns for their additivity over time and better normality
    properties at the minute frequency.</li>
</ul>

<h3>2.3 Contemporaneous Correlations</h3>

<p>
  As a baseline, we compute both Pearson (linear) and Spearman (rank) correlations between contemporaneous
  returns for each instrument pair. Pearson measures the strength of the linear relationship; Spearman measures
  the monotonic relationship and is robust to outliers and nonlinear monotone transformations. Disagreement
  between Pearson and Spearman (e.g., VIX shows Pearson &asymp; 0 but Spearman = &minus;0.15) indicates
  nonlinearity in the relationship.
</p>

<p>
  Session-filtered correlations are computed separately for each trading session, revealing whether the
  gold-DXY relationship (for example) is stronger during London hours when both markets are most liquid,
  or whether it is driven entirely by overnight moves in Asia.
</p>

<h3>2.4 Lead-Lag Testing</h3>

<p>
  The core test uses 1-bar lagged returns as the predictor variable:
</p>

<p>The core regression specification:</p>

$$r_{\\text{gold},t} = \\alpha + \\beta \\cdot r_{\\text{cross},t-1} + \\varepsilon_t$$

<p>
  where $r_{\\text{gold},t}$ is the XAUUSD return at bar $t$ and $r_{\\text{cross},t-1}$ is the cross-asset return at bar $t-1$.
  The coefficient $\\beta$ measures the linear sensitivity of gold returns to lagged cross-asset returns, and
  $R^2$ measures the fraction of gold return variance explained by the predictor. We also test a multivariate
  specification with all six lagged predictors simultaneously.
</p>

<p>
  The critical distinction is between <strong>in-sample</strong> R&sup2; (which can always be made positive
  by adding predictors) and <strong>out-of-sample</strong> R&sup2; (which penalizes overfitting). We report
  only OOS R&sup2; from walk-forward validation.
</p>

<h3>2.5 Walk-Forward Design</h3>

<p>
  The 90-day dataset is divided into rolling windows:
</p>

<ul>
  <li><strong>Training window:</strong> 60 trading days (~86,400 M1 bars)</li>
  <li><strong>Test window:</strong> 5 trading days (~7,200 M1 bars)</li>
  <li><strong>Step size:</strong> 5 days (non-overlapping test windows)</li>
  <li><strong>Total folds:</strong> 6 non-overlapping test periods covering the final 30 days</li>
</ul>

<p>
  In each fold, the OLS regression is estimated on the training window, and R&sup2; is computed on the
  test window using the <em>training-set coefficients</em>. The OOS R&sup2; is computed as:
  $R^2_{\\text{OOS}} = 1 - \\frac{\\text{SSE}_{\\text{model}}}{\\text{SSE}_{\\text{mean}}}$, where $\\text{SSE}_{\\text{mean}}$ is the sum of squared errors from
  predicting the test-set mean return. Negative OOS R&sup2; means the lagged cross-asset model performs
  worse than simply predicting the mean &mdash; a definitive failure of predictive power.
</p>

<h3>2.6 Quarterly Stability (Part B)</h3>

<p>
  For equity pairs, we divide 5.5 years into 22 non-overlapping quarterly blocks (~63 trading days each,
  ~756 five-minute bars per day, ~47,628 observations per quarter). Within each quarter, we compute the
  Spearman correlation between lagged single-stock returns and index returns. We then assess:
</p>

<ul>
  <li><strong>Sign consistency:</strong> The fraction of quarters where the correlation has the same sign
    (positive or negative). Random chance would produce 50% consistency. We require &ge;70% for a pair
    to be classified as robust.</li>
  <li><strong>Bootstrap confidence interval:</strong> 10,000 block-bootstrap resamples (block size = 1 day
    to preserve intraday autocorrelation) are drawn from the full 5.5-year dataset. For each resample,
    the mean correlation is computed. The 2.5th and 97.5th percentiles form the 95% CI. A pair is robust
    only if the CI excludes zero.</li>
  <li><strong>Regime flip analysis:</strong> We examine whether correlation sign flips coincide with
    identifiable market events (volatility regime changes, earnings seasons, macroeconomic shocks) or
    are random.</li>
</ul>

<h2>3. Results &mdash; XAUUSD Cross-Asset</h2>

<h3>3.1 Contemporaneous Correlations</h3>

<table>
  <tr>
    <th>Asset</th>
    <th>Pearson (contemp.)</th>
    <th>Spearman (contemp.)</th>
    <th>Relationship</th>
  </tr>
  <tr>
    <td>XAGUSD</td>
    <td>+0.77</td>
    <td>+0.74</td>
    <td>Strong positive</td>
  </tr>
  <tr>
    <td>DX.f (DXY)</td>
    <td>&minus;0.28</td>
    <td>&minus;0.26</td>
    <td>Moderate negative</td>
  </tr>
  <tr>
    <td>NAS100</td>
    <td>+0.18</td>
    <td>+0.16</td>
    <td>Weak positive</td>
  </tr>
  <tr>
    <td>US500.f</td>
    <td>+0.15</td>
    <td>+0.14</td>
    <td>Weak positive</td>
  </tr>
  <tr>
    <td>USDJPY</td>
    <td>&minus;0.12</td>
    <td>&minus;0.11</td>
    <td>Weak negative</td>
  </tr>
  <tr>
    <td>VIX.f</td>
    <td>~0.00</td>
    <td>&minus;0.15</td>
    <td>Nonlinear only</td>
  </tr>
</table>

<p>
  Silver exhibits the strongest contemporaneous relationship with gold, as expected from their shared
  precious-metals complex. The Pearson-Spearman agreement (+0.77 vs. +0.74) indicates a predominantly
  linear relationship. The dollar index shows the classic negative gold-dollar correlation, moderate in
  magnitude (&minus;0.28) and consistent between Pearson and Spearman.
</p>

<p>
  <strong>Session-filtered results</strong> reveal important nuances. The DXY correlation strengthens
  during the London session (&minus;0.37 vs. &minus;0.28 full-sample) when both gold and dollar are
  most actively traded. During the Asian session, the DXY correlation weakens to &minus;0.18, likely
  because both instruments are in low-liquidity regimes with wider spreads and less efficient price
  discovery. The London-NY overlap shows the strongest gold-equity correlations (NAS100 Pearson = +0.24
  vs. +0.18 full-sample), consistent with shared risk-appetite flows during the most liquid hours.
</p>

<p>
  The VIX result is particularly notable: zero linear (Pearson) correlation but statistically significant
  rank correlation (Spearman &minus;0.15, p &lt; 0.01). This indicates a monotonic but nonlinear
  relationship &mdash; extreme VIX spikes are associated with gold rallies (safe-haven demand), but the
  relationship saturates at moderate VIX levels. This nonlinearity means that raw VIX returns or lagged
  VIX cannot be used as a linear predictor; instead, transformations like VIX z-scores, VIX regime
  indicators, or VIX percentile ranks are needed to capture the signal.
</p>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 250" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 1: Contemporaneous Correlations with XAUUSD</text>
    <!-- Center axis at x=350 for 0. Scale: 0.77 maps to full right (330px). Per unit: 330/0.77 = 428px -->
    <!-- Chart area y: 45..225, 5 bars, spacing=36 -->
    <!-- Zero axis -->
    <line x1="350" y1="40" x2="350" y2="220" stroke="#374151" stroke-width="1"/>
    <!-- Scale markers -->
    <text x="350" y="238" text-anchor="middle" fill="#6b7280" font-size="10">0</text>
    <text x="564" y="238" text-anchor="middle" fill="#6b7280" font-size="10">+0.50</text>
    <text x="136" y="238" text-anchor="middle" fill="#6b7280" font-size="10">&minus;0.50</text>
    <line x1="564" y1="40" x2="564" y2="220" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="136" y1="40" x2="136" y2="220" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <!-- XAG: +0.77, bar width = 0.77*428 = 330, y=48 -->
    <text x="85" y="63" text-anchor="end" fill="#374151" font-size="12">XAG</text>
    <rect x="350" y="48" width="330" height="24" rx="3" fill="#059669"/>
    <text x="686" y="65" fill="#1a1a2e" font-size="11" font-weight="600">+0.77</text>
    <!-- NAS100: +0.18, bar width = 0.18*428 = 77, y=84 -->
    <text x="85" y="99" text-anchor="end" fill="#374151" font-size="12">NAS100</text>
    <rect x="350" y="84" width="77" height="24" rx="3" fill="#059669" opacity="0.7"/>
    <text x="433" y="101" fill="#1a1a2e" font-size="11">+0.18</text>
    <!-- US500: +0.16, bar width = 0.16*428 = 68, y=120 -->
    <text x="85" y="135" text-anchor="end" fill="#374151" font-size="12">US500</text>
    <rect x="350" y="120" width="68" height="24" rx="3" fill="#059669" opacity="0.6"/>
    <text x="424" y="137" fill="#1a1a2e" font-size="11">+0.16</text>
    <!-- USDJPY: -0.15, bar width = 0.15*428 = 64, extends left, y=156 -->
    <text x="85" y="171" text-anchor="end" fill="#374151" font-size="12">USDJPY</text>
    <rect x="286" y="156" width="64" height="24" rx="3" fill="#dc2626" opacity="0.7"/>
    <text x="278" y="173" text-anchor="end" fill="#1a1a2e" font-size="11">&minus;0.15</text>
    <!-- DXY: -0.28, bar width = 0.28*428 = 120, extends left, y=192 -->
    <text x="85" y="207" text-anchor="end" fill="#374151" font-size="12">DXY</text>
    <rect x="230" y="192" width="120" height="24" rx="3" fill="#dc2626"/>
    <text x="222" y="209" text-anchor="end" fill="#1a1a2e" font-size="11">&minus;0.28</text>
  </svg>
  <p class="figure-caption">Figure 1: Contemporaneous Pearson correlations between cross-asset returns and XAUUSD. Silver shows the strongest positive relationship; DXY shows the expected negative correlation.</p>
</div>

<h3>3.2 Walk-Forward Out-of-Sample R&sup2;</h3>

<div class="finding-box">
  <strong>Key Finding:</strong> Walk-forward OOS R&sup2; is <strong>negative for ALL assets</strong>,
  both in univariate and multivariate specifications. No cross-asset instrument provides linear
  predictive power for XAUUSD returns at the 1-minute horizon. The lagged-return model is worse
  than predicting the mean.
</div>

<table>
  <tr>
    <th>Predictor</th>
    <th>OOS R&sup2; (univariate)</th>
    <th>OOS R&sup2; (multivariate)</th>
    <th>In-Sample R&sup2;</th>
  </tr>
  <tr>
    <td>XAGUSD (1-bar lag)</td>
    <td>&minus;0.003</td>
    <td rowspan="6">&minus;0.008</td>
    <td>+0.0004</td>
  </tr>
  <tr>
    <td>DX.f (1-bar lag)</td>
    <td>&minus;0.005</td>
    <td>+0.0003</td>
  </tr>
  <tr>
    <td>NAS100 (1-bar lag)</td>
    <td>&minus;0.002</td>
    <td>+0.0002</td>
  </tr>
  <tr>
    <td>US500.f (1-bar lag)</td>
    <td>&minus;0.004</td>
    <td>+0.0002</td>
  </tr>
  <tr>
    <td>USDJPY (1-bar lag)</td>
    <td>&minus;0.006</td>
    <td>+0.0001</td>
  </tr>
  <tr>
    <td>VIX.f (1-bar lag)</td>
    <td>&minus;0.007</td>
    <td>+0.0001</td>
  </tr>
</table>

<p>
  The in-sample R&sup2; column reveals the mechanism of failure: even in-sample, the lagged cross-asset
  returns explain less than 0.04% of gold return variance. These are vanishingly small effects that
  are well within the noise floor. The multivariate model (all six lagged predictors) performs worse
  than any individual predictor out-of-sample (&minus;0.008 vs. best individual &minus;0.002), consistent
  with overfitting: combining six weak signals that are individually noise produces a model that fits
  training-set noise patterns that do not recur in the test set.
</p>

<p>
  Negative OOS R&sup2; indicates that a simple mean prediction (predicting that gold's next-bar return
  equals the average return in the training window) outperforms the lagged cross-asset model. This is
  a definitive failure: the cross-asset information does not improve on the most naive possible forecast.
</p>

<p>
  <strong>Why does DXY fail despite the strong contemporaneous correlation?</strong> The &minus;0.28
  contemporaneous correlation between gold and DXY is real and economically meaningful. However,
  it is <em>contemporaneous</em>, not <em>predictive</em>. Gold and the dollar move inversely
  <em>at the same time</em> because they respond to the same macroeconomic information (e.g., Fed
  rate expectations). There is no systematic delay &mdash; when a news release hits, both gold and
  DXY adjust within seconds, leaving no lag-1 (one-minute) predictive signal. The information is
  priced in simultaneously across both markets.
</p>

<h2>4. Results &mdash; Equities</h2>

<h3>4.1 Quarterly Sign Consistency</h3>

<table>
  <tr>
    <th>Pair</th>
    <th>Horizon</th>
    <th>Consistent Quarters</th>
    <th>Consistency %</th>
    <th>Bootstrap 95% CI</th>
    <th>Regime Flip %</th>
    <th>Verdict</th>
  </tr>
  <tr>
    <td>MSFT &rarr; NAS100</td>
    <td>5 min</td>
    <td>18 / 22</td>
    <td><strong>81%</strong></td>
    <td>[+0.021, +0.058]</td>
    <td>38%</td>
    <td style="color: #059669;"><strong>ROBUST</strong></td>
  </tr>
  <tr>
    <td>GS &rarr; US30</td>
    <td>5 min</td>
    <td>16 / 22</td>
    <td><strong>73%</strong></td>
    <td>[+0.008, +0.041]</td>
    <td>42%</td>
    <td style="color: #059669;"><strong>ROBUST</strong></td>
  </tr>
  <tr>
    <td>AXP &rarr; US30</td>
    <td>5 min</td>
    <td>12 / 22</td>
    <td>55%</td>
    <td>[&minus;0.012, +0.029]</td>
    <td>55%</td>
    <td>Recent only</td>
  </tr>
  <tr>
    <td>MCD &rarr; US500</td>
    <td>5 min</td>
    <td>11 / 22</td>
    <td>50%</td>
    <td>[&minus;0.018, +0.023]</td>
    <td>50%</td>
    <td>Random</td>
  </tr>
  <tr>
    <td>AAPL &rarr; US30</td>
    <td>5 min</td>
    <td>11 / 22</td>
    <td>50%</td>
    <td>[&minus;0.015, +0.019]</td>
    <td>50%</td>
    <td>Random</td>
  </tr>
  <tr>
    <td>CAT &rarr; US500</td>
    <td>5 min</td>
    <td>10 / 22</td>
    <td>45%</td>
    <td>[&minus;0.022, +0.016]</td>
    <td>55%</td>
    <td>Random</td>
  </tr>
</table>

<p>
  The results divide sharply into two groups. MSFT &rarr; NAS100 and GS &rarr; US30 exhibit stable,
  statistically significant lead-lag relationships that persist across 5.5 years. The remaining four
  pairs show consistency at or below the 55% level &mdash; statistically indistinguishable from random
  sign assignment. Their bootstrap CIs all include zero, confirming the absence of a systematic effect.
</p>

<div class="finding-box">
  <strong>Key Finding:</strong> Only <strong>2 of 6</strong> equity pairs survive multi-year stability
  testing. MSFT &rarr; NAS100 (81% consistency, CI excludes zero) and GS &rarr; US30 (73%, CI excludes
  zero) are the only robust lead-lag relationships. All other pairs show sign consistency at or below
  the 55% level, indistinguishable from random.
</div>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 2: Quarterly Sign Consistency (22 quarters, 5.5 years)</text>
    <!-- Chart area: x=90..650, y=45..240 -->
    <!-- Y axis -->
    <line x1="90" y1="240" x2="650" y2="240" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="90" y1="45" x2="90" y2="240" stroke="#e5e7eb" stroke-width="1"/>
    <!-- Y gridlines: 0%=240, 25%=191.25, 50%=142.5, 75%=93.75, 100%=45 -->
    <line x1="90" y1="191" x2="650" y2="191" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="90" y1="142" x2="650" y2="142" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="90" y1="94" x2="650" y2="94" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <line x1="90" y1="45" x2="650" y2="45" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="4,4"/>
    <text x="80" y="244" text-anchor="end" fill="#6b7280" font-size="10">0%</text>
    <text x="80" y="146" text-anchor="end" fill="#6b7280" font-size="10">50%</text>
    <text x="80" y="98" text-anchor="end" fill="#6b7280" font-size="10">75%</text>
    <text x="80" y="49" text-anchor="end" fill="#6b7280" font-size="10">100%</text>
    <!-- 50% threshold dashed line -->
    <line x1="90" y1="142" x2="650" y2="142" stroke="#374151" stroke-width="1" stroke-dasharray="6,4"/>
    <text x="656" y="146" fill="#374151" font-size="10">Random</text>
    <!-- 6 bars, centered at: 150, 240, 330, 420, 510, 600. Width=60 -->
    <!-- MSFT-NAS: 81%, height=158, y=82 -->
    <rect x="120" y="82" width="60" height="158" rx="3" fill="#059669"/>
    <text x="150" y="74" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">81%</text>
    <text x="150" y="260" text-anchor="middle" fill="#374151" font-size="10">MSFT</text>
    <text x="150" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;NAS100</text>
    <!-- GS-US30: 73%, height=142, y=98 -->
    <rect x="210" y="98" width="60" height="142" rx="3" fill="#059669" opacity="0.8"/>
    <text x="240" y="90" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">73%</text>
    <text x="240" y="260" text-anchor="middle" fill="#374151" font-size="10">GS</text>
    <text x="240" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;US30</text>
    <!-- AXP-US30: 56%, height=109, y=131 (amber) -->
    <rect x="300" y="131" width="60" height="109" rx="3" fill="#d97706" opacity="0.7"/>
    <text x="330" y="123" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">56%</text>
    <text x="330" y="260" text-anchor="middle" fill="#374151" font-size="10">AXP</text>
    <text x="330" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;US30</text>
    <!-- AAPL-US30: 50%, height=97.5, y=142 (red) -->
    <rect x="390" y="142" width="60" height="98" rx="3" fill="#dc2626" opacity="0.6"/>
    <text x="420" y="134" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">50%</text>
    <text x="420" y="260" text-anchor="middle" fill="#374151" font-size="10">AAPL</text>
    <text x="420" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;US30</text>
    <!-- MCD-US500: 44%, height=85.8, y=154 (red) -->
    <rect x="480" y="154" width="60" height="86" rx="3" fill="#dc2626" opacity="0.5"/>
    <text x="510" y="146" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">44%</text>
    <text x="510" y="260" text-anchor="middle" fill="#374151" font-size="10">MCD</text>
    <text x="510" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;US500</text>
    <!-- CAT-US500: 45%, height=87.75, y=152 (red) -->
    <rect x="570" y="152" width="60" height="88" rx="3" fill="#dc2626" opacity="0.5"/>
    <text x="600" y="144" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">45%</text>
    <text x="600" y="260" text-anchor="middle" fill="#374151" font-size="10">CAT</text>
    <text x="600" y="272" text-anchor="middle" fill="#6b7280" font-size="9">&rarr;US500</text>
  </svg>
  <p class="figure-caption">Figure 2: Quarterly sign consistency across 5.5 years. Only MSFT and GS exceed the 70% robustness threshold. Remaining pairs are indistinguishable from random sign assignment.</p>
</div>

<h3>4.2 Regime Flip Analysis</h3>

<p>
  For the non-robust pairs (AXP, MCD, AAPL, CAT), we examine when the correlation sign flips across
  quarters. The flips show no systematic pattern &mdash; they do not coincide with volatility regime
  changes, earnings seasons, or macroeconomic events. This is consistent with the correlations being
  noise rather than a structural relationship that occasionally breaks down. When a pair shows 50%
  sign consistency (AAPL &rarr; US30, MCD &rarr; US500), the sign in any given quarter is essentially
  a coin flip, which is the hallmark of a null relationship.
</p>

<p>
  The regime flip percentage for non-robust pairs (50&ndash;55%) closely matches the theoretical expectation
  for random sign assignment. Under the null hypothesis of zero correlation, the expected sign consistency
  is 50% with standard deviation &radic;(0.25/22) &asymp; 10.7%. The observed values (45%, 50%, 50%, 55%)
  are all within 0.5 standard deviations of the null, providing no evidence against the random hypothesis.
</p>

<p>
  In contrast, the two robust pairs show remarkable stability. MSFT &rarr; NAS100 maintains a positive
  lagged correlation in 18 of 22 quarters, with the four negative quarters concentrated in Q2 2020
  (the pandemic recovery period, characterized by extreme dispersion as tech stocks diverged from indices)
  and Q4 2022 (the aggressive rate-hiking cycle, which disrupted normal sector relationships). These
  are identifiable macro-regime events, not random noise. The GS &rarr; US30 relationship is similarly
  stable, with its 6 negative quarters also clustering around the same macro dislocations. The regime flip
  rate (38% for MSFT, 42% for GS) is elevated but interpretable &mdash; the lead-lag weakens during
  extreme macro stress but re-establishes itself in normal conditions.
</p>

<h3>4.3 Why MSFT and GS?</h3>

<p>
  The two surviving pairs share a structural explanation. MSFT is the largest constituent of the Nasdaq
  100 by market capitalization (approximately 12&ndash;14% weight during the study period), meaning its
  individual-stock returns mechanically lead the index through several channels:
</p>

<ul>
  <li><strong>Index rebalancing lag:</strong> When MSFT moves, the NAS100 index is recalculated based on
    all 100 constituents. The index update occurs at discrete intervals (typically every 15 seconds for
    index calculation, but futures adjust continuously). The 5-minute lag captures the time for the full
    index to reflect the MSFT move.</li>
  <li><strong>ETF creation/redemption:</strong> QQQ (the NAS100 ETF) and similar products have
    authorized participants who create/redeem shares to keep ETF prices aligned with the index.
    This process introduces minutes of latency, during which MSFT may have already moved but ETF
    flows (which drive futures) have not yet adjusted.</li>
  <li><strong>Futures basis arbitrage:</strong> The NAS100 futures contract tracks the index with a
    basis (driven by dividends and funding rates). Basis arbitrageurs adjust futures prices in response
    to spot index moves, but their reaction time creates a lag.</li>
</ul>

<p>
  Similarly, GS is an outsized contributor to the price-weighted Dow Jones Industrial Average, where its
  high nominal share price (~$500&ndash;600 during the study period) gives it approximately 7&ndash;8% of
  the index weight &mdash; disproportionate relative to its market cap. A $1 move in GS translates to a
  ~6.7 point move in the Dow, which the US30 futures take several minutes to fully reflect through the
  same arbitrage and ETF mechanisms.
</p>

<p>
  These are not "predictive signals" in the alpha sense &mdash; they are <strong>mechanical lead effects</strong>
  arising from index construction methodology and the latency of index-tracking instruments in reflecting
  single-stock moves. The alpha is small (bootstrap CI upper bound of +0.058 for MSFT &rarr; NAS100,
  +0.041 for GS &rarr; US30) but stable, making it suitable for high-frequency strategies that trade
  small edges consistently rather than large edges occasionally.
</p>

<h3>4.4 Failed Pairs: AAPL, CAT, and Others</h3>

<p>
  AAPL's failure is instructive. Despite being a large NAS100 constituent (~11% weight), AAPL does not
  lead the index at 5 minutes. The likely explanation is that AAPL is so widely followed and liquid that
  its information is priced into the index near-simultaneously &mdash; there is no lag to exploit. MSFT
  leads partly because it is slightly less liquid (lower average daily trading volume relative to market
  cap) and has a more institutional ownership base, creating a marginally slower information diffusion.
</p>

<p>
  CAT's failure to lead US500 is unsurprising in retrospect: as a single-stock in a 500-constituent
  index, its weight (~0.5%) is too small to mechanically move the index. Any lead-lag relationship
  would need to be information-based (CAT as an economic bellwether), which our results show does not
  hold consistently at the 5-minute horizon. MCD similarly lacks the index weight to create a mechanical
  effect.
</p>

<p>
  The AXP &rarr; US30 pair shows 55% consistency and a bootstrap CI that includes zero ([&minus;0.012,
  +0.029]). This is a borderline case &mdash; there may be a weak relationship (AXP is in the Dow), but
  it is not robust enough to trade systematically. The relationship appears concentrated in recent
  quarters, suggesting it may be a temporary artifact of AXP's increased trading volume in 2024&ndash;2025
  rather than a structural effect.
</p>

<h2>5. Implications for Trading System Design</h2>

<h3>5.1 Gold Systems</h3>

<p>
  For XAUUSD trading models, the results are unambiguous: <strong>lagged cross-asset returns should not
  be used as linear features</strong>. The absence of walk-forward OOS predictive power across all six
  tested instruments means that any in-sample correlation between lagged DXY (or silver, or equities)
  and gold returns is noise that will not persist out of sample.
</p>

<p>
  This does not mean cross-asset information is useless. The VIX result (zero Pearson, significant
  Spearman) suggests that <strong>nonlinear transformations</strong> can capture cross-asset dependencies
  that raw lagged returns cannot. Specific recommendations for gold feature engineering:
</p>

<ul>
  <li><strong>Gold/silver ratio:</strong> <code>xau_close / xag_close</code> captures relative precious
    metals positioning. The ratio has stronger predictive properties than individual lagged returns because
    it encodes a spread relationship that mean-reverts on intraday horizons.</li>
  <li><strong>Z-scores of rolling correlation:</strong> <code>zscore(rolling_corr(gold, dxy, 60), 240)</code>
    captures whether the gold-dollar relationship is at an extreme relative to recent history. Extremes
    in the correlation z-score (very negative or very positive) can signal regime transitions.</li>
  <li><strong>Relative moves:</strong> <code>gold_return - beta * dxy_return</code> (the "xaucore" metric)
    isolates gold-specific returns after removing the dollar component. This is already feature #18
    in our 107-feature pipeline and has AUC significantly above 0.500.</li>
  <li><strong>VIX regime indicators:</strong> Binary or ordinal encoding of VIX level (low/medium/high/extreme)
    rather than raw VIX returns, capturing the nonlinear relationship identified by the Spearman correlation.</li>
</ul>

<p>
  The broader lesson is that contemporaneous cross-asset relationships are real and useful when transformed
  into <em>relative</em> or <em>regime</em> features. It is only the <em>lagged return</em> specification
  that fails, because information at the M1 frequency is priced in simultaneously across liquid markets.
</p>

<h3>5.2 Equity Systems</h3>

<p>
  For equity index scalping, only two lead-lag pairs have validated predictive power at the 5-minute
  horizon: <strong>MSFT for NAS100</strong> and <strong>GS for US30</strong>. These should be treated as
  mechanical lead effects with modest but stable alpha, not as fundamental cross-asset signals.
  Position sizing should reflect the small magnitude of the effect (bootstrap CI upper bound of
  +0.058 for MSFT &rarr; NAS100, +0.041 for GS &rarr; US30).
</p>

<p>
  <strong>Practical sizing guidance:</strong> With a 5-minute lag correlation of ~0.04, the expected
  R&sup2; is ~0.0016 (0.16% of variance explained). This is sufficient for high-frequency strategies
  with low transaction costs and high Sharpe ratios through volume, but insufficient for directional
  swing trades. A strategy trading this edge should execute thousands of trades per month to realize
  the statistical advantage, with per-trade sizing determined by Kelly criterion on the observed
  win rate and payoff ratio.
</p>

<h3>5.3 Regime Conditioning Caveat</h3>

<p>
  A common practitioner approach is to estimate cross-asset correlations on rolling 90-day windows and
  condition trading signals on the current correlation regime. Our results caution against this approach:
  90-day rolling windows produce "snapshot artifacts" where a temporarily strong correlation appears
  statistically significant but does not persist into the next 90-day window. The quarterly flip
  analysis (4.2) shows that even for non-robust pairs, any given quarter can show a strong positive
  or negative correlation that reverses in the next quarter. Conditioning on 90-day estimates effectively
  overfits to the most recent regime, which may not be the regime that prevails when the trade is
  executed.
</p>

<h2>6. Conclusion</h2>

<p>
  Most assumed lead-lag relationships between asset classes are noise. Over 5.5 years and 22 quarterly
  evaluation blocks, only 2 of 8 tested relationships survive out-of-sample validation: MSFT &rarr;
  NAS100 and GS &rarr; US30, both at the 5-minute horizon, and both attributable to mechanical index
  construction effects rather than fundamental information transmission.
</p>

<p>
  For XAUUSD, no linear lead-lag relationship exists at any tested horizon from any of six commonly
  used cross-asset instruments. Walk-forward OOS R&sup2; is negative for all predictors, including
  silver (the most correlated asset), the dollar index (the most theoretically motivated predictor),
  and VIX (which shows only nonlinear dependence). The contemporaneous correlations are real (gold-DXY
  at &minus;0.28, gold-silver at +0.77), but they are priced in simultaneously &mdash; not with an
  exploitable lag.
</p>

<p>
  For practitioners, the actionable conclusions are: (1) for gold, use nonlinear transformations of
  cross-asset data (ratios, z-scores, relative moves, regime indicators) rather than raw lagged returns;
  (2) for equities, only MSFT &rarr; NAS100 and GS &rarr; US30 at 5 minutes are validated, and only
  because of mechanical index construction effects; (3) the burden of proof for any cross-asset feature
  should be walk-forward OOS R&sup2;, not in-sample correlation; (4) regime conditioning on 90-day
  rolling windows is prone to snapshot artifacts and should be validated with quarterly stability analysis.
</p>

<blockquote>
  The burden of proof for cross-asset features should be walk-forward OOS R&sup2;, not in-sample
  correlation. By this standard, the vast majority of cross-asset lead-lag relationships used in
  production trading systems are likely overfitted artifacts. The small number of genuine lead-lag
  effects (MSFT &rarr; NAS100, GS &rarr; US30) are mechanical, not informational, and their magnitude
  is modest. Treat cross-asset lead-lag as a hypothesis to be tested, not an assumption to be relied upon.
</blockquote>
`;

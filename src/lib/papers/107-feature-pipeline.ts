export const content = `
<h2>1. Introduction</h2>

<p>
  Feature engineering is widely acknowledged as the most labor-intensive and consequential stage of quantitative
  model development. In academic literature, model architectures receive disproportionate attention, yet practitioners
  consistently report that the quality and diversity of input features determines the ceiling of model performance.
  A well-constructed feature pipeline can make a simple model competitive; a poor one renders even sophisticated
  architectures ineffective.
</p>

<p>
  We document the design, implementation, and validation of a <strong>107-feature pipeline</strong> for intraday
  XAUUSD (gold) trading at the M1 (one-minute) frequency. The pipeline spans six cross-asset instruments, four
  feature groups, and 14 feature families. Each feature was individually validated via AUC scoring on a held-out
  validation set, with rigorous quality controls including feature inversion, noise removal, and cache invalidation.
</p>

<p>
  This paper serves as both a technical reference for the pipeline and an empirical guide to which feature families
  contribute meaningful signal for gold intraday trading. The pipeline is implemented in a single function,
  the main feature builder function, which accepts M1
  OHLCV DataFrames for all six instruments and returns a fully aligned feature matrix. The features are
  registered in an official feature column registry (107 entries as of February 2026), which serves
  as both the canonical feature set and the cache invalidation key.
</p>

<h2>2. Data Sources</h2>

<p>
  The pipeline ingests M1 OHLCV bars from six instruments, providing a multi-asset view of the macroeconomic
  environment:
</p>

<table>
  <tr>
    <th>Instrument</th>
    <th>Symbol</th>
    <th>Role</th>
    <th>Source</th>
  </tr>
  <tr>
    <td>Gold</td>
    <td>XAUUSD</td>
    <td>Primary traded instrument</td>
    <td>MT5 / CSV</td>
  </tr>
  <tr>
    <td>Silver</td>
    <td>XAGUSD</td>
    <td>Precious metals co-movement</td>
    <td>MT5 / CSV</td>
  </tr>
  <tr>
    <td>US Dollar Index</td>
    <td>DX.f</td>
    <td>Currency regime</td>
    <td>MT5 / CSV</td>
  </tr>
  <tr>
    <td>Nasdaq 100</td>
    <td>NAS100</td>
    <td>Risk appetite proxy</td>
    <td>MT5 / CSV</td>
  </tr>
  <tr>
    <td>S&amp;P 500</td>
    <td>US500.f</td>
    <td>Broad equity regime</td>
    <td>MT5 / CSV</td>
  </tr>
  <tr>
    <td>VIX</td>
    <td>VIX.f</td>
    <td>Implied volatility / fear gauge</td>
    <td>MT5 / CSV</td>
  </tr>
</table>

<p>
  Data loading is handled by a bar loader function, which attempts CSV first (from the
  data directory) and falls back to MetaTrader 5's Python API. The CSV-first
  approach allows development and backtesting without a live MT5 connection, while the MT5 fallback
  enables live trading with real-time data. XAUUSD OHLCV columns are always prefixed with
  "xau_" (producing xau_open, xau_high, xau_low, xau_close, xau_volume) to avoid namespace collisions
  during cross-asset merges. This renaming occurs regardless of whether cross-asset data is available,
  ensuring consistent column names throughout the pipeline.
</p>

<p>
  Cross-asset data is merged on timestamps via an inner join. Bars where any instrument has missing data
  are dropped rather than forward-filled, ensuring that no feature computation uses stale or interpolated
  prices. This approach reduces the available bar count by approximately 5&ndash;10% (due to misaligned
  trading hours and data gaps) but eliminates look-ahead bias from filling future prices into past bars.
</p>

<h2>3. Feature Groups</h2>

<h3>3.1 Original Features (9 features)</h3>

<p>
  The foundational feature set, designed to capture core price dynamics and temporal structure. These were
  the first features implemented and have been in the pipeline since inception:
</p>

<table>
  <tr>
    <th>#</th>
    <th>Feature</th>
    <th>Description</th>
    <th>Computation</th>
  </tr>
  <tr>
    <td>1</td>
    <td>accelz_60_30</td>
    <td>Acceleration z-score</td>
    <td>Z-score of the difference between 30-bar and 60-bar momentum (second derivative of price). Captures whether momentum is accelerating or decelerating. High positive values indicate accelerating upward movement.</td>
  </tr>
  <tr>
    <td>2</td>
    <td>volaccelz60_30</td>
    <td>Volatility acceleration</td>
    <td>Z-score of the difference between 30-bar and 60-bar realized volatility. Detects transitions between calm and volatile regimes. A rising volaccel often precedes breakouts.</td>
  </tr>
  <tr>
    <td>3</td>
    <td>dist_ma120</td>
    <td>Distance from 120-bar MA</td>
    <td>$\\frac{\\text{close} - \\text{SMA}(\\text{close}, 120)}{\\text{SMA}(\\text{close}, 120)}$. Normalized distance from the 2-hour moving average. Mean-reversion anchor: extreme values suggest overextension.</td>
  </tr>
  <tr>
    <td>4</td>
    <td>resid_z60</td>
    <td>AR(1) residual z-score</td>
    <td>Z-score of the residual from a 60-bar rolling linear regression of close prices. Captures deviations from the recent linear trend. Computed by the residual z-score function.</td>
  </tr>
  <tr>
    <td>5</td>
    <td>er60</td>
    <td>Efficiency ratio (60-bar)</td>
    <td>$\\frac{|\\text{close}_t - \\text{close}_{t-60}|}{\\sum_{i=t-59}^{t} |\\text{close}_i - \\text{close}_{i-1}|}$. Ranges [0, 1]. High values indicate trending (price moved far relative to path length); low values indicate choppy/mean-reverting.</td>
  </tr>
  <tr>
    <td>6</td>
    <td>tod_sin</td>
    <td>Time-of-day (sine)</td>
    <td>$\\sin\\left(\\frac{2\\pi \\cdot \\text{minutes\\_since\\_midnight}}{1440}\\right)$. Cyclical encoding of time that the model can use to learn session-dependent patterns without discrete session boundaries.</td>
  </tr>
  <tr>
    <td>7</td>
    <td>tod_cos</td>
    <td>Time-of-day (cosine)</td>
    <td>$\\cos\\left(\\frac{2\\pi \\cdot \\text{minutes\\_since\\_midnight}}{1440}\\right)$. Paired with tod_sin to provide a complete cyclical encoding. <strong>Note: INVERTED</strong> (original AUC was 0.476; inverted to 0.524). The cosine component peaked at midnight UTC, which anti-correlates with direction during the Asian session.</td>
  </tr>
  <tr>
    <td>8</td>
    <td>leadcorr_nas100</td>
    <td>Lead-lag correlation with NAS100</td>
    <td>Rolling 60-bar Pearson correlation between XAUUSD and NAS100 returns. Captures the time-varying risk-on/risk-off relationship. Not predictive as a lagged feature (see companion paper), but informative as a regime indicator.</td>
  </tr>
  <tr>
    <td>9</td>
    <td>dow_sin</td>
    <td>Day-of-week (sine encoding)</td>
    <td>$\\sin\\left(\\frac{2\\pi \\cdot \\text{day\\_of\\_week}}{5}\\right)$. Captures weekly seasonality (e.g., Monday positioning, Friday book-squaring). Combined with tod_sin/cos provides full intraweek temporal context.</td>
  </tr>
</table>

<h3>3.2 OG Extended Features (17 features)</h3>

<p>
  Extensions to the original set, adding multi-horizon returns, cross-asset correlations, and volatility structure.
  These features provide the model with a richer view of price dynamics at multiple timescales:
</p>

<ul>
  <li><strong>Multi-horizon returns (4):</strong> Log returns computed at 1-minute, 5-minute, 30-minute, and
    120-minute horizons. Each horizon captures different dynamics: 1m returns are dominated by microstructure
    noise but have significant AR(1) structure; 5m returns capture short-term momentum; 30m and 120m returns
    capture intra-session trends. The model learns to weight these horizons differently via the VSN.</li>
  <li><strong>Volatility (2):</strong> Rolling realized volatility at 30-bar and 120-bar windows, computed as
    the standard deviation of log returns multiplied by &radic;(annualization factor). The 30-bar window
    captures recent volatility spikes; the 120-bar window captures session-level volatility regime.</li>
  <li><strong>MA distances (2):</strong> Normalized distance from 30-bar and 200-bar moving averages. The 30-bar
    distance captures short-term mean-reversion potential; the 200-bar distance captures the position within
    the broader intraday trend. Distance is normalized by the MA value to produce a percentage rather than
    an absolute dollar distance.</li>
  <li><strong>Cross-asset correlations (3):</strong> Rolling 60-bar Pearson correlation of XAUUSD returns with
    XAGUSD, DXY, and NAS100 returns. These are not predictive as lagged features (confirmed by our
    cross-asset lead-lag study) but serve as regime indicators: a breakdown in the normally strong
    gold-silver correlation, or an inversion of the gold-dollar correlation, signals a regime change
    that affects optimal trading behavior.</li>
  <li><strong>Cross-asset betas (3):</strong> Rolling 60-bar regression beta of XAUUSD returns against DXY,
    NAS100, and US500 returns. The beta measures gold's sensitivity to each instrument. <strong>Note: all
    three beta features (beta_xag_to_xau_30, beta_xag_to_xau_60, beta_xag_to_xau_120) required
    inversion</strong> &mdash; their natural orientation had AUC below 0.500, meaning that higher beta
    (more sensitivity to cross-assets) actually predicted <em>opposite</em> gold direction. After
    inversion, AUC values improved to 0.509&ndash;0.517.</li>
  <li><strong>XAU core (2):</strong> xaucore is the residual return after removing cross-asset
    beta exposures: $r_{\text{gold}} - \beta_{\text{DXY}} \cdot r_{\text{DXY}} - \beta_{\text{NAS}} \cdot r_{\text{NAS}}$. This isolates gold-specific
    returns from cross-asset factor exposure. xaucore_z is the z-score of xaucore over a
    60-bar window. Positive xaucore_z indicates gold is outperforming what cross-asset factors predict,
    potentially due to gold-specific flows (physical demand, central bank buying, ETF inflows).</li>
  <li><strong>Volume ratio (1):</strong> Current bar tick volume divided by 60-bar rolling mean tick volume.
    Values &gt; 1.5 indicate unusually high activity (session opens, news events); values &lt; 0.5 indicate
    quiet periods. Volume ratio is a key input to the liquidity-sensitive features in the Extended group.</li>
</ul>

<h3>3.3 Level and Channel Features (17 features)</h3>

<p>
  Support/resistance levels and regression channels provide structural context that pure price dynamics
  features cannot capture. A price that is $2 above the nearest resistance level has different implications
  than a price that is $2 below it, even if the returns, volatility, and momentum are identical.
</p>

<ul>
  <li><strong>KMeans levels (13):</strong> Computed via the the LevelState dataclass, which maintains
    a dynamic set of K=7 price levels computed by K-Means clustering on a 5-day (7,200-bar) lookback of
    close prices. The the level features function function returns 13 values per bar (extended from the
    original 10 in February 2026):
    <ul>
      <li>dist_nearest_above: Distance (in ATR units) to the nearest level above current price</li>
      <li>dist_nearest_below: Distance (in ATR units) to the nearest level below current price</li>
      <li>level_density: Count of levels within 0.5 ATR of current price (congestion indicator)</li>
      <li>nearest_above_touches: Number of times price has touched the nearest level above (more touches = stronger resistance)</li>
      <li>nearest_below_touches: Number of times price has touched the nearest level below</li>
      <li>nearest_above_bounces: Times price reversed after touching the level above (bounce rate)</li>
      <li>nearest_below_bounces: Times price reversed after touching the level below</li>
      <li>nearest_above_breakout: Binary flag: has price ever broken through the level above?</li>
      <li>nearest_below_breakout: Binary flag: has price ever broken through the level below?</li>
      <li>time_since_last_touch_above: Bars since the nearest above level was last touched</li>
      <li>time_since_last_touch_below: Bars since the nearest below level was last touched</li>
      <li>level_strength_above: Composite score: touches &times; bounce_rate / (1 + breakouts)</li>
      <li>level_strength_below: Composite score for the level below</li>
    </ul>
    The three features added in the February 2026 extension (time_since_last_touch and level_strength for
    above/below, plus an additional density metric) improved the model's ability to distinguish between
    fresh levels (recently formed, actively tested) and stale levels (not touched in hours, likely irrelevant).
  </li>
  <li><strong>Quantile regression channels (4):</strong> Fit quantile regression lines at Q=[0.1, 0.5, 0.9]
    over a 180-minute rolling window. The features are:
    <ul>
      <li>channel_upper: Q=0.9 regression line value (upper boundary)</li>
      <li>channel_lower: Q=0.1 regression line value (lower boundary)</li>
      <li>channel_width: $(	ext{upper} - 	ext{lower}) / C$ (normalized width)</li>
      <li>channel_position: $(C - 	ext{lower}) / (	ext{upper} - 	ext{lower})$, ranging [0, 1], indicating position within the channel (0 = at lower boundary, 1 = at upper boundary)</li>
    </ul>
    Quantile regression is preferred over standard linear regression for channels because it captures the
    actual boundaries of price movement rather than the central tendency. The Q=0.1 and Q=0.9 lines
    approximate the 10th and 90th percentile price paths.
  </li>
</ul>

<h3>3.4 Session and Timing Features (5 features)</h3>

<p>
  Gold's 23-hour trading day spans three major liquidity sessions with distinct microstructure characteristics.
  Session features allow the model to learn session-dependent behavior:
</p>

<table>
  <tr>
    <th>Feature</th>
    <th>Description</th>
    <th>Rationale</th>
  </tr>
  <tr>
    <td>session_asian</td>
    <td>Binary: Asian session (00:00&ndash;08:00 UTC)</td>
    <td>Low volume, narrow ranges, strong mean reversion. The model should apply tighter stops and prefer counter-trend trades during this session.</td>
  </tr>
  <tr>
    <td>session_london</td>
    <td>Binary: London session (07:00&ndash;16:00 UTC)</td>
    <td>Highest liquidity, London AM/PM gold fixes, pronounced trending behavior. The session where most genuine moves occur.</td>
  </tr>
  <tr>
    <td>session_ny</td>
    <td>Binary: New York session (13:00&ndash;22:00 UTC)</td>
    <td>Equity-correlated flows, macroeconomic data releases (NFP, CPI, FOMC). Most volatile during the London-NY overlap.</td>
  </tr>
  <tr>
    <td>session_overlap</td>
    <td>Binary: London&ndash;NY overlap (13:00&ndash;16:00 UTC)</td>
    <td>The single most liquid and volatile period of the trading day. Both London and New York desks are active simultaneously. ~40% of daily gold volume concentrates here.</td>
  </tr>
  <tr>
    <td>vol_session_ratio</td>
    <td>Continuous: current volatility / session average volatility</td>
    <td>Normalizes volatility by session expectations. A vol_session_ratio of 2.0 during the Asian session is more noteworthy than 2.0 during the London-NY overlap.</td>
  </tr>
</table>

<p>
  <strong>Removed feature:</strong> london_open (binary flag for the first 15 minutes of London
  session) was tested and removed with AUC = 0.503 &mdash; indistinguishable from noise. The session boundaries
  themselves provide sufficient temporal context without precise-minute indicators.
</p>

<h3>3.5 Extended Features (59 features)</h3>

<p>
  The largest feature group, organized into 14 sub-families. Each sub-family targets a specific aspect of
  market microstructure, regime dynamics, or cross-asset relationships:
</p>

<table>
  <tr>
    <th>Sub-Family</th>
    <th>Count</th>
    <th>Features</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><strong>Price-Volume Interaction</strong></td>
    <td>4</td>
    <td>vw_return_60, obv_slope_60, vol_surprise, pv_corr_60</td>
    <td>Volume-weighted returns capture whether price moves are backed by participation. OBV (On-Balance Volume) slope tracks cumulative buying/selling pressure. Volume surprise detects unusual activity. PV correlation measures the price-volume relationship (positive in trending, negative in distribution).</td>
  </tr>
  <tr>
    <td><strong>Tick Proxies</strong></td>
    <td>3</td>
    <td>tick_direction_ratio, tick_intensity, bar_tick_vol_ratio</td>
    <td>Since true order flow is unavailable in OTC gold, we estimate it from price microstructure. Tick direction ratio counts uptick vs. downtick bars in a rolling window. Tick intensity measures the number of price changes per bar. Bar-to-tick volatility ratio detects when bar volatility diverges from tick-level volatility (indicating large single prints vs. gradual movement).</td>
  </tr>
  <tr>
    <td><strong>Multi-TF Momentum</strong></td>
    <td>5</td>
    <td>rsi_14, mom_5, mom_15, mom_60, mom_240, mom_divergence</td>
    <td>RSI computed via the rolling RSI function (window=14) captures overbought/oversold conditions. Four-horizon momentum provides the model with a multi-scale trend view. Momentum divergence ($	ext{mom}_5 - 	ext{mom}_{60}$) flags when short-term momentum opposes long-term &mdash; often a reversal precursor.</td>
  </tr>
  <tr>
    <td><strong>Regime Indicators</strong></td>
    <td>4</td>
    <td>hurst_60, trend_mr_class, regime_persistence, regime_change_rate</td>
    <td>Hurst exponent (&gt;0.5 = trending, &lt;0.5 = mean-reverting) via R/S analysis. Trend/MR classification is a derived binary. Regime persistence measures how many consecutive bars have maintained the same regime. Regime change rate counts regime switches per 120-bar window.</td>
  </tr>
  <tr>
    <td><strong>Volatility Proxies</strong></td>
    <td>5</td>
    <td>parkinson_vol, gk_vol, vol_of_vol, vol_zscore, vol_ratio_short_long</td>
    <td>Parkinson volatility uses high-low range (more efficient than close-to-close). Garman-Klass (_garman_klass_vol) uses full OHLC. Vol-of-vol (volatility of volatility) captures clustering. Vol z-score and vol ratio (30-bar/120-bar) capture the current volatility regime relative to recent history.</td>
  </tr>
  <tr>
    <td><strong>Volatility Clustering</strong></td>
    <td>3</td>
    <td>vol_autocorr_10, vol_regime, vol_breakout_flag</td>
    <td>Volatility autocorrelation at 10-bar lag quantifies clustering strength (typically 0.6&ndash;0.8 for gold M1, confirming strong GARCH-like behavior). Vol regime is ordinal (expanding/stable/contracting). Vol breakout flags bars where volatility exceeds 2&sigma; above its 120-bar mean.</td>
  </tr>
  <tr>
    <td><strong>Risk-On/Off</strong></td>
    <td>4</td>
    <td>gold_equity_corr_regime, vix_level, vix_change, risk_on_score</td>
    <td>Gold-equity correlation regime captures whether gold is trading as a risk asset (positive correlation with equities) or a safe haven (negative correlation). VIX level and change capture fear gauge dynamics. Risk-on score is a composite of equity performance, VIX level, and gold-equity correlation.</td>
  </tr>
  <tr>
    <td><strong>Lead-Lag Improvements</strong></td>
    <td>4</td>
    <td>dxy_lag5_ret, nas_lag5_ret, xag_lag5_ret, composite_lead</td>
    <td>Despite our finding that 1-bar lagged returns have no predictive power, we retain 5-bar lagged returns as features because they capture a slightly different dynamic: the 5-minute lag allows for slower information transmission channels (e.g., option hedging flows). Composite lead is a weighted combination. Their AUC is marginal (0.505&ndash;0.510) but they contribute to the model's regime awareness.</td>
  </tr>
  <tr>
    <td><strong>Candle Patterns</strong></td>
    <td>4</td>
    <td>body_range_ratio, upper_wick_ratio, lower_wick_ratio, doji_flag</td>
    <td>Body-to-range ratio measures conviction (high ratio = strong directional bar, low ratio = indecision). Wick ratios quantify rejection from high/low prices. Doji flag (body &lt; 10% of range) indicates extreme indecision, often preceding breakouts.</td>
  </tr>
  <tr>
    <td><strong>Liquidity Windows</strong></td>
    <td>3</td>
    <td>mins_to_session_open, mins_to_session_close, london_fix_proximity</td>
    <td>Distance (in minutes) to the nearest session open/close. Session opens attract positioning flows; session closes attract book-squaring. London fix proximity (distance to 10:30 AM and 3:00 PM London gold fixes) captures the pre-fix positioning that systematically affects gold prices.</td>
  </tr>
  <tr>
    <td><strong>Calendar Patterns</strong></td>
    <td>3</td>
    <td>week_of_month, month_of_quarter, nfp_week_flag</td>
    <td>Week-of-month captures turn-of-month effects (institutional rebalancing, pension fund flows). Month-of-quarter captures quarter-end dynamics. NFP week flag marks the first Friday of each month &plusmn;2 days, when non-farm payrolls data creates unique volatility patterns.</td>
  </tr>
  <tr>
    <td><strong>S/R Improvements</strong></td>
    <td>4</td>
    <td>round_number_5, round_number_10, prev_day_hl_dist, pivot_point_dist</td>
    <td>Round number proximity (distance to nearest $5 and $10 levels) captures psychological support/resistance. Previous-day high/low distance provides key structural levels. Pivot point distance (classic floor-trader pivots) captures institutional reference levels.</td>
  </tr>
  <tr>
    <td><strong>Multi-Scale Analysis</strong></td>
    <td>5</td>
    <td>fractal_dim_60, dfa_60, wavelet_energy_ratio, multiscale_entropy, hurst_60</td>
    <td>Fractal dimension (_rolling_fractal_dimension, Higuchi method) measures price path complexity [1,2]. DFA (_rolling_dfa, Detrended Fluctuation Analysis) quantifies long-range dependence. Wavelet energy ratio captures the distribution of variance across frequency bands. Multi-scale entropy measures complexity at multiple embedding dimensions. Hurst exponent is shared with Regime Indicators.</td>
  </tr>
  <tr>
    <td><strong>Self-Similarity &amp; Alpha101</strong></td>
    <td>8</td>
    <td>autocorr_lag1, autocorr_lag5, autocorr_lag15, autocorr_lag60, partial_autocorr, self_similarity_idx, alpha024, alpha083</td>
    <td>Autocorrelation at four lags captures the AR structure at different horizons. Partial autocorrelation isolates the direct (not mediated) lag effect. Self-similarity index measures how well the recent return distribution matches the longer-term distribution (a form of stationarity test). Alpha024 and alpha083 are the two surviving Kakushadze (2016) factors (see companion paper).</td>
  </tr>
</table>

<h2>4. Feature Quality Control</h2>

<h3>4.1 AUC-Based Validation</h3>

<p>
  Every feature in the pipeline undergoes individual AUC testing on the held-out validation set (last 20%
  of training data). The target is binary: 1 if the next M1 bar's close exceeds the current close, 0 otherwise.
  AUC measures how well the feature alone discriminates between positive and negative
  next-bar returns, providing a baseline assessment of univariate predictive power before any feature
  interactions are considered.
</p>

<p>
  The AUC threshold for inclusion is context-dependent:
</p>

<ul>
  <li><strong>AUC &gt; 0.515 or &lt; 0.485:</strong> Strong candidate. Features below 0.485 are inverted
    (see 4.2), which flips them above 0.515.</li>
  <li><strong>AUC 0.505&ndash;0.515 or 0.485&ndash;0.495:</strong> Marginal. Included if they provide
    incremental value in forward feature selection (tested by adding to the existing set and measuring
    pipeline AUC improvement).</li>
  <li><strong>AUC 0.495&ndash;0.505:</strong> Noise. Removed. No feature in this band has ever survived
    forward selection.</li>
</ul>

<h3>4.2 Feature Inversion</h3>

<p>
  Features with AUC consistently below 0.500 are <strong>inverted</strong> (multiplied by &minus;1) rather
  than discarded. A feature with AUC = 0.480 is just as informative as one with AUC = 0.520 &mdash; it simply
  has the opposite sign convention. The inversion is applied in the feature pipeline before caching,
  ensuring that the model always sees the correctly oriented version. Four features required inversion:
</p>

<table>
  <tr>
    <th>Feature</th>
    <th>Original AUC</th>
    <th>Post-Inversion AUC</th>
    <th>Explanation</th>
  </tr>
  <tr>
    <td>tod_cos</td>
    <td>0.476</td>
    <td>0.524</td>
    <td>Cosine component peaked at midnight UTC; gold direction during Asian session was opposite to what the raw encoding implied.</td>
  </tr>
  <tr>
    <td>beta_xag_to_xau_30</td>
    <td>0.488</td>
    <td>0.512</td>
    <td>Higher gold-silver beta (more sensitivity) predicted <em>opposite</em> gold direction, possibly because high beta indicates regime stress.</td>
  </tr>
  <tr>
    <td>beta_xag_to_xau_60</td>
    <td>0.483</td>
    <td>0.517</td>
    <td>Same dynamic as 30-bar beta, stronger at longer horizon.</td>
  </tr>
  <tr>
    <td>beta_xag_to_xau_120</td>
    <td>0.489</td>
    <td>0.511</td>
    <td>Same pattern, weaker at the longest horizon as the relationship stabilizes.</td>
  </tr>
</table>

<p>
  The inversion list is tracked in the feature inversion list and included in the cache signature hash.
  Any change to the inversion list triggers automatic cache invalidation and feature recomputation.
</p>

<h3>4.3 Feature Removal</h3>

<p>
  Features with AUC indistinguishable from 0.500 (within &plusmn;0.005 after inversion) were removed entirely.
  These contribute no directional signal and add noise to the model. Notable removals include:
</p>

<ul>
  <li>sign_agree &mdash; cross-asset sign agreement (fraction of cross-asset instruments moving
    in the same direction as gold). AUC: 0.501. This feature measures contemporaneous agreement, which
    has no predictive value for the next bar.</li>
  <li>kalman_state, kalman_gain &mdash; outputs from a Kalman filter applied to
    close prices. AUC: 0.499, 0.502. The Kalman filter's state estimate is essentially a smoothed price,
    and the gain measures how much the filter trusts new observations. Neither provides directional signal
    beyond what the existing MA distance and residual z-score features capture.</li>
  <li>london_open &mdash; binary flag for the first 15 minutes of the London session.
    AUC: 0.503. The session indicators (session_london) already capture the London session boundary;
    a precise 15-minute window adds no incremental information.</li>
</ul>

<div style="margin: 2rem 0;">
<svg width="100%" viewBox="0 0 700 120" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
  <rect width="700" height="120" fill="#ffffff" rx="8"/>
  <text x="350" y="20" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 2: Feature Quality Control Pipeline</text>
  <!-- Box 1: Raw Candidates -->
  <rect x="20" y="38" width="120" height="50" rx="10" fill="#f3f4f6" stroke="#6b7280" stroke-width="1.5"/>
  <text x="80" y="58" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="700">120+</text>
  <text x="80" y="74" text-anchor="middle" fill="#374151" font-size="9">Raw Candidates</text>
  <!-- Arrow 1 -->
  <line x1="144" y1="63" x2="170" y2="63" stroke="#6b7280" stroke-width="1.5"/>
  <polygon points="170,58 180,63 170,68" fill="#6b7280"/>
  <!-- Box 2: AUC Validation -->
  <rect x="184" y="38" width="120" height="50" rx="10" fill="#f3f4f6" stroke="#374151" stroke-width="1.5"/>
  <text x="244" y="58" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">AUC Validation</text>
  <text x="244" y="74" text-anchor="middle" fill="#374151" font-size="9">Remove AUC &#x2248; 0.50</text>
  <!-- Arrow 2 -->
  <line x1="308" y1="63" x2="334" y2="63" stroke="#6b7280" stroke-width="1.5"/>
  <polygon points="334,58 344,63 334,68" fill="#6b7280"/>
  <text x="325" y="50" text-anchor="middle" fill="#dc2626" font-size="8">-9 noise</text>
  <!-- Box 3: Inversion -->
  <rect x="348" y="38" width="120" height="50" rx="10" fill="#f3f4f6" stroke="#374151" stroke-width="1.5"/>
  <text x="408" y="58" text-anchor="middle" fill="#1a1a2e" font-size="11" font-weight="600">Invert AUC&lt;0.50</text>
  <text x="408" y="74" text-anchor="middle" fill="#374151" font-size="9">4 features flipped</text>
  <!-- Arrow 3 -->
  <line x1="472" y1="63" x2="498" y2="63" stroke="#6b7280" stroke-width="1.5"/>
  <polygon points="498,58 508,63 498,68" fill="#6b7280"/>
  <!-- Box 4: Final -->
  <rect x="512" y="38" width="150" height="50" rx="10" fill="#f3f4f6" stroke="#059669" stroke-width="2"/>
  <text x="587" y="58" text-anchor="middle" fill="#059669" font-size="16" font-weight="700">107</text>
  <text x="587" y="74" text-anchor="middle" fill="#059669" font-size="10">Official Features</text>
  <!-- Bottom note -->
  <text x="350" y="108" text-anchor="middle" fill="#6b7280" font-size="10">Cache invalidation via SHA-256 hash of OFFICIAL_FEATURE_COLS</text>
</svg>
<p class="figure-caption">Figure 2: Feature quality control pipeline. Starting from 120+ candidates, noise features are removed via AUC validation, 4 features are inverted, yielding the final 107 official features.</p>
</div>

<h3>4.4 Alpha101 Screening</h3>

<p>
  All 101 Kakushadze (2016) alpha factors were evaluated as candidate features. Only 4 exceeded AUC &gt; 0.515,
  and only 2 survived forward selection: <strong>alpha024</strong> (AUC: 0.521) and <strong>alpha083</strong>
  (AUC: 0.518). The remaining 99 were discarded. The overall survival rate (1.98%) is consistent with the
  hypothesis that equity cross-sectional factors do not transfer to single-instrument commodity intraday
  trading. See our companion paper for a detailed analysis of the five structural failure modes.
</p>

<h2>5. Helper Functions</h2>

<p>
  The pipeline relies on eight core vectorized helper functions, each designed for efficiency on M1-scale
  datasets (hundreds of thousands of rows). All helpers are defined before
  the feature builder function in the source file and are implemented with NumPy
  vectorized operations, avoiding Python-level loops:
</p>

<table>
  <tr>
    <th>Function</th>
    <th>Signature</th>
    <th>Output Range</th>
    <th>Purpose</th>
  </tr>
  <tr>
    <td>_rolling_rsi</td>
    <td>(series, window) → series</td>
    <td>[0, 100]</td>
    <td>Relative Strength Index: $\\text{RSI} = 100 - \\frac{100}{1 + \\text{RS}}$ where $\\text{RS} = \\frac{\\text{EMA}(\\text{gains}, w)}{\\text{EMA}(\\text{losses}, w)}$. Uses the Wilder smoothing method (equivalent to EMA with span=2*window-1). RSI=14 is the standard configuration used in the pipeline.</td>
  </tr>
  <tr>
    <td>_rolling_atr_series</td>
    <td>(high, low, close, window) → series</td>
    <td>[0, &infin;)</td>
    <td>Average True Range (vectorized). Computes $\\text{TR}_t = \\max(H_t - L_t,\\, |H_t - C_{t-1}|,\\, |L_t - C_{t-1}|)$, then applies EMA smoothing: $\\text{ATR}_t = \\text{EMA}(\\text{TR}, w)$. This is the <strong>vectorized</strong> version for the feature pipeline; a separate scalar a scalar ATR function function exists for live execution where only the latest value is needed.</td>
  </tr>
  <tr>
    <td>_rolling_hurst</td>
    <td>(series, window) → series</td>
    <td>[0, 1]</td>
    <td>Hurst exponent via Rescaled Range (R/S) analysis: $H$ is estimated from the scaling law $\\frac{R}{S} \\sim n^H$. $H > 0.5$ indicates trending (persistent) behavior; $H < 0.5$ indicates mean-reverting (anti-persistent) behavior; $H = 0.5$ indicates random walk. <strong>Minimum bar floor: 20</strong> (below this, R/S analysis is statistically unreliable).</td>
  </tr>
  <tr>
    <td>_rolling_fractal_dimension</td>
    <td>(series, window) → series</td>
    <td>[1, 2]</td>
    <td>Higuchi fractal dimension. D=1 for a smooth curve, D=2 for space-filling noise. Values near 1.5 are typical for financial time series. Higher values indicate more complex/noisy price paths. <strong>Minimum bar floor: 12</strong> (Higuchi method requires at least 12 samples for stable k-max estimation).</td>
  </tr>
  <tr>
    <td>_rolling_dfa</td>
    <td>(series, window) → series</td>
    <td>[0, 2]</td>
    <td>Detrended Fluctuation Analysis exponent. &alpha; &gt; 1 indicates long-range correlations (trending); &alpha; &lt; 0.5 indicates anti-correlations (mean-reverting); &alpha; = 0.5 indicates white noise. More robust than the Hurst exponent for non-stationary series.</td>
  </tr>
  <tr>
    <td>_garman_klass_vol</td>
    <td>(high, low, close, open, window) → series</td>
    <td>[0, &infin;)</td>
    <td>Garman-Klass volatility estimator. Uses full OHLC information, making it approximately 8&times; more efficient than close-to-close volatility estimation. Formula: $\\sigma_{GK}^2 = \\frac{1}{n}\\sum_{i=1}^{n}\\left[\\frac{1}{2}\\left(\\ln\\frac{H_i}{L_i}\\right)^2 - (2\\ln 2 - 1)\\left(\\ln\\frac{C_i}{O_i}\\right)^2\\right]$, averaged over the rolling window.</td>
  </tr>
  <tr>
    <td>_rolling_beta</td>
    <td>(y, x, window) → series</td>
    <td>(&minus;&infin;, &infin;)</td>
    <td>Rolling OLS regression beta coefficient. Computes cov(y, x) / var(x) on a rolling window. Used for cross-asset betas (gold returns regressed on DXY, NAS100, US500 returns).</td>
  </tr>
  <tr>
    <td>_resid_z60</td>
    <td>(close) → series</td>
    <td>(&minus;&infin;, &infin;)</td>
    <td>Z-scored residual from a 60-bar rolling linear regression. Fits a linear trend to the last 60 close prices, computes the residual (actual - predicted), then z-scores it. Captures how far price deviates from its recent linear trend, normalized by the typical deviation magnitude.</td>
  </tr>
</table>

<h2>6. Feature Caching</h2>

<h3>6.1 Architecture</h3>

<p>
  Feature computation is expensive: the full 107-feature pipeline on six months of M1 data requires approximately
  90 seconds on a modern workstation. The bottleneck is the statistical features (Hurst, fractal dimension, DFA)
  which require rolling window computations over hundreds of thousands of rows. To avoid redundant computation,
  we implement a Parquet-based caching system:
</p>

<ul>
  <li><strong>Cache format:</strong> Apache Parquet with SNAPPY compression. Parquet is columnar, enabling
    efficient reading of individual feature columns without deserializing the entire frame. A 107-feature,
    180K-row cache file is approximately 40 MB compressed.</li>
  <li><strong>Metadata:</strong> Companion a companion metadata file file storing the feature signature hash,
    creation timestamp, feature count, row count, and data time range. The metadata enables quick validation
    without reading the Parquet file.</li>
  <li><strong>Signature:</strong> The cache key is a composite hash of multiple configuration elements:
    a composite of the features mode, official feature list, inversion list, Alpha101 flag, and any custom cache keys.
    The cache_key_dict can include additional application-specific keys (e.g., the data file
    modification timestamp). Any change to any component of this signature triggers a full cache rebuild.</li>
</ul>

<h3>6.2 Invalidation</h3>

<p>
  The cache is automatically invalidated when any of the following change:
</p>

<ul>
  <li>A feature is added to or removed from the official feature list</li>
  <li>A feature is added to or removed from the the feature inversion list list</li>
  <li>The order of features changes (affects model input layer ordering)</li>
  <li>The the Alpha101 toggle flag is toggled (adds/removes 2 features)</li>
  <li>The underlying data source is updated (detected via file modification timestamp in cache_key_dict)</li>
  <li>Any custom cache key in cache_key_dict changes</li>
</ul>

<p>
  On cache hit, feature loading takes approximately 0.3 seconds (vs. 90 seconds for full recomputation) &mdash;
  a 300&times; speedup. Cache rebuild events are logged with the reason for invalidation (which component of the
  signature changed), facilitating debugging when unexpected rebuilds occur. This makes iterative model development
  practical without risking stale feature data.
</p>

<h2>7. Minimum Bar Floors</h2>

<p>
  Several statistical features require a minimum number of input bars to produce mathematically stable outputs.
  Below these thresholds, the estimators are unreliable or degenerate. The the bar-floor scaling helper scaling function
  enforces minimum bar floors before computing these features:
</p>

<table>
  <tr>
    <th>Feature</th>
    <th>Minimum Bars</th>
    <th>Rationale</th>
    <th>Behavior Below Floor</th>
  </tr>
  <tr>
    <td>Hurst exponent (_rolling_hurst)</td>
    <td>20</td>
    <td>R/S analysis requires partitioning the window into sub-ranges. With &lt;20 bars, the partition sizes are too small for stable R/S estimation, and the Hurst estimate degenerates toward 0.5 (random walk) regardless of the true data-generating process.</td>
    <td>Output is NaN, forward-filled from the last valid estimate</td>
  </tr>
  <tr>
    <td>Fractal dimension (_rolling_fractal_dimension)</td>
    <td>12</td>
    <td>The Higuchi method computes curve lengths at multiple resolutions (k=1,2,...,k_max). With &lt;12 bars, k_max is too small to fit a reliable log-log regression for the dimension estimate.</td>
    <td>Output is NaN, forward-filled</td>
  </tr>
  <tr>
    <td>Wavelet energy ratio</td>
    <td>2</td>
    <td>Wavelet decomposition at the minimum level (1) requires at least 2 data points. This is a very low bar &mdash; the wavelet feature is available from the 2nd bar onward.</td>
    <td>Output is 0.5 (equal energy at all scales)</td>
  </tr>
  <tr>
    <td>DFA exponent (_rolling_dfa)</td>
    <td>16</td>
    <td>DFA requires fitting linear trends to windows of multiple sizes. With &lt;16 bars, the range of window sizes is too narrow for reliable exponent estimation.</td>
    <td>Output is NaN, forward-filled</td>
  </tr>
</table>

<p>
  The bar floors are enforced in the the bar-floor scaling helper helper, which wraps each statistical feature
  computation and replaces outputs below the floor with NaN. The NaN values are then forward-filled from
  the most recent valid estimate. This approach ensures that the model never sees garbage statistical
  estimates from insufficient data, while avoiding the loss of entire rows at the start of the dataset.
  In practice, the bar floors only affect the first 10&ndash;20 bars of a session (after a data gap or
  session start), which are typically excluded from training and inference anyway due to the sequence
  length requirements of the model (minimum 30 bars for the SHORT scale).
</p>

<h2>8. Summary Feature Table</h2>

<p>
  The complete pipeline organized by family, with feature counts:
</p>

<table>
  <tr>
    <th>Group</th>
    <th>Family</th>
    <th>Count</th>
    <th>Key Signals</th>
  </tr>
  <tr>
    <td rowspan="2"><strong>Original (9)</strong></td>
    <td>Price dynamics</td>
    <td>5</td>
    <td>Acceleration, MA distance, residual z-score, efficiency ratio</td>
  </tr>
  <tr>
    <td>Temporal encoding</td>
    <td>4</td>
    <td>Time-of-day (sin/cos), day-of-week, lead correlation</td>
  </tr>
  <tr>
    <td rowspan="4"><strong>OG Extended (17)</strong></td>
    <td>Multi-horizon returns</td>
    <td>4</td>
    <td>1m, 5m, 30m, 120m log returns</td>
  </tr>
  <tr>
    <td>Volatility</td>
    <td>3</td>
    <td>Realized vol (30/120 bar), volume ratio</td>
  </tr>
  <tr>
    <td>MA structure</td>
    <td>2</td>
    <td>Distance from MA-30 and MA-200</td>
  </tr>
  <tr>
    <td>Cross-asset</td>
    <td>8</td>
    <td>Correlations, betas, xaucore, xaucore_z</td>
  </tr>
  <tr>
    <td rowspan="2"><strong>Level &amp; Channel (17)</strong></td>
    <td>KMeans levels</td>
    <td>13</td>
    <td>Distances, touch/bounce/breakout, density, time-since-touch, level strength</td>
  </tr>
  <tr>
    <td>Quantile channels</td>
    <td>4</td>
    <td>Upper/lower bounds, width, position</td>
  </tr>
  <tr>
    <td><strong>Session (5)</strong></td>
    <td>Session indicators</td>
    <td>5</td>
    <td>Asian/London/NY/overlap flags, vol_session_ratio</td>
  </tr>
  <tr>
    <td rowspan="14"><strong>Extended (59)</strong></td>
    <td>Price-volume interaction</td>
    <td>4</td>
    <td>Volume-weighted returns, OBV, PV correlation</td>
  </tr>
  <tr>
    <td>Tick proxies</td>
    <td>3</td>
    <td>Tick direction, intensity, bar-tick vol ratio</td>
  </tr>
  <tr>
    <td>Multi-TF momentum</td>
    <td>5</td>
    <td>RSI, momentum at 4 horizons, divergence</td>
  </tr>
  <tr>
    <td>Regime indicators</td>
    <td>4</td>
    <td>Hurst, trend/MR class, persistence, change rate</td>
  </tr>
  <tr>
    <td>Volatility proxies</td>
    <td>5</td>
    <td>Parkinson, Garman-Klass, vol-of-vol, vol z, vol ratio</td>
  </tr>
  <tr>
    <td>Volatility clustering</td>
    <td>3</td>
    <td>Vol autocorrelation, regime, breakout flag</td>
  </tr>
  <tr>
    <td>Risk-on/off</td>
    <td>4</td>
    <td>Gold-equity corr regime, VIX level/change, risk score</td>
  </tr>
  <tr>
    <td>Lead-lag improvements</td>
    <td>4</td>
    <td>DXY/NAS100/XAG lagged returns, composite lead</td>
  </tr>
  <tr>
    <td>Candle patterns</td>
    <td>4</td>
    <td>Body ratio, wick ratios, doji, engulfing</td>
  </tr>
  <tr>
    <td>Liquidity windows</td>
    <td>3</td>
    <td>Session open/close proximity, London fix</td>
  </tr>
  <tr>
    <td>Calendar patterns</td>
    <td>3</td>
    <td>Week-of-month, month-of-quarter, NFP week</td>
  </tr>
  <tr>
    <td>S/R improvements</td>
    <td>4</td>
    <td>Round number proximity, prev day H/L, pivot</td>
  </tr>
  <tr>
    <td>Multi-scale analysis</td>
    <td>5</td>
    <td>Fractal dimension, DFA, wavelets, entropy, Hurst</td>
  </tr>
  <tr>
    <td>Self-similarity &amp; Alpha101</td>
    <td>8</td>
    <td>Autocorrelations, self-similarity, alpha024, alpha083</td>
  </tr>
  <tr>
    <td colspan="2"><strong>Total</strong></td>
    <td><strong>107</strong></td>
    <td></td>
  </tr>
</table>

<div style="margin: 2rem 0;">
<svg width="100%" viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
  <rect width="700" height="200" fill="#ffffff" rx="8"/>
  <text x="350" y="26" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 1: Feature Composition (107 Total)</text>
  <!-- Stacked horizontal bar -->
  <!-- Total width = 600px (from x=50 to x=650), each feature = 600/107 = 5.61px -->
  <!-- Original: 9 => 50.5px | OG Extended: 17 => 95.3px | Level & Channel: 17 => 95.3px | Session: 5 => 28px | Extended: 59 => 331px -->
  <!-- Row y=55 to y=110 (height 55) -->
  <!-- Original: 9 features -->
  <rect x="50" y="55" width="50" height="55" rx="0" fill="#0d9488"/>
  <!-- OG Extended: 17 features -->
  <rect x="100" y="55" width="96" height="55" rx="0" fill="#14b8a6"/>
  <!-- Level & Channel: 17 features -->
  <rect x="196" y="55" width="96" height="55" rx="0" fill="#2dd4bf"/>
  <!-- Session & Timing: 5 features -->
  <rect x="292" y="55" width="28" height="55" rx="0" fill="#5eead4"/>
  <!-- Extended: 59 features -->
  <rect x="320" y="55" width="330" height="55" rx="0" fill="#059669"/>
  <!-- Rounded corners on first and last -->
  <rect x="50" y="55" width="10" height="55" fill="#0d9488"/>
  <rect x="50" y="55" width="50" height="55" rx="4" fill="#0d9488"/>
  <rect x="320" y="55" width="330" height="55" rx="0" fill="#059669"/>
  <rect x="640" y="55" width="10" height="55" rx="4" fill="#059669"/>
  <!-- Count labels inside bars -->
  <text x="75" y="87" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">9</text>
  <text x="148" y="87" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">17</text>
  <text x="244" y="87" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">17</text>
  <text x="306" y="87" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="700">5</text>
  <text x="485" y="87" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">59</text>
  <!-- Labels below bar -->
  <text x="75" y="130" text-anchor="middle" fill="#1a1a2e" font-size="10" font-weight="500">Original</text>
  <text x="148" y="130" text-anchor="middle" fill="#1a1a2e" font-size="10" font-weight="500">OG Extended</text>
  <text x="244" y="130" text-anchor="middle" fill="#1a1a2e" font-size="10" font-weight="500">Level &amp; Channel</text>
  <text x="306" y="130" text-anchor="middle" fill="#1a1a2e" font-size="9" font-weight="500">Session</text>
  <text x="485" y="130" text-anchor="middle" fill="#1a1a2e" font-size="10" font-weight="500">Extended</text>
  <!-- Extended sub-sections breakdown -->
  <text x="485" y="148" text-anchor="middle" fill="#374151" font-size="9">PV(4) Tick(3) Mom(5) Regime(4) Vol(8) Risk(4) Lead(4) Candle(4) Liq(3) Cal(3) S/R(4) Scale(5) Self(8)</text>
  <!-- Legend -->
  <rect x="120" y="170" width="12" height="12" rx="2" fill="#0d9488"/>
  <text x="136" y="180" fill="#374151" font-size="10">Original (9)</text>
  <rect x="220" y="170" width="12" height="12" rx="2" fill="#14b8a6"/>
  <text x="236" y="180" fill="#374151" font-size="10">OG Extended (17)</text>
  <rect x="340" y="170" width="12" height="12" rx="2" fill="#2dd4bf"/>
  <text x="356" y="180" fill="#374151" font-size="10">Level &amp; Channel (17)</text>
  <rect x="470" y="170" width="12" height="12" rx="2" fill="#5eead4"/>
  <text x="486" y="180" fill="#374151" font-size="10">Session (5)</text>
  <rect x="555" y="170" width="12" height="12" rx="2" fill="#059669"/>
  <text x="571" y="180" fill="#374151" font-size="10">Extended (59)</text>
</svg>
<p class="figure-caption">Figure 1: Feature composition across the five major groups. The Extended group (59 features) is the largest, spanning 14 sub-families of market microstructure, regime, and cross-asset features.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/features/feature_auc_stability_heatmap.png" alt="Feature AUC stability across time periods" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 3: Feature AUC stability heatmap across different time periods. Features with consistent AUC values across periods (uniform colour) are the most reliable; those with high variance (mixed colours) may be regime-dependent.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/features/regime_gate_vs_auc.png" alt="Regime gate effectiveness versus feature AUC" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 4: Regime gate effectiveness versus feature AUC. Features with high static AUC tend to also receive high gate activation in the Variable Selection Network, but some features with moderate AUC show regime-dependent gating that amplifies their conditional predictive power.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/gold/channel_plot_full.png" alt="Quantile regression channel with price overlay" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 5: Quantile regression channel (Q=0.1 and Q=0.9) overlaid on XAUUSD price data. The channel width and the position of price within the channel are two of the 17 level and channel features in the pipeline.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/gold/xauusd_close_vs_ar1_24h.png" alt="XAUUSD close price versus AR(1) model prediction" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 6: XAUUSD close price versus AR(1) model prediction over a 24-hour window. The residual from this regression (the AR(1) residual z-score) is one of the original 9 features in the pipeline and captures short-term deviations from the linear trend.</p>
</div>

<h2>9. Conclusion</h2>

<p>
  A structured feature pipeline with rigorous quality control is essential for robust quantitative trading.
  Our 107-feature set balances breadth &mdash; spanning 6 instruments, 4 groups, and 14 feature families &mdash; with
  discipline: every feature passes AUC validation, features with inverted polarity are corrected rather than
  discarded, and a hash-based caching system ensures reproducibility without stale data.
</p>

<p>
  The pipeline supports both batch backtesting (full historical recomputation) and live execution (incremental
  feature updates with sub-second latency). The main entry point, the feature builder function,
  accepts M1 OHLCV DataFrames for all six instruments and returns a fully aligned feature matrix ready for
  model ingestion. The function handles all preprocessing (column renaming, timestamp alignment, missing data
  removal) internally, presenting a clean interface to the caller.
</p>

<p>
  The most informative feature families, ranked by their contribution to pipeline AUC, are: (1) regime
  indicators (Hurst exponent, trend/MR classification), (2) volatility proxies (Garman-Klass, Parkinson,
  vol-of-vol), (3) multi-scale analysis (fractal dimension, DFA), (4) level features (KMeans distances,
  touch counts), and (5) price dynamics (acceleration z-score, efficiency ratio). Cross-asset features
  provide critical regime context but limited direct predictive power, consistent with our finding that
  cross-asset lead-lag relationships do not hold at the M1 frequency.
</p>

<div class="finding-box">
  <p>
    <strong>Key Finding:</strong> Of the 107 features, the Extended group (59 features) contributes the largest
    share of marginal AUC, with volatility proxies, regime indicators, and multi-scale analysis being the
    highest-value families. Cross-asset features provide critical regime context but limited direct predictive
    power. The Alpha101 screening (101 candidates, 2 survivors) demonstrates that feature sourcing from
    adjacent domains has extremely low yield &mdash; domain-specific engineering is irreplaceable.
  </p>
</div>

<p>
  The pipeline is maintained via the the official feature list registry, which serves as both the
  canonical feature list and the cache invalidation key. Adding or removing a feature requires only updating
  this list &mdash; the caching system, model input layer, and validation suite adapt automatically. The
  minimum bar floors enforced by the bar-floor scaling helper ensure that statistical features are never computed on
  insufficient data, and the forward-fill strategy for sub-floor bars preserves row alignment without
  introducing garbage estimates into the training data.
</p>
`;

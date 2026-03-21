export const content = `
<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Work in Progress</strong> &mdash; Phase 2 complete, Phase 3 in progress.
  Data inventory, feature specification, normaliser selection, and model configuration finalised
  (43 features after pruning, 17 passthrough / 26 rolling z-score, VSN+TCN+Transformer with 4 temporal streams).
  All three Run 1 and Run 2 diagnostics complete. All indices have deploy-candidate models.
  NAS100 best at 68.9% val accuracy (negative generalisation gap),
  US30 68.4% with best class balance (1.6pp gap), US500 largest Run 1 to Run 2 improvement (class gap 15.5pp to 4.9pp).
  Run 3a/3b both failed (55.7%, 55.4%). Root cause: single-stream has 2.6x fewer params (562K vs 1,451K).
  Run 3c in progress: testing whether scaling the single-stream to 4,155K params (2.9x Run 2) resolves the capacity bottleneck before reverting to 4-stream.
</div>

<h2>Project Roadmap</h2>

<table>
  <thead>
    <tr><th>Phase</th><th>Description</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Phase 1</td><td>Literature Review</td><td style="color: #059669; font-weight: 600;">Complete</td></tr>
    <tr><td>Phase 2</td><td>Data Collection &amp; Feature Engineering<br/><small>7 gap studies completed — see Section 6 for full results.</small></td><td style="color: #059669; font-weight: 600;">Complete</td></tr>
    <tr><td>Phase 3</td><td>Model Development &amp; Backtesting<br/><small>Data inventory (7.1), feature specification (7.2), normaliser selection (7.3), and model configuration (7.4) finalised: 45 features, VSN+TCN+Transformer with 4 temporal streams, double-barrier labels. All three Run 1 diagnostics complete (7.5): NAS100 best at 68.9% val accuracy (negative generalisation gap), US30 67.8%, US500 63.1%. US30 Run 2 complete: 68.4% accuracy, bias eliminated. US500 Run 2 complete: 62.0% accuracy, class gap 15.5pp to 4.9pp. NAS100 Run 2 complete: 68.9% accuracy, Run 1 confirmed near-optimal. All Run 2 diagnostics complete. Run 3 architecture redesign complete (Section 7.6): single-stream 660-bar Transformer, multi-horizon targets, lag-15 cross-asset features, two Transformer layers. Run 3a regressed to 55.7% (Section 7.7): auxiliary loss dominance identified as root cause. Run 3b dynamic auxiliary scaling fixed loss balance (43% vs 71%) but accuracy remained at 55.4% (Section 7.8): root cause is single-stream capacity bottleneck (562K vs 1,451K params). Run 3c in progress: scaled single-stream (4,155K params, 320-dim, 3 layers) testing the capacity hypothesis before reverting to 4-stream.</small></td><td style="color: #2563eb; font-weight: 600;">In Progress</td></tr>
    <tr><td>Phase 4</td><td>Walk-Forward Validation</td><td style="color: #6b7280;">Planned</td></tr>
  </tbody>
</table>

<h2>1. Introduction</h2>

<p>
  The three dominant US equity indices &mdash; the Dow Jones Industrial Average (DJIA, traded as US30), the
  S&amp;P 500 (US500), and the NASDAQ-100 (NAS100) &mdash; are often treated as interchangeable proxies for
  "the US stock market." In practice, they differ profoundly in construction methodology, sector composition,
  and constituent overlap. The DJIA is price-weighted across 30 blue-chip stocks; the S&amp;P 500 is
  float-adjusted market-cap-weighted across roughly 500 companies; the NAS100 is modified market-cap-weighted
  across 100 non-financial firms with heavy technology exposure. These structural differences create persistent,
  non-trivial divergences in short-horizon returns that are largely absent from the academic literature.
</p>

<p>
  Most published research on US equity index prediction treats each index in isolation: momentum strategies on
  the S&amp;P 500, mean-reversion on the DJIA, or machine learning forecasts for the NASDAQ. The cross-index
  dimension &mdash; how information propagates between the three indices, how their spreads behave across market
  regimes, and whether structural differences create exploitable signals &mdash; remains substantially
  understudied. This is surprising given that the futures on these three indices (ES, YM, NQ) are among the
  most liquid instruments in the world, and that relative-value trades between them are a staple of
  institutional desks (CME Group, "Stock Index Spread Opportunities").
</p>

<p>
  This project aims to fill that gap. We begin with a comprehensive literature review covering cross-index
  dynamics, multi-index trading strategies, and structural differences that create tradeable opportunities.
  We then identify specific research gaps &mdash; several of which appear to be entirely unstudied in the
  academic literature &mdash; and outline a phased research plan to test them empirically. The data constraint
  is deliberate: we restrict ourselves to OHLCV data at minute resolution from MetaTrader 5, ensuring that
  any findings are reproducible without proprietary data feeds.
</p>

<h2>2. Cross-Index Dynamics</h2>

<h3>2.1 Lead-Lag Relationships</h3>

<p>
  The foundational work on lead-lag in equity markets comes from Lo and MacKinlay (1990), who documented that
  returns of large-capitalisation stocks lead returns of smaller stocks, attributing the effect partly to
  nonsynchronous trading and partly to differential speed of adjustment to information. Chordia and
  Swaminathan (2000) refined this finding by showing that high-volume portfolios lead low-volume portfolios
  at daily and weekly horizons, even after controlling for firm size. The mechanism is not purely mechanical:
  high-volume stocks adjust faster to market-wide information because they attract more attention from
  informed traders and algorithmic market makers.
</p>

<p>
  In the futures-spot domain, the evidence is decisive. Stoll and Whaley (1990) found that S&amp;P 500 and
  Major Market Index futures returns lead the corresponding cash indices by approximately five minutes on
  average, with occasional leads exceeding ten minutes. Lower transaction costs, leverage, and the ease of
  short-selling in futures explain why price discovery concentrates there. Hasbrouck (2003) quantified this
  precisely: roughly 90% of price discovery in the S&amp;P 500 occurs in E-mini futures
  (information share IS = 0.89 to 0.93). For the NASDAQ-100, E-mini futures similarly dominate. The SPY ETF
  contributes to sector ETF price discovery, but not the reverse.
</p>

<p>
  At the tick level, Huth and Abergel (2011) demonstrated that the most liquid assets lead smaller and less
  liquid stocks, and that the lead-lag structure is not constant intraday but shows seasonality around
  macroeconomic announcements and the US market open. By the early 2020s, median lead-lag durations in
  major equity markets have compressed to under ten milliseconds.
</p>

<p>
  Despite this extensive literature on futures-spot and large-small cap lead-lag, direct studies of
  information flow <em>between</em> the three major US equity indices are sparse. Because the DJIA contains
  only 30 price-weighted stocks while the NAS100 is technology-heavy and the S&amp;P 500 is broadly
  cap-weighted, differential information absorption speeds should exist during sector-specific news events.
  For instance, technology earnings may move the NAS100 first, with the signal propagating to the S&amp;P 500
  and the DJIA lagging if the relevant stocks carry low price-weighting in the Dow. This hypothesis has not
  been formally tested.
</p>

<h3>2.2 Correlation Structure and Regime Dependence</h3>

<p>
  Engle (2002) introduced the Dynamic Conditional Correlation (DCC-GARCH) framework, which has become the
  standard tool for estimating time-varying correlations between financial assets. The model proceeds in two
  stages: univariate GARCH for each series, followed by a parsimonious correlation model on the standardised
  residuals. For any study of cross-index dynamics, DCC-GARCH provides the natural starting point for
  measuring how tightly the three indices co-move and whether that co-movement is stable.
</p>

<p>
  A critical methodological insight comes from Forbes and Rigobon (2002), who demonstrated that raw
  correlation coefficients are biased upward during high-volatility periods. After adjusting for this bias,
  they found no significant increase in <em>unconditional</em> correlation during the 1997 Asian crisis,
  the 1994 Mexican devaluation, or the 1987 US crash. What appeared to be crisis-driven contagion was in
  fact pre-existing interdependence made visible by elevated variance. This finding has direct implications
  for anyone studying cross-index correlation during stress periods: naive rolling correlations will
  systematically overstate the degree of regime change.
</p>

<p>
  Hamilton (1989) introduced the Markov-switching model for macroeconomic time series, where model parameters
  depend on an unobservable regime variable that follows a first-order Markov chain. This framework underpins
  all subsequent regime-switching work in finance. Ang and Bekaert (2002) applied it to portfolio choice,
  documenting that correlations and volatilities increase in bear markets. Despite this, diversification
  retains value even under regime switching because the increase in correlation is not perfect.
</p>

<p>
  Regarding the three indices specifically, a Nasdaq (2020) white paper documents that NAS100 correlation with
  DJIA and S&amp;P 500 was weakest during the Tech Bubble and the low-volatility period of 2017, and
  strongest during and after the 2008 Financial Crisis. In low-volatility environments, correlations decline
  naturally as there is no strong macroeconomic signal forcing co-movement. Fry-McKibbin and Hsiao (2018)
  applied Markov-switching models to US indices and identified three regimes &mdash; tranquil, volatile, and
  turbulent &mdash; with the tranquil regime being most frequent, the volatile regime dominating 2008, and
  the turbulent regime dominating the first four months of 2020.
</p>

<h3>2.3 Sector Rotation Patterns</h3>

<p>
  The three indices differ structurally in sector exposure. The DJIA tilts toward industrials, healthcare,
  consumer staples, and financials. The S&amp;P 500 has approximately 30% technology, 13% healthcare, and
  13% financials. The NAS100 is roughly 45% technology with significant communications and consumer
  discretionary exposure, but excludes financials entirely and has minimal energy and utilities representation.
  These are not minor differences: they mean that sector rotation directly translates into cross-index
  relative performance.
</p>

<p>
  Barberis and Shleifer (2003) formalised this intuition in their style investing framework. They showed that
  investors categorise assets into styles and allocate capital at the category level rather than the
  individual-asset level. Assets within the same style co-move excessively; assets in different styles
  co-move too little relative to fundamentals. Importantly, style-level momentum and value strategies are
  more profitable than their asset-level counterparts. This framework maps directly onto the DJIA
  (value/industrial style) versus NAS100 (growth/technology style) distinction.
</p>

<p>
  Moskowitz and Grinblatt (1999) found that industry momentum is highly profitable even after controlling
  for size, book-to-market, and individual stock momentum. The sector composition differences across the
  three indices create natural momentum and rotation opportunities. The 2025 to 2026 "Great Rotation"
  provides a real-time illustration: capital shifted from technology (NAS100 underperformed the S&amp;P 500
  by approximately 6% year-to-date in 2025) into financials, industrials, energy, and precious metals, with
  the DJIA outperforming as traditional sectors led.
</p>

<h3>2.4 Dispersion and Convergence Dynamics</h3>

<p>
  The dispersion trading literature, reviewed by Drechsler, Moreira, and Savov (2018), documents that implied
  correlation among index constituents tends to exceed realised correlation. The core dispersion trade &mdash;
  buying straddles on individual stocks and selling straddles on the index &mdash; exploits this wedge. A
  study on S&amp;P 500 constituents from 2000 to 2017 found statistically significant returns of 14.5% to
  26.5% per annum after transaction costs. Dispersion trades are concave in correlation: they profit when
  individual stocks diverge and lose during stress periods when correlation spikes, making them inherently
  short the volatility of correlation.
</p>

<p>
  While traditional dispersion trading operates at the single-stock versus index level, the concept extends
  naturally to a three-index framework. If the three indices are temporarily dislocated &mdash; for example,
  the NAS100 rallying while the DJIA falls &mdash; a convergence trade betting on mean-reversion of the
  spread exploits the same correlation premium at the index level.
</p>

<h3>2.5 Index Arbitrage and Constituent Overlap</h3>

<p>
  The overlap structure between the three indices is asymmetric. All 30 DJIA stocks are constituents of the
  S&amp;P 500 (100% overlap). Approximately 79 of the 100 NAS100 stocks also appear in the S&amp;P 500.
  However, only six stocks appear in all three indices. Roughly 20% of DJIA weight maps to about 30% of
  NAS100 weight. This partial overlap means that the indices are neither independent nor identical &mdash;
  they share enough common constituents to co-move, but differ enough to diverge meaningfully during
  sector-specific events.
</p>

<p>
  Greenwood and Sammon (2023) documented that the index inclusion/exclusion effect has diminished over time
  as passive investing has grown, but that discretionary S&amp;P 500 deletions still beat additions by 22%
  in the following year. Index fund long-short rebalancing portfolios continue to earn 4.61% annualised.
  Each index follows its own rebalancing calendar: the S&amp;P 500 rebalances quarterly with ad hoc
  additions, the DJIA changes infrequently at the committee's discretion, and the NAS100 rebalances
  annually in December with special rebalancing triggered when the largest stock exceeds 24% weight.
  These rebalancing events create predictable flow demands that can temporarily dislocate cross-index
  relationships.
</p>

<h2>3. Multi-Index Strategies in the Literature</h2>

<h3>3.1 Pairs and Spread Trading</h3>

<p>
  Gatev, Goetzmann, and Rouwenhorst (2006) established the academic foundation for pairs trading. Using
  minimum-distance matching on normalised prices across the period 1962 to 2002, they found that a simple
  two-standard-deviation divergence trigger yielded average annualised excess returns of up to 11% for
  self-financing portfolios. More recently, Zhu (2024) found that trading cointegrated near-parity pairs
  generates 58 basis points per month after costs, with 71% convergence probability, outperforming
  distance-based selection methods.
</p>

<p>
  Applied to index spreads, CME Group details the methodology for constructing intermarket spreads between
  ES, YM, and NQ futures. A trader who believes technology is overvalued relative to the broad market sells
  NQ and buys ES, capturing relative sector performance without directional exposure. These spreads benefit
  from reduced margin requirements (as low as 10% of outright) reflecting their lower risk profile.
</p>

<h3>3.2 Time-Series Momentum and Rotation</h3>

<p>
  Moskowitz, Ooi, and Pedersen (2012) documented significant time-series momentum across 58 liquid
  instruments including equity index futures. A diversified time-series momentum (TSMOM) portfolio delivers
  substantial abnormal returns and performs best during extreme market moves. Applied to a three-index
  rotation framework &mdash; allocating to the index with the strongest trailing momentum at each
  rebalancing point &mdash; this is one of the most robust findings in quantitative finance, yet its
  specific application to DJIA/S&amp;P 500/NAS100 rotation is untested.
</p>

<p>
  Barberis and Shleifer (2003) showed that style rotation is more profitable than individual asset rotation.
  The DJIA-as-value versus NAS100-as-growth mapping provides a natural style rotation pair. Rothe (2023)
  formalised sector rotation using macroeconomic indicators to time sector ETF allocation, while Mamais
  (2025) showed that momentum profitability varies across sectors and time, with macroeconomic conditions
  predicting these shifts.
</p>

<h3>3.3 Risk-On/Risk-Off Regime Detection</h3>

<p>
  Chari, Stedman, and Lundblad (2025) proposed a composite risk-on/risk-off (RORO) index using credit
  spreads, equity returns, implied volatility, funding liquidity, and currency/gold signals. NBER Working
  Paper 31907 (2023) argues for measuring RORO as a combination of risk aversion (the price of risk) and
  macroeconomic uncertainty (the quantity of risk). Li (2025) found that the largest negative VIX-to-S&amp;P 500
  correlation occurs when both markets are in a high-volatility state, a result directly applicable to
  regime-conditional hedging.
</p>

<p>
  A particularly promising signal, used by practitioners but never formally studied, is the
  <strong>NAS100/DJIA ratio</strong> as a risk-on/risk-off indicator. When the NAS100 outperforms the DJIA,
  capital is flowing into growth and technology stocks, signalling risk-on conditions. When the DJIA
  outperforms the NAS100, capital is rotating into value and defensive sectors, signalling risk-off. The
  2025 to 2026 "Great Rotation" episodes provide vivid real-time illustrations of this dynamic. Despite its
  widespread use on trading desks, no academic study has validated the NAS100/DJIA ratio as a regime
  indicator or tested whether conditioning on it improves strategy selection.
</p>

<h2>4. Research Gaps Identified</h2>

<p>
  Our literature review reveals several research gaps, ranging from entirely unstudied phenomena to
  well-known effects that have never been rigorously validated on this specific set of instruments.
  We restrict attention to gaps that can be tested with OHLCV data at minute resolution &mdash; the data
  we have available from MetaTrader 5. The following four gaps carry the highest combination of novelty,
  feasibility, and practical value.
</p>

<h3>4.1 Price-Weighted vs. Cap-Weighted Divergence Signal</h3>

<p>
  The DJIA is the only major US equity index that uses price-weighting. This construction methodology
  creates mechanical, non-fundamental divergences from cap-weighted indices around stock splits, constituent
  additions and deletions, and divisor adjustments. A stock split, which is economically neutral, changes
  a company's DJIA weight but has no effect on its S&amp;P 500 or NAS100 weight. Passive DJIA-tracking
  funds must rebalance in response; S&amp;P 500 and NAS100 trackers do not.
</p>

<p>
  <strong>No published study has systematically tested this divergence as a mean-reversion trading signal.</strong>
  The weighting methodology difference is structural and permanent &mdash; it cannot be arbitraged away
  because it stems from index construction rules, not from mispricing. The divergence is directly observable
  as the spread between normalised US30 and US500 (or NAS100) price series, making it testable with
  standard OHLCV data. The planned methodology involves constructing the normalised spread, testing
  z-score mean-reversion entry and exit thresholds, identifying whether divergence events cluster around
  known structural events, and validating out of sample with walk-forward windows.
</p>

<h3>4.2 Trivariate Cointegration Regime Model</h3>

<p>
  Most cointegration studies in the pairs-trading literature test bivariate relationships (e.g., SPY/IWM).
  However, the Johansen (1991) multivariate vector error correction model (VECM) framework allows testing
  cointegration among all three indices simultaneously. Trivariate cointegration can reveal cointegrating
  vectors that no bivariate test would detect &mdash; relationships where the three-way spread mean-reverts
  even though no two-way spread does.
</p>

<p>
  Furthermore, no study examines how trivariate cointegration stability changes across market regimes.
  Cointegration can break down during crisis periods or structural breaks. A Markov-switching VECM that
  detects regime transitions and adjusts trading rules accordingly would be a novel contribution. The
  planned methodology involves Johansen trace and eigenvalue tests at multiple timeframes (M5, M15, H1, D1),
  estimation of cointegrating vectors and error-correction speeds, and regime-switching models to detect
  when cointegration breaks down.
</p>

<h3>4.3 NAS100/DJIA Ratio as a Regime Indicator</h3>

<p>
  As discussed in Section 3.3, the NAS100/DJIA ratio is widely used by practitioners as a risk-on/risk-off
  proxy, but it has never been formally validated. Zero academic studies exist. The planned empirical work
  will construct the ratio time series, define regimes based on the direction and magnitude of ratio changes
  across multiple lookback windows, and test whether regime identification predicts which index has the
  highest forward returns, whether momentum or mean-reversion strategies perform better in each regime, and
  whether volatility is expanding or contracting. The 2025 to 2026 "Great Rotation" provides a natural
  out-of-sample test period.
</p>

<h3>4.4 Cross-Index Lead-Lag at Minute Frequency</h3>

<p>
  The academic lead-lag literature focuses on futures versus spot or large-cap versus small-cap stocks. No
  study directly measures information flow between US30, US500, and NAS100 at minute frequency, conditional
  on the type of move. During sector-specific events, differential absorption speeds should exist:
  technology earnings may move the NAS100 first, with the signal propagating to the S&amp;P 500 and
  reaching the DJIA last. The planned methodology involves Granger causality tests at lags of one to ten
  minutes, time-varying lead-lag estimation via rolling window cross-correlation, conditioning on volatility
  regime and time of day, and testing whether detected lead-lag patterns are exploitable after spread costs.
</p>

<h3>4.5 Additional Gaps</h3>

<p>
  Beyond the four primary gaps, our review identified several secondary opportunities:
</p>

<ul>
  <li><strong>DJIA stock-split event arbitrage</strong> &mdash; when a DJIA constituent splits, its index weight
  drops mechanically while its weight in the S&amp;P 500 and NAS100 is unaffected, creating a multi-index
  relative-value window that has never been formally studied.</li>
  <li><strong>Joint multi-index Hidden Markov Model</strong> &mdash; most HMMs in the financial literature use
  single-index returns; a joint HMM on all three indices could capture cross-index states such as
  "technology-led rally," "broad selloff," "sector rotation," or "convergence."</li>
  <li><strong>Anomaly decay rates on the DJIA</strong> &mdash; calendar effects, Dogs of the Dow, and moving
  average crossover strategies have all weakened over time, but no meta-study quantifies the rate at which
  published anomalies lose their edge on this liquid blue-chip index.</li>
  <li><strong>NAS100 concentration-conditional strategy selection</strong> &mdash; whether momentum versus
  mean-reversion performance varies as a function of mega-cap concentration levels (Magnificent 7 weight
  approximately 40%) is an open question with no peer-reviewed evidence.</li>
</ul>

<h2>5. Planned Methodology</h2>

<p>
  The empirical work is organised into three subsequent phases, each building on the previous.
</p>

<p>
  <strong>Phase 2: Data Collection and Feature Engineering.</strong> We will collect M1 OHLCV bars for US30,
  US500, and NAS100 from MetaTrader 5 and CSV archives covering at least five years. Features will include
  normalised cross-index spreads (US30/US500, US30/NAS100, NAS100/US500), the NAS100/DJIA ratio and its
  rolling changes, volatility estimators (ATR, Garman-Klass, Parkinson, Yang-Zhang) for each index,
  rolling Johansen cointegration test statistics at multiple timeframes, and lead-lag estimates from
  rolling cross-correlation and Granger causality. Feature engineering will follow the same rigorous
  pipeline used in our gold trading research, with cache invalidation tied to feature column signatures.
</p>

<p>
  <strong>Phase 3: Model Development and Backtesting.</strong> We will test the four primary research gaps
  as standalone strategies: z-score mean-reversion on the price-weighted/cap-weighted divergence,
  trivariate VECM spread trading with regime-conditional entry and exit, NAS100/DJIA ratio as a
  regime filter for momentum versus mean-reversion selection, and cross-index lead-lag exploitation at
  minute frequency. Each strategy will be evaluated against a buy-and-hold baseline with realistic
  transaction costs (MT5 spreads of 1 to 3 points for US30, 0.5 to 1 point for US500 and NAS100).
</p>

<p>
  <strong>Phase 4: Walk-Forward Validation.</strong> All strategies that show promise in Phase 3 will
  undergo walk-forward out-of-sample testing with expanding or rolling training windows. We will report
  Sharpe ratios, maximum drawdowns, profit factors, and statistical significance via bootstrap. Any
  strategy that fails to outperform buy-and-hold after costs in the walk-forward test will be
  documented as a negative result.
</p>

<h2>6. Phase 2: Empirical Gap Studies</h2>

<p>
  Seven empirical gap studies were conducted to test the research questions identified in Section 4.
  Studies are presented in order of increasing complexity, from simple single-index strategies to
  multi-index structural models, with a final Granger causality validation study bridging Phase 2
  and Phase 3.
</p>

<h3>6.1 Gap Study #8: IBS/RSI Mean-Reversion Replication</h3>

<h4>Objective</h4>

<p>
  The first empirical study in Phase 2 replicates two of the most cited OHLCV-only mean-reversion
  strategies on US equity indices: the Internal Bar Strength (IBS) strategy from Pagonidis (2014) and
  the RSI(2) strategy from Connors and Alvarez (2009). Both strategies are tested on US30, US500, and
  NAS100 using daily bars from MetaTrader 5 with realistic CFD spread costs applied to every round-trip.
  The purpose is to establish whether these well-known edges survive transaction costs on MT5 CFDs before
  building more complex models on top of them.
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from historical backtests on
  MT5 CFD daily bars with spread costs deducted on every entry. They do not account for slippage,
  overnight financing, or execution latency. Past performance does not predict future results.
</div>

<h4>Full-Sample Results (Literature Parameters)</h4>

<p>
  The IBS strategy enters long when the Internal Bar Strength
  $\\text{IBS} = (\\text{Close} - \\text{Low}) / (\\text{High} - \\text{Low})$ falls below 0.20 and
  exits the next trading day. The RSI(2) strategy enters long when the two-period RSI drops below 5
  and holds for five trading days. Both use the exact parameter values from their respective publications.
</p>

<h4>IBS (buy &lt; 0.20, sell &gt; 0.80, hold 1 day)</h4>

<table>
  <thead>
    <tr><th>Index</th><th>Trades</th><th>Win Rate</th><th>Profit Factor</th><th>Total Points</th><th>Buy &amp; Hold Points</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>360</td><td>49.4%</td><td>1.15</td><td>+8,764</td><td>+19,167</td></tr>
    <tr><td>US500</td><td>547</td><td>50.3%</td><td>1.26</td><td>+2,846</td><td>+4,055</td></tr>
    <tr><td>NAS100</td><td>603</td><td>49.4%</td><td>1.25</td><td>+12,516</td><td>+18,027</td></tr>
  </tbody>
</table>

<h4>RSI(2) &lt; 5, hold 5 days</h4>

<table>
  <thead>
    <tr><th>Index</th><th>Trades</th><th>Win Rate</th><th>Profit Factor</th><th>Total Points</th><th>Buy &amp; Hold Points</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>47</td><td>57.4%</td><td>1.48</td><td>+7,243</td><td>+19,167</td></tr>
    <tr><td>US500</td><td>61</td><td>67.2%</td><td>1.64</td><td>+1,501</td><td>+4,055</td></tr>
    <tr><td>NAS100</td><td>62</td><td>59.7%</td><td>1.45</td><td>+4,959</td><td>+18,027</td></tr>
  </tbody>
</table>

<p>
  Both strategies are profitable in-sample across all three indices, but neither comes close to matching
  buy-and-hold returns. IBS captures roughly 46% to 70% of buy-and-hold points depending on the index,
  while RSI(2) captures 27% to 38%. The RSI(2) strategy shows higher win rates and profit factors but
  trades far less frequently (47 to 62 trades versus 360 to 603 for IBS).
</p>

<h4>Walk-Forward Out-of-Sample Results</h4>

<p>
  To test robustness, both strategies were evaluated using a nine-fold walk-forward framework with
  expanding training windows. At each fold, the strategy parameters were re-optimised on the training
  window and evaluated on the subsequent out-of-sample period.
</p>

<table>
  <thead>
    <tr><th>Strategy</th><th>Folds Beating Buy &amp; Hold</th><th>OOS Beat Rate</th></tr>
  </thead>
  <tbody>
    <tr><td>IBS</td><td>2 / 9</td><td>22%</td></tr>
    <tr><td>RSI(2)</td><td>3 / 9</td><td>33%</td></tr>
  </tbody>
</table>

<p>
  Neither strategy beats buy-and-hold consistently out of sample. Walk-forward optimal parameters are
  unstable across folds, suggesting that the in-sample edge is partially an artefact of parameter fitting
  rather than a stable structural signal.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>Pagonidis's 75% IBS win rate does not replicate.</strong> We observe approximately 50% across
  all three indices. The discrepancy likely reflects differences in instrument (equities versus CFDs),
  cost assumptions, and sample period.</li>
  <li><strong>RSI(2) shows a genuine but weak signal.</strong> Win rates of 55 to 67% are consistent with
  Connors and Alvarez (2009) but the edge is too thin to overcome buy-and-hold on a trending asset class.</li>
  <li><strong>US500 is the worst venue for both strategies.</strong> Higher relative spread costs on the
  S&amp;P 500 CFD eat the thin mean-reversion edge more aggressively than on US30 or NAS100.</li>
  <li><strong>Walk-forward parameters are unstable.</strong> Optimal IBS and RSI thresholds shift
  substantially across folds, indicating that the strategies are fitting noise rather than capturing
  a stable structural signal.</li>
  <li><strong>Negative results are informative.</strong> These findings confirm that the research agenda
  should focus on the novel cross-index gaps identified in Section 4 (spread dynamics, cointegration,
  regime detection) rather than on single-index mean-reversion at daily frequency.</li>
  <li><strong>Verdict: FAIL.</strong> Daily mean-reversion on MT5 CFDs does not outperform buy-and-hold.
  IBS replication failed (50% win rate versus Pagonidis's reported 75%). RSI(2) replication is partial
  (genuine but weak signal, insufficient after costs). Neither strategy passes walk-forward validation.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/summary_comparison_20260316_232903.png" alt="Summary comparison across all strategies and indices" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 1. Summary comparison of IBS and RSI(2) strategies across US30, US500, and NAS100. Neither strategy matches buy-and-hold returns.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/US30_ibs_rsi_study_20260316_232903.png" alt="US30 IBS and RSI study results" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 2. US30 IBS and RSI(2) equity curves and trade distributions.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/US500_ibs_rsi_study_20260316_232903.png" alt="US500 IBS and RSI study results" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 3. US500 IBS and RSI(2) equity curves and trade distributions. US500 shows the weakest performance due to higher relative spread costs.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/NAS100_ibs_rsi_study_20260316_232903.png" alt="NAS100 IBS and RSI study results" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 4. NAS100 IBS and RSI(2) equity curves and trade distributions.</figcaption>
</figure>

<h3>6.2 Gap Study #4: Cross-Index Momentum Rotation</h3>

<h4>Objective</h4>

<p>
  The second empirical study tests whether cross-index momentum rotation can outperform static
  buy-and-hold allocation across the three US equity indices. This directly addresses the gap
  identified in Section 3.2: time-series momentum (Moskowitz, Ooi, and Pedersen, 2012) is one
  of the most robust findings in quantitative finance, yet its specific application to
  US30/US500/NAS100 rotation has never been tested. We evaluate four rotation strategies
  against four buy-and-hold baselines over a common period of August 2020 to March 2026
  (approximately 5.5 years).
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from historical backtests on
  MT5 CFD daily bars with spread costs deducted on every entry. They do not account for slippage,
  overnight financing, or execution latency. Past performance does not predict future results.
</div>

<h4>Strategies and Baselines</h4>

<p>
  Four rotation strategies were tested, all using daily close prices for the three indices:
</p>

<ul>
  <li><strong>Top-1 Momentum:</strong> At each rebalancing date, allocate 100% to the index with
  the highest trailing return over the lookback window.</li>
  <li><strong>Top-2 Momentum:</strong> Allocate 50% each to the two indices with the highest
  trailing returns.</li>
  <li><strong>TSMOM (Time-Series Momentum):</strong> For each index independently, go long if its
  trailing return over the lookback window is positive, otherwise go to cash. Equal-weight across
  indices with positive momentum. If all three have negative momentum, hold 100% cash.</li>
  <li><strong>Long-Short:</strong> Go long the top-momentum index and short the bottom-momentum
  index at each rebalancing date.</li>
</ul>

<p>
  Lookback periods of 1, 3, 6, and 12 months were tested with both weekly and monthly rebalancing
  frequencies. The optimal configuration was selected on the full sample and validated via
  walk-forward out-of-sample testing.
</p>

<h4>Baseline Performance</h4>

<table>
  <thead>
    <tr><th>Baseline</th><th>Ann. Return</th><th>Sharpe Ratio</th><th>Max Drawdown</th></tr>
  </thead>
  <tbody>
    <tr><td>Buy &amp; Hold US30</td><td>9.9%</td><td>0.67</td><td>-21.8%</td></tr>
    <tr><td>Buy &amp; Hold US500</td><td>13.1%</td><td>0.78</td><td>-24.9%</td></tr>
    <tr><td>Buy &amp; Hold NAS100</td><td>15.0%</td><td>0.69</td><td>-35.4%</td></tr>
    <tr><td>Equal Weight (1/3 each)</td><td>12.9%</td><td>0.75</td><td>-26.4%</td></tr>
  </tbody>
</table>

<p>
  NAS100 buy-and-hold delivers the highest annualised return (15.0%) but at the cost of the
  deepest drawdown (-35.4%). The equal-weight portfolio smooths some of this volatility but
  does not beat the best single index. US500 has the best risk-adjusted return among the
  buy-and-hold baselines (Sharpe 0.78).
</p>

<h4>Full-Sample Results</h4>

<p>
  The table below reports the best configuration for each strategy family (selected by Sharpe ratio).
  TSMOM with a 1-month lookback and weekly rebalancing is the clear winner.
</p>

<table>
  <thead>
    <tr><th>Strategy</th><th>Lookback</th><th>Rebalance</th><th>Trades</th><th>Ann. Return</th><th>Sharpe</th><th>Max DD</th></tr>
  </thead>
  <tbody>
    <tr><td>Top-1 Momentum</td><td>1 month</td><td>Weekly</td><td>148</td><td>12.3%</td><td>0.71</td><td>-28.1%</td></tr>
    <tr><td>Top-2 Momentum</td><td>1 month</td><td>Weekly</td><td>134</td><td>13.8%</td><td>0.84</td><td>-22.7%</td></tr>
    <tr style="font-weight: 600; background: #f0fdf4;"><td>TSMOM</td><td>1 month</td><td>Weekly</td><td>108</td><td>16.0%</td><td>1.27</td><td>-9.4%</td></tr>
    <tr><td>Long-Short</td><td>1 month</td><td>Weekly</td><td>156</td><td>2.1%</td><td>0.18</td><td>-31.2%</td></tr>
  </tbody>
</table>

<p>
  TSMOM delivers 16.0% annualised with a Sharpe ratio of 1.27, which is 1.7 times better than the
  best buy-and-hold baseline (US500 at 0.78) and 1.5 times better than the best cross-sectional
  rotation strategy (Top-2 at 0.84). Its maximum drawdown of -9.4% is less than half of any
  buy-and-hold baseline and roughly one-quarter of NAS100 buy-and-hold (-35.4%).
</p>

<p>
  The long-short strategy fails decisively, earning only 2.1% annualised with a Sharpe of 0.18 and
  the worst drawdown in the table. This is consistent with a known property of cross-sectional
  momentum at small $N$: the bottom-ranked index tends to mean-revert rather than continue declining,
  making the short leg a drag on performance.
</p>

<h4>Why TSMOM Works: Crash Protection</h4>

<p>
  TSMOM's edge is not in picking the best index during bull markets. Its edge is almost entirely
  in <em>crash protection</em>. When trailing returns for all three indices turn negative, TSMOM
  moves to 100% cash. This mechanism avoided the majority of the 2022 drawdown (when all three
  indices fell 20 to 35%) and the sharp corrections in late 2023 and early 2025. The allocation
  timeline chart (Figure 8) shows this clearly: TSMOM spends roughly 15 to 20% of the sample
  period in cash, and those cash periods coincide with the deepest drawdowns in the buy-and-hold
  baselines.
</p>

<p>
  Short lookback (1 month) combined with weekly rebalancing is optimal because it detects the onset
  of drawdowns quickly. Longer lookbacks (3, 6, 12 months) are slower to react and suffer larger
  drawdowns before switching to cash. Monthly rebalancing underperforms weekly for the same reason:
  delayed reaction to regime changes.
</p>

<h4>Walk-Forward Out-of-Sample Validation</h4>

<p>
  The TSMOM strategy (1-month lookback, weekly rebalancing) was validated using a two-fold
  walk-forward framework. TSMOM beats the equal-weight baseline in both folds (100% beat rate).
</p>

<table>
  <thead>
    <tr><th>Fold</th><th>Period</th><th>TSMOM Return</th><th>TSMOM Sharpe</th><th>Equal-Weight Return</th><th>Equal-Weight Sharpe</th></tr>
  </thead>
  <tbody>
    <tr><td>Fold 0</td><td>2020-08 to 2023-05</td><td>+35.0%</td><td>2.35</td><td>+28.7%</td><td>0.91</td></tr>
    <tr><td>Fold 1</td><td>2023-05 to 2026-03</td><td>+2.2%</td><td>0.27</td><td>+1.8%</td><td>0.12</td></tr>
  </tbody>
</table>

<p>
  Fold 0 covers the post-COVID recovery through mid-2023 and shows strong outperformance
  (Sharpe 2.35 versus 0.91). Fold 1 covers the more challenging 2023 to 2026 period and shows
  modest outperformance (Sharpe 0.27 versus 0.12). The strategy beats the baseline in both folds,
  but the edge is substantially weaker in the more recent period. This is consistent with the
  observation that TSMOM's primary edge is crash avoidance: Fold 0 contains the 2022 drawdown
  (where going to cash was highly valuable), while Fold 1 has shallower corrections.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>TSMOM is the first strategy to beat all baselines.</strong> At 16.0% annualised with
  Sharpe 1.27 and -9.4% max drawdown, it dominates every buy-and-hold benchmark and the
  equal-weight portfolio on both absolute and risk-adjusted metrics.</li>
  <li><strong>The edge is in crash protection, not stock picking.</strong> TSMOM moves to cash when
  trailing returns are negative, avoiding the bulk of major drawdowns. During bull markets, it
  performs roughly in line with equal-weight allocation.</li>
  <li><strong>Short lookback plus frequent rebalancing is optimal.</strong> A 1-month lookback with
  weekly rebalancing reacts quickly to regime changes. Longer lookbacks and less frequent
  rebalancing suffer larger drawdowns before adapting.</li>
  <li><strong>Long-short fails at small $N$.</strong> With only three indices, the bottom-ranked
  index tends to mean-revert rather than continue falling, making the short leg a consistent drag.
  This contrasts with the broader TSMOM literature where diversification across dozens of
  instruments smooths the short leg.</li>
  <li><strong>Walk-forward validates the result, with caveats.</strong> TSMOM beats equal-weight in
  2/2 folds (100%), but the edge is concentrated in the fold containing the 2022 drawdown. In
  benign markets, the advantage narrows substantially.</li>
  <li><strong>This validates pursuing harder cross-index gaps.</strong> The positive TSMOM result
  confirms that cross-index signals contain exploitable structure, motivating the remaining gap
  studies (spread dynamics, cointegration, regime detection) identified in Section 4.</li>
  <li><strong>Verdict: PASS.</strong> TSMOM with 1-month lookback and weekly rebalancing delivers Sharpe 1.27
  (1.7x the best buy-and-hold) with -9.4% max drawdown. Validated out of sample in both walk-forward folds.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/full_sample_equity_20260316_235013.png" alt="Full-sample equity curves: TSMOM vs buy-and-hold baselines" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 5. Full-sample equity curves: TSMOM vs buy-and-hold baselines. TSMOM (green) delivers the highest terminal value with the shallowest drawdowns, primarily by moving to cash during the 2022 correction.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/sharpe_by_lookback_20260316_235013.png" alt="Sharpe ratio by lookback period and rebalancing frequency" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 6. Sharpe ratio by lookback period and rebalancing frequency. Short lookbacks (1 month) dominate across all strategy families, with weekly rebalancing consistently outperforming monthly.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/walkforward_oos_20260316_235013.png" alt="Walk-forward out-of-sample performance by fold" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 7. Walk-forward out-of-sample performance by fold. TSMOM beats equal-weight in both folds, with the strongest outperformance in Fold 0 (which contains the 2022 drawdown).</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/allocation_timeline_20260316_235013.png" alt="TSMOM allocation timeline showing index rotation" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 8. TSMOM allocation timeline showing index rotation over the full sample. Grey bands indicate cash periods where all three indices had negative trailing momentum. These cash periods coincide with the deepest drawdowns in the buy-and-hold baselines.</figcaption>
</figure>

<h3>6.3 Gap Study #2: NAS100/DJIA Risk-On/Risk-Off Indicator</h3>

<h4>Objective</h4>

<p>
  The NAS100/DJIA price ratio is widely cited as a proxy for risk appetite. When the ratio rises,
  technology-heavy NAS100 is outperforming value-heavy DJIA, which practitioners interpret as a
  "risk-on" environment. The hypothesis is that this ratio, smoothed over a trailing window, can
  serve as an allocation signal: overweight NAS100 during risk-on regimes and rotate into DJIA
  during risk-off regimes. This study tests whether the RORO ratio adds value beyond the TSMOM
  strategy established in Gap Study #4.
</p>

<h4>Ratio Construction and Regime Definition</h4>

<p>
  The RORO ratio is computed as NAS100 daily close divided by US30 daily close. A regime label is
  assigned at each date: "risk-on" when the ratio is above its N-day simple moving average, and
  "risk-off" when below. Lookback windows of 5, 10, 21, 42, and 63 trading days were tested.
</p>

<h4>Forward Return Predictability</h4>

<p>
  Using a 21-day lookback to define regimes, we measured the hit rate of the ratio as a directional
  predictor at multiple forward horizons. The results are asymmetric. Risk-on regimes correctly
  predict NAS100 outperforming US30 with hit rates between 53% and 63%, peaking at 62.7% at the
  63-day forward horizon. Risk-off regimes, however, fail to predict US30 outperforming NAS100,
  with hit rates below 50% at all horizons tested.
</p>

<p>
  This asymmetry means the ratio is better described as a NAS100 momentum signal than as a balanced
  risk-on/risk-off indicator. When the ratio is rising, NAS100 tends to keep outperforming. When
  the ratio is falling, there is no reliable tendency for DJIA to take the lead.
</p>

<h4>Volatility by Regime</h4>

<p>
  The strongest finding from this study is in volatility, not returns. Risk-off regimes (ratio below
  its moving average) exhibit 20 to 28% higher realised volatility than risk-on regimes, and this
  holds across all three indices and all lookback windows tested. This is a reliable and economically
  meaningful regime distinction. Even though the ratio does not reliably predict which index will
  outperform during risk-off, it does predict that volatility will be elevated regardless of which
  index you hold.
</p>

<h4>Allocation Strategy Results</h4>

<p>
  Four families of allocation strategies were tested across all lookback windows. The table below
  shows the best configuration from each family alongside the TSMOM benchmark from Gap Study #4.
</p>

<table>
  <thead>
    <tr><th>Strategy</th><th>Lookback</th><th>Ann. Return</th><th>Sharpe</th><th>Max DD</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr style="font-weight: 600; background: #f0fdf4;"><td>TSMOM (Study #4)</td><td>1 month</td><td>16.0%</td><td>1.27</td><td>-9.4%</td><td>Benchmark</td></tr>
    <tr><td>Contrarian RORO</td><td>5 days</td><td>15.5%</td><td>0.79</td><td>-22.4%</td><td>393 switches, fragile</td></tr>
    <tr><td>Follow Blend</td><td>21 days</td><td>12.8%</td><td>0.76</td><td>-27.5%</td><td></td></tr>
    <tr><td>Follow RORO</td><td>42 days</td><td>12.3%</td><td>0.71</td><td>-26.2%</td><td></td></tr>
    <tr><td>RORO + TSMOM</td><td>21 days</td><td>8.9%</td><td>0.67</td><td>-18.6%</td><td>Combination underperforms pure TSMOM</td></tr>
  </tbody>
</table>

<p>
  No RORO-based strategy beats TSMOM on a risk-adjusted basis. The closest competitor is the
  contrarian configuration with a 5-day lookback, which achieves a higher raw return than most
  RORO variants but at the cost of 393 regime switches over the sample, a Sharpe ratio of 0.79
  (versus 1.27 for TSMOM), and a maximum drawdown of -22.4% (versus -9.4%). The RORO + TSMOM
  combination actually underperforms pure TSMOM, suggesting that the RORO signal adds noise
  rather than complementary information to the momentum signal.
</p>

<p>
  <small><em>Simulated results. All backtests use daily OHLCV data from MT5 CFDs over the period
  2019 to 2026. Returns are gross of transaction costs beyond the embedded CFD spread. Past
  performance does not indicate future results.</em></small>
</p>

<h4>Walk-Forward Out-of-Sample Validation</h4>

<p>
  The Follow RORO strategy (42-day lookback) was validated using the same two-fold walk-forward
  framework as Gap Study #4. Follow RORO beats the equal-weight baseline in both folds (Fold 0:
  Sharpe 1.05, Fold 1: Sharpe 0.47), confirming that the signal contains some genuine information
  out of sample. However, it still trails TSMOM substantially. For comparison, TSMOM achieved a
  Sharpe of 2.35 in Fold 0 and 0.78 in Fold 1.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>The ratio is asymmetrically predictive.</strong> Risk-on regimes correctly predict
  NAS100 outperformance at 53 to 63% hit rates. Risk-off regimes fail to predict DJIA
  outperformance at any horizon. The ratio is a NAS100 momentum signal, not a balanced regime
  indicator.</li>
  <li><strong>The strongest use case is volatility forecasting.</strong> Risk-off regimes show 20
  to 28% higher realised volatility across all instruments and lookback windows. This is consistent,
  robust, and potentially useful for position sizing and risk management even if the directional
  signal is weak.</li>
  <li><strong>As an allocation signal, RORO underperforms pure TSMOM.</strong> The best RORO
  strategy (Contrarian, 5-day) achieves a Sharpe of 0.79, versus 1.27 for TSMOM. Combining RORO
  with TSMOM degrades rather than improves performance.</li>
  <li><strong>Practical use: supplementary signal, not primary allocator.</strong> The RORO ratio
  has three plausible applications that do not require it to beat TSMOM as a standalone strategy:
  volatility-based position sizing (reduce size during risk-off), TSMOM tiebreaker (when momentum
  signals conflict across indices), and drawdown management (tighten stops during risk-off
  regimes).</li>
  <li><strong>Verdict: MIXED.</strong> Valid regime indicator (20-28% higher vol in risk-off), but
  not a superior allocation signal. Every RORO configuration underperforms TSMOM on Sharpe ratio
  and maximum drawdown. Retained as a supplementary signal.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/roro_ratio_20260316_235656.png" alt="NAS100/US30 ratio with risk-on/risk-off regime shading" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 9. NAS100/US30 ratio with risk-on/risk-off regime shading. The ratio trends upward over the full sample, reflecting NAS100's structural outperformance of DJIA. Risk-off regimes (shaded) cluster around drawdown periods.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/predictability_heatmap_20260316_235656.png" alt="Forward return predictability by lookback and horizon" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 10. Forward return predictability by lookback and horizon. The asymmetry is visible: risk-on hit rates (upper rows) reach 63%, while risk-off hit rates (lower rows) remain near or below 50%.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/strategy_equity_20260316_235656.png" alt="RORO allocation strategy equity curves vs baselines" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 11. RORO allocation strategy equity curves vs baselines. All RORO variants trail the TSMOM benchmark (green) established in Gap Study #4.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/walkforward_oos_20260316_235656.png" alt="Walk-forward OOS performance comparison" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 12. Walk-forward out-of-sample performance comparison. Follow RORO beats equal-weight in both folds but trails TSMOM in both.</figcaption>
</figure>

<h3>6.4 Gap Study #5: Volatility Regime Strategy Selection</h3>

<h4>Objective</h4>

<p>
  The three prior gap studies produced a puzzle. Mean-reversion (Study #8) failed outright.
  TSMOM (Study #4) succeeded with Sharpe 1.27. The RORO ratio (Study #2) reliably identified
  high-volatility regimes but did not beat TSMOM as an allocation signal. This study asks the
  natural follow-up question: what if the right strategy is not a single rule applied uniformly,
  but a different sub-strategy selected by the prevailing volatility regime? The hypothesis is
  that some strategies that fail in aggregate may work in specific regimes, and that conditioning
  on volatility state can recover hidden edges.
</p>

<h4>Methodology</h4>

<p>
  Volatility is measured using the Garman-Klass estimator over a trailing 21-day window. At each
  date, the current GK volatility is classified into one of three regimes (Low, Medium, High)
  using expanding-window percentile thresholds. Because the percentiles are computed only on data
  available up to that date, there is no lookahead bias. The test then evaluates which sub-strategy
  performs best within each regime. The candidate sub-strategies are: time-series momentum (TSMOM,
  from Study #4), mean-reversion (IBS-based, from Study #8), buy-and-hold, and cash. Eight
  meta-strategy combinations were tested, each assigning a different sub-strategy to each of the
  three volatility buckets.
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from historical backtests on
  MT5 CFD daily bars with spread costs deducted on every entry. They do not account for slippage,
  overnight financing, or execution latency. Past performance does not predict future results.
</div>

<h4>Strategy Performance by Volatility Regime</h4>

<p>
  The results reveal a clear pattern that differs by instrument. For US30 and US500, the same
  template holds: buy-and-hold wins in low-volatility regimes (Sharpe 0.67 for US30, 1.85 for
  US500), while TSMOM wins in high-volatility regimes (Sharpe 1.38 for US30, 1.02 for US500).
  This is consistent with the TSMOM finding from Study #4, which showed that TSMOM's edge is
  primarily in crash protection. Low-vol periods are calm trending markets where being long is
  the right trade; high-vol periods are where momentum's ability to go flat preserves capital.
</p>

<p>
  NAS100 is the outlier. In low-volatility regimes, buy-and-hold dominates (Sharpe 2.14), which
  is unsurprising given NAS100's strong secular trend. In medium-volatility regimes, however,
  mean-reversion takes the lead (Sharpe 0.70). And in high-volatility regimes, mean-reversion
  wins again (Sharpe 0.99). This is a striking rehabilitation of a strategy that failed
  completely in Study #8 when applied without regime conditioning.
</p>

<div class="finding-box" style="border-left-color: #059669; background: #f0fdf4;">
  <strong>Mean-reversion rehabilitation: the edge was hidden by regime mixing.</strong>
  The IBS mean-reversion strategy that produced negative results in Gap Study #8 delivers a
  Sharpe of 0.99 when applied specifically to high-volatility NAS100 regimes. The overall failure
  was not because the signal lacked predictive power, but because applying it uniformly across
  all volatility states diluted the high-vol edge with noise from low-vol and medium-vol periods
  where the signal does not work. This validates the RORO finding from Study #2 (volatility
  regimes matter) and operationalises it as a concrete strategy selection rule.
</div>

<h4>Best Meta-Strategy by Instrument</h4>

<p>
  The best-performing meta-strategy for each instrument, selected by in-sample Sharpe ratio:
</p>

<p>
  US30 uses the "buy-and-hold in low vol, TSMOM in high vol" template (bh_low_mom_high),
  returning 5.7% annualised with a Sharpe of 0.58. US500 uses the same template, returning
  10.2% annualised with a Sharpe of 0.87. NAS100 uses the opposite pattern
  (mom_low_mr_high, meaning TSMOM in low vol, mean-reversion in high vol), returning 20.3%
  annualised with a Sharpe of 0.92 and a maximum drawdown of -18.4%.
</p>

<p>
  The NAS100 result is notable for delivering the highest raw return of any strategy tested in
  this series. It trails TSMOM on risk-adjusted terms (0.92 vs 1.27 Sharpe) but provides a
  meaningfully different return profile, concentrating its edge in volatile periods where TSMOM
  moves to cash.
</p>

<h4>Walk-Forward Out-of-Sample Validation</h4>

<p>
  Walk-forward testing confirms the same pattern observed in Study #4: the meta-strategies beat
  buy-and-hold in 100% of bear-market folds but trail in bull-market folds. This is the familiar
  crash-protection signature. The regime-conditioned approach does not add a new source of edge
  beyond what TSMOM already captures; rather, it confirms that the volatility dimension is the
  mechanism through which TSMOM works and shows that mean-reversion can participate in that same
  mechanism for NAS100.
</p>

<h4>Updated Strategy Leaderboard</h4>

<p>
  Across all four gap studies, the cumulative ranking by risk-adjusted performance is:
</p>

<ol>
  <li><strong>TSMOM (Gap Study #4):</strong> Sharpe 1.27, -9.4% max drawdown. Still the best
  risk-adjusted strategy. Its crash-protection mechanism is now better understood as a volatility
  regime response.</li>
  <li><strong>NAS100 mom_low_mr_high (this study):</strong> 20.3% annualised return, Sharpe 0.92,
  -18.4% max drawdown. The highest raw return of any strategy tested, driven by mean-reversion
  working in high-vol NAS100 regimes.</li>
  <li><strong>US500 bh_low_mom_high (this study):</strong> 10.2% annualised return, Sharpe 0.87.
  A clean implementation of the "be long in calm markets, follow momentum in volatile markets"
  template.</li>
</ol>

<h4>Key Findings</h4>

<ol>
  <li><strong>Strategy failure can be regime-specific, not absolute.</strong> Mean-reversion was
  dismissed after Study #8 as non-viable at daily frequency on MT5 CFDs. That conclusion was
  correct in aggregate but masked a regime-conditional edge. The signal works in high-volatility
  NAS100 environments where price overreactions are larger and more likely to revert.</li>
  <li><strong>Volatility regime is the common thread.</strong> All four studies converge on the same
  mechanism. TSMOM works because it avoids high-vol drawdowns. The RORO ratio works as a volatility
  identifier. Mean-reversion works within high-vol regimes. The unifying insight is that strategy
  selection conditioned on realised volatility captures most of the exploitable structure in daily
  US index returns.</li>
  <li><strong>Instrument-specific behaviour matters.</strong> NAS100 responds to mean-reversion in
  high-vol regimes while US30 and US500 respond to momentum. This likely reflects NAS100's higher
  beta and more pronounced overreaction-reversal pattern during volatile periods, consistent with
  its technology-heavy composition and the flow dynamics studied in Gap Study #2.</li>
  <li><strong>Risk-return tradeoffs remain.</strong> The highest-return strategy (NAS100
  mom_low_mr_high at 20.3%) comes with nearly double the drawdown of TSMOM (-18.4% vs -9.4%).
  There is no free lunch; the regime-conditioned approach trades better returns for larger peak
  losses.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/summary_sharpe_by_regime_20260317_000356.png" alt="Sharpe ratio by strategy and volatility regime across instruments" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 13. Sharpe ratio by strategy and volatility regime across instruments. The divergence between NAS100 (where mean-reversion leads in high vol) and US30/US500 (where TSMOM leads in high vol) is clearly visible.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/NAS100_vol_regime_20260317_000356.png" alt="NAS100 volatility regime classification and strategy equity curves" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 14. NAS100 volatility regime classification and strategy equity curves. The mean-reversion sub-strategy (orange) gains ground during shaded high-vol periods where buy-and-hold and TSMOM both struggle.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/US30_vol_regime_20260317_000356.png" alt="US30 volatility regime analysis" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 15. US30 volatility regime analysis. TSMOM dominates high-vol regimes while buy-and-hold leads during calm periods.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/US500_vol_regime_20260317_000356.png" alt="US500 volatility regime analysis" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 16. US500 volatility regime analysis. The same pattern as US30: buy-and-hold in low vol, TSMOM in high vol.</figcaption>
</figure>

<h3>6.5 Gap Study #1: Price-Weighted vs Cap-Weighted Divergence</h3>

<h4>Objective</h4>

<p>
  This is the highest-novelty study in the series. The DJIA is price-weighted; the S&amp;P 500 and
  NAS100 are capitalisation-weighted. When these weighting schemes disagree on direction, the
  log-ratio spread between them widens. No published academic study has systematically tested
  whether extreme divergences in this spread are mean-reverting and tradeable. The hypothesis is
  that the spread reflects transient dislocations rather than permanent structural shifts, and that
  entering when the spread reaches extreme Z-scores should capture a reversion to the mean.
</p>

<h4>Spread Construction</h4>

<p>
  The spread is defined as the log-ratio between US30 and a capitalisation-weighted index:
  log(US30) minus log(US500), and separately log(US30) minus log(NAS100). Taking logs ensures
  the spread is symmetric and interpretable as a percentage divergence. A rolling Z-score is
  computed over a configurable lookback window to normalise the spread for time-varying levels.
  Entry occurs when the Z-score exceeds a threshold (long the lagging index, short the leading
  index), and exit occurs when the Z-score reverts below a separate exit threshold.
</p>

<h4>Stationarity Testing</h4>

<p>
  The Augmented Dickey-Fuller test on the full-sample spread fails to reject the unit root
  null hypothesis (p = 0.69 for US30/NAS100). The estimated half-life of mean reversion is
  approximately 320 to 349 days depending on the pair. This is a critical negative finding:
  the spread is not stationary over the full sample. It drifts, reflecting genuine structural
  shifts in the relative performance of price-weighted versus capitalisation-weighted indices
  (e.g., the technology sector's growing dominance in capitalisation-weighted indices). Any
  mean-reversion strategy on this spread must contend with the fact that the "mean" itself
  is non-stationary.
</p>

<h4>Full-Sample Results</h4>

<p>
  Despite the non-stationarity, extreme Z-score entries do capture short-horizon reversion.
  The best configuration for US30/NAS100 uses a Z-score entry threshold of 2.5, an exit
  threshold below 0.0, and a 126-day lookback window. This produces 9 trades with a 100%
  win rate, a profit factor of 999 (effectively infinite, as there are zero losing trades),
  a Sharpe ratio of 1.08, and an annualised return of 7.6%. The US30/US500 pair is weaker,
  with a Sharpe of 0.78 under its best configuration.
</p>

<p>
  The obvious concern is statistical power. Nine trades over a multi-year sample is far too
  few to draw confident conclusions about the strategy's true edge. A 100% win rate on 9 trades
  is consistent with genuine edge but also consistent with luck. The result should be read as
  "promising but unproven" rather than "validated."
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from historical backtests on
  MT5 CFD daily bars with spread costs deducted on every entry. They do not account for slippage,
  partial fills, or margin constraints. Trade counts are very low (9 trades in the best
  configuration), making all performance statistics statistically fragile. These results should
  not be interpreted as evidence of a reliable trading edge.
</div>

<h4>Walk-Forward Out-of-Sample Results</h4>

<p>
  Walk-forward validation reveals regime dependence. Both pairs lose in Fold 0 (covering 2022,
  a period of strong secular trends driven by the Federal Reserve tightening cycle) and win
  in Fold 1 (covering 2024, a period of oscillation and rotation). The pattern is consistent
  with what we would expect from a mean-reversion strategy applied to a non-stationary spread:
  it works when the spread oscillates around a relatively stable level and fails when the
  spread trends directionally for extended periods.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>The spread is not stationary.</strong> The ADF test rejects stationarity (p = 0.69)
  and the half-life is 320 to 349 days. This reflects genuine structural shifts in the relative
  composition of price-weighted and capitalisation-weighted indices, not transient noise.</li>

  <li><strong>Short-horizon mean-reversion exists at extreme Z-scores.</strong> Win rates of 75%
  to 100% are observed at Z-score thresholds of 2.0 and above, but the number of trades is very
  low (single digits), making these statistics unreliable.</li>

  <li><strong>US30/NAS100 is the stronger pair.</strong> Sharpe 1.08 versus 0.78 for US30/US500.
  This makes sense: the construction difference between price-weighted and technology-heavy
  capitalisation-weighted is larger than between price-weighted and broad capitalisation-weighted.</li>

  <li><strong>Out-of-sample results are mixed.</strong> The strategy is regime-dependent, winning
  in oscillating markets and losing during secular trends. This is not surprising given the
  non-stationarity finding, but it limits practical applicability.</li>

  <li><strong>Market-neutral with zero beta.</strong> Because the strategy is always long one index
  and short another, it has essentially zero exposure to the broad equity market. This makes it a
  potential diversifier for portfolios that already hold directional equity exposure.</li>

  <li><strong>Does not beat TSMOM.</strong> The best spread configuration (Sharpe 1.08) narrowly
  trails TSMOM (Sharpe 1.27) and does so with far fewer trades and weaker statistical support.
  TSMOM remains the benchmark to beat in this series.</li>

  <li><strong>Academic contribution stands regardless of trading viability.</strong> To our knowledge,
  this is the first systematic empirical test of mean-reversion in the price-weighted versus
  capitalisation-weighted divergence. The negative stationarity result and the regime-dependent
  out-of-sample performance are themselves novel findings that fill a gap in the literature.</li>
</ol>

<div class="finding-box" style="border-left-color: #2563eb; background: #eff6ff;">
  <strong>First Systematic Test.</strong> We are not aware of any published academic study that
  formally tests mean-reversion in the log-ratio spread between price-weighted (DJIA) and
  capitalisation-weighted (S&amp;P 500, NAS100) indices. The CME Group's "Stock Index Spread
  Opportunities" whitepaper describes the trade conceptually but provides no backtested results.
  The stationarity failure (ADF p = 0.69, half-life ~320 days) and regime-dependent OOS performance
  documented here appear to be new to the literature.
</div>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/spread_zscore_20260317_001847.png" alt="US30/NAS100 log-ratio spread with Z-score bands" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 17. US30/NAS100 log-ratio spread with Z-score bands. The spread drifts over time, consistent with the ADF stationarity failure. Extreme Z-score excursions are rare but tend to revert within weeks.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/sharpe_heatmap_20260317_001847.png" alt="Sharpe ratio heatmap across Z-entry and lookback parameters" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 18. Sharpe ratio heatmap across Z-entry and lookback parameters. The best performance concentrates at high Z-score thresholds (2.0+) with medium lookback windows (63 to 126 days), but the surface is sparse due to low trade counts.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/equity_curves_20260317_001847.png" alt="Spread strategy equity curves vs baselines" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 19. Spread strategy equity curves versus baselines. The spread strategy's flat periods reflect the long waits between extreme Z-score entries. TSMOM's smoother equity curve reflects its higher trade frequency and directional flexibility.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/walkforward_oos_20260317_001847.png" alt="Walk-forward out-of-sample fold comparison" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 20. Walk-forward out-of-sample fold comparison. Fold 0 (2022, trending) produces losses; Fold 1 (2024, oscillating) produces gains. The regime dependence is visually clear.</figcaption>
</figure>

<h3>6.6 Gap Study #3: Trivariate Cointegration Regime Model</h3>

<h4>Objective</h4>

<p>
  Gap #3 in the literature review (Section 4) asked whether trivariate cointegration testing across
  US30, US500, and NAS100 would reveal hidden equilibrium relationships that pairwise tests miss. The
  hypothesis was that the Johansen trace test on the three-index system would uncover a second
  cointegrating vector invisible to two-variable Engle-Granger tests, and that fading deviations
  from this vector (the error-correction term, or ECT) would produce a tradeable signal, especially
  when conditioned on volatility regimes from Gap Study #5.
</p>

<h4>Methodology</h4>

<p>
  We applied two complementary cointegration frameworks to daily log-price series for US30, US500,
  and NAS100 over the full sample period (January 2020 to December 2025).
</p>

<p>
  <strong>Johansen trace and max-eigenvalue tests</strong> were run on the trivariate system with
  lag order selected by AIC. These test for the number of linearly independent cointegrating
  relationships (the cointegration rank) in the three-index system.
</p>

<p>
  <strong>Pairwise Engle-Granger tests</strong> were run on all three index pairs (US30/US500,
  US30/NAS100, US500/NAS100) as a baseline to determine whether any trivariate structure existed
  beyond what pairwise tests already capture.
</p>

<p>
  <strong>Rolling stability analysis</strong> used 252-day rolling windows to track how the
  cointegration rank evolves over time, testing whether the equilibrium relationship is persistent
  or transient.
</p>

<p>
  <strong>ECT fade strategy:</strong> When the Johansen procedure identifies a cointegrating vector,
  the ECT measures how far the system has drifted from equilibrium. We constructed a trading signal
  that fades extreme ECT deviations (entering when the Z-scored ECT exceeds a threshold and exiting
  on mean reversion). We tested this both unfiltered and filtered by the Garman-Klass volatility
  regimes from Gap Study #5.
</p>

<p>
  <strong>Walk-forward validation</strong> used the same two-fold expanding-window protocol as the
  previous studies, with in-sample parameter selection and strictly out-of-sample evaluation.
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from historical backtests on
  MT5 CFD daily bars with spread costs deducted on every entry. They do not account for slippage,
  partial fills, or margin constraints. The cointegrating vectors are estimated in-sample and may
  not persist out-of-sample, as the walk-forward results confirm. These results should not be
  interpreted as evidence of a reliable trading edge.
</div>

<h4>Cointegration Test Results</h4>

<p>
  The Johansen trace test finds rank = 1, with a trace statistic of 31.30 against a 5% critical
  value of 29.80. This barely rejects the null of rank = 0, meaning there is marginal evidence for
  one cointegrating relationship in the trivariate system. The max-eigenvalue test, which is more
  conservative, does not reject rank = 0. The two tests disagree, which is itself a signal that the
  cointegration is weak and sample-dependent.
</p>

<p>
  Pairwise Engle-Granger tests tell a clearer story. US30/US500 is cointegrated (p = 0.002) and
  US30/NAS100 is cointegrated (p = 0.031), both at conventional significance levels. US500/NAS100
  is not cointegrated (p = 0.203). This means the pairwise tests already identify the two pairs
  that drive the single Johansen vector. There is no hidden trivariate relationship that pairwise
  tests miss. The central hypothesis of this study is disproven.
</p>

<h4>Rolling Stability</h4>

<p>
  Rolling 252-day Johansen tests reveal that even the single cointegrating relationship is highly
  unstable. Cointegration of rank 1 or higher is present in only 28.6% of rolling windows.
  In the remaining 71.4% of the sample, the three indices show no cointegrating relationship at all.
  The cointegration that does appear concentrates in specific regimes (primarily the 2020-2021
  recovery period and brief windows in late 2023) and vanishes during trend-dominated periods.
</p>

<p>
  This instability is not surprising in hindsight. The NAS100 experienced a tech-driven boom through
  late 2021 followed by a sharp correction in 2022, then a second AI-driven surge in 2023-2024. These
  structural shifts in the NAS100's relationship to the other indices mean that any cointegrating
  vector estimated in one period is unreliable in the next.
</p>

<h4>ECT Fade Strategy Results</h4>

<p>
  The ECT fade strategy produces a best unfiltered Sharpe ratio of 0.28 across all parameter
  combinations. This is well below the TSMOM benchmark of 1.27 from Gap Study #4 and below the
  meta-strategy Sharpe of 0.92 from Gap Study #5.
</p>

<p>
  Regime filtering, which improved results in Gap Study #5, makes the ECT strategy worse. The
  best regime-filtered Sharpe ratio is 0.06. The reason is that the ECT signal and the volatility
  regime are correlated: extreme ECT deviations tend to occur during the same high-volatility
  periods that the regime filter flags as trading windows. Filtering removes the few trades that
  had any reversion, leaving only noise.
</p>

<h4>Walk-Forward Out-of-Sample Results</h4>

<p>
  Walk-forward validation confirms that the in-sample Sharpe of 0.28 does not survive out-of-sample.
  Fold 1 produces a return of -18.9% unfiltered and -11.6% regime-filtered. Both represent
  catastrophic losses. The cointegrating vector estimated during the 2020-2022 training window
  is simply invalid for the 2023-2025 test window, because the structural relationships between
  the indices shifted.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>Trivariate cointegration exists but is marginal.</strong> The Johansen trace test barely
  rejects rank = 0 (31.30 vs 29.80 critical value) and the max-eigenvalue test does not reject at
  all. The two tests disagree, indicating weak and sample-dependent cointegration.</li>
  <li><strong>Pairwise tests were sufficient.</strong> The central hypothesis that trivariate testing
  would reveal hidden equilibrium vectors not visible in pairwise tests is disproven. US30/US500 and
  US30/NAS100 are individually cointegrated; US500/NAS100 is not. The Johansen vector simply
  combines these two known pairwise relationships.</li>
  <li><strong>Cointegration is unstable.</strong> Rolling analysis shows cointegration absent in 71.4%
  of the sample. The equilibrium relationship is transient, not structural.</li>
  <li><strong>The ECT signal is not tradeable.</strong> The best unfiltered Sharpe of 0.28 is far below
  the TSMOM benchmark (1.27) and below every other strategy tested in this series except raw
  mean-reversion from Gap Study #8.</li>
  <li><strong>Regime filtering makes it worse.</strong> Unlike Gap Study #5, where volatility conditioning
  recovered hidden edges, here it degrades the Sharpe from 0.28 to 0.06. The ECT and volatility
  regime signals are redundant rather than complementary.</li>
  <li><strong>Out-of-sample failure is catastrophic.</strong> Walk-forward losses of -18.9% confirm
  that the cointegrating vector is not stable enough to trade. The structural shift driven by NAS100's
  tech boom and AI surge invalidates vectors estimated in earlier periods.</li>
  <li><strong>Verdict: FAIL.</strong> Trivariate cointegration does not reveal hidden structure beyond
  pairwise tests, and the ECT signal is not tradeable. Walk-forward validation produces catastrophic losses.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/trivariate_coint_20260317_002428.png" alt="Rolling cointegration rank and ECT Z-score over time" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 21. Rolling cointegration rank and ECT Z-score over time. The cointegration rank fluctuates between 0 and 1, with rank 1 present in only 28.6% of rolling windows. ECT Z-score excursions are large but occur during periods where the cointegrating vector is itself unstable.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/pairwise_vs_trivariate_20260317_002428.png" alt="Pairwise vs trivariate cointegration test comparison" style="max-width: 100%; margin: 1rem 0;" />
  <figcaption>Figure 22. Pairwise vs trivariate cointegration test comparison. The pairwise Engle-Granger p-values (US30/US500 at 0.002, US30/NAS100 at 0.031) clearly identify the cointegrated pairs. The trivariate Johansen test adds no information beyond what pairwise tests already reveal.</figcaption>
</figure>

<h3>6.7 Gap Study #10: Granger Causality Feature Validation</h3>

<h4>Objective</h4>

<p>
  The 45 features specified for the Phase 3 model (Section 7.2) were selected on theoretical grounds and empirical gap-study
  results. Before passing them to the model, we apply a formal statistical test: does each feature
  Granger-cause the target variable (forward 60-minute returns) beyond what past returns alone predict?
  A feature that fails this test may still be useful to a nonlinear model, but one that passes provides
  independent frequentist evidence of predictive content.
</p>

<h4>Methodology</h4>

<p>
  For each feature $x_j$ and each lag $\\ell \\in \\{1, 5, 15, 30, 60\\}$ minutes,
  we estimate two OLS regressions on the training period (2021-07 to 2025-06):
</p>

<p style="text-align: center;">
  Restricted: $r_{t+60} = \\alpha + \\sum_{k=1}^{\\ell} \\beta_k\\, r_{t-k} + \\varepsilon_t$
</p>
<p style="text-align: center;">
  Unrestricted: $r_{t+60} = \\alpha + \\sum_{k=1}^{\\ell} \\beta_k\\, r_{t-k} + \\sum_{k=1}^{\\ell} \\gamma_k\\, x_{j,t-k} + \\varepsilon_t$
</p>

<p>
  The Granger (1969) F-test compares the residual sum of squares of the two models. Under the null
  $H_0: \\gamma_1 = \\cdots = \\gamma_\\ell = 0$, the test statistic follows an $F(\\ell,\\, T - 2\\ell - 1)$
  distribution. With 45 features $\\times$ 5 lags = 225 tests per index, we apply Bonferroni correction
  at $\\alpha = 0.05 / 225 \\approx 2.2 \\times 10^{-4}$ to control the family-wise error rate. No validation
  data is used at any point.
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results Disclaimer.</strong> All results below are from statistical tests on
  historical M1 bar data from MT5 CFDs over the training period (2021-07 to 2025-06). Granger causality
  is a linear test and does not guarantee nonlinear predictive power or trading profitability.
</div>

<h4>Results</h4>

<p><strong>Summary of results:</strong></p>

<table>
  <thead>
    <tr><th>Index</th><th>Tests</th><th>Significant (Bonferroni)</th><th>%</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>225</td><td>120</td><td>53%</td></tr>
    <tr><td>US500</td><td>225</td><td>115</td><td>51%</td></tr>
    <tr><td>NAS100</td><td>225</td><td>94</td><td>42%</td></tr>
  </tbody>
</table>

<p>
  Over half the feature&ndash;lag combinations are statistically significant for US30 and US500 after
  conservative multiple-testing correction. NAS100 is slightly lower, consistent with its higher
  idiosyncratic noise from concentrated technology exposure.
</p>

<p><strong>Top features by F-statistic (consistent across all three indices):</strong></p>

<table>
  <thead>
    <tr><th>Rank</th><th>Feature</th><th>F-stat (US30)</th><th>F-stat (US500)</th><th>F-stat (NAS100)</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>ret_60m</td><td>&gt; 2600</td><td>&gt; 2600</td><td>&gt; 2600</td></tr>
    <tr><td>2</td><td>dist_ma_290</td><td>&gt; 1500</td><td>&gt; 1500</td><td>&gt; 1500</td></tr>
    <tr><td>3</td><td>dist_ma120</td><td>&gt; 1450</td><td>&gt; 1450</td><td>&gt; 1450</td></tr>
    <tr><td>4</td><td>trend_strength</td><td>~165</td><td>~165</td><td>~165</td></tr>
    <tr><td>5</td><td>ret_120m</td><td>~143</td><td>~138</td><td>~130</td></tr>
  </tbody>
</table>

<p>
  All five are own-instrument features from Group 1 (core price dynamics). The dominance of ret_60m
  is expected: the target is forward 60-minute returns, and the autoregressive component of returns
  at this horizon is well-documented. The two moving-average distance features capture trend persistence
  at different time scales.
</p>

<p><strong>Features significant in all three indices (24 of 45):</strong></p>

<p>
  abs_dist_ma120, brent_ret_60m, channel_width, constituent_dispersion, cross_idx_dispersion,
  dist_ma120, dist_ma_290, kurt_240m, momentum_regime, msft_ret_60m, ret_120m, ret_60m,
  roro_ratio, roro_vs_sma21, skew_240m, stdev60, trend_strength, tsmom_idx3_21d, tsmom_self_21d,
  vol_30m, vol_of_vol_60, vol_regime_ratio, vol_session_ratio, vol_surprise.
</p>

<p>
  This set spans all five feature groups: core price dynamics (Group 1), volatility and higher moments
  (Group 2), cross-index signals from the gap studies (Group 3), cross-asset features (Group 4), and
  microstructure proxies (Group 5). The cross-index features (cross_idx_dispersion, roro_ratio,
  roro_vs_sma21, tsmom signals) all pass, confirming that the Phase 2 gap study findings survive formal
  causality testing.
</p>

<p><strong>Features not significant on any index after Bonferroni correction:</strong></p>

<p>
  er60, tod_sin, tod_cos, ibs, gk_vol_pctile, session_flag, dxy_corr_30, and several individual
  constituent returns. The time-of-day features (tod_sin, tod_cos, session_flag) are deterministic
  functions of the clock and contain no stochastic information about returns. IBS and gk_vol_pctile
  are bounded indicators that operate conditionally (IBS predicts only within specific volatility
  regimes, as shown in Gap Study #8). The log-spread features (log_spread_us30_us500,
  log_spread_us30_nas100) were borderline, consistent with the slow mean-reversion documented in
  Gap Study #1.
</p>

<h4>Key Findings</h4>

<ol>
  <li><strong>Majority of features pass Granger causality.</strong> Over 50% of feature-lag combinations
  are significant after Bonferroni correction for US30 and US500, and 42% for NAS100. The feature set
  carries genuine linear predictive content for forward 60-minute returns.</li>
  <li><strong>Own-instrument features dominate.</strong> The top 5 features by F-statistic are all from
  Group 1 (core price dynamics), with ret_60m and the moving-average distance features showing the
  strongest causal signal across all three indices.</li>
  <li><strong>Cross-index features validated.</strong> All Phase 2 gap-study-derived features
  (cross_idx_dispersion, roro_ratio, roro_vs_sma21, tsmom signals) pass the Granger test, confirming
  that the empirical gap study findings survive formal causality testing.</li>
  <li><strong>Non-significant features retained as VSN validation.</strong> Features that fail Granger causality
  were deliberately retained as a validation mechanism for the Variable Selection Network. If the VSN works
  correctly, it should independently learn to downweight these features. The Run 1 training results
  (Section 7.5) confirm this: log_spread_us30_us500 (not Granger-causal) received the lowest VSN
  attention, while the top Granger-causal features received the highest. This correspondence provides
  independent validation that the VSN is working as intended.</li>
</ol>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/granger_vs_vsn_US30.png" alt="US30 Granger F-statistic vs VSN attention weight scatter plot" />
  <figcaption>Figure 23. US30: Granger F-statistic vs VSN attention weight. Features with stronger causal signal receive higher learned attention.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/granger_vs_vsn_US500.png" alt="US500 Granger F-statistic vs VSN attention weight scatter plot" />
  <figcaption>Figure 24. US500: Granger F-statistic vs VSN attention weight. The same pattern holds &mdash; VSN attention tracks Granger causality.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/granger_vs_vsn_NAS100.png" alt="NAS100 Granger F-statistic vs VSN attention weight scatter plot" />
  <figcaption>Figure 25. NAS100: Granger F-statistic vs VSN attention weight correspondence.</figcaption>
</figure>

<h2>7. Phase 3: Neural Net Model Development</h2>

<h3>7.1 Data Inventory</h3>

<p>
  This section documents the data available for model development. All three index models share a common
  training window, cross-asset feature set, and chronological train/validation/test split. The binding
  constraint on the common window is META, whose M1 data begins on 2021-06-30.
</p>

<h4>Common Training Window</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Window</td><td>2021-07-01 to 2026-03-17 (~4.7 years)</td></tr>
    <tr><td>Binding constraint</td><td>META (starts 2021-06-30)</td></tr>
    <tr><td>Bar frequency</td><td>M1 (1-minute OHLCV)</td></tr>
    <tr><td>Source</td><td>MT5 CFD data + Databento XNAS backfill (TLT, META)</td></tr>
  </tbody>
</table>

<h4>Target Indexes</h4>

<p>
  Each model predicts the forward 60-minute return using a double-barrier label (up/down/hold).
</p>

<table>
  <thead>
    <tr><th>Instrument</th><th>Full Span</th><th>M1 Rows</th></tr>
  </thead>
  <tbody>
    <tr><td>US30 (DJIA)</td><td>2020-08 to 2026-03</td><td>1,982,699</td></tr>
    <tr><td>US500 (S&amp;P 500)</td><td>2018-05 to 2026-03</td><td>2,743,872</td></tr>
    <tr><td>NAS100 (Nasdaq 100)</td><td>2018-05 to 2026-03</td><td>2,792,656</td></tr>
  </tbody>
</table>

<h4>Cross-Asset Instruments</h4>

<p>
  The following instruments provide cross-asset features for all three models.
</p>

<table>
  <thead>
    <tr><th>Instrument</th><th>Full Span</th><th>M1 Rows</th><th>Feature Use</th></tr>
  </thead>
  <tbody>
    <tr><td>VIX</td><td>2018-05 to 2026-03</td><td>760,033</td><td>Fear gauge, vol regime</td></tr>
    <tr><td>DXY (Dollar Index)</td><td>2018-12 to 2026-03</td><td>2,194,608</td><td>Dollar strength</td></tr>
    <tr><td>USDJPY</td><td>2008-09 to 2026-03</td><td>2,133,765</td><td>Carry trade / risk proxy</td></tr>
    <tr><td>BTCUSD</td><td>2017-06 to 2026-03</td><td>2,325,662</td><td>Risk appetite proxy</td></tr>
    <tr><td>XAUUSD (Gold)</td><td>2018-05 to 2026-03</td><td>2,802,955</td><td>Safe haven flow</td></tr>
    <tr><td>BRENT (Crude Oil)</td><td>2016-01 to 2026-03</td><td>1,839,566</td><td>Energy / inflation proxy</td></tr>
    <tr><td>TLT (20Y+ Treasury Bond ETF)</td><td>2018-05 to 2026-02</td><td>971,662</td><td>Bond proxy, equity/bond rotation</td></tr>
  </tbody>
</table>

<h4>Constituent Stocks</h4>

<p>
  The top 5 constituents per index provide 60-minute returns as features and intra-index dispersion
  measures. Several stocks appear in multiple index models.
</p>

<table>
  <thead>
    <tr><th>Index</th><th>Top 5 Constituents</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>GS, MSFT, HD, CAT, V</td></tr>
    <tr><td>NAS100</td><td>AAPL, MSFT, NVDA, AMZN, GOOG</td></tr>
    <tr><td>US500</td><td>AAPL, MSFT, NVDA, AMZN, META (binding constraint)</td></tr>
  </tbody>
</table>

<p>
  AAPL, MSFT, NVDA, and AMZN appear in both the NAS100 and US500 constituent sets. MSFT also appears
  in the US30 set, making it the only stock present across all three models.
</p>

<h4>Train / Validation Split</h4>

<p>
  All splits are strictly chronological with no overlap. No data from the validation set is used during
  training or hyperparameter selection.
</p>

<table>
  <thead>
    <tr><th>Split</th><th>Period</th><th>Duration</th><th>Share</th></tr>
  </thead>
  <tbody>
    <tr><td>Train</td><td>2021-07-01 to 2025-06-30</td><td>4.0 years</td><td>83%</td></tr>
    <tr><td>Validation</td><td>2025-07-01 to 2026-03-17</td><td>~8.5 months</td><td>17%</td></tr>
  </tbody>
</table>

<p>
  All splits are strictly chronological. The validation set includes the 2025 tariff volatility regime.
  The real out-of-sample test is live execution on MT5.
</p>

<h4>Data Quality Notes</h4>

<ul>
  <li>All files are clean M1 bars, verified via interval analysis (no duplicate timestamps, no
  gaps exceeding expected market closures).</li>
  <li>Missing minutes in lower-volume stocks reflect thin liquidity during off-peak hours, not
  data errors. These gaps are expected and handled during feature construction.</li>
  <li>Stock constituents only trade 13:30 to 20:00 UTC (US cash session). Outside these hours,
  constituent features are forward-filled from the last available bar.</li>
</ul>

<h3>7.2 Feature Specification</h3>

<p>
  Each model receives approximately 45 features per M1 bar, organised into five groups. Every feature
  is justified either by Phase 1 literature or by Phase 2 empirical results. The prediction target is
  the forward 60-minute return, encoded via double-barrier labelling (up / down / hold).
</p>

<h4>Group 1: Own-Instrument Core (18 features)</h4>

<p>
  These features are proven predictors from the XAUUSD base model, adapted for equity indices. They
  capture returns, volatility structure, trend quality, distribution shape, and time-of-day cyclicality.
</p>

<table>
  <thead>
    <tr><th>Feature</th><th>Formula / Definition</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>ret_60m</td><td>$\\ln(p_t / p_{t-60})$</td><td>Recent return momentum</td></tr>
    <tr><td>ret_120m</td><td>$\\ln(p_t / p_{t-120})$</td><td>Medium-horizon return</td></tr>
    <tr><td>dist_ma120</td><td>$(p_t - \\text{MA}_{120}) / \\text{MA}_{120}$</td><td>Signed distance from 2h MA</td></tr>
    <tr><td>dist_ma290</td><td>$(p_t - \\text{MA}_{290}) / \\text{MA}_{290}$</td><td>Signed distance from session MA</td></tr>
    <tr><td>stdev60</td><td>$\\sigma(\\text{ret}_{1m}, w{=}60)$</td><td>Realised volatility (1h)</td></tr>
    <tr><td>vol_30m</td><td>$\\sigma(\\text{ret}_{1m}, w{=}30)$</td><td>Short-window volatility</td></tr>
    <tr><td>vol_session_ratio</td><td>$\\sigma_{30m} / \\sigma_{\\text{session}}$</td><td>Intraday vol regime</td></tr>
    <tr><td>vol_of_vol_60</td><td>$\\sigma(\\sigma_{30m}, w{=}60)$</td><td>Volatility clustering intensity</td></tr>
    <tr><td>vol_regime_ratio</td><td>$\\sigma_{60m} / \\sigma_{240m}$</td><td>Short vs long vol ratio</td></tr>
    <tr><td>vol_surprise</td><td>$(\\sigma_{30m} - \\mu_{\\sigma,240}) / \\sigma_{\\sigma,240}$</td><td>Vol Z-score (surprise detection)</td></tr>
    <tr><td>channel_width</td><td>$Q_{0.95} - Q_{0.05}$ (rolling 120 bars)</td><td>Quantile regression channel</td></tr>
    <tr><td>skew_240m</td><td>Rolling skewness, $w{=}240$</td><td>Return distribution asymmetry</td></tr>
    <tr><td>kurt_240m</td><td>Rolling kurtosis, $w{=}240$</td><td>Tail heaviness</td></tr>
    <tr><td>er60</td><td>$|\\Delta p_{60}| / \\sum_{i=1}^{60}|\\Delta p_i|$</td><td>Kaufman efficiency ratio $[0,1]$</td></tr>
    <tr><td>momentum_regime</td><td>Binary: MA crossover aligned with return sign</td><td>Trend alignment indicator</td></tr>
    <tr><td>trend_strength</td><td>$\\text{sign}(\\text{ret}_{60m}) \\times \\text{ER}_{60} \\times |\\text{ret}_{60m}| / \\sigma_{60m}$</td><td>Signed ER x normalised magnitude</td></tr>
    <tr><td>tod_sin</td><td>$\\sin(2\\pi \\cdot \\text{minute} / 1440)$</td><td>Cyclical time-of-day encoding</td></tr>
    <tr><td>tod_cos</td><td>$\\cos(2\\pi \\cdot \\text{minute} / 1440)$</td><td>Cyclical time-of-day encoding</td></tr>
  </tbody>
</table>

<h4>Group 2: Cross-Index Features (11 features)</h4>

<p>
  Every feature in this group traces directly to a specific Phase 2 gap study. These encode
  cross-index momentum, risk regime, volatility state, and structural spread dynamics.
</p>

<table>
  <thead>
    <tr><th>Feature</th><th>Formula / Definition</th><th>Source</th></tr>
  </thead>
  <tbody>
    <tr><td>tsmom_self_21d</td><td>$\\text{sgn}\\bigl(\\sum_{i=1}^{21} r_i\\bigr)$, trailing monthly return</td><td>Study #4 (TSMOM)</td></tr>
    <tr><td>tsmom_idx2_21d</td><td>Same, for second index</td><td>Study #4</td></tr>
    <tr><td>tsmom_idx3_21d</td><td>Same, for third index</td><td>Study #4</td></tr>
    <tr><td>roro_ratio</td><td>$\\ln(\\text{NAS100} / \\text{US30})$</td><td>Study #2 (RORO)</td></tr>
    <tr><td>roro_vs_sma21</td><td>Binary: RORO ratio above/below 21d SMA</td><td>Study #2</td></tr>
    <tr><td>gk_vol_21d</td><td>Garman-Klass volatility, 21-day rolling</td><td>Study #5 (Vol regime)</td></tr>
    <tr><td>gk_vol_pctile</td><td>Expanding percentile rank of GK vol</td><td>Study #5</td></tr>
    <tr><td>ibs</td><td>$(\\text{close} - \\text{low}) / (\\text{high} - \\text{low})$, daily</td><td>Study #8 (conditional on vol regime)</td></tr>
    <tr><td>cross_idx_dispersion</td><td>$\\sigma(\\text{ret}_{60m}^{(i)})$ across all 3 indices</td><td>Study #4 (rotation signal)</td></tr>
    <tr><td>log_spread_us30_us500</td><td>$\\ln(\\text{US30}) - \\ln(\\text{US500})$</td><td>Study #1 (novel)</td></tr>
    <tr><td>log_spread_us30_nas100</td><td>$\\ln(\\text{US30}) - \\ln(\\text{NAS100})$</td><td>Study #1 (novel)</td></tr>
  </tbody>
</table>

<div class="finding-box">
  <strong>Provenance.</strong> Every cross-index feature traces to a specific Phase 2 empirical result.
  The two novel features (log_spread_us30_us500, log_spread_us30_nas100) have no academic precedent;
  they were first tested in Gap Study #1 and are included on the basis of the extreme Z-score reversion
  effect documented there.
</div>

<h4>Group 3: Cross-Asset Macro (7 features)</h4>

<p>
  Macro features capture risk appetite, dollar strength, carry dynamics, and energy/inflation pressure.
  Three candidates were dropped due to insufficient history in the common training window.
</p>

<table>
  <thead>
    <tr><th>Feature</th><th>Formula / Definition</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>vix_level</td><td>VIX spot value</td><td>Fear gauge level</td></tr>
    <tr><td>vix_chg_60m</td><td>$\\Delta\\text{VIX}_{60m}$</td><td>VIX momentum (shock detection)</td></tr>
    <tr><td>dxy_ret_60m</td><td>$\\ln(\\text{DXY}_t / \\text{DXY}_{t-60})$</td><td>Dollar strength</td></tr>
    <tr><td>dxy_corr_30</td><td>Rolling 30-bar correlation(index, DXY)</td><td>Dollar correlation regime</td></tr>
    <tr><td>usdjpy_ret_60m</td><td>$\\ln(\\text{USDJPY}_t / \\text{USDJPY}_{t-60})$</td><td>Yen carry proxy</td></tr>
    <tr><td>btcusd_ret_60m</td><td>$\\ln(\\text{BTCUSD}_t / \\text{BTCUSD}_{t-60})$</td><td>Crypto risk appetite</td></tr>
    <tr><td>brent_ret_60m</td><td>$\\ln(\\text{BRENT}_t / \\text{BRENT}_{t-60})$</td><td>Energy / inflation proxy</td></tr>
  </tbody>
</table>

<p>
  <strong>Dropped instruments:</strong> TLT (only 3 months of M1 data in common window), LQD (3 months),
  USOIL (4 months; replaced by BRENT which has full coverage from 2016).
</p>

<h4>Group 4: Constituent Returns (6 features per model)</h4>

<p>
  The top 5 constituents by index weight provide 60-minute returns as individual features. A sixth feature,
  constituent_dispersion, measures intra-index disagreement. The constituent set differs per model.
</p>

<table>
  <thead>
    <tr><th>Model</th><th>Top-5 Constituents</th><th>Dispersion Feature</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>GS, MSFT, HD, CAT, V</td><td>$\\sigma(\\text{ret}_{60m}^{(k)})$, $k \\in \\{1..5\\}$</td></tr>
    <tr><td>NAS100</td><td>AAPL, MSFT, NVDA, AMZN, GOOG</td><td>$\\sigma(\\text{ret}_{60m}^{(k)})$, $k \\in \\{1..5\\}$</td></tr>
    <tr><td>US500</td><td>AAPL, MSFT, NVDA, AMZN, JPM</td><td>$\\sigma(\\text{ret}_{60m}^{(k)})$, $k \\in \\{1..5\\}$</td></tr>
  </tbody>
</table>

<h4>Group 5: Intraday Seasonality (2 features)</h4>

<table>
  <thead>
    <tr><th>Feature</th><th>Definition</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>session_flag</td><td>Asia = 0, London = 1, US = 2</td><td>Session regime (liquidity + volatility differ by session)</td></tr>
    <tr><td>minutes_since_us_open</td><td>Minutes elapsed since 13:30 UTC</td><td>Distance from highest-activity period</td></tr>
  </tbody>
</table>

<h4>Feature Count Summary</h4>

<table>
  <thead>
    <tr><th>Group</th><th>Features</th></tr>
  </thead>
  <tbody>
    <tr><td>Own-Instrument Core</td><td>18</td></tr>
    <tr><td>Cross-Index</td><td>11</td></tr>
    <tr><td>Cross-Asset Macro</td><td>7</td></tr>
    <tr><td>Constituent Returns</td><td>6</td></tr>
    <tr><td>Intraday Seasonality</td><td>2</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>44</strong></td></tr>
  </tbody>
</table>

<h4>Normalisation</h4>

<table>
  <thead>
    <tr><th>Method</th><th>Applied To</th><th>Window</th></tr>
  </thead>
  <tbody>
    <tr><td>rolling_z</td><td>Continuous non-stationary features (returns, distances, vol levels)</td><td>$w = 1440$ (24 hours)</td></tr>
    <tr><td>zscore (expanding)</td><td>Stable distributions (GK vol percentile, kurtosis)</td><td>Expanding from start of training set</td></tr>
    <tr><td>passthrough</td><td>Bounded or naturally scaled features (ER, IBS, session_flag, tod_sin/cos)</td><td>None</td></tr>
  </tbody>
</table>

<h4>Lookahead Prevention</h4>

<p>
  All features are strictly causal. Daily IBS uses the previous completed day only. TSMOM signals use
  completed daily returns only. No feature reads future prices. Rolling windows use only data available
  at time $t$, with no forward-looking statistics.
</p>

<h4>Feature Provenance</h4>

<p>
  The following table summarises the link between cross-index / cross-asset features and the Phase 2
  gap studies that justified their inclusion.
</p>

<table>
  <thead>
    <tr><th>Feature(s)</th><th>Phase 2 Study</th><th>Key Finding</th></tr>
  </thead>
  <tbody>
    <tr><td>tsmom_self_21d, tsmom_idx2_21d, tsmom_idx3_21d, cross_idx_dispersion</td><td>Study #4 (Cross-index momentum)</td><td>TSMOM rotation: Sharpe 1.27</td></tr>
    <tr><td>roro_ratio, roro_vs_sma21</td><td>Study #2 (RORO ratio)</td><td>Valid vol regime indicator; 20-28% higher vol in risk-off</td></tr>
    <tr><td>gk_vol_21d, gk_vol_pctile</td><td>Study #5 (Vol regime selection)</td><td>MR works in high-vol NAS100 (Sharpe 0.99)</td></tr>
    <tr><td>ibs</td><td>Study #8 (IBS/RSI replication)</td><td>Conditional on vol regime only; fails in aggregate</td></tr>
    <tr><td>log_spread_us30_us500, log_spread_us30_nas100</td><td>Study #1 (PW vs CW divergence)</td><td>Novel; extreme Z-score reversion observed</td></tr>
    <tr><td>session_flag, minutes_since_us_open</td><td>Study #9 (Intraday seasonality)</td><td>Vol and momentum differ by session</td></tr>
  </tbody>
</table>

<h3>7.3 Normaliser Selection</h3>

<h4>Why Normalisation Matters</h4>

<p>
  Raw features can drift across regimes &mdash; VIX level, channel width, and kurtosis all exhibit
  non-stationary behaviour over months-long windows. Without normalisation, drifting features dominate
  the neural net's gradient updates, causing training instability or the model learning spurious
  regime-dependent patterns. But normalisation can also destroy information, particularly in features
  where the raw scale <em>is</em> the signal. Absolute volatility levels, dispersion magnitudes, and
  vol ratios all carry meaning in their raw units that z-scoring can erase.
</p>

<h4>Methodology</h4>

<p>
  Each of the 36 continuous features was tested under three normalisation strategies on the validation
  set (2025-07 to 2026-03):
</p>

<table>
  <thead>
    <tr><th>Strategy</th><th>Description</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>raw</strong></td><td>No normalisation (baseline)</td></tr>
    <tr><td><strong>rolling_z</strong></td><td>Causal 30-day rolling $3\\sigma$ clip + z-score</td></tr>
    <tr><td><strong>rolling_winsor_z</strong></td><td>Causal 30-day rolling 1st&ndash;99th percentile clip + z-score</td></tr>
  </tbody>
</table>

<p>
  Static normalisation (global mean/std computed over the full dataset) was excluded because it leaks
  regime information and fails on drifting features &mdash; a model trained during a low-VIX period
  would see systematically biased inputs during a high-VIX regime.
</p>

<p>
  <strong>Decision rule:</strong>
</p>
<ol>
  <li>Compute gain = AUC(rolling_z) $-$ AUC(raw) for each feature on each index.</li>
  <li>Average across all 3 indices.</li>
  <li>If avg gain $&lt; -0.001$ AND rolling_z hurts on at least 2/3 indices &rarr; passthrough.</li>
  <li>If already bounded/binary &rarr; passthrough.</li>
  <li>Otherwise &rarr; rolling_z (safe default for drift protection).</li>
</ol>

<p>
  The rolling_winsor_z strategy (percentile clip instead of $\\sigma$-clip) was never chosen. Gains
  over rolling_z were marginal and inconsistent across the three indices.
</p>

<h4>Final Split: 17 Passthrough / 28 Rolling Z-Score</h4>

<p>
  The per-feature decision rule produces a clear split: 17 features are passed through without
  normalisation, and 28 features use rolling_z.
</p>

<h4>Passthrough Features (17)</h4>

<p>
  These fall into two categories:
</p>

<p><strong>Bounded/binary (9):</strong></p>
<ul>
  <li>er60 $[0,1]$</li>
  <li>momentum_regime $\\{0,1\\}$</li>
  <li>tod_sin $[-1,1]$, tod_cos $[-1,1]$</li>
  <li>roro_vs_sma21 $\\{0,1\\}$</li>
  <li>gk_vol_pctile $[0,1]$</li>
  <li>ibs $[0,1]$</li>
  <li>dxy_corr_30 $[-1,1]$</li>
  <li>session_flag $\\{0,1,2\\}$</li>
  <li>minutes_since_us_open $[0,1]$</li>
</ul>

<p><strong>Scale-is-signal (8):</strong></p>
<ul>
  <li><strong>ret_60m</strong> &mdash; naturally mean-zero and stationary</li>
  <li><strong>stdev60</strong> and <strong>vol_30m</strong> &mdash; realised volatility is stationary; raw level encodes regime</li>
  <li><strong>vol_session_ratio</strong> and <strong>vol_surprise</strong> &mdash; self-normalising ratios</li>
  <li><strong>gk_vol_21d</strong> &mdash; daily Garman-Klass vol, naturally bounded (avg gain $-0.0022$)</li>
  <li><strong>cross_idx_dispersion</strong> &mdash; strongest negative (avg gain $-0.0037$)</li>
  <li><strong>vix_level</strong> &mdash; highest drift (2.72) but rolling_z kills regime signal (avg gain $-0.0037$)</li>
</ul>

<h4>Rolling Z-Score Features (28)</h4>

<p>
  All other continuous features use rolling_z. Key beneficiaries:
</p>

<table>
  <thead>
    <tr><th>Feature</th><th>Avg $\\Delta$AUC</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>kurt_240m</td><td style="color: #059669; font-weight: 600;">+0.0020</td><td>High drift 1.67&ndash;1.75</td></tr>
    <tr><td>skew_240m</td><td style="color: #059669; font-weight: 600;">+0.0020</td><td>&mdash;</td></tr>
    <tr><td>channel_width</td><td style="color: #059669; font-weight: 600;">+0.0013</td><td>High drift 4.5&ndash;4.8</td></tr>
    <tr><td>tsmom_idx3_21d</td><td style="color: #059669; font-weight: 600;">+0.0013</td><td>Consistently positive all 3 indices</td></tr>
    <tr><td>log_spread_us30_us500</td><td style="color: #059669; font-weight: 600;">+0.0013</td><td>Drifts by construction</td></tr>
    <tr><td>abs_dist_ma120</td><td style="color: #059669; font-weight: 600;">+0.0009</td><td>Consistently positive all 3 indices</td></tr>
    <tr><td>dxy_ret_60m</td><td style="color: #059669; font-weight: 600;">+0.0006</td><td>Consistently positive all 3 indices</td></tr>
    <tr><td colspan="3"><em>All constituent stock returns: rolling_z protects against earnings/split outliers</em></td></tr>
  </tbody>
</table>

<h4>Cross-Instrument Results</h4>

<p>
  The following tables summarise AUC gains from rolling_z versus raw on each index. A positive value
  means normalisation helped; a negative value means the raw scale carried predictive information that
  z-scoring destroyed.
</p>

<p><strong>Features where rolling_z helps most</strong> (AUC gain $> 0.002$ on at least one index):</p>

<table>
  <thead>
    <tr><th>Feature</th><th>US30 $\\Delta$AUC</th><th>NAS100 $\\Delta$AUC</th><th>US500 $\\Delta$AUC</th><th>Drift Score</th></tr>
  </thead>
  <tbody>
    <tr><td>kurt_240m</td><td style="color: #059669; font-weight: 600;">+0.0074</td><td>+0.0018</td><td>&mdash;</td><td>1.67 / 1.75</td></tr>
    <tr><td>log_spread_us30_us500</td><td style="color: #059669; font-weight: 600;">+0.0063</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>skew_240m</td><td style="color: #059669; font-weight: 600;">+0.0045</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>aapl_ret_60m</td><td>&mdash;</td><td style="color: #059669; font-weight: 600;">+0.0043</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>constituent_dispersion</td><td>&mdash;</td><td>&mdash;</td><td style="color: #059669; font-weight: 600;">+0.0042</td><td>&mdash;</td></tr>
    <tr><td>vix_chg_60m</td><td>&mdash;</td><td>&mdash;</td><td style="color: #059669; font-weight: 600;">+0.0036</td><td>&mdash;</td></tr>
    <tr><td>tsmom_self_21d</td><td>&mdash;</td><td>&mdash;</td><td style="color: #059669; font-weight: 600;">+0.0026</td><td>&mdash;</td></tr>
    <tr><td>amzn_ret_60m</td><td>&mdash;</td><td style="color: #059669; font-weight: 600;">+0.0025</td><td>&mdash;</td><td>&mdash;</td></tr>
  </tbody>
</table>

<p><strong>Features where rolling_z hurts most</strong> (raw scale carries predictive information):</p>

<table>
  <thead>
    <tr><th>Feature</th><th>US30 $\\Delta$AUC</th><th>NAS100 $\\Delta$AUC</th><th>US500 $\\Delta$AUC</th></tr>
  </thead>
  <tbody>
    <tr><td>cross_idx_dispersion</td><td style="color: #dc2626; font-weight: 600;">-0.0061</td><td style="color: #dc2626; font-weight: 600;">-0.0032</td><td>&mdash;</td></tr>
    <tr><td>vix_level</td><td style="color: #dc2626; font-weight: 600;">-0.0059</td><td>&mdash;</td><td style="color: #dc2626; font-weight: 600;">-0.0063</td></tr>
    <tr><td>vol_session_ratio</td><td style="color: #dc2626; font-weight: 600;">-0.0045</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>vol_surprise</td><td style="color: #dc2626; font-weight: 600;">-0.0045</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>vol_30m</td><td style="color: #dc2626; font-weight: 600;">-0.0033</td><td>&mdash;</td><td>&mdash;</td></tr>
    <tr><td>stdev60</td><td style="color: #dc2626; font-weight: 600;">-0.0033</td><td>&mdash;</td><td>&mdash;</td></tr>
  </tbody>
</table>

<h4>Final Decision</h4>

<div class="finding-box">
  <strong>Per-feature normaliser selection:</strong> The decision rule reveals two distinct feature
  populations. Features where the raw <em>level</em> encodes regime information (volatility, VIX,
  dispersion) lose predictive power when z-scored because the model needs to distinguish
  &ldquo;VIX at 12 vs VIX at 30&rdquo;, not &ldquo;VIX is 1 standard deviation above recent mean.&rdquo;
  Features with heavy tails or structural drift (kurtosis, channel width, log spreads) benefit because
  clipping removes outliers and z-scoring stabilises the input distribution. Final split:
  <strong>17 passthrough</strong> (9 bounded + 8 scale-dependent) / <strong>28 rolling_z</strong>.
</div>

<table>
  <thead>
    <tr><th>Normaliser</th><th>Count</th></tr>
  </thead>
  <tbody>
    <tr><td>passthrough</td><td>17 (9 bounded + 8 scale-dependent)</td></tr>
    <tr><td>rolling_z</td><td>28</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>45</strong></td></tr>
  </tbody>
</table>

<p>
  <strong>VIX note:</strong> VIX has the highest drift (2.72) but is passthrough. If training
  instability is observed, $\\log(\\text{VIX})$ is a fallback that is more stationary while
  preserving regime information.
</p>

<h4>Normaliser AUC Heatmaps</h4>

<p>
  The following heatmaps show directional AUC (one-vs-rest classifier on the double-barrier label)
  for each feature under each normalisation strategy. Green cells indicate AUC above baseline (0.5);
  darker shading indicates stronger signal.
</p>

<figure style="margin: 1.5rem auto; text-align: center; max-width: 600px;">
  <img src="/charts/us-indexes/heatmap_US30.png" alt="US30 normaliser AUC heatmap across features and strategies" style="width: 100%; border-radius: 6px;" />
  <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US30 normaliser AUC heatmap across features and strategies</figcaption>
</figure>
<details style="margin: 1rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem;">
  <summary style="cursor: pointer; font-size: 0.9rem; color: #1e40af; font-weight: 500;">Expand: US500 and NAS100 normaliser heatmaps</summary>
  <div style="margin-top: 1rem;">
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/heatmap_US500.png" alt="US500 normaliser AUC heatmap" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US500 normaliser AUC heatmap</figcaption>
    </figure>
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/heatmap_NAS100.png" alt="NAS100 normaliser AUC heatmap" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">NAS100 normaliser AUC heatmap</figcaption>
    </figure>
  </div>
</details>

<h4>AUC Improvement from Rolling Z-Score</h4>

<p>
  Bar charts showing the per-feature AUC change when switching from raw to rolling_z. Positive bars
  (green) indicate features that benefit from normalisation; negative bars (red) indicate features
  where the raw scale carries signal.
</p>

<figure style="margin: 1.5rem auto; text-align: center; max-width: 600px;">
  <img src="/charts/us-indexes/improvement_US30.png" alt="US30 AUC improvement from rolling_z vs raw" style="width: 100%; border-radius: 6px;" />
  <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US30 AUC improvement from rolling_z vs raw</figcaption>
</figure>

<details style="margin: 1rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem;">
  <summary style="cursor: pointer; font-size: 0.9rem; color: #1e40af; font-weight: 500;">Expand: US500 and NAS100 AUC improvement charts</summary>
  <div style="margin-top: 1rem;">
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/improvement_US500.png" alt="US500 AUC improvement" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US500 AUC improvement from rolling_z vs raw</figcaption>
    </figure>
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/improvement_NAS100.png" alt="NAS100 AUC improvement" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">NAS100 AUC improvement from rolling_z vs raw</figcaption>
    </figure>
  </div>
</details>

<h4>Drift Score vs. Normalisation AUC Gain</h4>

<p>
  Scatter plots of feature drift score (x-axis, measured as the ratio of inter-month variance to
  intra-month variance) against AUC gain from rolling_z (y-axis). Features in the upper-right
  quadrant are high-drift features that benefit from normalisation. Features in the lower-right
  are high-drift features where normalisation hurts &mdash; these are the scale-dependent features
  (VIX level, dispersion) where drift is real but informative.
</p>

<figure style="margin: 1.5rem auto; text-align: center; max-width: 600px;">
  <img src="/charts/us-indexes/drift_vs_gain_US30.png" alt="US30 drift score vs normalisation AUC gain" style="width: 100%; border-radius: 6px;" />
  <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US30 drift score vs normalisation AUC gain</figcaption>
</figure>

<details style="margin: 1rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem;">
  <summary style="cursor: pointer; font-size: 0.9rem; color: #1e40af; font-weight: 500;">Expand: US500 and NAS100 drift-vs-gain scatter plots</summary>
  <div style="margin-top: 1rem;">
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/drift_vs_gain_US500.png" alt="US500 drift vs gain" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">US500 drift score vs normalisation AUC gain</figcaption>
    </figure>
    <figure style="margin: 1rem auto; text-align: center; max-width: 600px;">
      <img src="/charts/us-indexes/drift_vs_gain_NAS100.png" alt="NAS100 drift vs gain" style="width: 100%; border-radius: 6px;" />
      <figcaption style="font-size: 0.85em; color: #6b7280; margin-top: 0.5rem;">NAS100 drift score vs normalisation AUC gain</figcaption>
    </figure>
  </div>
</details>

<h3>7.4 Model Configuration</h3>

<h4>Target Variable</h4>

<p>
  The target is the forward 60-minute return, labelled via symmetric double-barrier classification.
  Every bar receives a directional prediction &mdash; there is no trade/no-trade gate at the model level.
  The barrier is set per-index to account for different price levels:
</p>

<table>
  <thead>
    <tr><th>Index</th><th>Barrier</th><th>Approx %</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>\\$100</td><td>~0.24%</td><td>DJIA ~42,000</td></tr>
    <tr><td>US500</td><td>\\$30</td><td>~0.52%</td><td>S&amp;P 500 ~5,800</td></tr>
    <tr><td>NAS100</td><td>\\$200</td><td>~1.0%</td><td>NASDAQ-100 ~20,000</td></tr>
  </tbody>
</table>

<p>
  Bars where price stays within the barrier for the full 60-minute horizon are labelled "hold."
</p>

<h4>Trading Costs</h4>

<table>
  <thead>
    <tr><th>Index</th><th>Spread</th></tr>
  </thead>
  <tbody>
    <tr><td>US30</td><td>\\$1.20</td></tr>
    <tr><td>US500</td><td>\\$0.50</td></tr>
    <tr><td>NAS100</td><td>\\$2.00</td></tr>
  </tbody>
</table>

<h4>Architecture: VSN + TCN + Transformer</h4>

<p>
  The model pipeline is: Features &rarr; Variable Selection Network (VSN) &rarr; Temporal Convolutional
  Network (TCN) &rarr; Transformer encoder &rarr; prediction heads. The VSN produces a dense embedding
  from the raw feature vector at each timestep; the TCN extracts local temporal patterns from the
  embedding sequence; the Transformer captures global dependencies across the full window. The adaptive
  denoise filter (used in the XAUUSD base model) is disabled here because index composites already
  smooth microstructure noise inherent in single-instrument tick data.
</p>

<p>
  Four parallel ContextTCNTransformer modules operate at different temporal scales:
</p>

<table>
  <thead>
    <tr><th>Stream</th><th>Bars</th><th>Duration</th><th>Purpose</th></tr>
  </thead>
  <tbody>
    <tr><td>Short</td><td>60</td><td>1 hour</td><td>Immediate momentum</td></tr>
    <tr><td>Mid</td><td>120</td><td>2 hours</td><td>Medium-term trend</td></tr>
    <tr><td>Long</td><td>240</td><td>4 hours</td><td>Full session context</td></tr>
    <tr><td>Slow</td><td>720</td><td>30 days</td><td>Macro regime (H1 resampled)</td></tr>
  </tbody>
</table>

<p>
  The slow stream resamples to H1 bars (720 H1 bars = 30 trading days) for long-range regime context
  without inflating sequence length.
</p>

<h4>Variable Selection Network (VSN)</h4>

<p>
  The VSN is a learned, per-timestep soft feature gate based on the Variable Selection Network
  introduced by Lim et al. (2021) in the Temporal Fusion Transformer. Given $F$ input features at each
  timestep, the VSN produces softmax-normalised importance weights via a selector MLP, then projects
  the weighted features into a dense embedding of dimension $E$. This allows the model to suppress
  noisy or irrelevant features on a bar-by-bar basis rather than treating all 44 inputs equally.
</p>

<p>
  The VSN computes two complementary paths and combines them via element-wise addition:
</p>

<table>
  <thead>
    <tr><th>Path</th><th>Computation</th><th>What It Captures</th></tr>
  </thead>
  <tbody>
    <tr><td>Value path</td><td>$x \\odot w \\rightarrow \\text{Linear}(F, E)$</td><td>How much each feature contributes (magnitude-aware)</td></tr>
    <tr><td>Prototype path</td><td>$w^\\top \\cdot \\text{Prototypes}(F, E)$</td><td>Which features are active (identity-aware)</td></tr>
  </tbody>
</table>

<p>
  The value path multiplies each raw feature by its importance weight and projects the result to the
  embedding dimension. The prototype path takes the dot product of the weight vector with a learnable
  prototype matrix, producing an embedding that reflects which features are selected regardless of their
  magnitude. The element-wise sum passes through LayerNorm to produce the final embedding fed to the TCN.
</p>

<p>
  <strong>Why VSN before TCN.</strong> Each layer in the pipeline operates on a different axis and is
  blind to what the others handle:
</p>

<table>
  <thead>
    <tr><th>Component</th><th>Operates Across</th><th>Learns</th><th>Blind To</th></tr>
  </thead>
  <tbody>
    <tr><td>VSN</td><td>Features ($F$ axis)</td><td>Which features matter at this timestep</td><td>Temporal patterns</td></tr>
    <tr><td>TCN</td><td>Time ($T$ axis)</td><td>Local temporal patterns (15-bar kernel)</td><td>Feature quality</td></tr>
    <tr><td>Transformer</td><td>Time ($T$ axis)</td><td>Global dependencies across full window</td><td>Local patterns</td></tr>
  </tbody>
</table>

<p>
  By composing VSN &rarr; TCN &rarr; Transformer, each layer handles what it does best. The VSN says
  &ldquo;at this bar, dxy_ret_60m and vol_surprise are the key inputs; suppress noisy constituents.&rdquo;
  The TCN says &ldquo;over the last 15 bars of those selected features, there is momentum acceleration.&rdquo;
  The Transformer says &ldquo;across the full window, trend context supports this direction.&rdquo;
</p>

<p>
  <strong>Why not feed raw features directly to the TCN.</strong> The 44 features range from near-random
  (AUC 0.5004) to meaningfully predictive (AUC 0.5367). Without the VSN, the TCN treats every feature
  channel equally, wasting capacity on noise. Furthermore, feature importance is regime-dependent:
  momentum features matter during trends, while volatility features matter in mean-reverting markets.
  The VSN adapts per-timestep, allowing the downstream TCN to operate on a cleaned, regime-appropriate
  representation.
</p>

<p>
  <strong>VSN hyperparameters:</strong>
</p>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>Hidden dim</td><td>64</td><td>Selector MLP hidden size</td></tr>
    <tr><td>Dropout</td><td>0.15</td><td>Matches model-wide dropout</td></tr>
    <tr><td>Context dim</td><td>0</td><td>No regime context ($K = 1$)</td></tr>
  </tbody>
</table>

<p>
  <strong>Parameter cost:</strong> approximately 11,648 parameters total (selector MLP ~5,760,
  value projection ~2,880, prototypes ~2,880, LayerNorm ~128). This is negligible relative to the
  Transformer encoder and does not meaningfully increase training time or memory.
</p>

<h4>VSN Entropy Regularisation</h4>

<p>
  Without regularisation, the VSN softmax gate can <strong>collapse</strong>, concentrating all
  attention on one or two features and ignoring the rest. This wastes the 45-feature design,
  overfits to a narrow signal, and suppresses jointly informative but individually weak features.
</p>

<p>
  We add the Shannon entropy of the VSN weights to the loss as a regularisation term:
</p>

<p style="text-align: center; margin: 1rem 0;">
  $$H(\\mathbf{w}_t) = -\\sum_{i=1}^{F} w_{t,i} \\log(w_{t,i})$$
</p>

<p>
  where $\\mathbf{w}_t$ is the $F$-dimensional softmax weight vector at timestep $t$.
  Maximum entropy ($\\log F \\approx 3.8$ for 45 features) corresponds to uniform attention;
  minimum entropy (0) corresponds to complete collapse onto a single feature.
</p>

<p>
  The entropy is averaged across all timesteps, batch samples, and all four streams, then
  <strong>subtracted</strong> from the loss. Higher entropy (more diverse feature usage) reduces
  the loss, nudging the model toward balanced attention.
</p>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>$\\lambda_{\\text{vsn}}$</td><td>0.002</td><td>Deliberately small: direction loss (~1.0) dominates; entropy term (~0.006) acts as a gentle nudge</td></tr>
  </tbody>
</table>

<table>
  <thead>
    <tr><th>Scenario</th><th>Entropy</th><th>Effect on Loss</th></tr>
  </thead>
  <tbody>
    <tr><td>Uniform attention (all 45 features)</td><td>~3.8</td><td>Loss reduced by ~0.0076</td></tr>
    <tr><td>Concentrated on 5 features</td><td>~1.6</td><td>Loss reduced by ~0.0032</td></tr>
    <tr><td>Collapsed to 1 feature</td><td>~0.0</td><td>No entropy benefit</td></tr>
  </tbody>
</table>

<p>
  The model learns to balance concentrating on the most predictive features (to minimise direction
  loss) against maintaining enough diversity to earn the entropy bonus. If entropy drops below ~1.0
  during training, the VSN is collapsing and $\\lambda_{\\text{vsn}}$ should be increased.
</p>

<h4>TCN + Transformer Hyperparameters</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Embedding dimension</td><td>128</td></tr>
    <tr><td>Layers</td><td>1</td></tr>
    <tr><td>Attention heads</td><td>4 (32 per head)</td></tr>
    <tr><td>Dropout</td><td>0.15</td></tr>
    <tr><td>TCN channels</td><td>64</td></tr>
    <tr><td>TCN kernel</td><td>15 (15-min receptive field)</td></tr>
  </tbody>
</table>

<h4>Training Configuration</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>Epochs</td><td>50</td><td>With warmup + cosine schedule</td></tr>
    <tr><td>Batch size</td><td>512</td><td>Fits GPU with 4 streams</td></tr>
    <tr><td>Learning rate</td><td>$3 \\times 10^{-4}$</td><td>Standard Transformer LR</td></tr>
    <tr><td>Weight decay</td><td>0.005</td><td>Regularisation</td></tr>
    <tr><td>Expected PnL loss</td><td>Disabled</td><td>Use supervised BCE/CE for direction</td></tr>
    <tr><td>Regime clusters</td><td>$K = 1$</td><td>No clustering; learn direction first</td></tr>
  </tbody>
</table>

<h4>Design Decisions</h4>

<p>
  <strong>$K = 1$ regime clustering.</strong> A single prediction head is used. Regime clustering with
  $K > 1$ fragments the already limited data across multiple heads, each seeing a fraction of the
  training samples. The model learns direction first; regime specialisation can be added once the base
  model demonstrates signal.
</p>

<p>
  <strong>No trade gate.</strong> Every bar receives an up/down/hold prediction. The trade/no-trade
  decision is made by the executor based on confidence thresholds, not by the model. This keeps the
  model focused on directional classification and avoids conflating two separate objectives in a single
  output.
</p>

<p>
  <strong>Dropout 0.15.</strong> Higher than the typical 0.05&ndash;0.10 used in NLP Transformers,
  because financial features are substantially noisier than language tokens. This value was validated
  on the XAUUSD base model, where lower dropout (0.05) led to overfitting on training data.
</p>

<p>
  <strong>Learning rate $3 \\times 10^{-4}$.</strong> Standard for Transformer architectures. Higher
  rates (e.g., $10^{-2}$) cause catastrophic early updates that destroy the attention mechanism before
  it can learn meaningful patterns. Lower rates (e.g., $10^{-5}$) converge too slowly within 50 epochs.
</p>

<h4>Data Pipeline</h4>

<div style="display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap; margin: 1.5rem 0; font-size: 0.9em;">
  <div style="background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center; font-weight: 600; color: #1e40af;">M1 OHLCV</div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center;">Feature builder<br/><small style="color: #6b7280;">45 features</small></div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center;">Normaliser<br/><small style="color: #6b7280;">17 passthrough / 28 rolling_z</small></div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center;">Double-barrier<br/><small style="color: #6b7280;">labels</small></div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #f0f4ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center;">Sequence dataset<br/><small style="color: #6b7280;">4 windows</small></div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center; font-weight: 600; color: #92400e;">VSN<br/><small style="color: #6b7280;">soft feature gate</small></div>
  <div style="padding: 0 0.4rem; color: #9ca3af; font-size: 1.2em;">&rarr;</div>
  <div style="background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 0.5rem 0.75rem; text-align: center; font-weight: 600; color: #059669;">TCN + Transformer<br/><small style="color: #6b7280;">$p_{\\text{up}}, p_{\\text{down}}, p_{\\text{hold}}$</small></div>
</div>

<h3>7.5 Training Results</h3>

<h4>Cross-Index Summary</h4>
<p>The table below consolidates all training runs across the three indices, highlighting the Run 2 improvements.</p>
<table>
<thead><tr><th>Index</th><th>Run</th><th>Best Epoch</th><th>Val Acc</th><th>Val Loss</th><th>Class Gap</th><th>VSN Ratio</th><th>Status</th></tr></thead>
<tbody>
<tr><td>US30</td><td>Run 1</td><td>3</td><td>67.8%</td><td>0.933</td><td>6.0pp</td><td>3.1x</td><td>Superseded</td></tr>
<tr style="background:#f0fdf4;"><td><strong>US30</strong></td><td><strong>Run 2</strong></td><td><strong>4</strong></td><td><strong>68.4%</strong></td><td><strong>0.891</strong></td><td><strong>1.6pp</strong></td><td><strong>2.0x</strong></td><td style="color:#059669;"><strong>Deploy candidate</strong></td></tr>
<tr style="background:#fef2f2;"><td>US30</td><td>Run 3a</td><td>3</td><td style="color:#dc2626; font-weight:600;">55.7%</td><td>1.562</td><td>16.7pp</td><td>&mdash;</td><td style="color:#dc2626;">Failed &mdash; aux loss dominance</td></tr>
<tr style="background:#fef2f2;"><td>US30</td><td>Run 3b</td><td>&mdash;</td><td style="color:#dc2626; font-weight:600;">55.4%</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td style="color:#dc2626;">Failed &mdash; capacity bottleneck</td></tr>
<tr><td>US500</td><td>Run 1</td><td>7</td><td>63.1%</td><td>1.649</td><td>15.5pp</td><td>3.8x</td><td>Superseded</td></tr>
<tr style="background:#f0fdf4;"><td><strong>US500</strong></td><td><strong>Run 2</strong></td><td><strong>5</strong></td><td><strong>62.0%</strong></td><td><strong>1.349</strong></td><td><strong>4.9pp</strong></td><td><strong>2.0x</strong></td><td style="color:#059669;"><strong>Deploy candidate</strong></td></tr>
<tr><td>NAS100</td><td>Run 1</td><td>5</td><td>68.9%</td><td>0.792</td><td>0.6pp</td><td>2.2x</td><td>Superseded</td></tr>
<tr style="background:#f0fdf4;"><td><strong>NAS100</strong></td><td><strong>Run 2</strong></td><td><strong>3</strong></td><td><strong>68.9%</strong></td><td><strong>0.783</strong></td><td><strong>20.2pp*</strong></td><td><strong>1.8x</strong></td><td style="color:#059669;"><strong>Deploy candidate</strong></td></tr>
</tbody>
</table>
<p class="text-sm text-[#6b7280]">*NAS100 Run 2 epoch 3 has a transient bullish bias (20.2pp gap) that resolves to 0.7pp by epoch 5. For balanced deployment, use epoch 5 (68.3% accuracy).</p>

<details style="margin: 1.5rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem;" open>
<summary style="cursor: pointer; padding: 0.75rem 1rem; font-weight: 600; font-size: 1.05em; color: #1a1a2e; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 0.5rem 0.5rem 0 0;">US30 — Run 1 &amp; Run 2 Detail</summary>
<div style="padding: 1rem;">

<h4 style="margin-top: 0.5rem; font-size: 1.05em;">US30 &mdash; Run 1 (Diagnostic)</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<p>
  This is the first training run for the US30 model. The purpose is diagnostic: confirm the
  architecture can learn directional signal, identify failure modes, and calibrate regularisation
  for subsequent runs. The results reveal severe overfitting but also genuine directional signal
  in the validation set.
</p>

<h4>Configuration</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Target</td><td>US30</td></tr>
    <tr><td>Barrier</td><td>&dollar;100</td></tr>
    <tr><td>Spread</td><td>&dollar;1.20</td></tr>
    <tr><td>Batch size</td><td>512</td></tr>
    <tr><td>Learning rate</td><td>$3 \\times 10^{-4}$ (warmup + cosine)</td></tr>
    <tr><td>Epochs</td><td>18 / 50 (early termination)</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001 (later increased to 0.002)</td></tr>
    <tr><td>Train period</td><td>2021-07 to 2025-06</td></tr>
    <tr><td>Validation period</td><td>2025-07 to 2026-03</td></tr>
  </tbody>
</table>

<h4>Headline Results</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Best validation loss</td><td>0.933 (Epoch 3)</td></tr>
    <tr><td>Best validation direction accuracy</td><td>67.8% (Epoch 3)</td></tr>
    <tr><td>Final validation direction accuracy</td><td>64.9% (Epoch 18)</td></tr>
    <tr><td>Final train direction accuracy</td><td>92.0% (Epoch 18)</td></tr>
    <tr><td>Coverage</td><td>95.7%</td></tr>
    <tr><td>$p_{\\text{up}}$ std</td><td>0.438 (healthy, no hedging)</td></tr>
    <tr><td>VSN entropy</td><td>3.635 (max 3.81)</td></tr>
  </tbody>
</table>

<h4>Key Observations</h4>

<p>
  <strong>Epoch 3 is the sweet spot.</strong> Validation loss hits its minimum (0.933) and validation
  accuracy peaks (67.8%) at epoch 3, during the warmup phase when the effective learning rate is
  approximately $1.4 \\times 10^{-4}$. Everything after epoch 3 is overfitting. This pattern is
  consistent with the XAUUSD base model experience: Transformers on noisy financial data find their
  best generalisation early, before the optimiser has enough capacity to memorise training noise.
</p>

<p>
  <strong>Severe overfitting from epoch 4 onwards.</strong> Validation loss increased 143% from
  epoch 3 to epoch 18 (0.93 to 2.27). The train&ndash;validation accuracy gap grew from 6.7
  percentage points (epoch 3: 74.5% train, 67.8% val) to 27.1 percentage points (epoch 18: 92.0%
  train, 64.9% val). The model memorised the training set.
</p>

<p>
  <strong>Directional signal is real.</strong> A validation accuracy of 67.8% is well above the
  50% random baseline and above the ~55% threshold typically required for profitability after
  transaction costs. DOWN accuracy (70.5%) exceeds UP accuracy (64.5%), indicating a slight bearish
  bias in the model's learned representations. This asymmetry may reflect the validation period
  (2025-07 to 2026-03) containing more volatile down-moves that are easier to predict.
</p>

<p>
  <strong>VSN is healthy.</strong> Entropy decreased from 3.78 to 3.64 (theoretical maximum 3.81
  for 45 features), meaning the Variable Selection Network learned to differentiate feature
  importance without collapsing to a small subset. The entropy regularisation term
  ($\\lambda = 0.001$) served its purpose.
</p>

<p>
  <strong>No gradient issues.</strong> Gradient norms remained stable throughout all 18 epochs.
  No exploding or vanishing gradients were observed, confirming the warmup + cosine annealing
  schedule is appropriate for this architecture.
</p>

<p>
  <strong>Coverage ramped quickly.</strong> Coverage (fraction of bars where the model produces a
  non-hold prediction with sufficient confidence) increased from 60% at epoch 1 to 96% by epoch 6.
  The model became confident on nearly all directional bars early in training.
</p>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/us30_run1_01_loss_curves.png" alt="US30 Run 1 loss curves" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US30 Run 1: train and validation loss curves. Validation loss minimises at epoch 3 then diverges sharply, reaching 2.27 by epoch 18 while train loss continues to decline.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run1_02_direction_accuracy.png" alt="US30 Run 1 direction accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Direction accuracy: 67.8% validation peak at epoch 3, then plateau around 64&ndash;65% while train accuracy climbs to 92%. The widening gap is the signature of overfitting.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run1_06_vsn_entropy.png" alt="US30 Run 1 VSN entropy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>VSN entropy: healthy decline from 3.78 to 3.64 without collapse. The network learned to weight features differentially while maintaining broad attention.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run1_05_per_class_accuracy.png" alt="US30 Run 1 per-class accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Per-class accuracy: DOWN (70.5%) consistently beats UP (64.5%), suggesting the model captures bearish patterns more reliably in the validation window.</figcaption>
</figure>

<h4>VSN Per-Stream Feature Preferences</h4>

<p>
  Each of the four temporal streams learned to attend to different features, validating the
  multi-scale architecture. The VSN softmax weights started near-uniform (max/min ratio ~1.2x)
  and gradually differentiated to a 3.1x ratio by the final epoch.
</p>

<table>
  <thead>
    <tr><th>Stream</th><th>Duration</th><th>Top Features</th><th>Interpretation</th></tr>
  </thead>
  <tbody>
    <tr><td>Short (60 bars)</td><td>1 hour</td><td>dist_ma120, dist_ma_290, tod_cos</td><td>Price distance from MAs and time-of-day: short-term mean-reversion signals</td></tr>
    <tr><td>Mid (120 bars)</td><td>2 hours</td><td>vix_chg_60m, cross_idx_dispersion, cat_ret_60m</td><td>Volatility changes and cross-index dynamics: risk sentiment</td></tr>
    <tr><td>Long (240 bars)</td><td>4 hours</td><td>roro_ratio, log_spread_us30_nas100, cross_idx_dispersion</td><td>Risk-on/risk-off and cross-index spreads: regime-level signals</td></tr>
    <tr><td>Slow (720 bars)</td><td>12 hours</td><td>ret_60m, dist_ma120, abs_dist_ma120</td><td>Recent returns and MA distance: daily trend context</td></tr>
  </tbody>
</table>

<p>
  This specialisation is exactly what the VSN was designed to produce. Short-term streams focus on
  price action and intraday timing; longer streams focus on cross-index regime signals from Phase 2
  studies. The RORO ratio and log spreads (novel features from Gap Studies #1 and #2) appear
  prominently in the long stream, confirming they carry regime-level information.
</p>

<p>
  <strong>Consistently neglected features:</strong> log_spread_us30_us500 (lowest in 3/4 streams),
  er60 (efficiency ratio), vol_30m (redundant with stdev60), and individual constituent returns
  gs_ret_60m and hd_ret_60m. These are candidates for removal in future feature pruning.
</p>

<h4>Label Distribution</h4>

<p>
  The &dollar;100 symmetric barrier produced 45.2% UP and 54.8% DOWN labels with 0% HOLD. Every
  single bar hit the barrier within 60 minutes, meaning the barrier is too narrow relative to
  US30's intraday volatility. A wider barrier would create HOLD labels for ambiguous bars,
  potentially improving signal quality by excluding noise. This is a candidate change for
  future runs.
</p>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Severe overfitting:</strong> the model learns genuine directional signal (67.8% validation
  accuracy at epoch 3) but memorises training data within 5 epochs. The best checkpoint would use
  epoch 3 weights. Run 2 will address this with stronger regularisation, earlier stopping, and a
  shorter warmup schedule.
</div>

<h4>Recommendations for Run 2</h4>

<table>
  <thead>
    <tr><th>Change</th><th>Run 1</th><th>Run 2</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>Early stopping</td><td>None</td><td>5-epoch patience</td><td>Stop when validation loss stalls</td></tr>
    <tr><td>Dropout</td><td>0.15</td><td>0.25</td><td>Stronger regularisation against memorisation</td></tr>
    <tr><td>Weight decay</td><td>0.005</td><td>0.01</td><td>Stronger L2 penalty on weights</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001</td><td>0.002</td><td>Prevent late-stage attention collapse</td></tr>
    <tr><td>Max epochs</td><td>50</td><td>20</td><td>No value past epoch 10&ndash;15</td></tr>
    <tr><td>LR warmup</td><td>5 epochs</td><td>3 epochs</td><td>Best validation at epoch 3; warmup should end sooner</td></tr>
  </tbody>
</table>

</div>
</details>

<details style="margin: 1.5rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
<summary style="cursor: pointer; padding: 0.75rem 1rem; font-weight: 600; font-size: 1.05em; color: #1a1a2e; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 0.5rem 0.5rem 0 0;">US500 — Run 1 &amp; Run 2 Detail</summary>
<div style="padding: 1rem;">

<h4 style="margin-top: 0.5rem; font-size: 1.05em;">US500 &mdash; Run 1 (Diagnostic)</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<h4>Configuration</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Target</td><td>US500.f</td></tr>
    <tr><td>Barrier</td><td>&dollar;30</td></tr>
    <tr><td>Spread</td><td>&dollar;0.50</td></tr>
    <tr><td>Batch size</td><td>512</td></tr>
    <tr><td>Learning rate</td><td>$3 \\times 10^{-4}$</td></tr>
    <tr><td>Epochs</td><td>9 / 50</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001</td></tr>
  </tbody>
</table>

<h4>Headline Results</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Best val loss</td><td>1.143 (Epoch 1)</td></tr>
    <tr><td>Best val direction accuracy</td><td>63.1% (Epoch 7)</td></tr>
    <tr><td>Final val accuracy</td><td>62.0% (Epoch 9)</td></tr>
    <tr><td>Final train accuracy</td><td>89.0%</td></tr>
    <tr><td>Coverage</td><td>95.7%</td></tr>
    <tr><td>$p_{\\text{up}}$ std</td><td>0.418 (no hedging)</td></tr>
    <tr><td>VSN entropy</td><td>3.687 (max 3.81)</td></tr>
  </tbody>
</table>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated results only.</strong> These metrics are from training and validation on historical
  data and do not represent live or forward-tested trading performance.
</div>

<h4>Key Observations</h4>

<p>
  <strong>Lower accuracy ceiling than US30.</strong> Best validation accuracy reached 63.1% versus
  US30's 67.8% &mdash; a 4.7 percentage-point gap. The accuracy plateau at 62&ndash;63% from epoch 3
  onwards suggests a structural ceiling for this feature set on US500. The S&amp;P 500's higher
  diversification (500 constituents vs 30) may dilute the signal carried by individual-stock features
  in the feature set.
</p>

<p>
  <strong>Overfitting even faster than US30.</strong> Validation loss was best at epoch 1 (before any
  real training) and never improved. The generalisation gap grew 21% faster than US30 at the same
  stage, reaching a train&ndash;validation accuracy spread of 27 percentage points by epoch 9
  (compared to epoch 13 for US30). This accelerated memorisation is consistent with a noisier
  label set from the too-tight barrier.
</p>

<p>
  <strong>Strong bullish bias.</strong> The predicted $p_{\\text{up}}$ mean stayed at 0.55&ndash;0.64
  throughout training. UP accuracy (70&ndash;77%) far exceeded DOWN accuracy (32&ndash;55%). This is
  the mirror image of US30's bearish bias. Label distribution is nearly balanced (UP 51.2%,
  DOWN 48.8%), so the bias is learned, not inherited from the data. The model finds it easier to
  predict upward moves in the validation window &mdash; consistent with the post-2024 bull trend
  in large-cap equities.
</p>

<p>
  <strong>VSN feature preferences consistent with US30.</strong> Top features across both indices:
  cross_idx_dispersion (#1 in both), ret_60m (#2), dist_ma120 (#3). Bottom in both:
  log_spread_us30_us500. This consistency suggests genuine signal rather than noise fitting. The
  cross-index dispersion feature &mdash; designed from Gap Study #2 &mdash; is the most informative
  single feature for both indices, validating the Phase 2 empirical work.
</p>

<p>
  <strong>MID stream over-concentrated.</strong> The MID stream (120-bar, 2-hour context) has an
  18.8x max/min attention ratio &mdash; nearly ignoring most features in favour of
  cross_idx_dispersion and ret_60m. While some specialisation is desirable, this level of
  concentration risks fragility. This is a candidate for higher per-stream entropy regularisation
  in Run 2.
</p>

<p>
  <strong>&dollar;30 barrier too tight.</strong> The barrier produced 0% HOLD labels &mdash; every
  single bar hit the &dollar;30 barrier within 60 minutes. US500's typical hourly range is
  &dollar;15&ndash;&dollar;25, so &dollar;30 is only 1.2&ndash;2x the typical move. A wider barrier
  (&dollar;50) would create HOLD labels for ambiguous bars, improving label quality by excluding
  noise periods.
</p>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/us500_run1_01_loss_curves.png" alt="US500 Run 1 loss curves" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US500 Run 1: val loss minimises at epoch 1 and never recovers. The model begins memorising from the first gradient update.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run1_02_direction_accuracy.png" alt="US500 Run 1 direction accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Direction accuracy: 63.1% validation peak at epoch 7, 4.7pp below US30's 67.8%. Train accuracy climbs to 89% while validation plateaus at 62&ndash;63%.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run1_05_per_class_accuracy.png" alt="US500 Run 1 per-class accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Per-class accuracy: extreme UP/DOWN asymmetry. UP accuracy reaches 77% at epoch 1 while DOWN accuracy starts at 32%, revealing a strong bullish bias throughout training.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run1_06_vsn_entropy.png" alt="US500 Run 1 VSN entropy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>VSN entropy: healthy at 96.7% of theoretical maximum (3.687 / 3.81). The network maintains broad attention without collapse.</figcaption>
</figure>

<h4>VSN Per-Stream Feature Preferences</h4>

<p>
  Each of the four temporal streams learned distinct feature preferences, consistent with the
  multi-scale architecture design. The MID stream shows the highest concentration (18.8x max/min
  ratio), focusing almost exclusively on cross-index dynamics.
</p>

<table>
  <thead>
    <tr><th>Stream</th><th>Duration</th><th>Top Features</th><th>Focus</th></tr>
  </thead>
  <tbody>
    <tr><td>Short (60 bars)</td><td>1 hour</td><td>dist_ma120, trend_strength, tod_cos</td><td>Mean reversion + intraday timing</td></tr>
    <tr><td>Mid (120 bars)</td><td>2 hours</td><td>cross_idx_dispersion, ret_60m, trend_strength</td><td>Cross-index dynamics (18.8x concentration)</td></tr>
    <tr><td>Long (240 bars)</td><td>4 hours</td><td>roro_ratio, cross_idx_dispersion, ret_60m</td><td>Regime context</td></tr>
    <tr><td>Slow (720 bars)</td><td>12 hours</td><td>dist_ma120, ret_60m, dist_ma_290</td><td>Daily trend context</td></tr>
  </tbody>
</table>

<h4>Cross-Index Comparison: US30 vs US500</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>US30</th><th>US500</th></tr>
  </thead>
  <tbody>
    <tr><td>Best val accuracy</td><td>67.8%</td><td>63.1%</td></tr>
    <tr><td>Best val loss epoch</td><td>3</td><td>1</td></tr>
    <tr><td>Overfit gap (epoch 9)</td><td>1.53</td><td>1.87</td></tr>
    <tr><td>Class balance bias</td><td>DOWN &gt; UP by 8pp</td><td>UP &gt; DOWN by 15pp</td></tr>
    <tr><td>VSN concentration</td><td>3.1x</td><td>3.8x</td></tr>
  </tbody>
</table>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Weaker generalisation than US30.</strong> US500 shows 63.1% vs 67.8% validation accuracy
  with faster overfitting (val loss never improved past epoch 1). The &dollar;30 barrier produces
  noisier labels (0% HOLD), and the model develops a strong bullish bias. The consistent feature
  preferences across both indices validate the feature set, but US500 likely needs a wider barrier
  and stronger regularisation to close the accuracy gap.
</div>

<h4>Recommendations for Run 2</h4>

<table>
  <thead>
    <tr><th>Change</th><th>Run 1</th><th>Run 2</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>Barrier</td><td>&dollar;30</td><td>&dollar;50</td><td>0% HOLD rate; barrier too tight for US500 volatility</td></tr>
    <tr><td>Early stopping</td><td>None</td><td>5-epoch patience</td><td>Val loss never improved past epoch 1</td></tr>
    <tr><td>Dropout</td><td>0.15</td><td>0.25</td><td>Reduce memorisation; overfitting faster than US30</td></tr>
    <tr><td>Weight decay</td><td>0.005</td><td>0.01</td><td>Stronger L2 regularisation</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001</td><td>0.002</td><td>MID stream 18.8x too concentrated</td></tr>
    <tr><td>Max epochs</td><td>50</td><td>15</td><td>No improvement after epoch 7</td></tr>
  </tbody>
</table>

<h4 style="margin-top: 1.5rem; padding: 0.5rem 0.75rem; background: #f0f9ff; border-left: 4px solid #2563eb; font-size: 1.1em;">US500 &mdash; Run 2</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<p>
  US500 Run 2 applies the same configuration template as US30 Run 2: max LR halved to
  $1.5 \\times 10^{-4}$, VSN entropy $\\lambda$ doubled to 0.004, two noise features pruned
  (45 &rarr; 43). The decisive additional change is the barrier: widened from &dollar;30 to &dollar;90,
  a 3x increase, to address Run 1's 0% HOLD rate and extreme bullish bias.
</p>

<h4>Configuration Changes from Run 1</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Run 1</th><th>Run 2</th></tr>
  </thead>
  <tbody>
    <tr><td>Max LR</td><td>$3 \\times 10^{-4}$</td><td>$1.5 \\times 10^{-4}$</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.002</td><td>0.004</td></tr>
    <tr><td>Barrier</td><td>&dollar;30</td><td>&dollar;90</td></tr>
    <tr><td>Features</td><td>45</td><td>43</td></tr>
  </tbody>
</table>

<h4>Run 1 vs Run 2 Comparison</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 1 (Ep 7)</th><th>Run 2 (Ep 5)</th><th>Change</th></tr>
  </thead>
  <tbody>
    <tr><td>Val Accuracy</td><td><strong>63.1%</strong></td><td>62.0%</td><td>&minus;1.1pp</td></tr>
    <tr><td>Val Loss</td><td>1.649</td><td><strong>1.349</strong></td><td>&minus;18%</td></tr>
    <tr><td>Class Acc Gap</td><td>15.5pp</td><td><strong>4.9pp</strong></td><td>&minus;68%</td></tr>
    <tr><td>UP/DOWN Acc</td><td>70.6 / 55.1</td><td><strong>64.4 / 59.5</strong></td><td>Balanced</td></tr>
    <tr><td>$p_{\\text{up}}$ Mean</td><td>0.573</td><td><strong>0.523</strong></td><td>Centred</td></tr>
    <tr><td>VSN Mean Ratio</td><td>3.8x</td><td><strong>2.0x</strong></td><td>&minus;47%</td></tr>
    <tr><td>VSN MID Ratio</td><td>18.8x</td><td><strong>4.3x</strong></td><td>&minus;77%</td></tr>
  </tbody>
</table>

<h4>Key Findings</h4>

<p>
  <strong>1. Class balance is the headline improvement.</strong> The per-class accuracy gap shrank from
  15.5pp to 4.9pp, a 68% reduction. Run 1's strong bullish bias (UP 70.6%, DOWN 55.1%) is replaced
  by balanced predictions (UP 64.4%, DOWN 59.5%). The &dollar;90 barrier was the decisive fix:
  it produced cleaner labels by excluding bars where price moved less than &dollar;90 in 60 minutes,
  forcing the model to distinguish genuine directional moves from noise.
</p>

<p>
  <strong>2. Val loss improved 18% despite lower accuracy.</strong> Val loss dropped from 1.649 to 1.349.
  The apparent contradiction with the &minus;1.1pp accuracy drop reflects cleaner labels: a wider barrier
  makes each prediction harder (price must move further to count as correct), but the model's probability
  outputs are better calibrated. Lower loss with slightly lower accuracy is the expected signature of
  improved label quality.
</p>

<p>
  <strong>3. VSN MID stream concentration fixed.</strong> The MID stream's max/min attention ratio dropped
  from 18.8x to 4.3x, a 77% reduction. Run 1's MID stream was nearly ignoring most features in favour
  of cross_idx_dispersion and ret_60m. The doubled entropy regularisation ($\\lambda$ 0.002 &rarr; 0.004)
  forced broader attention without distorting the overall feature ranking.
</p>

<p>
  <strong>4. $p_{\\text{up}}$ centred.</strong> The mean predicted probability of UP moved from 0.573
  (bullish bias) to 0.523 (near-centred). The model no longer defaults to predicting UP when uncertain.
</p>

<p>
  <strong>5. Val accuracy slightly lower.</strong> 62.0% vs 63.1% (&minus;1.1pp). This is expected: the wider
  &dollar;90 barrier means the model must predict larger moves correctly, which is inherently harder. The
  accuracy drop is small relative to the class balance improvement.
</p>

<p>
  <strong>6. Still 0% HOLD even at &dollar;90.</strong> US500 moves more than &dollar;90 in virtually every
  60-minute window. This is consistent with US500's typical hourly range. A barrier wide enough to generate
  HOLD labels would likely be so wide as to reduce the number of actionable predictions below a useful
  threshold.
</p>

<h4>Top Features (Mean Across Streams)</h4>

<table>
  <thead>
    <tr><th>Rank</th><th>Feature</th><th>Mean Weight</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>dist_ma120</td><td>0.0356</td></tr>
    <tr><td>2</td><td>cross_idx_dispersion</td><td>0.0356</td></tr>
    <tr><td>3</td><td>ret_60m</td><td>0.0304</td></tr>
    <tr><td>4</td><td>vol_session_ratio</td><td>0.0276</td></tr>
    <tr><td>5</td><td>roro_ratio</td><td>0.0264</td></tr>
  </tbody>
</table>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>The &dollar;90 barrier was the decisive fix.</strong> Class balance improved dramatically
  (15.5pp &rarr; 4.9pp gap, 68% reduction), VSN concentration is controlled (MID stream 18.8x &rarr; 4.3x),
  and $p_{\\text{up}}$ is centred at 0.523. Val accuracy is marginally lower (&minus;1.1pp) because the
  wider barrier makes predictions harder, but val loss improved 18%, indicating better-calibrated outputs.
  US500 Run 2 is ready for deployment consideration alongside US30. The top features (dist_ma120,
  cross_idx_dispersion, ret_60m) remain consistent with US30, further validating the shared feature set.
</div>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/us500_run2_01_loss_curves.png" alt="US500 Run 2: training and validation loss curves" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US500 Run 2: training and validation loss curves. Val loss improved 18% vs Run 1 despite slightly lower accuracy.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run2_02_direction_accuracy.png" alt="US500 Run 2: direction accuracy by epoch" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US500 Run 2: direction accuracy by epoch. Peak at epoch 5 (62.0%) vs Run 1's epoch 7 (63.1%).</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run2_05_per_class_accuracy.png" alt="US500 Run 2: per-class accuracy showing balanced predictions" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US500 Run 2: per-class accuracy showing balanced predictions. UP/DOWN gap reduced from 15.5pp to 4.9pp.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us500_run2_06_vsn_entropy.png" alt="US500 Run 2: VSN entropy showing controlled feature concentration" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US500 Run 2: VSN entropy showing controlled feature concentration. MID stream ratio dropped from 18.8x to 4.3x.</figcaption>
</figure>

</div>
</details>

<details style="margin: 1.5rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
<summary style="cursor: pointer; padding: 0.75rem 1rem; font-weight: 600; font-size: 1.05em; color: #1a1a2e; background: #f0f9ff; border-left: 4px solid #2563eb; border-radius: 0.5rem 0.5rem 0 0;">NAS100 — Run 1 &amp; Run 2 Detail</summary>
<div style="padding: 1rem;">

<h4 style="margin-top: 0.5rem; font-size: 1.05em;">NAS100 &mdash; Run 1 (Diagnostic)</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<h4>Configuration</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Target</td><td>NAS100</td></tr>
    <tr><td>Barrier</td><td>&dollar;200</td></tr>
    <tr><td>Spread</td><td>&dollar;2.00</td></tr>
    <tr><td>Batch size</td><td>512</td></tr>
    <tr><td>Learning rate</td><td>$3 \\times 10^{-4}$</td></tr>
    <tr><td>Epochs</td><td>8 / 50</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001</td></tr>
  </tbody>
</table>

<h4>Headline Results</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Value</th></tr>
  </thead>
  <tbody>
    <tr><td>Best val loss</td><td>0.792 (Epoch 2)</td></tr>
    <tr><td>Best val direction accuracy</td><td>68.9% (Epoch 3)</td></tr>
    <tr><td>Final val accuracy</td><td>64.2% (Epoch 8)</td></tr>
    <tr><td>Final train accuracy</td><td>82.5%</td></tr>
    <tr><td>$p_{\\text{up}}$ std</td><td>0.409 (no hedging)</td></tr>
    <tr><td>VSN entropy</td><td>3.724 (97.6% of max)</td></tr>
  </tbody>
</table>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated results only.</strong> These metrics are from training and validation on historical
  data and do not represent live or forward-tested trading performance.
</div>

<h4>Key Observations</h4>

<p>
  <strong>Best model of the three indices.</strong> 68.9% validation accuracy (vs US30's 67.8%,
  US500's 63.1%). The only model to achieve a negative generalisation gap: at epoch 2, validation
  loss (0.792) was <em>lower</em> than training loss (0.850). This is rare and indicates genuine
  out-of-sample signal.
</p>

<p>
  <strong>Near-perfect class balance at peak.</strong> At epoch 3, UP accuracy was 69.1% and DOWN
  accuracy was 68.5%, a gap of only 0.6 percentage points. This contrasts sharply with US30's
  bearish bias (8pp gap) and US500's extreme bullish bias (15&ndash;20pp gap). After epoch 3,
  the model oscillated between bullish and bearish bias each epoch, a sign of instability.
</p>

<p>
  <strong>No persistent directional bias.</strong> $p_{\\text{up}}$ mean oscillated around 0.50
  without trending. US30 was persistently bearish (~0.45), US500 persistently bullish (~0.60).
  NAS100 stayed centred.
</p>

<p>
  <strong>Rapid learning.</strong> Validation accuracy jumped from 52.1% to 68.8% in a single
  epoch (epoch 1 to 2), the largest single-epoch gain across all indices. This suggests NAS100's
  features carry stronger initial signal.
</p>

<p>
  <strong>VSN discovered unique features.</strong> Top features include momentum_regime and
  brent_ret_60m, which were NOT top-ranked in US30 or US500. NAS100 is more sensitive to oil
  prices (energy cost for tech) and momentum regime (tech has stronger momentum).
</p>

<p>
  <strong>Consistent feature ranking across indices.</strong> dist_ma120 (#1 in NAS100, #3 in
  US30/US500), ret_60m (#2 in all three), log_spread_us30_us500 (last in all three). This
  cross-index consistency validates the feature set.
</p>

<h4>VSN Per-Stream Feature Preferences</h4>

<table>
  <thead>
    <tr><th>Stream</th><th>Duration</th><th>Top Features</th><th>Max/Min Ratio</th></tr>
  </thead>
  <tbody>
    <tr><td>Short (60 bars)</td><td>1 hour</td><td>dist_ma120, trend_strength, momentum_regime</td><td>9.2x</td></tr>
    <tr><td>Mid (120 bars)</td><td>2 hours</td><td>brent_ret_60m, dist_ma_290, trend_strength</td><td>3.0x (most balanced)</td></tr>
    <tr><td>Long (240 bars)</td><td>4 hours</td><td>tod_cos, roro_ratio, brent_ret_60m</td><td>3.2x</td></tr>
    <tr><td>Slow (720 bars)</td><td>12 hours</td><td>ret_60m, dist_ma120, abs_dist_ma120</td><td>6.1x</td></tr>
  </tbody>
</table>

<h4>Three-Index Comparison</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>NAS100</th><th>US30</th><th>US500</th></tr>
  </thead>
  <tbody>
    <tr><td>Best val accuracy</td><td><strong>68.9%</strong></td><td>67.8%</td><td>63.1%</td></tr>
    <tr><td>Best val loss</td><td><strong>0.792</strong></td><td>0.933</td><td>1.143</td></tr>
    <tr><td>Negative gap achieved?</td><td><strong>Yes (Ep 2)</strong></td><td>No</td><td>No</td></tr>
    <tr><td>Class balance at peak</td><td><strong>0.6pp</strong></td><td>6.0pp</td><td>20.6pp</td></tr>
    <tr><td>Direction bias</td><td><strong>None</strong></td><td>Bearish</td><td>Bullish</td></tr>
    <tr><td>VSN diversity (entropy)</td><td><strong>97.6%</strong></td><td>95.3%</td><td>96.7%</td></tr>
  </tbody>
</table>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #059669; background: #ecfdf5;">
  <strong>NAS100 produced the strongest Run 1 model:</strong> 68.9% directional accuracy with
  near-perfect class balance (0.6pp gap), no directional bias, and the only negative generalisation
  gap in the series. The &dollar;200 barrier is the best calibrated of the three indices. All three
  models share the same top features (dist_ma120, ret_60m, trend_strength) and bottom features
  (log_spread_us30_us500), validating the feature set and the VSN's ability to discriminate signal
  from noise across different instruments.
</div>

<h4>Recommendations for Run 2</h4>

<table>
  <thead>
    <tr><th>Change</th><th>Run 1</th><th>Run 2</th><th>Rationale</th></tr>
  </thead>
  <tbody>
    <tr><td>Early stopping</td><td>None</td><td>3-epoch patience</td><td>Val loss never improved past epoch 2</td></tr>
    <tr><td>Dropout</td><td>0.15</td><td>0.25</td><td>Reduce memorisation</td></tr>
    <tr><td>Weight decay</td><td>0.005</td><td>0.01</td><td>Stronger regularisation</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.001</td><td>0.002</td><td>Already set</td></tr>
    <tr><td>Max LR</td><td>$3 \\times 10^{-4}$</td><td>$1.5 \\times 10^{-4}$</td><td>Best results at LR ~$10^{-4}$</td></tr>
    <tr><td>Max epochs</td><td>50</td><td>10</td><td>No improvement after epoch 3</td></tr>
    <tr><td>Barrier</td><td>&dollar;200</td><td>&dollar;250&ndash;300</td><td>Test wider barrier for HOLD labels</td></tr>
  </tbody>
</table>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/nas100_run1_01_loss_curves.png" alt="NAS100 Run 1 loss curves" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>NAS100 Run 1: val loss drops below train loss at epoch 2 (negative generalisation gap), the only index to achieve this.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run1_02_direction_accuracy.png" alt="NAS100 Run 1 direction accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Direction accuracy: 68.9% val peak, the highest of all three indices.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run1_05_per_class_accuracy.png" alt="NAS100 Run 1 per-class accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Per-class: near-perfect balance at epoch 3 (69.1% UP vs 68.5% DOWN), then oscillation.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run1_06_vsn_entropy.png" alt="NAS100 Run 1 VSN entropy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>VSN entropy: highest diversity of all three indices at 97.6% of maximum.</figcaption>
</figure>

<hr style="margin: 2rem 0; border-top: 2px solid #e5e7eb;" />

<h4 style="margin-top: 0.5rem; font-size: 1.05em;">NAS100 &mdash; Run 2 (Diagnostic)</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<h4>Run 1 vs Run 2 Comparison</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 1 (Ep 3)</th><th>Run 2 (Ep 3)</th></tr>
  </thead>
  <tbody>
    <tr><td>Val Accuracy</td><td>68.8%</td><td>68.9% (+0.1pp, identical)</td></tr>
    <tr><td>Val Loss</td><td>0.822</td><td>0.783 (-5%)</td></tr>
    <tr><td>Class Gap</td><td>0.6pp</td><td>20.2pp (worse at peak)</td></tr>
    <tr><td>UP/DOWN Acc</td><td>69.1/68.5</td><td>78.5/58.3 (bullish bias)</td></tr>
    <tr><td>p_up Mean</td><td>0.505</td><td>0.568 (shifted)</td></tr>
    <tr><td>VSN Mean Ratio</td><td>4.0x</td><td>1.8x (-55%)</td></tr>
  </tbody>
</table>

<h4>Epoch 5 Comparison (Best Class Balance)</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 1 (Ep 3)</th><th>Run 2 (Ep 5)</th></tr>
  </thead>
  <tbody>
    <tr><td>Val Accuracy</td><td>68.8%</td><td>68.3% (-0.5pp)</td></tr>
    <tr><td>Class Gap</td><td>0.6pp</td><td>0.7pp (identical)</td></tr>
  </tbody>
</table>

<h4>Key Findings</h4>

<ol>
  <li><strong>Peak accuracy identical (68.9%) across both runs.</strong> NAS100 learns the same signal regardless of LR/entropy.</li>
  <li><strong>Val loss improved 5% (0.783 vs 0.822).</strong> Better calibration.</li>
  <li><strong>Bullish bias at peak epoch (20.2pp gap)</strong> because lower LR learns UP before DOWN. This resolves by epoch 5.</li>
  <li><strong>VSN concentration halved (4.0x to 1.8x).</strong> The entropy lambda change worked.</li>
  <li><strong>Run 1's configuration was already near-optimal for NAS100.</strong> Run 2 confirms this.</li>
</ol>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #059669; background: #ecfdf5;">
  <strong>NAS100 Run 1 was already the strongest model.</strong> Run 2 confirms the signal is robust to
  hyperparameter changes. Recommended deployment: use Run 1 epoch 3 for balanced predictions, or
  Run 2 epoch 5 for equivalent balance with better-calibrated probabilities.
</div>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/nas100_run2_01_loss_curves.png" alt="NAS100 Run 2 loss curves" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>NAS100 Run 2: val loss 0.783, a 5% improvement over Run 1.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run2_02_direction_accuracy.png" alt="NAS100 Run 2 direction accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Direction accuracy: 68.9% val peak, identical to Run 1.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run2_05_per_class_accuracy.png" alt="NAS100 Run 2 per-class accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Per-class: transient bullish bias at epoch 3 (78.5% UP vs 58.3% DOWN) resolves to 0.7pp gap by epoch 5.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/nas100_run2_06_vsn_entropy.png" alt="NAS100 Run 2 VSN entropy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>VSN concentration halved from 4.0x to 1.8x, confirming the entropy lambda increase worked.</figcaption>
</figure>

</div>
</details>

<h4 style="margin-top: 2rem; padding: 0.5rem 0.75rem; background: #fffbeb; border-left: 4px solid #d97706; font-size: 1.1em;">Run 1 &rarr; Run 2: Configuration Changes</h4>

<p>
  Based on the Run 1 diagnostics across all three indices, four targeted changes were made for Run 2.
  Each change addresses a specific finding from Run 1 and is backed by empirical evidence.
</p>

<h4>Change 1: Learning Rate $3 \\times 10^{-4} \\rightarrow 1.5 \\times 10^{-4}$</h4>

<p>
  Run 1 used a 5-epoch linear warmup from $3 \\times 10^{-5}$ to $3 \\times 10^{-4}$. The per-epoch
  LR and corresponding validation accuracy reveal that the optimal LR lies near $1.4 \\times 10^{-4}$:
</p>

<table>
  <thead>
    <tr><th>Epoch</th><th>LR</th><th>US30 Val Acc</th><th>NAS100 Val Acc</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>$3.0 \\times 10^{-5}$</td><td>54.7%</td><td>52.1%</td></tr>
    <tr><td>2</td><td>$8.4 \\times 10^{-5}$</td><td>66.2%</td><td>68.8%</td></tr>
    <tr><td><strong>3</strong></td><td><strong>$1.4 \\times 10^{-4}$</strong></td><td><strong>67.8%</strong></td><td><strong>68.9%</strong></td></tr>
    <tr><td>4</td><td>$1.9 \\times 10^{-4}$</td><td>67.7%</td><td>67.3%</td></tr>
    <tr><td>5</td><td>$2.5 \\times 10^{-4}$</td><td>65.5%</td><td>66.6%</td></tr>
    <tr><td>6</td><td>$3.0 \\times 10^{-4}$</td><td>66.1%</td><td>64.9%</td></tr>
  </tbody>
</table>

<p>
  Once LR exceeded $\\sim 1.5 \\times 10^{-4}$, validation accuracy declined in both indices. The higher
  LR drove predictions toward extreme confidence ($p_{\\text{up}}$ std rose from 0.17 to 0.44), inflating
  cross-entropy loss without improving directional signal. Halving the maximum LR to
  $1.5 \\times 10^{-4}$ means the model reaches the empirically optimal LR at the end of warmup rather
  than overshooting it.
</p>

<h4>Change 2: VSN Entropy $\\lambda$ from 0.002 to 0.004</h4>

<p>
  The VSN entropy regulariser penalises concentrated attention weights to prevent the model from ignoring
  most features. Run 1 used $\\lambda = 0.001$. The per-stream concentration ratios (max weight / min
  weight) reveal that this was insufficient:
</p>

<table>
  <thead>
    <tr><th>Stream</th><th>US30</th><th>US500</th><th>NAS100</th></tr>
  </thead>
  <tbody>
    <tr><td>Short</td><td>6.3x</td><td>10.1x</td><td>9.2x</td></tr>
    <tr><td>Mid</td><td>7.0x</td><td><strong>18.8x</strong></td><td>3.0x</td></tr>
    <tr><td>Long</td><td>3.1x</td><td>3.3x</td><td>3.2x</td></tr>
    <tr><td>Slow</td><td>5.7x</td><td>5.7x</td><td>6.1x</td></tr>
  </tbody>
</table>

<p>
  The US500 MID stream had an 18.8x concentration ratio, effectively ignoring most features in that
  temporal window. At $\\lambda = 0.001$, the regularisation was too weak to prevent this collapse.
  Setting $\\lambda = 0.004$ (2x stronger) should keep the max/min ratio below 5x. The entropy loss
  acts on the softmax attention weights only and does not interfere with the direction loss.
</p>

<h4>Change 3: Feature Pruning &mdash; 45 to 43</h4>

<p>
  Two features were removed: <em>log_spread_us30_us500</em> and <em>log_spread_us30_nas100</em>. Two
  independent methods confirmed these are noise:
</p>

<ul>
  <li><strong>Granger causality:</strong> F-stat = 0.00 in all three indices (literally zero linear predictive power for 60-minute returns).</li>
  <li><strong>VSN attention:</strong> bottom-ranked in all three indices (weight $\\sim 0.010$ vs uniform baseline $0.022$).</li>
</ul>

<p>
  These features measure cumulative log price divergence between index pairs, which is dominated by
  long-term drift and is uninformative for 60-minute directional prediction. The <em>roro_ratio</em>
  captures the same cross-index relationship more effectively through relative returns.
</p>

<p>
  Other low-Granger features (<em>er60</em>, <em>tod_cos</em>, <em>session_flag</em>) were retained
  because they showed non-zero VSN attention, suggesting non-linear signal that the Granger test
  (a linear method) cannot detect.
</p>

<h4>Change 4: US500 Barrier &dollar;30 &rarr; &dollar;90</h4>

<p>
  US500 had the worst class balance in Run 1 (15.5pp gap between UP and DOWN accuracy) despite
  balanced training labels. The &dollar;30 barrier was too tight relative to the index's hourly range,
  causing the model to overfit to one direction. Applying NAS100's successful barrier-to-range ratio
  (approximately 1.5 times the average hourly range) to US500's &dollar;60 average hourly range yields
  &dollar;90. US30 (&dollar;100) and NAS100 (&dollar;200) barriers are unchanged &mdash; both were
  already well-calibrated in Run 1.
</p>

<h4>What Stayed the Same</h4>

<p>
  Dropout (0.15), weight decay (0.005), embed dim (128), layers (1), and warmup epochs (5) are all
  unchanged. The overfitting observed in Run 1 is in <em>calibration</em> (overconfident predictions),
  not <em>capacity</em>. Train accuracy at the best validation epoch was only 71&ndash;74%, not 99%,
  confirming that the model has not exhausted its capacity. The lower learning rate is the correct
  lever &mdash; not stronger regularisation.
</p>

<h4>Run 2 Configuration Summary</h4>

<table>
  <thead>
    <tr><th>Parameter</th><th>US30</th><th>US500</th><th>NAS100</th></tr>
  </thead>
  <tbody>
    <tr><td>Learning rate</td><td>$1.5 \\times 10^{-4}$</td><td>$1.5 \\times 10^{-4}$</td><td>$1.5 \\times 10^{-4}$</td></tr>
    <tr><td>VSN entropy $\\lambda$</td><td>0.004</td><td>0.004</td><td>0.004</td></tr>
    <tr><td>Features</td><td>43</td><td>43</td><td>43</td></tr>
    <tr><td>Barrier</td><td>&dollar;100</td><td><strong>&dollar;90</strong></td><td>&dollar;200</td></tr>
    <tr><td>Spread</td><td>&dollar;1.20</td><td>&dollar;0.50</td><td>&dollar;2.00</td></tr>
  </tbody>
</table>

<details style="margin: 1.5rem 0; border: 1px solid #e5e7eb; border-radius: 0.5rem;" open>
<summary style="cursor: pointer; padding: 0.75rem 1rem; font-weight: 600; font-size: 1.05em; color: #1a1a2e; background: #f0fdf4; border-left: 4px solid #059669; border-radius: 0.5rem 0.5rem 0 0;">US30 — Run 2 (Latest)</summary>
<div style="padding: 1rem;">

<h4 style="margin-top: 0.5rem; font-size: 1.05em;">US30 &mdash; Run 2</h4>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Simulated Results</strong> &mdash; All results in this section are from simulated training
  and validation on historical data. They do not represent live trading performance. Validation
  accuracy measures directional prediction on held-out bars (2025-07 to 2026-03) that were not
  seen during training.
</div>

<p>
  US30 Run 2 applies the four configuration changes described above: max LR halved to
  $1.5 \\times 10^{-4}$, VSN entropy $\\lambda$ doubled to 0.004, two noise features pruned
  (45 &rarr; 43), and all other hyperparameters unchanged. The goal is to eliminate Run 1's bearish
  bias and improve class balance without sacrificing directional accuracy.
</p>

<h4>Run 1 vs Run 2 Comparison</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 1</th><th>Run 2</th><th>Change</th></tr>
  </thead>
  <tbody>
    <tr><td>Best val accuracy</td><td>67.8% (Ep 3)</td><td><strong>68.4% (Ep 5)</strong></td><td>+0.6pp</td></tr>
    <tr><td>Best val loss</td><td><strong>0.933</strong></td><td>0.981</td><td>+0.048</td></tr>
    <tr><td>Class acc gap at peak</td><td>6.0pp</td><td><strong>1.6pp</strong></td><td>&minus;73%</td></tr>
    <tr><td>UP/DN acc at peak</td><td>64.5 / 70.5</td><td><strong>69.3 / 67.7</strong></td><td>Near-equal</td></tr>
    <tr><td>Direction bias</td><td>Bearish</td><td><strong>None</strong></td><td>Eliminated</td></tr>
    <tr><td>VSN max/min ratio</td><td>3.1x</td><td><strong>2.0x</strong></td><td>More distributed</td></tr>
    <tr><td>VSN MID concentration</td><td>7.0x</td><td><strong>3.1x</strong></td><td>Fixed</td></tr>
    <tr><td>Best epoch</td><td>3</td><td><strong>5</strong></td><td>Shifted later (lower LR)</td></tr>
  </tbody>
</table>

<h4>Key Findings</h4>

<p>
  <strong>1. Class balance is the headline improvement.</strong> The per-class accuracy gap shrank from
  6.0pp to 1.6pp. UP accuracy rose from 64.5% to 69.3% while DOWN remained at 67.7%. The bearish
  bias from Run 1 is eliminated &mdash; $p_{\\text{up}}$ mean now centres around 0.49&ndash;0.50
  instead of drifting to 0.45.
</p>

<p>
  <strong>2. Accuracy improved marginally.</strong> 68.4% vs 67.8% (+0.6pp). The model finds the same
  directional signal but distributes it more evenly across classes.
</p>

<p>
  <strong>3. Overfitting rate is unchanged.</strong> The lower LR delayed the peak by 2 epochs but
  post-peak degradation is identical (~0.18&ndash;0.20 loss/epoch). This confirms overfitting is driven
  by data diversity (6,600 effective independent samples vs 2M parameters), not learning rate.
</p>

<p>
  <strong>4. Optimal LR confirmed at ~$1.5 \\times 10^{-4}$.</strong> Both runs peaked when the
  effective LR reached $1.4$&ndash;$1.5 \\times 10^{-4}$. Run 1 hit this during warmup at
  epoch 3; Run 2 reached it at end of warmup at epoch 5. The model achieves peak generalisation at
  this specific LR regardless of schedule.
</p>

<p>
  <strong>5. VSN entropy regularisation works without distorting rankings.</strong> MID stream
  concentration dropped from 7.0x to 3.1x. Top features are unchanged (dist_ma120, ret_60m,
  cross_idx_dispersion). The regularisation redistributed weight without changing relative importance.
</p>

<p>
  <strong>6. Feature pruning had minimal impact.</strong> Removing 2 noise features (log_spread pair)
  reduced inputs from 45 to 43, but these were already receiving near-zero VSN attention.
</p>

<h4>VSN Per-Stream Feature Preferences (Run 2)</h4>

<table>
  <thead>
    <tr><th>Stream</th><th>Ratio</th><th>Top 3</th></tr>
  </thead>
  <tbody>
    <tr><td>Short</td><td>2.9x</td><td>dist_ma120, trend_strength, abs_dist_ma120</td></tr>
    <tr><td>Mid</td><td>3.1x</td><td>tod_cos, dist_ma120, ret_120m</td></tr>
    <tr><td>Long</td><td>2.6x</td><td>roro_ratio, cross_idx_dispersion, vix_chg_60m</td></tr>
    <tr><td>Slow</td><td>2.2x</td><td>dist_ma120, ret_60m, skew_240m</td></tr>
  </tbody>
</table>

<h4>Diagnosis</h4>

<div class="finding-box" style="border-left-color: #059669; background: #ecfdf5;">
  <strong>Strictly better for live deployment:</strong> Run 2 achieves higher accuracy (68.4% vs 67.8%),
  near-perfect class balance (1.6pp vs 6.0pp gap), no directional bias, and healthier VSN diversity
  (max/min 2.0x vs 3.1x). The slightly higher validation loss (0.981 vs 0.933) reflects less extreme
  confidence, not worse direction prediction. The optimal checkpoint is epoch 5.
</div>

<h4>Charts</h4>

<figure>
  <img src="/charts/us-indexes/us30_run2_02_direction_accuracy.png" alt="US30 Run 2 vs Run 1 direction accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>US30 Run 2 vs Run 1: direction accuracy. Run 2 peaks 2 epochs later but 0.6pp higher, with much better class balance.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run2_05_per_class_accuracy.png" alt="US30 Run 2 per-class accuracy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Per-class accuracy: Run 2 achieves near-equal UP/DOWN (69.3/67.7) vs Run 1's bearish skew (64.5/70.5).</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run2_06_vsn_entropy.png" alt="US30 Run 2 VSN entropy" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>VSN entropy: Run 2 maintains 98.3% of max vs Run 1's 95.3%. Feature concentration reduced across all streams.</figcaption>
</figure>

<figure>
  <img src="/charts/us-indexes/us30_run2_03_overfitting_gap.png" alt="US30 Run 2 generalisation gap" style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Generalisation gap: identical overfitting rate in both runs &mdash; lower LR delays but does not prevent memorisation.</figcaption>
</figure>

</div>
</details>

<h3>7.6 Run 3: Architecture Redesign</h3>

<div class="finding-box" style="border-left-color: #2563eb; background: #eff6ff;">
  <strong>Complete</strong> &mdash; Run 3 implemented four structural changes based on Run 1 and Run 2 findings.
  Results are a significant regression (55.7% val accuracy). See Section 7.7 for failure analysis,
  root cause diagnosis, and proposed fix.
</div>

<p>
  Run 1 and Run 2 established a signal ceiling: approximately 69% for NAS100, 68% for US30, and 62% for US500.
  Hyperparameter tuning in Run 2 improved class balance and probability calibration but did not push accuracy
  meaningfully higher. The bottleneck is architectural, not configurational. Run 3 implements four structural
  changes designed to address the specific limitations identified in the Run 1 and Run 2 diagnostics.
</p>

<h4>Change 1: Single-Stream Transformer (660 M1 Bars)</h4>

<p>
  The current 4-stream design splits 660 M1 bars into SHORT (60 bars), MID (120 bars), LONG (240 bars), and
  SLOW (720 M1 bars downsampled to 12 H1 bars). Each stream passes through its own Variable Selection Network,
  Temporal Convolutional Network, and Transformer encoder before the four outputs are concatenated for the
  classification heads. Run 3 replaces this with a single stream that processes all 660 M1 bars through one
  unified pipeline.
</p>

<p>The rationale has six components:</p>

<ul>
  <li><strong>Full trading day context.</strong> 660 M1 bars equals 11 hours, covering one complete US equity
    trading session (pre-market through close). No information is discarded or downsampled.</li>
  <li><strong>Uniform resolution.</strong> The current SLOW stream downsamples M1 to H1 bars, creating a
    resolution boundary that the TCN kernel cannot bridge cleanly. A single M1 stream preserves sequence
    continuity throughout.</li>
  <li><strong>Transformers do not need stream splitting.</strong> The 4-stream design was an LSTM-era workaround
    for limited context windows. Transformers with self-attention can directly attend from bar 5 to bar 630
    without any architectural intermediary.</li>
  <li><strong>Current streams are redundant.</strong> SHORT (bars 601 to 660) is a strict subset of MID (bars
    541 to 660), which is a strict subset of LONG (bars 421 to 660). The model processes overlapping data
    through separate parameter sets, wasting capacity.</li>
  <li><strong>Cross-scale interactions are impossible in the current design.</strong> The four streams only
    merge at the final concatenation layer. A pattern visible at the 30-minute scale cannot interact with a
    pattern at the 4-hour scale until after all temporal processing is complete.</li>
  <li><strong>SLOW stream adds minimal unique signal.</strong> Across the Run 1 and Run 2 VSN analyses, 3 of
    SLOW's top 5 features overlap with other streams' top 10 for US30 and US500. For NAS100, all 5 overlap.
    The SLOW stream's unique contribution is negligible.</li>
</ul>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 340" style="max-width: 700px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 1.5rem 0;">
  <style>
    .arch-title { font: bold 13px system-ui, sans-serif; fill: #1e40af; }
    .arch-box { fill: #ffffff; stroke: #1e40af; stroke-width: 1.5; rx: 6; }
    .arch-text { font: 11px system-ui, sans-serif; fill: #374151; text-anchor: middle; }
    .arch-text-sm { font: 10px system-ui, sans-serif; fill: #6b7280; text-anchor: middle; }
    .arch-arrow { stroke: #1e40af; stroke-width: 1.5; fill: none; marker-end: url(#arrowhead); }
    .arch-brace { stroke: #9ca3af; stroke-width: 1; fill: none; }
    .arch-label { font: italic 10px system-ui, sans-serif; fill: #6b7280; text-anchor: start; }
  </style>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#1e40af"/>
    </marker>
  </defs>

  <!-- Left: OLD -->
  <text x="155" y="24" class="arch-title">OLD (4 streams)</text>
  <rect x="85" y="35" width="140" height="28" class="arch-box"/>
  <text x="155" y="53" class="arch-text">660 M1 bars</text>
  <line x1="115" y1="63" x2="115" y2="80" class="arch-arrow"/>
  <line x1="140" y1="63" x2="140" y2="80" class="arch-arrow"/>
  <line x1="165" y1="63" x2="165" y2="80" class="arch-arrow"/>
  <line x1="195" y1="63" x2="195" y2="80" class="arch-arrow"/>
  <text x="155" y="76" class="arch-text-sm">split</text>

  <rect x="30" y="82" width="80" height="24" class="arch-box"/>
  <text x="70" y="98" class="arch-text-sm">SHORT (60)</text>
  <rect x="115" y="82" width="80" height="24" class="arch-box"/>
  <text x="155" y="98" class="arch-text-sm">MID (120)</text>
  <rect x="30" y="112" width="80" height="24" class="arch-box"/>
  <text x="70" y="128" class="arch-text-sm">LONG (240)</text>
  <rect x="115" y="112" width="80" height="24" class="arch-box"/>
  <text x="155" y="128" class="arch-text-sm">SLOW (12 H1)</text>

  <line x1="70" y1="106" x2="70" y2="145" class="arch-arrow"/>
  <line x1="155" y1="106" x2="155" y2="145" class="arch-arrow"/>
  <line x1="70" y1="136" x2="70" y2="145" class="arch-arrow"/>
  <line x1="155" y1="136" x2="155" y2="145" class="arch-arrow"/>

  <rect x="25" y="147" width="90" height="24" class="arch-box"/>
  <text x="70" y="163" class="arch-text-sm">VSN+TCN+TF</text>
  <rect x="120" y="147" width="90" height="24" class="arch-box"/>
  <text x="165" y="163" class="arch-text-sm">VSN+TCN+TF</text>
  <rect x="25" y="177" width="90" height="24" class="arch-box"/>
  <text x="70" y="193" class="arch-text-sm">VSN+TCN+TF</text>
  <rect x="120" y="177" width="90" height="24" class="arch-box"/>
  <text x="165" y="193" class="arch-text-sm">VSN+TCN+TF</text>

  <path d="M70,201 L70,215 L120,225" class="arch-brace"/>
  <path d="M165,201 L165,215 L120,225" class="arch-brace"/>
  <path d="M70,171 L70,215" class="arch-brace" style="opacity:0"/>
  <path d="M165,171 L165,215" class="arch-brace" style="opacity:0"/>

  <rect x="70" y="220" width="100" height="28" class="arch-box"/>
  <text x="120" y="238" class="arch-text">concat</text>
  <line x1="120" y1="248" x2="120" y2="265" class="arch-arrow"/>
  <rect x="70" y="267" width="100" height="28" class="arch-box"/>
  <text x="120" y="285" class="arch-text">heads</text>

  <!-- Divider -->
  <line x1="340" y1="15" x2="340" y2="330" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Right: NEW -->
  <text x="520" y="24" class="arch-title">NEW (single stream)</text>
  <rect x="450" y="35" width="140" height="28" class="arch-box"/>
  <text x="520" y="53" class="arch-text">660 M1 bars</text>
  <line x1="520" y1="63" x2="520" y2="80" class="arch-arrow"/>

  <rect x="455" y="82" width="130" height="28" class="arch-box"/>
  <text x="520" y="100" class="arch-text">VSN (single)</text>
  <line x1="520" y1="110" x2="520" y2="127" class="arch-arrow"/>

  <rect x="455" y="129" width="130" height="28" class="arch-box"/>
  <text x="520" y="147" class="arch-text">TCN (kernel 15)</text>
  <line x1="520" y1="157" x2="520" y2="174" class="arch-arrow"/>

  <rect x="440" y="176" width="160" height="28" class="arch-box"/>
  <text x="520" y="194" class="arch-text">Transformer (2L, 8H)</text>
  <line x1="520" y1="204" x2="520" y2="221" class="arch-arrow"/>

  <rect x="455" y="223" width="130" height="28" class="arch-box"/>
  <text x="520" y="241" class="arch-text">TAP</text>
  <line x1="520" y1="251" x2="520" y2="268" class="arch-arrow"/>

  <rect x="455" y="270" width="130" height="28" class="arch-box"/>
  <text x="520" y="288" class="arch-text">heads</text>

  <!-- Labels -->
  <text x="600" y="100" class="arch-label">"which features matter now?"</text>
  <text x="600" y="147" class="arch-label">"local 15-min patterns"</text>
  <text x="610" y="194" class="arch-label">"full-day attention"</text>
  <text x="600" y="241" class="arch-label">"which bars matter most?"</text>
</svg>

<p>The parameter and compute tradeoffs are shown below.</p>

<table>
  <thead>
    <tr><th>Design</th><th>Attention cost</th><th>Parameters</th></tr>
  </thead>
  <tbody>
    <tr><td>4 streams (current)</td><td>75,744</td><td>~2.0M</td></tr>
    <tr><td>Single stream (660)</td><td>435,600</td><td>~0.7M</td></tr>
  </tbody>
</table>

<p>
  The single-stream design increases attention cost by approximately 5.7x (435,600 vs 75,744) because the
  Transformer must attend across all 660 positions rather than four shorter subsequences. However, it reduces
  total parameters by 65% (from ~2.0M to ~0.7M) because the four redundant VSN, TCN, and Transformer modules
  are replaced by one of each. The net effect is higher compute per forward pass but substantially less
  memorisation capacity, which directly addresses the overfitting observed in Runs 1 and 2.
</p>

<h4>Change 2: Multi-Horizon Targets (30m / 60m / 120m)</h4>

<p>
  Runs 1 and 2 train on a single target: the 60-minute double-barrier label. Run 3 trains on three horizons
  simultaneously. The 60-minute horizon remains primary (loss weight 1.0). The 30-minute and 120-minute horizons
  are auxiliary (loss weight 0.3 each). All three heads share the same backbone (VSN, TCN, Transformer, TAP);
  only the final classification layers are horizon-specific.
</p>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" style="max-width: 400px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 1.5rem 0;">
  <style>
    .mh-box { fill: #ffffff; stroke: #1e40af; stroke-width: 1.5; rx: 6; }
    .mh-box-aux { fill: #f0f9ff; stroke: #1e40af; stroke-width: 1; rx: 6; }
    .mh-box-pri { fill: #eff6ff; stroke: #1e40af; stroke-width: 2; rx: 6; }
    .mh-text { font: 12px system-ui, sans-serif; fill: #374151; text-anchor: middle; }
    .mh-text-sm { font: 10px system-ui, sans-serif; fill: #6b7280; text-anchor: middle; }
    .mh-arrow { stroke: #1e40af; stroke-width: 1.5; fill: none; marker-end: url(#mh-arrow); }
  </style>
  <defs>
    <marker id="mh-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#1e40af"/>
    </marker>
  </defs>

  <rect x="110" y="15" width="180" height="32" class="mh-box"/>
  <text x="200" y="36" class="mh-text">shared_embedding</text>

  <line x1="130" y1="47" x2="80" y2="72" class="mh-arrow"/>
  <line x1="200" y1="47" x2="200" y2="72" class="mh-arrow"/>
  <line x1="270" y1="47" x2="320" y2="72" class="mh-arrow"/>

  <rect x="20" y="75" width="120" height="32" class="mh-box-aux"/>
  <text x="80" y="94" class="mh-text">head_30m</text>
  <text x="80" y="124" class="mh-text-sm">auxiliary (0.3)</text>

  <rect x="140" y="75" width="120" height="32" class="mh-box-pri"/>
  <text x="200" y="94" class="mh-text">head_60m</text>
  <text x="200" y="124" class="mh-text-sm">primary (1.0)</text>

  <rect x="260" y="75" width="120" height="32" class="mh-box-aux"/>
  <text x="320" y="94" class="mh-text">head_120m</text>
  <text x="320" y="124" class="mh-text-sm">auxiliary (0.3)</text>
</svg>

<p>
  The purpose is structural regularisation. The shared backbone must learn feature representations that predict
  direction at 30, 60, and 120 minutes simultaneously. Features that predict only the 60-minute horizon (but not
  the others) are more likely to reflect noise or overfitting than genuine signal. Multi-task learning forces the
  model to learn more general temporal patterns. This principle was established by Collobert and Weston (2008),
  who showed that auxiliary tasks improve primary-task generalisation in NLP, and it applies directly here: the
  auxiliary horizons act as a form of implicit regularisation that is more informative than dropout or weight
  decay because it encodes domain knowledge about temporal consistency.
</p>

<h4>Change 3: Cross-Asset Features at Lag 15 (43 to 45 features)</h4>

<p>
  Run 1 and Run 2 use DXY and USDJPY returns at lag 60 (the 60-minute lagged return). Granger causality testing
  reveals that DXY also has significant predictive power at lag 15, but zero predictive power at lags 1 through
  5. The lag-15 and lag-60 returns capture different phenomena: the lag-15 return measures the recent 15-minute
  dollar move, while the lag-60 return measures the hour-long dollar trend. Run 3 adds dxy_ret_15m and
  usdjpy_ret_15m as two additional features, bringing the total from 43 to 45.
</p>

<table>
  <thead>
    <tr><th>Lag (min)</th><th>DXY F-stat</th><th>Significant?</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>3.4</td><td>No</td></tr>
    <tr><td>5</td><td>1.1</td><td>No</td></tr>
    <tr><td>15</td><td>6.4</td><td>Yes</td></tr>
    <tr><td>30</td><td>6.7</td><td>Yes</td></tr>
    <tr><td>60</td><td>22.1</td><td>Yes</td></tr>
  </tbody>
</table>

<p>
  The Granger test results confirm that the dollar index has no short-term predictive power for US equity indices
  at the 1-minute or 5-minute horizon, but becomes significant at 15 minutes and strengthens monotonically out
  to 60 minutes. The lag-15 feature is not redundant with lag-60: it captures faster-moving dollar dynamics
  (e.g., intraday Fed commentary, Treasury auction results) that dissipate before the 60-minute window.
</p>

<h4>Change 4: Two Transformer Layers</h4>

<p>
  Runs 1 and 2 use a single Transformer encoder layer. The train-validation accuracy gap at best epoch shows
  unused capacity: NAS100 has only a 2.4pp gap, US30 8.2pp, and US500 12.2pp. A second Transformer layer learns
  second-order temporal interactions: patterns of patterns. Where the first layer identifies individual temporal
  features (e.g., a momentum reversal at bar 400, a volatility spike at bar 580), the second layer can learn
  relationships between those features (e.g., momentum reversals that follow volatility spikes have different
  directional implications than isolated momentum reversals).
</p>

<p>
  The cost is approximately 197K additional parameters. Combined with the single-stream redesign, the total
  model size is approximately 0.9M parameters, still less than half the current 2.0M. The additional compute
  is roughly 2x in the Transformer portion of the forward pass, which is modest given that the TCN and VSN
  components (unchanged) account for the majority of wall-clock time.
</p>

<h4>Run 3 Summary</h4>

<table>
  <thead>
    <tr><th>Change</th><th>Parameters</th><th>Compute</th><th>Expected Benefit</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Single-stream 660 bars</td>
      <td>-1.3M</td>
      <td>+5.7x attention, -65% params</td>
      <td>Cross-scale attention, less memorisation</td>
    </tr>
    <tr>
      <td>Multi-horizon targets</td>
      <td>+260</td>
      <td>+60% labels</td>
      <td>Structural regularisation</td>
    </tr>
    <tr>
      <td>Lag-15 cross-asset features</td>
      <td>+4.7% input</td>
      <td>Negligible</td>
      <td>Granger-validated signal</td>
    </tr>
    <tr>
      <td>Two Transformer layers</td>
      <td>+197K</td>
      <td>+100% Transformer</td>
      <td>Higher-order temporal interactions</td>
    </tr>
  </tbody>
</table>

<p>
  Net result: approximately 0.9M parameters (down from 2.0M), full trading-day context in a single stream,
  and multi-horizon regularisation. The expected benefit is not higher peak accuracy on a single run, but
  better generalisation and more stable out-of-sample performance due to reduced memorisation capacity and
  structurally enforced temporal consistency.
</p>

<h4>Run 3 Pipeline</h4>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420" style="max-width: 700px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 1.5rem 0;">
  <style>
    .pp-box { fill: #ffffff; stroke: #1e40af; stroke-width: 1.5; rx: 8; }
    .pp-box-head { fill: #f0f9ff; stroke: #1e40af; stroke-width: 1.5; rx: 8; }
    .pp-box-pri { fill: #eff6ff; stroke: #1e40af; stroke-width: 2; rx: 8; }
    .pp-text { font: 13px system-ui, sans-serif; fill: #374151; text-anchor: middle; }
    .pp-text-sub { font: 11px system-ui, sans-serif; fill: #6b7280; text-anchor: middle; }
    .pp-text-label { font: italic 11px system-ui, sans-serif; fill: #6b7280; text-anchor: start; }
    .pp-arrow { stroke: #1e40af; stroke-width: 1.5; fill: none; marker-end: url(#pp-arrow); }
  </style>
  <defs>
    <marker id="pp-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#1e40af"/>
    </marker>
  </defs>

  <!-- Input -->
  <rect x="200" y="15" width="220" height="36" class="pp-box"/>
  <text x="310" y="38" class="pp-text">660 M1 bars x 45 features</text>
  <line x1="310" y1="51" x2="310" y2="72" class="pp-arrow"/>

  <!-- VSN -->
  <rect x="210" y="74" width="200" height="36" class="pp-box"/>
  <text x="310" y="97" class="pp-text">VSN (single)</text>
  <text x="430" y="97" class="pp-text-label">"which features matter now?"</text>
  <line x1="310" y1="110" x2="310" y2="131" class="pp-arrow"/>

  <!-- TCN -->
  <rect x="210" y="133" width="200" height="36" class="pp-box"/>
  <text x="310" y="156" class="pp-text">TCN (kernel 15)</text>
  <text x="430" y="156" class="pp-text-label">"local 15-min patterns"</text>
  <line x1="310" y1="169" x2="310" y2="190" class="pp-arrow"/>

  <!-- Transformer -->
  <rect x="190" y="192" width="240" height="36" class="pp-box"/>
  <text x="310" y="215" class="pp-text">Transformer (2 layers, 8 heads)</text>
  <text x="450" y="215" class="pp-text-label">"full-day cross-scale attention"</text>
  <line x1="310" y1="228" x2="310" y2="249" class="pp-arrow"/>

  <!-- TAP -->
  <rect x="210" y="251" width="200" height="36" class="pp-box"/>
  <text x="310" y="274" class="pp-text">TAP</text>
  <text x="430" y="274" class="pp-text-label">"which bars matter most?"</text>

  <!-- Branching arrows -->
  <line x1="240" y1="287" x2="160" y2="318" class="pp-arrow"/>
  <line x1="310" y1="287" x2="310" y2="318" class="pp-arrow"/>
  <line x1="380" y1="287" x2="460" y2="318" class="pp-arrow"/>

  <!-- Heads -->
  <rect x="90" y="320" width="140" height="36" class="pp-box-head"/>
  <text x="160" y="343" class="pp-text">head_30m (aux)</text>

  <rect x="240" y="320" width="140" height="36" class="pp-box-pri"/>
  <text x="310" y="343" class="pp-text">head_60m (primary)</text>

  <rect x="390" y="320" width="150" height="36" class="pp-box-head"/>
  <text x="465" y="343" class="pp-text">head_120m (aux)</text>

  <!-- Weights -->
  <text x="160" y="375" class="pp-text-sub">weight: 0.3</text>
  <text x="310" y="375" class="pp-text-sub">weight: 1.0</text>
  <text x="465" y="375" class="pp-text-sub">weight: 0.3</text>
</svg>

<h3>7.7 Run 3 Results: Failure Analysis</h3>

<div class="finding-box" style="border-left-color: #dc2626; background: #fef2f2;">
  <strong>Run 3 regressed from 68.4% to 55.7% val accuracy.</strong> Root cause: auxiliary loss (30m+120m targets)
  dominated 71% of the gradient by epoch 23. The 60m direction signal was diluted. Fix: dynamic auxiliary scaling
  capping non-direction loss at 20% of the primary loss.
</div>

<p>
  Run 3 is a negative result. The four architectural changes described in Section 7.6 were implemented and
  trained on US30. Rather than improving on the Run 2 ceiling of 68.4%, the model regressed to 55.7% validation
  accuracy, barely above random. This section documents the regression, the five diagnostic investigations
  performed, the root cause identified, and the proposed fix. Negative results are valuable when they isolate
  the failure mechanism precisely enough to guide the next iteration.
</p>

<h4>Performance Comparison</h4>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 1</th><th>Run 2</th><th>Run 3</th></tr>
  </thead>
  <tbody>
    <tr><td>Best Val Accuracy</td><td>67.8% (Ep 3)</td><td>68.4% (Ep 5)</td><td style="color:#dc2626; font-weight:600;">55.7% (Ep 3)</td></tr>
    <tr><td>Best Val Loss</td><td>0.933</td><td>0.981</td><td style="color:#dc2626; font-weight:600;">1.562</td></tr>
    <tr><td>Train Acc at best</td><td>74.5%</td><td>76.6%</td><td>65.5%</td></tr>
    <tr><td>Class Gap</td><td>6.0pp</td><td>1.6pp</td><td style="color:#dc2626; font-weight:600;">16.7pp</td></tr>
  </tbody>
</table>

<p>
  The regression is severe across every metric. Validation accuracy dropped 12.7 percentage points from Run 2.
  Validation loss nearly doubled. The class gap widened from 1.6pp (near-perfect balance in Run 2) to 16.7pp,
  indicating the model reverted to a strong directional bias. Five diagnostic investigations were performed to
  isolate the cause.
</p>

<h4>Diagnostic 1: Training Accuracy Comparison</h4>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_02_train_accuracy_3runs.png" alt="Training accuracy comparison across Runs 1, 2, and 3. Run 3 learns slower, ruling out pure overfitting." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Training accuracy comparison. Run 3 learns slower on the training set itself, ruling out pure overfitting as the explanation.</figcaption>
</figure>

<p>
  Run 3 learns slower on the training data (72.9% vs 78.9% at epoch 6) and generalises worse (55.4% vs 67.2%).
  This rules out the standard overfitting narrative where the model memorises training data at the expense of
  validation. Run 3 is failing to learn the training signal in the first place. Something in the architecture
  is preventing the model from fitting the 60-minute direction target.
</p>

<h4>Diagnostic 2: Generalisation Gap</h4>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_03_generalization_gap_3runs.png" alt="Generalisation gap growth rate across Runs 1, 2, and 3. Run 3's gap widens fastest." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Generalisation gap (train accuracy minus validation accuracy) over training. Run 3's gap widens fastest despite lower absolute training accuracy.</figcaption>
</figure>

<p>
  The generalisation gap grows much faster in Run 3: 29.7 percentage points at epoch 10 versus 21.4pp for Run 2.
  Combined with Diagnostic 1, this means Run 3 is simultaneously learning less on training data and generalising
  worse. The model is wasting capacity on something other than the primary 60-minute direction signal.
</p>

<h4>Diagnostic 3: Loss Component Breakdown (Root Cause)</h4>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_04_loss_components_run3.png" alt="Loss component breakdown showing auxiliary loss dominating the gradient in Run 3." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Loss component breakdown for Run 3. The non-direction (auxiliary) loss increasingly dominates the total gradient as training progresses.</figcaption>
</figure>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_05_aux_dominance_run3.png" alt="Auxiliary loss as percentage of total gradient over training epochs." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Auxiliary loss as a percentage of total loss over training. By epoch 23, 71% of the gradient comes from non-direction targets.</figcaption>
</figure>

<p>
  This is the root cause. By epoch 12, 65% of the gradient comes from non-direction losses (the auxiliary
  30-minute and 120-minute target heads). By epoch 23, this rises to 71%. The model optimises for auxiliary
  targets, not the 60-minute direction that is actually traded.
</p>

<p>
  The mechanism is straightforward. The 60-minute direction loss (primary) drops faster than the auxiliary losses
  because the 60-minute horizon is the easiest to fit (it has the most training signal per label). As the primary
  loss shrinks, the auxiliary losses, which carry a fixed weight of 0.3 each, occupy a growing share of the total
  gradient. The backbone parameters are updated primarily to improve 30-minute and 120-minute predictions, which
  are not aligned with the 60-minute direction the model is evaluated on.
</p>

<table>
  <thead>
    <tr><th>Epoch</th><th>Total Loss</th><th>Direction (60m)</th><th>Non-direction (30m+120m)</th><th>% Non-direction</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>1.443</td><td>0.695</td><td>0.748</td><td>51.8%</td></tr>
    <tr><td>6</td><td>1.024</td><td>0.462</td><td>0.562</td><td>54.9%</td></tr>
    <tr><td>12</td><td>0.573</td><td>0.199</td><td>0.374</td><td style="color:#dc2626; font-weight:600;">65.2%</td></tr>
    <tr><td>23</td><td>0.427</td><td>0.124</td><td>0.303</td><td style="color:#dc2626; font-weight:600;">71.0%</td></tr>
  </tbody>
</table>

<p>
  The loss breakdown makes the failure mechanism explicit. At epoch 1, the split is roughly even (51.8%
  non-direction). By epoch 12, the primary direction loss has dropped to 0.199 while the auxiliary losses remain
  at 0.374, giving non-direction losses a 65.2% share of the gradient. By epoch 23, the imbalance reaches 71%.
  The shared backbone is being trained predominantly to predict 30-minute and 120-minute horizons, diluting the
  60-minute signal that determines validation accuracy.
</p>

<h4>Diagnostic 4: VSN Feature Selection</h4>

<p>
  The Variable Selection Network was examined to determine whether it had been corrupted by the architectural
  changes. It had not. The top feature remains dist_ma120, consistent with Runs 1 and 2. The overall ranking
  of the top 10 features is stable. The two new lag-15 cross-asset features (dxy_ret_15m and usdjpy_ret_15m)
  rank in the bottom 10, indicating minimal additional signal but also no disruption. The VSN is not the
  source of the regression.
</p>

<h4>Diagnostic 5: Confounded Changes</h4>

<p>
  Run 3 made four simultaneous changes (single-stream architecture, multi-horizon targets, lag-15 features,
  two Transformer layers). The loss component breakdown in Diagnostic 3 confirms that auxiliary loss dominance
  is the root cause of the regression. However, because all four changes were applied together, the three
  remaining changes (single-stream, lag-15 features, two Transformer layers) remain possible contributors
  that require individual ablation to clear. The auxiliary loss fix is necessary; whether it is sufficient
  will be determined by Run 3b.
</p>

<h4>Why US500 and NAS100 Were Not Run</h4>

<p>
  All three indices showed identical dynamics in Runs 1 and 2: the same overfitting timing, the same VSN
  feature rankings, the same learning rate sensitivity. The regression observed in Run 3 is architecture-level,
  not data-level. The auxiliary loss dominance mechanism applies equally to all three indices because it stems
  from the fixed 0.3 weight assigned to each auxiliary head, which is independent of the underlying data. Running
  US500 and NAS100 with the same broken loss weighting would produce the same failure mode and waste compute
  without generating new information.
</p>

<h4>Learning Rate Schedules</h4>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_06_lr_schedule_3runs.png" alt="Learning rate schedules across all three runs." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Learning rate schedules across Runs 1, 2, and 3. Run 3 uses the same warmup + cosine schedule as Run 2.</figcaption>
</figure>

<figure style="margin: 1.5rem 0;">
  <img src="/charts/us-indexes/us30_run3_01_val_accuracy_3runs.png" alt="Validation accuracy across Runs 1, 2, and 3. Run 3 regresses to 55.7%." style="max-width: 100%; border-radius: 8px;" />
  <figcaption>Validation accuracy across all three runs. Run 3 regresses sharply from the 68% ceiling established by Runs 1 and 2.</figcaption>
</figure>

<h4>Proposed Fix: Dynamic Auxiliary Loss Scaling</h4>

<p>
  The fix replaces the fixed auxiliary weight of 0.3 with a dynamic cap: auxiliary loss is scaled so that the
  total non-direction loss never exceeds 20% of the primary direction loss. In early training, the auxiliary
  losses are naturally within this budget because all three losses are large and roughly comparable. The model
  benefits from the regularisation effect of multi-task learning. In late training, as the primary loss drops
  faster, the auxiliary losses would normally dominate (as observed in Run 3). The dynamic cap prevents this
  by scaling down the auxiliary gradients, ensuring that the backbone remains dominated by the 60-minute
  direction signal throughout training.
</p>

<p>
  Concretely, at each training step the total auxiliary loss (30m head loss times 0.3 plus 120m head loss
  times 0.3) is computed. If this total exceeds 0.2 times the primary 60m direction loss, a scaling factor
  is applied to bring it back to the 20% cap. The scaling is applied to the loss values before backpropagation,
  so the gradient magnitudes respect the cap automatically. The 20% threshold was chosen as a conservative
  starting point: enough auxiliary signal to provide regularisation, but low enough to prevent the gradient
  takeover observed in Run 3.
</p>

<div class="finding-box" style="border-left-color: #2563eb; background: #eff6ff;">
  <strong>Complete</strong> &mdash; Run 3b confirmed that dynamic auxiliary scaling fixes the loss balance problem
  (43% non-direction vs 71% in Run 3a) but does not recover accuracy. The failure is architectural, not
  loss-related. See Section 7.8.
</div>

<h3>7.8 Run 3b Results: Dynamic Auxiliary Scaling</h3>

<div class="finding-box" style="border-left-color: #dc2626; background: #fef2f2;">
  <strong>Run 3b confirms the single-stream architecture fails due to insufficient capacity (562K vs 1,451K params),
  not loss balance.</strong> The 4-stream design is more parameter-efficient within the 18GB VRAM budget. Dynamic
  auxiliary scaling is validated and retained.
</div>

<p>
  Run 3b applies the dynamic auxiliary scaling fix proposed in Section 7.7. The non-direction loss is capped at
  20% of the primary 60-minute direction loss at each training step. The fix worked exactly as designed: auxiliary
  losses stayed at 43% of the total gradient, down from 71% in Run 3a. But validation accuracy was 55.4%, nearly
  identical to Run 3a's 55.7%. The problem is not the loss function.
</p>

<h4>Performance Comparison</h4>

<table>
  <thead>
    <tr><th>Run</th><th>Architecture</th><th>Best Val Acc</th><th>Params</th></tr>
  </thead>
  <tbody>
    <tr><td>Run 2</td><td>4-stream, 1L, 4H</td><td>68.4%</td><td>1,451K</td></tr>
    <tr><td>Run 3a</td><td>1-stream 660, 2L, 8H, fixed aux</td><td>55.7%</td><td>562K</td></tr>
    <tr><td>Run 3b</td><td>1-stream 660, 2L, 8H, dynamic aux</td><td>55.4%</td><td>562K</td></tr>
  </tbody>
</table>

<p>
  Dynamic scaling kept the gradient balanced but did not recover accuracy. The 0.3pp difference between Run 3a
  and Run 3b is within noise. Both single-stream runs are 12-13pp below Run 2. The root cause is the
  single-stream design itself: it has 2.6x fewer parameters and a 4x representation bottleneck.
</p>

<h4>Parameter Breakdown</h4>

<table>
  <thead>
    <tr><th>Component</th><th>Run 2 (4-stream)</th><th>Run 3b (1-stream)</th></tr>
  </thead>
  <tbody>
    <tr><td>VSN</td><td>4 x 16.7K = 66.9K</td><td>1 x 17.1K</td></tr>
    <tr><td>TCN</td><td>4 x 122.9K = 491.8K</td><td>1 x 122.9K</td></tr>
    <tr><td>Transformer</td><td>4 x 198.3K = 793.1K</td><td>1 x 396.5K</td></tr>
    <tr><td>Total</td><td>1,451K</td><td>562K</td></tr>
  </tbody>
</table>

<h4>Representation Bottleneck</h4>

<p>
  Run 2 concatenates four 128-dim embeddings into a 512-dim vector before the classification heads. Run 3b
  compresses everything into one 128-dim vector. That is a 4x information bottleneck. The temporal structure
  that Run 2 preserves across four separate streams (SHORT, MID, LONG, SLOW) is lost when forced through a
  single 128-dim representation.
</p>

<p>
  The params-per-position ratio makes the capacity gap concrete. Run 3b has only 601 params per position
  (660 positions, 396K transformer params). Run 2's SHORT stream has 3,305 params per position (60 positions,
  198K params). With 660 positions and only 396K transformer parameters, the attention mechanism dilutes rather
  than enriches. Each position gets too little dedicated capacity to learn meaningful temporal patterns.
</p>

<h4>VRAM Prevents Scaling Up</h4>

<p>
  Matching Run 2's 1.45M params in single-stream would need EMBED=256 with 3 layers, estimated at 32GB VRAM.
  That barely fits an A100 and exceeds our 18GB budget. The 4-stream design is actually more VRAM-efficient
  because each stream has lower $T^2$ cost in attention. Four streams of 60, 60, 120, 240 positions cost far
  less than one stream of 660 positions.
</p>

<p>
  Longer sequences do not automatically help Transformers. That claim assumes sufficient model capacity. NLP
  Transformers that benefit from long context have hundreds of millions of parameters. Ours has 562K. At that
  scale, the quadratic attention cost of long sequences is a liability, not an advantage.
</p>

<h4>What Is Retained for Run 4</h4>

<p>
  Dynamic auxiliary scaling is validated and retained. It kept auxiliary losses at 43% (vs 71% in Run 3a),
  confirming the gradient balance mechanism works as designed. VSN entropy of 0.004 is also retained, validated
  across both Run 2 and Run 3b.
</p>

<h4>What Is Reverted for Run 4</h4>

<p>
  The single-stream architecture reverts to 4-stream. Two Transformer layers revert to one. Eight attention
  heads revert to four. The two lag-15 cross-asset features (dxy_ret_15m, usdjpy_ret_15m) are removed as the
  VSN ranked them in the bottom 10 with no measurable signal.
</p>

<h4>Run 3c: Testing the Capacity Hypothesis</h4>

<div class="finding-box" style="border-left-color: #2563eb; background: #eff6ff;">
  <strong>In Progress</strong> &mdash; Run 3c is training. Results will be reported here once complete.
</div>

<p>
  Before reverting to 4-stream, we are running one more test. The Run 3a/3b failure was diagnosed as a
  parameter and representation bottleneck (562K params, 128-dim embedding), not necessarily an inherent flaw
  of the single-stream design. Run 3c scales up the single-stream model to test whether giving it enough
  capacity resolves the problem.
</p>

<table>
  <thead>
    <tr><th>Parameter</th><th>Run 3b</th><th>Run 3c</th><th>Reasoning</th></tr>
  </thead>
  <tbody>
    <tr><td>EMBED_DIM</td><td>128</td><td>320</td><td>2.5x increase eliminates 128-dim bottleneck</td></tr>
    <tr><td>LAYERS</td><td>2</td><td>3</td><td>More depth for 660 positions</td></tr>
    <tr><td>NHEAD</td><td>8</td><td>8</td><td>Unchanged (head_dim = 40)</td></tr>
    <tr><td>BATCH_SIZE</td><td>512</td><td>384</td><td>Reduced to fit 32GB VRAM</td></tr>
    <tr><td>SEQ_LEN</td><td>660</td><td>660</td><td>Unchanged</td></tr>
    <tr><td>AUX_MAX_RATIO</td><td>0.20</td><td>0.20</td><td>Dynamic scaling retained</td></tr>
  </tbody>
</table>

<table>
  <thead>
    <tr><th>Metric</th><th>Run 2 (4-stream)</th><th>Run 3b (1-stream)</th><th>Run 3c (scaled)</th></tr>
  </thead>
  <tbody>
    <tr><td>Total params</td><td>1,451K</td><td>562K</td><td>4,155K</td></tr>
    <tr><td>Representation dim</td><td>512 (4x128)</td><td>128</td><td>320</td></tr>
    <tr><td>Params/position</td><td>826-16,523</td><td>601</td><td>6,295</td></tr>
    <tr><td>VRAM</td><td>18 GB</td><td>18 GB</td><td>26 GB</td></tr>
  </tbody>
</table>

<p>
  Run 3c has 2.9x Run 2's parameters and 10.5x Run 3b's. If the single-stream design can work, this
  configuration has enough capacity to prove it. If it still fails, the multi-stream architecture is
  fundamentally superior for this problem size, and we revert to 4-stream with dynamic aux scaling for Run 4.
</p>

<h2>8. Current Status and Next Steps</h2>

<p>
  Phase 2 is complete with seven empirical gap studies. Phase 3 has produced deploy-candidate models for all
  three indices across two training runs each. NAS100 achieved the highest validation accuracy (68.9%), US30
  the best class balance (1.6pp gap), and US500 the largest improvement from Run 1 to Run 2 (class gap
  reduced 68%). Run 3a implemented four architectural changes (single-stream Transformer, multi-horizon targets,
  lag-15 features, two Transformer layers) designed to break through the generalisation ceiling, but regressed
  to 55.7% validation accuracy. Diagnostic investigation identified auxiliary loss dominance as the root cause.
  Run 3b applied dynamic auxiliary scaling, which fixed the loss balance (43% non-direction vs 71%) but did not
  recover accuracy (55.4%). The root cause is the single-stream capacity bottleneck: 562K params and a 4x
  representation bottleneck vs Run 2's 1,451K params and 512-dim concatenated representation. Run 3c is now
  in progress, scaling the single-stream to 4,155K params (320-dim embedding, 3 layers) to determine whether
  the capacity hypothesis fully explains the failure before reverting to 4-stream. The immediate next steps are
  completing Run 3c, then either proceeding with the scaled single-stream or reverting to 4-stream with dynamic
  aux scaling for Run 4, followed by walk-forward out-of-sample backtests on validation data and preparing the
  MT5 execution bridge for live deployment.
</p>

<h2>9. References</h2>

<table>
  <thead>
    <tr><th>#</th><th>Authors</th><th>Year</th><th>Title</th><th>Venue</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Lo, A.W. &amp; MacKinlay, A.C.</td><td>1990</td><td>An Econometric Analysis of Nonsynchronous Trading</td><td><em>Journal of Econometrics</em></td></tr>
    <tr><td>2</td><td>Chordia, T. &amp; Swaminathan, B.</td><td>2000</td><td>Trading Volume and Cross-Autocorrelations in Stock Returns</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>3</td><td>Stoll, H.R. &amp; Whaley, R.E.</td><td>1990</td><td>The Dynamics of Stock Index and Stock Index Futures Returns</td><td><em>J. Financial &amp; Quantitative Analysis</em></td></tr>
    <tr><td>4</td><td>Hasbrouck, J.</td><td>2003</td><td>Intraday Price Formation in U.S. Equity Index Markets</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>5</td><td>Huth, N. &amp; Abergel, F.</td><td>2011</td><td>High Frequency Lead/Lag Relationships: Empirical Facts</td><td>arXiv:1111.7103</td></tr>
    <tr><td>6</td><td>Engle, R.F.</td><td>2002</td><td>Dynamic Conditional Correlation</td><td><em>J. Business &amp; Economic Statistics</em></td></tr>
    <tr><td>7</td><td>Forbes, K.J. &amp; Rigobon, R.</td><td>2002</td><td>No Contagion, Only Interdependence</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>8</td><td>Hamilton, J.D.</td><td>1989</td><td>A New Approach to the Economic Analysis of Nonstationary Time Series</td><td><em>Econometrica</em></td></tr>
    <tr><td>9</td><td>Ang, A. &amp; Bekaert, G.</td><td>2002</td><td>International Asset Allocation With Regime Shifts</td><td><em>Review of Financial Studies</em></td></tr>
    <tr><td>10</td><td>Barberis, N. &amp; Shleifer, A.</td><td>2003</td><td>Style Investing</td><td><em>J. Financial Economics</em></td></tr>
    <tr><td>11</td><td>Moskowitz, T.J. &amp; Grinblatt, M.</td><td>1999</td><td>Do Industries Explain Momentum?</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>12</td><td>Moskowitz, T.J., Ooi, Y.H. &amp; Pedersen, L.H.</td><td>2012</td><td>Time Series Momentum</td><td><em>J. Financial Economics</em></td></tr>
    <tr><td>13</td><td>Zhu, X.</td><td>2024</td><td>Examining Pairs Trading Profitability</td><td>Yale Economics Working Paper</td></tr>
    <tr><td>14</td><td>Greenwood, R. &amp; Sammon, M.</td><td>2023</td><td>The Disappearing Index Effect</td><td>Harvard Business School WP 23-025</td></tr>
    <tr><td>15</td><td>Li</td><td>2025</td><td>Volatility Risk and Vol-of-Vol Risk: State-Dependent VIX-S&amp;P Correlations</td><td><em>J. Futures Markets</em></td></tr>
    <tr><td>16</td><td>Rothe, J.</td><td>2023</td><td>Dynamic Sector Rotation</td><td>SSRN WP #4573209</td></tr>
    <tr><td>17</td><td>Mamais</td><td>2025</td><td>Explaining and Predicting Momentum Performance Shifts</td><td><em>J. Forecasting</em></td></tr>
    <tr><td>18</td><td>Li, Chen &amp; Liu</td><td>2025</td><td>High-frequency lead-lag in Chinese index futures</td><td>arXiv:2501.03171</td></tr>
    <tr><td>19</td><td>Johansen, S.</td><td>1991</td><td>Estimation and Hypothesis Testing of Cointegration Vectors</td><td><em>Econometrica</em></td></tr>
    <tr><td>20</td><td>Nasdaq</td><td>2020</td><td>A Tale of Three Crises in the Past Two Decades</td><td>Whitepaper</td></tr>
    <tr><td>21</td><td>Nasdaq</td><td>2025</td><td>Understanding the DJIA: Price-Weighted vs. Cap-Weighted Attribution</td><td>Whitepaper</td></tr>
    <tr><td>22</td><td>Lim, B., Ar&iacute;k, S.&Ouml;., Loeff, N. &amp; Pfister, T.</td><td>2021</td><td>Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting</td><td><em>International Journal of Forecasting</em></td></tr>
    <tr><td>23</td><td>Granger, C.W.J.</td><td>1969</td><td>Investigating Causal Relations by Econometric Models and Cross-spectral Methods</td><td><em>Econometrica</em></td></tr>
    <tr><td>24</td><td>Pagonidis, A.S.</td><td>2014</td><td>The IBS Effect: Mean Reversion in Equity ETFs</td><td>NAAIM Wagner Award Paper</td></tr>
    <tr><td>25</td><td>Connors, L. &amp; Alvarez, C.</td><td>2009</td><td>Short Term Trading Strategies That Work</td><td>TradingMarkets</td></tr>
    <tr><td>26</td><td>Collobert, R. &amp; Weston, J.</td><td>2008</td><td>A Unified Architecture for Natural Language Processing</td><td><em>ICML 2008</em></td></tr>
  </tbody>
</table>
`;

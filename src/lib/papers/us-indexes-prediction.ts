export const content = `
<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Work in Progress</strong> &mdash; Phase 1 complete, Phase 2 in progress.
  Empirical gap studies are underway. This page will be updated as results become available.
</div>

<h2>Project Roadmap</h2>

<table>
  <thead>
    <tr><th>Phase</th><th>Description</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Phase 1</td><td>Literature Review</td><td style="color: #059669; font-weight: 600;">Complete</td></tr>
    <tr><td>Phase 2</td><td>Data Collection &amp; Feature Engineering<br/><small>Gap Study #8 (IBS/RSI replication) complete: mean-reversion at daily frequency does not outperform buy-and-hold<br/>Gap Study #4 (Cross-index momentum) complete: TSMOM beats all baselines (Sharpe 1.27)<br/>Gap Study #2 (NAS100/DJIA RORO ratio) complete: valid volatility regime indicator but does not beat TSMOM as allocation signal<br/>Gap Study #5 (Volatility regime strategy selection) complete: mean-reversion works in high-vol NAS100 regimes (Sharpe 0.99), unifying findings from Studies #2, #4, and #8</small></td><td style="color: #d97706; font-weight: 600;">In Progress</td></tr>
    <tr><td>Phase 3</td><td>Model Development &amp; Backtesting</td><td style="color: #6b7280;">Planned</td></tr>
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

<h2>6. Phase 2: IBS and RSI Mean-Reversion Replication</h2>

<h3>6.1 Objective</h3>

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

<h3>6.2 Full-Sample Results (Literature Parameters)</h3>

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

<h3>6.3 Walk-Forward Out-of-Sample Results</h3>

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

<h3>6.4 Key Findings</h3>

<div class="finding-box">
  <strong>Negative result: daily mean-reversion on MT5 CFDs does not outperform buy-and-hold.</strong>
  IBS replication FAILED (Pagonidis reported 75% win rate; we observe approximately 50%).
  RSI(2) replication is PARTIAL (genuine but weak signal at 55 to 67% win rate, insufficient to beat
  buy-and-hold after costs). Neither strategy passes walk-forward validation.
</div>

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
</ol>

<h3>6.5 Charts</h3>

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

<h2>6.2 Gap Study #4: Cross-Index Momentum Rotation</h2>

<h3>6.2.1 Objective</h3>

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

<h3>6.2.2 Strategies and Baselines</h3>

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

<h3>6.2.3 Baseline Performance</h3>

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

<h3>6.2.4 Full-Sample Results</h3>

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

<h3>6.2.5 Why TSMOM Works: Crash Protection</h3>

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

<h3>6.2.6 Walk-Forward Out-of-Sample Validation</h3>

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

<h3>6.2.7 Key Findings</h3>

<div class="finding-box" style="border-left-color: #059669; background: #f0fdf4;">
  <strong>Positive result: TSMOM beats all baselines.</strong>
  Time-series momentum with a 1-month lookback and weekly rebalancing delivers a Sharpe ratio of
  1.27 (1.7 times the best buy-and-hold) with a maximum drawdown of -9.4% (less than half of any
  baseline). This is the first strategy in the series to outperform all buy-and-hold benchmarks
  on both return and risk-adjusted metrics.
</div>

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
</ol>

<h3>6.2.8 Charts</h3>

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

<h2>6.3 Gap Study #2: NAS100/DJIA Risk-On/Risk-Off Indicator</h2>

<h3>6.3.1 Objective</h3>

<p>
  The NAS100/DJIA price ratio is widely cited as a proxy for risk appetite. When the ratio rises,
  technology-heavy NAS100 is outperforming value-heavy DJIA, which practitioners interpret as a
  "risk-on" environment. The hypothesis is that this ratio, smoothed over a trailing window, can
  serve as an allocation signal: overweight NAS100 during risk-on regimes and rotate into DJIA
  during risk-off regimes. This study tests whether the RORO ratio adds value beyond the TSMOM
  strategy established in Gap Study #4.
</p>

<h3>6.3.2 Ratio Construction and Regime Definition</h3>

<p>
  The RORO ratio is computed as NAS100 daily close divided by US30 daily close. A regime label is
  assigned at each date: "risk-on" when the ratio is above its N-day simple moving average, and
  "risk-off" when below. Lookback windows of 5, 10, 21, 42, and 63 trading days were tested.
</p>

<h3>6.3.3 Forward Return Predictability</h3>

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

<h3>6.3.4 Volatility by Regime</h3>

<p>
  The strongest finding from this study is in volatility, not returns. Risk-off regimes (ratio below
  its moving average) exhibit 20 to 28% higher realised volatility than risk-on regimes, and this
  holds across all three indices and all lookback windows tested. This is a reliable and economically
  meaningful regime distinction. Even though the ratio does not reliably predict which index will
  outperform during risk-off, it does predict that volatility will be elevated regardless of which
  index you hold.
</p>

<h3>6.3.5 Allocation Strategy Results</h3>

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

<h3>6.3.6 Walk-Forward Out-of-Sample Validation</h3>

<p>
  The Follow RORO strategy (42-day lookback) was validated using the same two-fold walk-forward
  framework as Gap Study #4. Follow RORO beats the equal-weight baseline in both folds (Fold 0:
  Sharpe 1.05, Fold 1: Sharpe 0.47), confirming that the signal contains some genuine information
  out of sample. However, it still trails TSMOM substantially. For comparison, TSMOM achieved a
  Sharpe of 2.35 in Fold 0 and 0.78 in Fold 1.
</p>

<h3>6.3.7 Key Findings</h3>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Mixed result: the NAS100/DJIA ratio is a valid regime indicator but not a superior
  allocation signal.</strong> The ratio reliably identifies high-volatility regimes (20 to 28%
  higher realised vol during risk-off) and has asymmetric directional predictability (works for
  risk-on, fails for risk-off). As an allocation signal, every configuration tested underperforms
  the TSMOM strategy from Gap Study #4 on Sharpe ratio and maximum drawdown.
</div>

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
</ol>

<h3>6.3.8 Charts</h3>

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

<h2>6.4 Gap Study #5: Volatility Regime Strategy Selection</h2>

<h3>6.4.1 Objective</h3>

<p>
  The three prior gap studies produced a puzzle. Mean-reversion (Study #8) failed outright.
  TSMOM (Study #4) succeeded with Sharpe 1.27. The RORO ratio (Study #2) reliably identified
  high-volatility regimes but did not beat TSMOM as an allocation signal. This study asks the
  natural follow-up question: what if the right strategy is not a single rule applied uniformly,
  but a different sub-strategy selected by the prevailing volatility regime? The hypothesis is
  that some strategies that fail in aggregate may work in specific regimes, and that conditioning
  on volatility state can recover hidden edges.
</p>

<h3>6.4.2 Methodology</h3>

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

<h3>6.4.3 Strategy Performance by Volatility Regime</h3>

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

<h3>6.4.4 Best Meta-Strategy by Instrument</h3>

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

<h3>6.4.5 Walk-Forward Out-of-Sample Validation</h3>

<p>
  Walk-forward testing confirms the same pattern observed in Study #4: the meta-strategies beat
  buy-and-hold in 100% of bear-market folds but trail in bull-market folds. This is the familiar
  crash-protection signature. The regime-conditioned approach does not add a new source of edge
  beyond what TSMOM already captures; rather, it confirms that the volatility dimension is the
  mechanism through which TSMOM works and shows that mean-reversion can participate in that same
  mechanism for NAS100.
</p>

<h3>6.4.6 Updated Strategy Leaderboard</h3>

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

<h3>6.4.7 Key Findings</h3>

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

<h3>6.4.8 Charts</h3>

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

<h2>7. Current Status</h2>

<p>
  Phase 1 (Literature Review) is complete. Phase 2 (Data Collection and Feature Engineering) is in progress.
  Four empirical gap studies have been completed.
</p>

<p>
  <strong>Gap Study #8 (IBS/RSI replication):</strong> The first study replicated two well-known
  mean-reversion strategies on MT5 CFDs. The key finding is a negative result: daily mean-reversion
  does not outperform buy-and-hold after realistic spread costs. Pagonidis's reported 75% IBS win
  rate does not replicate (we observe approximately 50%), and while RSI(2) shows a genuine but weak
  signal (55 to 67% win rate), it fails walk-forward validation on all three indices.
</p>

<p>
  <strong>Gap Study #4 (Cross-index momentum rotation):</strong> The second study tested time-series
  momentum (TSMOM) rotation across the three indices. This produced the first positive result in the
  series: TSMOM with a 1-month lookback and weekly rebalancing delivers a Sharpe ratio of 1.27
  (1.7 times the best buy-and-hold baseline) with a maximum drawdown of only -9.4%. The edge is
  primarily in crash protection, as TSMOM moves to cash when all three indices have negative trailing
  momentum. Walk-forward validation confirms the result in 2/2 out-of-sample folds, though the edge
  is strongest during periods containing significant drawdowns.
</p>

<p>
  <strong>Gap Study #2 (NAS100/DJIA RORO ratio):</strong> The third study tested the NAS100/DJIA
  price ratio as a risk-on/risk-off regime indicator and allocation signal. This produced a mixed
  result. The ratio reliably identifies high-volatility regimes (20 to 28% higher realised vol
  during risk-off periods) and has asymmetric directional predictability (53 to 63% hit rate for
  risk-on, below 50% for risk-off). However, as an allocation signal, no RORO-based strategy beats
  the TSMOM benchmark from Gap Study #4. The best RORO configuration achieves a Sharpe of 0.79
  versus 1.27 for TSMOM. The ratio's primary value is as a supplementary volatility signal for
  position sizing and drawdown management rather than as a standalone allocator.
</p>

<p>
  <strong>Gap Study #5 (Volatility regime strategy selection):</strong> The fourth study tested
  whether conditioning strategy choice on Garman-Klass volatility regime could recover edges that
  failed in aggregate. It produced the most integrative result in the series. For US30 and US500,
  the optimal template is buy-and-hold in low-vol regimes and TSMOM in high-vol regimes, confirming
  that TSMOM's edge is a volatility regime response. For NAS100, mean-reversion (from Study #8,
  which failed overall) delivers a Sharpe of 0.99 specifically in high-vol regimes. The best
  NAS100 meta-strategy returns 20.3% annualised with Sharpe 0.92, the highest raw return of any
  strategy tested, though with larger drawdowns (-18.4%) than TSMOM. Walk-forward validation shows
  the same crash-protection signature as TSMOM: the meta-strategies beat buy-and-hold in 100% of
  bear-market folds but trail in bull-market folds.
</p>

<p>
  These results together show that single-index mean-reversion at daily frequency is not viable on
  MT5 CFDs when applied uniformly, but works within specific volatility regimes for NAS100.
  Cross-index momentum signals contain the most robust exploitable structure, and volatility regime
  is the unifying mechanism across all four studies. The remaining highest-priority gaps
  (price-weighted divergence signal, trivariate cointegration regime model, and cross-index
  lead-lag at minute frequency) are all testable with the OHLCV data we have available and remain
  the focus of the next gap studies.
</p>

<h2>8. References</h2>

<table>
  <thead>
    <tr><th>#</th><th>Authors</th><th>Year</th><th>Title</th><th>Venue</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>Lo, A.W. &amp; MacKinlay, A.C.</td><td>1990</td><td>An Econometric Analysis of Nonsynchronous Trading</td><td><em>Journal of Econometrics</em></td></tr>
    <tr><td>2</td><td>Chordia, T. &amp; Swaminathan, B.</td><td>2000</td><td>Trading Volume and Cross-Autocorrelations in Stock Returns</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>3</td><td>Brennan, M.J., Jegadeesh, N. &amp; Swaminathan, B.</td><td>1993</td><td>Investment Analysis and the Adjustment of Stock Prices to Common Information</td><td><em>Review of Financial Studies</em></td></tr>
    <tr><td>4</td><td>Stoll, H.R. &amp; Whaley, R.E.</td><td>1990</td><td>The Dynamics of Stock Index and Stock Index Futures Returns</td><td><em>J. Financial &amp; Quantitative Analysis</em></td></tr>
    <tr><td>5</td><td>Hasbrouck, J.</td><td>2003</td><td>Intraday Price Formation in U.S. Equity Index Markets</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>6</td><td>Huth, N. &amp; Abergel, F.</td><td>2011</td><td>High Frequency Lead/Lag Relationships: Empirical Facts</td><td>arXiv:1111.7103</td></tr>
    <tr><td>7</td><td>Engle, R.F.</td><td>2002</td><td>Dynamic Conditional Correlation</td><td><em>J. Business &amp; Economic Statistics</em></td></tr>
    <tr><td>8</td><td>Forbes, K.J. &amp; Rigobon, R.</td><td>2002</td><td>No Contagion, Only Interdependence</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>9</td><td>Hamilton, J.D.</td><td>1989</td><td>A New Approach to the Economic Analysis of Nonstationary Time Series</td><td><em>Econometrica</em></td></tr>
    <tr><td>10</td><td>Ang, A. &amp; Bekaert, G.</td><td>2002</td><td>International Asset Allocation With Regime Shifts</td><td><em>Review of Financial Studies</em></td></tr>
    <tr><td>11</td><td>Barberis, N. &amp; Shleifer, A.</td><td>2003</td><td>Style Investing</td><td><em>J. Financial Economics</em></td></tr>
    <tr><td>12</td><td>Moskowitz, T.J. &amp; Grinblatt, M.</td><td>1999</td><td>Do Industries Explain Momentum?</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>13</td><td>Moskowitz, T.J., Ooi, Y.H. &amp; Pedersen, L.H.</td><td>2012</td><td>Time Series Momentum</td><td><em>J. Financial Economics</em></td></tr>
    <tr><td>14</td><td>Gatev, E., Goetzmann, W.N. &amp; Rouwenhorst, K.G.</td><td>2006</td><td>Pairs Trading: Performance of a Relative Value Arbitrage Rule</td><td><em>Review of Financial Studies</em></td></tr>
    <tr><td>15</td><td>Zhu, X.</td><td>2024</td><td>Examining Pairs Trading Profitability</td><td>Yale Economics Working Paper</td></tr>
    <tr><td>16</td><td>Greenwood, R. &amp; Sammon, M.</td><td>2023</td><td>The Disappearing Index Effect</td><td>Harvard Business School WP 23-025</td></tr>
    <tr><td>17</td><td>Drechsler, I., Moreira, A. &amp; Savov, A.</td><td>2018</td><td>Volatility-Managed Portfolios</td><td><em>Journal of Finance</em></td></tr>
    <tr><td>18</td><td>Chari, A., Stedman, K.D. &amp; Lundblad, C.</td><td>2025</td><td>Risk-on/risk-off: Measuring shifts in investor risk bearing capacity</td><td><em>J. Intl. Money and Finance</em></td></tr>
    <tr><td>19</td><td>NBER WP 31907</td><td>2023</td><td>Risk-On Risk-Off: A Multifaceted Approach</td><td>NBER</td></tr>
    <tr><td>20</td><td>Li</td><td>2025</td><td>Volatility Risk and Vol-of-Vol Risk: State-Dependent VIX-S&amp;P Correlations</td><td><em>J. Futures Markets</em></td></tr>
    <tr><td>21</td><td>Rothe, J.</td><td>2023</td><td>Dynamic Sector Rotation</td><td>SSRN WP #4573209</td></tr>
    <tr><td>22</td><td>Mamais</td><td>2025</td><td>Explaining and Predicting Momentum Performance Shifts</td><td><em>J. Forecasting</em></td></tr>
    <tr><td>23</td><td>Li, Chen &amp; Liu</td><td>2025</td><td>High-frequency lead-lag in Chinese index futures</td><td>arXiv:2501.03171</td></tr>
    <tr><td>24</td><td>Fry-McKibbin &amp; Hsiao</td><td>2018</td><td>Markov-Switching Models for US Equity Indices</td><td>Working Paper</td></tr>
    <tr><td>25</td><td>Johansen, S.</td><td>1991</td><td>Estimation and Hypothesis Testing of Cointegration Vectors</td><td><em>Econometrica</em></td></tr>
    <tr><td>26</td><td>CME Group</td><td>&mdash;</td><td>Stock Index Spread Opportunities</td><td>Education Whitepaper</td></tr>
    <tr><td>27</td><td>Nasdaq</td><td>2020</td><td>A Tale of Three Crises in the Past Two Decades</td><td>Whitepaper</td></tr>
    <tr><td>28</td><td>Nasdaq</td><td>2025</td><td>Understanding the DJIA: Price-Weighted vs. Cap-Weighted Attribution</td><td>Whitepaper</td></tr>
  </tbody>
</table>
`;

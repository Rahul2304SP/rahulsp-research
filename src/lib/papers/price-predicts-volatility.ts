export const content = `
<h2>1. What we were actually trying to do</h2>

<h3>1.1 The goal was direction</h3>

<p>
  This project started with a simple, greedy ambition: forecast which way the Dow (US30) would move next.
  Not how much, not when, just the sign of the next move over the coming hour. If you can call direction
  even slightly better than a coin, the rest of a trading system is engineering. So we spent a long time on
  the hard part, the forecast itself.
</p>

<p>
  We built a feature set of 106 inputs (described in Section 2), trained gradient-boosted trees on the
  forward return, and ran the whole thing through a leak-proof, monthly-expanding walk-forward. When the
  60-minute target did not work, we tried 30, 120, and 240 minutes. When intraday did not work, we tried
  daily and multi-day horizons. When trees did not work, we tried a linear model and a neural network. We
  re-labelled, re-weighted, and re-tuned.
</p>

<p>
  Every road led to the same place: a profit factor of almost exactly 1.0. The equity curve neither climbed
  nor collapsed. It drifted, trade after trade, around break-even. For a long time we read that as an
  engineering failure, the wrong loss function or a stop placed a few points too tight, and kept tuning.
  That was the mistake, and this study is the correction.
</p>

<h3>1.2 A flat curve has five different causes</h3>

<p>
  A profit factor of 1.0 is not one diagnosis, it is five, and each one calls for a completely different
  response:
</p>

<ol>
  <li><strong>No information.</strong> The features genuinely cannot predict the target. Stop.</li>
  <li><strong>Wrong target.</strong> The features carry real information, but about something other than what we are betting on.</li>
  <li><strong>Model limitation.</strong> The information is there, but the learner cannot extract it.</li>
  <li><strong>Cost-bound.</strong> A real edge exists gross, but the spread eats it.</li>
  <li><strong>Regime-local.</strong> An edge lives in one regime and is averaged away by the rest.</li>
</ol>

<p>
  You cannot tell these apart from a PnL curve, because all five produce the same flat line. So we put the
  trade engine aside and asked a narrower, more honest question: does the signal exist at all, and if it
  does, what is it a signal of? The rest of this paper is that diagnosis.
</p>

<div class="finding-box">
  <strong>Central finding.</strong> On US30, our feature set predicts <strong>volatility</strong> with a
  rank correlation of 0.70 out-of-sample (36 standard deviations above a shuffled-label null) and predicts
  <strong>direction</strong> essentially not at all (rank correlation 0.009, directional accuracy 50.8%,
  indistinguishable from a coin flip). We were not running a broken forecaster. We were running a working
  forecaster pointed at the wrong question.
</div>

<h3>1.3 Why this generalises beyond one instrument</h3>

<p>
  The result is not a quirk of the Dow. It restates, in measured terms, one of the oldest stylised facts in
  quantitative finance: returns are very close to a martingale, while their second moment, volatility, is
  strongly autocorrelated and forecastable (Cont, 2001). The contribution here is the discipline of the
  test, an engine-independent battery that separates "we found no edge" from "there is no edge to find," and
  reports the statistical power it had to tell the two apart.
</p>

<h2>2. The data and the features</h2>

<h3>2.1 Everything here is public, and most of it is price</h3>

<p>
  One point matters before any result: nothing in this feature set is exotic or proprietary. Every input is
  derived from <strong>publicly available data</strong> that a retail desk can pull for free, and the large
  majority of the 106 features are functions of the <strong>price series itself</strong>. There is no order
  flow, no signed volume, no dealer-gamma positioning, no paid alternative data. The feature set is, roughly:
</p>

<table>
  <tr><th>Group</th><th>Share</th><th>Examples</th><th>Source</th></tr>
  <tr><td>Price-derived (the bulk)</td><td>~75%</td><td>multi-scale returns, distance from moving averages, acceleration, efficiency ratio, RSI, realised volatility and ATR, Hurst and fractal dimension, candle geometry, KMeans support/resistance levels, time-of-day encodings</td><td>the US30 price feed</td></tr>
  <tr><td>Cross-asset</td><td>~15%</td><td>dollar-index return, S&amp;P 500 and NASDAQ-100 moves, US30/US500 and US30/NAS100 log spreads, relative strength, a risk-on/risk-off ratio, Brent</td><td>public price feeds</td></tr>
  <tr><td>Macro</td><td>~10%</td><td>yield-curve slope (10y minus 2y), 5y and 10y breakeven inflation, high-yield credit spread, changes in the 10y, initial jobless claims, unemployment</td><td>FRED (free)</td></tr>
</table>

<p>
  This composition is the whole point. If a rich set of public, mostly price-based features cannot find
  direction on one of the most liquid instruments in the world, that tells you something about where
  directional information is <em>not</em>: it is not sitting in another transform of the price path. We come
  back to that in Section 10.
</p>

<h3>2.2 The causal frame</h3>

<p>
  Every number in this study is computed out-of-sample on a <strong>causal</strong> feature frame: the exact
  data the live system would have seen at decision time, with no information from the future leaking
  backwards. This matters because the same pipeline, in an earlier and leakier form, produced spectacular
  backtests, profit factors above 4, that evaporated the moment a single family of features was correctly
  lagged. Twelve daily-level features had been mapping the completed day's close onto every intraday bar of
  that same day, which is a direction oracle, not a feature. Once we applied a one-period shift,
  $x_t \\rightarrow x_{t-1}$, to every completed-period aggregate, the apparent edge collapsed to noise. That
  episode is why this study exists, and why we trust its nulls: the harness was caught manufacturing a fake
  edge once, and we have since instrumented it to catch itself.
</p>

<h3>2.3 The walk-forward</h3>

<p>
  We use a monthly-expanding walk-forward over US30 minute bars: train on all data up to the start of a
  calendar month, predict that month out-of-sample, then roll forward and expand the training window. This
  yields <strong>16 out-of-sample folds and 438,619 out-of-sample minute bars</strong>. Normalisation
  statistics are fit only on each fold's training window, so the test is live-consistent.
</p>

<h3>2.4 Scale-free metrics, judged before PnL</h3>

<p>
  We judge the signal with scale-free statistics rather than currency, because PnL conflates signal quality
  with sizing, stops, and costs. The primary metric is the Spearman rank information coefficient between the
  prediction and the realised forward value,
</p>

<p style="text-align:center;">
  $\\text{IC} = \\rho_{\\text{Spearman}}(\\hat{y},\\, y_{\\text{fwd}})$,
</p>

<p>
  alongside directional accuracy and the Mann&ndash;Whitney AUC of the prediction against the sign of the
  forward move. An IC of 0, an accuracy of 50%, and an AUC of 0.50 all mean no edge.
</p>

<h3>2.5 Reporting the power of the test</h3>

<p>
  A null result is only meaningful if the test could have detected an edge. We therefore report the
  <strong>minimum detectable IC at 80% power</strong>, computed from the standard error of a permutation
  null on the de-overlapped (thinned) series,
</p>

<p style="text-align:center;">
  $\\text{MDE} = (z_{0.975} + z_{0.80}) \\cdot \\text{SE}_{\\text{null}} \\approx 2.80 \\cdot \\text{SE}_{\\text{null}}$.
</p>

<p>
  To keep observations independent we thin the minute series by the 60-bar horizon before computing
  significance, so the effective sample for the direction test is 7,310 non-overlapping observations rather
  than the full 438,619 bars. This keeps the error bars honest and the nulls conservative.
</p>

<h2>3. Direction does not survive the test</h2>

<p>
  The deployed model is a gradient-boosted tree (LightGBM) trained on the 60-minute forward return, exactly
  the target the live bot bets on. Out-of-sample, across all 16 folds:
</p>

<table>
  <tr><th>Metric</th><th>Value</th><th>No-edge reference</th></tr>
  <tr><td>Spearman IC (direction)</td><td>+0.0092</td><td>0</td></tr>
  <tr><td>Directional accuracy</td><td>50.79%</td><td>50%</td></tr>
  <tr><td>Mann&ndash;Whitney AUC</td><td>0.5043</td><td>0.50</td></tr>
  <tr><td>Thinned IC (95% CI)</td><td>+0.0077 &nbsp;[&minus;0.0159, +0.0303]</td><td>CI contains 0</td></tr>
  <tr><td>Permutation p-value</td><td>0.515</td><td>0.50 expected</td></tr>
</table>

<p>
  The confidence interval straddles zero, the permutation p-value is 0.515 (a coin flip), and the point
  estimate sits in the dead centre of its own null distribution. There is no directional edge here to
  refine, tune, or re-weight.
</p>

<p>
  We also report what the test <em>could</em> have seen. The minimum detectable IC at 80% power is
  <strong>0.033</strong>, so this experiment rules out any directional edge larger than about 0.033 but
  cannot rule out a vanishingly small one (a caveat we return to in Section 11). The honest statement is not
  "direction is provably random," it is "any directional signal in these features is smaller than the noise
  floor of a very large, very clean test."
</p>

<img src="/charts/signal-diagnosis/study_targets_and_null.png" alt="Left: out-of-sample IC by target, with direction targets near zero and the volatility target far above. Right: the observed 60-minute direction IC sitting in the centre of its permutation null." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
<p class="figure-caption">
  Figure 1: (Left) Out-of-sample Spearman IC by prediction target. The four directional return targets are
  pinned to the zero line; the volatility and absolute-move targets stand far above the dashed noise floor.
  (Right) The observed 60-minute direction IC (+0.0077) falls in the middle of its 2,000-draw permutation
  null, the definition of no signal. Raw output of the diagnosis harness.
</p>

<h2>4. It is not the model's fault</h2>

<p>
  If a tree cannot find direction, perhaps a different functional form can. We ran a linear model (ridge
  regression) and a neural network (a small multi-layer perceptron) on the identical target and folds:
</p>

<table>
  <tr><th>Model</th><th>IC</th><th>Directional accuracy</th><th>AUC</th></tr>
  <tr><td>LightGBM (deployed)</td><td>+0.0092</td><td>50.79%</td><td>0.5043</td></tr>
  <tr><td>Ridge (linear)</td><td>+0.0204</td><td>51.29%</td><td>0.5109</td></tr>
  <tr><td>MLP (neural net)</td><td>&minus;0.0003</td><td>50.48%</td><td>0.5029</td></tr>
</table>

<p>
  No learner separates from chance. The linear model is nominally the best, at an AUC of 0.511, which is
  itself telling: if anything were really there, you would not expect a plain ridge regression to edge out a
  tuned tree and a neural network. This rules out the model-limitation hypothesis. The flat line is an
  information problem, not an architecture problem.
</p>

<h2>5. No single feature carries direction either</h2>

<p>
  Maybe the model is diluting one good feature among 105 bad ones. So we bypassed the model and computed the
  univariate rank correlation of every individual feature against the 60-minute forward return, then applied
  a Benjamini&ndash;Hochberg false-discovery-rate control at $q = 0.05$ to guard against the fact that
  testing 106 features will throw up false positives by chance alone.
</p>

<div class="finding-box">
  <strong>0 of 106 features</strong> survive false-discovery control as individual predictors of direction.
  The single strongest feature reaches an absolute IC of just 0.029, below the 0.033 noise floor of the test.
</div>

<img src="/charts/signal-diagnosis/fig2_per_feature_ic.png" alt="Horizontal bar chart of the twelve strongest single features by absolute IC against the 60-minute forward return; none reaches the noise-floor line at 0.033." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
<p class="figure-caption">
  Figure 2: The twelve strongest individual features, ranked by absolute univariate IC against the
  60-minute forward return. Even the best, a US30/US500 spread and a 60-minute dollar-index return, fall
  short of the dashed noise floor, and none survive multiple-testing control.
</p>

<p>
  It is worth noting which features came closest: a cross-index spread, a dollar-index return, a
  risk-on/risk-off ratio, a yield-curve slope. These are the cross-asset and macro features, not the
  price-path features. At this effect size it is a hint rather than a finding, but it is the only direction
  the data points in, and we use it in Section 10.
</p>

<h2>6. Volatility, by contrast, is strongly predictable</h2>

<p>
  The same features, the same model, the same folds, re-pointed at realised forward volatility instead of
  direction, produce a completely different picture:
</p>

<table>
  <tr><th>Target</th><th>Kind</th><th>IC</th><th>AUC</th></tr>
  <tr><td>60-minute return</td><td>direction</td><td>+0.0092</td><td>0.5043</td></tr>
  <tr><td>120-minute return</td><td>direction</td><td>+0.0089</td><td>0.5051</td></tr>
  <tr><td>240-minute return</td><td>direction</td><td>+0.0105</td><td>0.5049</td></tr>
  <tr><td>60-minute absolute move</td><td>magnitude</td><td>+0.2470</td><td>0.6288</td></tr>
  <tr><td><strong>60-minute volatility</strong></td><td><strong>magnitude</strong></td><td><strong>+0.6955</strong></td><td><strong>0.8445</strong></td></tr>
</table>

<p>
  An IC of 0.70 and an AUC of 0.84 on forward volatility is not a marginal result; it is one of the
  strongest, cleanest signals in the whole programme. The features know almost exactly how much the market
  will move over the next hour. They simply have no idea which way.
</p>

<img src="/charts/signal-diagnosis/fig1_direction_vs_volatility.png" alt="Bar chart contrasting near-zero direction ICs with the 0.70 volatility IC." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
<p class="figure-caption">
  Figure 3: The whole study in one chart. Direction targets (grey) sit on the noise floor; magnitude
  targets (teal) tower above it. The volatility signal is 36 standard deviations above a shuffled-label
  null; the direction signal is 0.9, statistically invisible.
</p>

<h2>7. The harness is not lying to us</h2>

<p>
  A null is only trustworthy if the test can detect a signal when one is genuinely present. To prove the
  harness is not simply numb, we ran a <strong>label-shuffle retrain null</strong>: permute the training
  labels, retrain the model from scratch, and score it against the real out-of-sample labels. If the
  pipeline manufactures edge from noise, the shuffled model will score above zero. We repeat this 20 times
  and compare the real model to the resulting null band.
</p>

<table>
  <tr><th>Target</th><th>Real IC</th><th>Shuffle-null IC (mean &plusmn; sd)</th><th>z-score</th><th>Verdict</th></tr>
  <tr><td>60-minute return (direction)</td><td>+0.0090</td><td>+0.0016 &plusmn; 0.0081</td><td>+0.9</td><td>inside the null, no signal</td></tr>
  <tr><td>60-minute volatility</td><td>+0.6883</td><td>&minus;0.0033 &plusmn; 0.0190</td><td>+36.4</td><td>far outside, genuine signal</td></tr>
</table>

<img src="/charts/signal-diagnosis/study_shuffle_null.png" alt="Two histograms: for direction the real IC sits inside the shuffled-label null; for volatility it sits far to the right of it." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
<p class="figure-caption">
  Figure 4: Label-shuffle retrain null. (Left) The real direction IC (red line) sits inside the band of
  models trained on shuffled labels: the direction "edge" is the same edge a model trained on scrambled
  targets gets by chance. (Right) The real volatility IC is nowhere near the null. This is the control that
  makes the direction null trustworthy: the harness clearly detects signal when there is signal to detect.
</p>

<p>
  This is the single most important check in the study. The direction result is not "our model was too
  weak." A model trained on randomly scrambled targets does just as well. The volatility result, run through
  the identical machinery, lights up at 36 sigma. The instrument works; direction is simply not there.
</p>

<h2>8. It is not a horizon problem</h2>

<p>
  Intraday direction being unpredictable is unsurprising. The natural rejoinder is that direction lives at a
  slower frequency, that daily or multi-day moves are forecastable even if hourly ones are not. So we built
  a separate daily-bar test: 2,602 daily observations, 49 causal daily features (momentum, moving averages,
  RSI, realised vol, macro, VIX, cross-asset, seasonality), 34 expanding folds, averaged over three seeds.
</p>

<table>
  <tr><th>Horizon</th><th>Direction IC</th><th>Directional accuracy</th><th>Clears the bar?</th></tr>
  <tr><td>1 day</td><td>&minus;0.0099</td><td>50.50%</td><td>No</td></tr>
  <tr><td>3 days</td><td>&minus;0.0223</td><td>50.65%</td><td>No</td></tr>
  <tr><td>5 days</td><td>&minus;0.0109</td><td>51.10%</td><td>No</td></tr>
  <tr><td>10 days</td><td>&minus;0.0034</td><td>49.21%</td><td>No</td></tr>
  <tr><td>20 days</td><td>+0.0103</td><td>51.78%</td><td>No</td></tr>
</table>

<p>
  Not one horizon clears its significance bar. Forward volatility, meanwhile, stays predictable at the daily
  scale too (IC +0.29). Direction is unpredictable from price, macro, and seasonality at both ends of the
  frequency spectrum, from 60 minutes to 20 days.
</p>

<img src="/charts/signal-diagnosis/study_daily_horizons.png" alt="Left: daily direction IC across horizons, hugging zero inside the power band. Right: a naive sign-following equity curve in points, deeply negative for most of the sample." style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
<p class="figure-caption">
  Figure 5: (Left) Daily direction IC across horizons stays pinned inside the 80%-power band; the test would
  see an edge if one existed, and there is none. (Right) A naive sign-follower of the 5-day signal bleeds
  roughly 15,000 index points over the sample before clawing some back. The point is not the exact path but
  that there is no monotone, exploitable drift.
</p>

<div class="finding-box" style="border-left-color: #d97706; background: #fffbeb;">
  <strong>Disclaimer, simulated diagnostic, not live trading.</strong> The sign-following point totals in
  Figure 5 (right) and the gross-edge figures in Section 9 are frictionless arithmetic proxies computed from
  historical bars to characterise the <em>signal</em>, not records of a traded account. They assume
  idealised fills and do not model slippage, partial fills, or variable liquidity. They are included only to
  show that a directional rule built on these features has no economically meaningful gross edge to begin with.
</div>

<h2>9. And no regime rescues it</h2>

<p>
  The last escape hatch is that an edge hides in one regime and washes out on average. We stratified the
  out-of-sample direction signal by volatility tercile, by trading session, and by trend sign. The best
  single bucket, low-volatility bars, reached a directional accuracy of 51.13%, and in the high-volatility
  bucket the signal actually inverts (AUC 0.493). No regime carries a standalone edge worth gating on; the
  spread across buckets is the random scatter you would expect from slicing noise seven ways.
</p>

<p>
  Putting the economics on it: the frictionless gross edge of sign-following the deployed signal is
  <strong>+1.61 index points per trade</strong>, against a realistic round-trip spread of about
  <strong>2.0 points</strong>. Even before asking whether that 1.61 is statistically real (it is not), it is
  smaller than the cost of trading it. The gross profit factor is 1.058; after spread it is 0.986. This is
  what the genuine absence of information looks like once you finally corner it: not a catastrophe, just a
  slow bleed of the spread.
</p>

<h2>10. What this changed</h2>

<p>
  Of the five candidate causes, the evidence points at one: wrong target. The features are richly
  informative, about volatility and risk, not direction. So we changed what we do with the pipeline rather
  than how we tune it.
</p>

<ul>
  <li>
    <strong>We stopped training directional models on this feature set.</strong> A directional bot built on
    these features is mis-targeted by construction, and no loss function or architecture change repairs a
    target the data is silent on. That single conclusion retired a long backlog of "tune the model" work.
  </li>
  <li>
    <strong>We re-pointed the pipeline at what it predicts: volatility.</strong> An IC of 0.70 on forward
    vol is a bankable signal, just not a directional one. It now drives a risk throttle that scales exposure
    up when the next hour is predictably calm and down when it is predictably violent. We cannot bet on
    which way the coin lands, but we can bet on how hard, and that is enough to manage size and drawdown.
  </li>
  <li>
    <strong>When we look for direction again, we change the data, not the model.</strong> The features that
    came closest here were cross-asset and macro, not price transforms, so the next places we look are
    sources this study did not include, such as order flow and dealer positioning, rather than a 107th
    function of the same price path.
  </li>
</ul>

<h2>11. Limitations</h2>

<p>
  A null is only as strong as the test behind it, so three caveats. First, the intraday test is well-powered
  only down to an IC of 0.033; a real but tiny directional edge below that floor would be invisible here, and
  at high frequency even a tiny edge can be tradable if costs are low enough. Second, the daily test rests on
  only about 2,600 observations, so a small daily-momentum effect cannot be excluded; resolving it would need
  a multi-instrument panel or a longer history. Third, everything here is one instrument; the result echoes a
  broad stylised fact, but we have not re-run the full battery on every market. None of these touches the
  positive result: the volatility signal is large and survives every control.
</p>

<h2>12. Conclusion</h2>

<p>
  We set out to forecast the Dow's direction and spent a long time failing in a very specific way: a profit
  factor that sat at 1.0 no matter what we changed. The diagnosis explains the failure. These features know
  how much the Dow will move over the next hour and have no idea which way. That is not a modelling problem
  to be solved with a bigger network; it is a property of the market. Accepting it let us stop forecasting
  the unforecastable and put the same features to work on the part that is real: sizing and risk.
</p>

<h2>References</h2>

<ol>
  <li>Cont, R. (2001). Empirical properties of asset returns: stylized facts and statistical issues. <em>Quantitative Finance</em>, 1(2), 223&ndash;236.</li>
  <li>Benjamini, Y., &amp; Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach to multiple testing. <em>Journal of the Royal Statistical Society: Series B</em>, 57(1), 289&ndash;300.</li>
  <li>Andersen, T. G., Bollerslev, T., Diebold, F. X., &amp; Labys, P. (2003). Modeling and forecasting realized volatility. <em>Econometrica</em>, 71(2), 579&ndash;625.</li>
  <li>L&oacute;pez de Prado, M. (2018). <em>Advances in Financial Machine Learning</em>. Wiley.</li>
  <li>Bailey, D. H., &amp; L&oacute;pez de Prado, M. (2014). The deflated Sharpe ratio. <em>Journal of Portfolio Management</em>, 40(5), 94&ndash;107.</li>
</ol>
`;

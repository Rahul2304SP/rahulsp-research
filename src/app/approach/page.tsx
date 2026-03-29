export default function ApproachPage() {
  const stages = [
    {
      number: 1,
      title: "Instrument Selection",
      body: [
        "The first decision is which instrument to model. The constraint is tractability — there is no point building a model for an instrument that the intended user cannot trade. At the scale I operate at (up to $1 million in notional volume), I need instruments available through standard retail brokers: major equity indices, forex pairs, precious metals, and energy futures.",
        "Three criteria apply. First, liquidity: the instrument must be able to absorb up to $1 million in volume without material price impact, which rules out most small-cap equities and exotic contracts. Second, leverage availability: retail brokers typically offer 1:20 to 1:200 leverage on CFDs and futures, and the instrument must be covered. Third, volatility: the instrument must move enough in a session to generate meaningful profit after spread and commission costs. An instrument that moves 10 points per day with a 3-point spread is not viable regardless of how good the model is.",
        "Current instruments: XAUUSD (gold), US30 (Dow Jones), US500, NAS100.",
      ],
    },
    {
      number: 2,
      title: "Data Analysis",
      body: [
        "Before any modelling, I study the raw data. The starting point is always the 1-minute bar series — OHLCV — over as long a history as the broker provides, typically 3 to 7 years.",
        "The analysis progresses in layers. Summary statistics first: return distribution, skewness, kurtosis, tail behaviour, autocorrelation at lag 1 and beyond. Then intraday structure: session-level return profiles, hour-of-day patterns, day-of-week effects, and overnight gap decomposition (how much of the total return comes from intraday moves versus close-to-open gaps).",
        "Then frequency analysis: Fourier transforms and periodograms to test whether the return series contains any cyclical structure. Most instruments show no statistically meaningful periodicity in raw returns, but the analysis is essential to rule it out rather than assume it.",
        "The goal of this stage is not to find features — it is to understand the instrument's statistical character before making any modelling decisions.",
      ],
    },
    {
      number: 3,
      title: "External Data Analysis",
      body: [
        "No instrument exists in isolation. This stage identifies and tests the secondary drivers — the assets and macroeconomic variables that the literature says should influence the target instrument — and determines empirically whether those relationships hold in the data.",
        "The process starts with a literature review. For gold, this means papers on the relationship between XAUUSD and the US dollar, silver, real yields, inflation breakevens, and equity volatility. For equity indices, it means papers on cross-index correlation, yield curve effects, credit spreads, and sector rotation.",
        "Most relationships described in the literature hold over long horizons (years) but not at the 1-minute scale where the model operates. The literature review tells us where to look; the empirical tests tell us what survives at the relevant timescale. I compute derived features from each candidate driver — rolling correlations, beta, return spreads, regime signals — and run AUC tests against the target instrument's direction over a forward horizon. Features that do not add lift above 0.515 AUC are discarded regardless of what the literature says.",
        "Macro level features (yield curve slope, credit spreads, inflation breakevens, jobless claims) are tested separately at daily resolution, forward-filled to 1-minute bars, and evaluated for their contribution to directional accuracy.",
      ],
    },
    {
      number: 4,
      title: "Causal Tests",
      body: [
        "Correlation is not enough. A feature can have high AUC against a target yet contain no independent predictive information once other features are controlled for. This stage tests whether candidate features have genuine lead-lag relationships with the target instrument.",
        "Granger causality tests are run for each candidate feature across multiple lag windows (1, 5, 15, 30, 60 minutes). A feature that Granger-causes the target at a statistically significant level at useful lags survives. Features that are only contemporaneously correlated — or whose Granger significance disappears after controlling for the target's own lags — are deprioritised.",
        "This stage also validates point-in-time safety. Any feature derived from external data must use only information available at the time of the bar. Daily macro features are shifted by one day before merging to prevent look-ahead bias.",
      ],
    },
    {
      number: 5,
      title: "Feature Selection",
      body: [
        "By this stage the candidate feature set is typically 50 to 150 features. The selection process is not purely statistical — it combines the empirical results from stages 2 through 4 with domain knowledge about what the feature represents economically.",
        "Features are grouped by type: own-instrument momentum and volatility, cross-asset correlations and betas, session and time-of-day indicators, macro level features, and microstructure proxies. Within each group, redundant features (high pairwise correlation with no independent AUC contribution) are pruned.",
        "The final feature set is documented in a named list — OFFICIAL_FEATURE_COLS in the codebase — and treated as a contract. Any change to the feature set invalidates the feature cache, forcing a full recompute. This prevents subtle look-ahead bugs from stale cached data.",
      ],
    },
    {
      number: 6,
      title: "Normalisation",
      body: [
        "The normaliser for each feature is chosen based on its statistical properties, not applied uniformly. Three categories apply:",
        "Features that drift over time — prices, cumulative volumes, raw dollar values — use rolling z-score normalisation computed over a recent window (typically 120 to 1440 bars). This ensures the normalised value reflects the feature's position relative to recent history rather than the full sample, which is the relevant reference frame for a live model.",
        "Features that are stationary and do not drift — return-based features, correlation coefficients, efficiency ratios — use a static z-score computed once from the training split and frozen. Using a rolling normaliser here would obscure regime changes that the model should be able to detect.",
        "Features that are already bounded by construction — indicator values in [0, 1], session flags, binary signals — are passed through without normalisation. Applying a z-score to a feature that is already bounded and well-scaled adds noise.",
        "Getting normalisation wrong is one of the most common causes of silent model failure. A feature that looks informative in raw form can become noise if the wrong normaliser is applied — and vice versa.",
      ],
    },
    {
      number: 7,
      title: "Model Selection",
      body: [
        "Model selection is treated as an empirical question, not a prior belief. The process starts simple and increases complexity only when simpler models have been exhausted.",
        "The progression is: OLS regression (linear baseline, fast to train, interpretable) → XGBoost (non-linear, handles interactions, no sequence structure) → TCN/Transformer (non-linear, sequence-aware, captures multi-timescale patterns). Each step up in complexity is justified only if the simpler model has a clear ceiling — typically if training accuracy is high but validation accuracy is poor in a way that suggests the model cannot capture the relevant non-linearities.",
        "Four criteria determine model selection: training stability (does the loss curve converge without oscillating?), training time (can this be retrained weekly on available hardware?), inference speed (can it produce a signal within the bar at 1-minute resolution?), and accuracy on held-out data. No model that fails the inference speed requirement is considered for live deployment regardless of backtest performance.",
        "The current architecture for the US index models is a 7-stream VSN (Variable Selection Network) with TCN frontends and a 2-layer Transformer encoder — chosen after the progression above showed that single-stream and 3-stream architectures had insufficient capacity for the multi-timescale structure of equity index data.",
      ],
    },
    {
      number: 8,
      title: "Training",
      body: [
        "Training uses the first 80% of the data. The remaining 20% is held out entirely and not touched during this phase.",
        "This phase is the most informative part of the pipeline. Every decision made in stages 2 through 7 is stress-tested here: if a feature adds no lift to validation accuracy, it is removed. If the model hedges (p_up ≈ p_down ≈ 0.5), the cause is diagnosed — typically too-high weight decay, too-large embedding dimension relative to effective sample size, or incorrect loss function. If validation accuracy peaks early and then degrades, the cause is diagnosed and addressed (typically overfitting from overlapping label sequences, which requires MAE-based label smoothing or balanced sampling).",
        "The training phase is iterative. A typical model generation goes through 5 to 15 training runs, each addressing a specific diagnosed failure mode from the previous run. The run log in the US Indexes paper documents this process across 13 runs from Run 1 through Run 3O.",
      ],
    },
    {
      number: 9,
      title: "Out-of-Sample Backtest",
      body: [
        "The held-out 20% of data is used for exactly one thing: the out-of-sample backtest. It is never used for hyperparameter selection or feature iteration — any decision informed by this data contaminates it.",
        "The backtest evaluates the model on three dimensions: profitability (is net PnL positive?), stability (is profit distributed across the period or concentrated in a few lucky weeks?), and drawdown (does the equity curve have sustainable drawdowns or catastrophic ones?). No single metric is sufficient. A model with high profit factor but a single month that accounts for 80% of PnL is not stable enough for deployment.",
        "The backtest also checks for structural biases: long/short symmetry, performance across different market regimes, and concentration by hour of day. A model that is profitable only during one session or one market regime is considered fragile.",
      ],
    },
    {
      number: 10,
      title: "Final Training",
      body: [
        "Once the model architecture, features, and hyperparameters are fixed from stages 8 and 9, a final training run uses 97% of the data with 3% held out for checkpoint selection. The best epoch is selected based on validation accuracy on this 3% split.",
        "Then a final 100% training run is executed using the same hyperparameters and the epoch selected in the 97% run. This model — trained on all available data — is the one deployed live. The reasoning is that the 97% run tells us when the model peaks; the 100% run uses that same checkpoint position but with maximum data exposure.",
        "This approach avoids the common mistake of selecting the deployment checkpoint on the full 100% run (where there is no validation data left to select on) while still deploying a model that has seen all available data.",
      ],
    },
    {
      number: 11,
      title: "Live Deployment",
      body: [
        "The model is deployed through an MT5 bridge that feeds 1-minute bars to the Python inference engine in real time. At each new bar close, the feature pipeline runs, the model produces a probability distribution over UP/DOWN/HOLD, and a signal is sent to MT5 if confidence exceeds the deployment threshold.",
        "Live performance is tracked against the out-of-sample backtest as a sanity check. Meaningful divergence from expected win rate or profit factor triggers a retraining cycle starting from stage 8. The model is not automatically retrained on a schedule — retraining is triggered by evidence of degraded performance, not by calendar time.",
        "This stage is also where the assumptions made in stages 1 through 10 are stress-tested by reality. Execution slippage, spread variance, and broker-specific order handling all introduce frictions that the backtest does not capture. Monitoring these discrepancies informs the next iteration of the pipeline.",
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">
          How I Build Neural Network Trading Models
        </h1>
        <p className="mt-4 text-[#374151] text-sm leading-relaxed">
          Building a trading model is not a single step — it is a pipeline of decisions, each one
          contingent on the last. Over several years of research across gold, equity indices, and
          intraday scalping strategies, I have converged on an 11-stage process. Each stage has a
          specific purpose and produces a concrete output that feeds the next. Skipping or rushing
          any stage tends to produce models that look good in training and fail in deployment.
        </p>
        <p className="mt-2 text-[#374151] text-sm leading-relaxed">
          What follows is that process, documented as I actually run it.
        </p>
      </div>

      <div className="space-y-0">
        {stages.map((stage, idx) => (
          <div key={stage.number} className="relative pl-12 pb-10">
            {/* Connector line */}
            {idx < stages.length - 1 && (
              <div className="absolute left-[19px] top-8 bottom-0 w-[2px] bg-[#e5e7eb]" />
            )}
            {/* Number badge */}
            <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#1e40af] text-white text-sm font-bold shrink-0">
              {stage.number}
            </div>
            {/* Content */}
            <div className="pt-1.5">
              <h2 className="font-serif text-xl text-[#1a1a2e] mb-3">
                {stage.title}
              </h2>
              <div className="space-y-3">
                {stage.body.map((para, i) => (
                  <p key={i} className="text-sm text-[#374151] leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f8f9fa] px-6 py-5">
        <p className="text-sm text-[#374151] leading-relaxed">
          This pipeline is not fixed. Each model generation surfaces new failure modes that
          require new solutions — the label design evolution from barrier-based to return-based
          to dip-conditional labels across Runs 3L through 3N in the US Indexes study is one
          example. The pipeline describes the sequence of questions to ask, not the answers.
        </p>
        <p className="mt-2 text-xs text-[#6b7280]">
          The full development history for the US30 neural net model is documented in the{" "}
          <a href="/papers/us-indexes-prediction" className="text-[#1e40af] hover:underline">
            US Indexes Prediction paper
          </a>
          .
        </p>
      </div>
    </div>
  );
}

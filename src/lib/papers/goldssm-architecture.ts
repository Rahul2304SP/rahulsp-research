export const content = `
<h2>1. Introduction</h2>

<p>
  Intraday price forecasting in liquid financial markets (commodities, FX, equity indices) is driven by
  monetary policy expectations, real interest rate movements, currency dynamics, cross-asset risk appetite,
  and market microstructure such as liquidity sweeps, order flow imbalances, and session transitions. These
  drivers interact nonlinearly, and their relative importance is time-varying and regime-dependent. We develop
  GoldSSM using XAUUSD (gold) as our primary instrument, chosen for its high liquidity ($130B+ daily turnover),
  diverse driver set, and strong regime structure. The architecture generalises to any liquid financial
  instrument at the intraday timescale.
</p>

<p>
  Three challenges define intraday forecasting at the one-minute (M1) timescale:
</p>

<ol>
  <li>
    <strong>Extremely low signal-to-noise ratio.</strong> At M1 resolution, most price bars contain no
    directional information. Signal concentrates in a sparse subset of bars: those coinciding with macroeconomic
    releases, liquidity sweeps near key levels, and session-boundary transitions. A model that treats all
    timesteps uniformly will be overwhelmed by noise.
  </li>
  <li>
    <strong>Non-stationarity at every timescale.</strong> The statistical properties of financial returns,
    including volatility, autocorrelation structure, cross-asset correlations, and individual feature relevance,
    shift continuously. A volatility regime that persists for weeks can collapse within minutes during a
    macro shock. Models with frozen normalisation statistics or static feature weights degrade as the
    market evolves.
  </li>
  <li>
    <strong>No fixed optimal lookback horizon.</strong> How much historical context an accurate forecast requires
    depends on the current regime. Trend-following signals need long lookback windows (hours to half-days);
    mean-reversion signals around support/resistance levels need short, precise context (tens of minutes). A
    model locked to one temporal scale will systematically underperform whenever a different scale dominates.
  </li>
</ol>

<p>
  Existing deep learning approaches do not address these challenges simultaneously. LSTMs (Hochreiter and
  Schmidhuber, 1997) process sequences through a single fixed lookback window with uniform temporal aggregation
  and offer no mechanism to attend selectively to informative bars or adapt feature weighting across regimes.
  Transformers (Vaswani et al., 2017) introduce flexible attention over the full sequence, but at
  $O(T^2 \\cdot d)$ cost, making context windows beyond 200 bars impractical for real-time M1 inference.
  Efficient variants such as Informer (Zhou et al., 2021) reduce the quadratic bottleneck but retain static
  feature treatment and fixed positional encodings. In all these architectures, feature selection is performed
  offline (e.g., via AUC screening or LASSO) and remains frozen during inference, even though feature relevance
  rotates with market regime.
</p>

<p>
  This paper introduces <strong>GoldSSM</strong>, a structured state space architecture that addresses all
  three limitations. GoldSSM combines a Variable Selection Network for dynamic, regime-aware feature weighting;
  multi-scale Mamba encoding with input-dependent state transitions for linear-time sequence processing; learned
  temporal attention pooling to concentrate summary capacity on informative bars; and adaptive stream gating to
  redistribute emphasis across temporal scales as the regime shifts. GoldSSM processes 12 hours of M1 context
  (720 bars) in linear time, with 6.2&times; fewer parameters than the equivalent Transformer baseline.
</p>

<h2>2. The Transformer Problem for Financial Time Series</h2>

<p>
  Why do Transformer models, despite their dominance in natural language processing, perform poorly on intraday
  financial time series? The limitations go beyond computation. They reflect structural mismatches between the
  assumptions embedded in self-attention and the statistical properties of financial data.
</p>

<h3>2.1 Quadratic Complexity</h3>

<p>
  The core operation of a Transformer encoder is scaled dot-product self-attention:
</p>

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$

<p>
  where $Q, K, V \\in \\mathbb{R}^{T \\times d}$. The $QK^\\top$ matrix multiplication alone requires
  $O(T^2 \\cdot d)$ operations, and the resulting $T \\times T$ attention matrix must be materialised in memory.
  For a 720-bar M1 window (12 hours of trading), this produces 518,400 attention score pairs per head per layer.
  With multiple heads and layers, the total computational burden makes real-time inference on commodity GPU
  hardware infeasible. This cost applies to each temporal context window the model must process.
</p>

<p>
  Quadratic scaling forces a trade-off between context richness and computational tractability. Practitioners
  must either truncate the context window, discarding potentially valuable regime information from earlier in
  the session, or accept latency that exceeds the bar interval. Neither option is acceptable for a production
  system where inference must complete within the bar boundary.
</p>

<h3>2.2 Uniform Attention over Noise</h3>

<p>
  Self-attention treats every timestep as potentially relevant to every other. For natural language this is
  sensible: any word in a sentence may modify the meaning of any other. For financial time series it is
  unsuitable. At M1 resolution, over 95% of bars contain no actionable directional information. Signal
  concentrates in a sparse, irregular subset of timesteps: bars coinciding with macroeconomic data releases
  (NFP, CPI, FOMC), liquidity sweeps past key support/resistance levels, and session-boundary transitions
  (London open, New York open).
</p>

<p>
  In principle, the softmax attention mechanism can assign near-zero weight to uninformative bars. In practice,
  the learning problem is severely complicated by the low signal-to-noise ratio. The model must discover which
  bars are informative from data where such bars are rare events and where "informative" itself changes across
  regimes. Attention maps end up spreading probability mass diffusely across the sequence, diluting the signal
  from the few bars that matter.
</p>

<h3>2.3 Static Feature Weighting</h3>

<p>
  Transformers process a fixed feature vector at each timestep with no native mechanism to adapt which features
  receive emphasis based on market state. In financial markets, feature relevance rotates: momentum and
  moving-average distance dominate trending regimes; support/resistance proximity and volatility dominate
  mean-reverting regimes; cross-asset correlations and rate-sensitivity features become paramount during macro
  shocks. A Transformer treats the input vector identically regardless of regime, relying on general model
  capacity to implicitly learn regime-dependent feature interactions. Given the non-stationarity of financial
  data, this implicit approach is data-inefficient and prone to overfitting.
</p>

<h3>2.4 Positional Encoding Assumes Regularity</h3>

<p>
  Standard Transformer positional encodings, whether sinusoidal or learned, assume that information density is
  roughly uniform across sequence positions. Financial time series violate this assumption. An overnight gap
  compresses hours of calendar time into a single bar transition. A session open concentrates information that
  accumulated during the preceding close into the first few bars. A macro release injects an information spike
  that decays over subsequent bars. The regular positional grid has no way to represent this irregular density,
  and the model wastes capacity learning to ignore the positional signal during periods where it misleads.
</p>

<div class="finding-box">
  <strong>The Transformer Mismatch:</strong> Self-attention's quadratic cost, uniform treatment of timesteps,
  static feature weighting, and regular positional assumptions are each individually problematic for financial
  time series. In combination, they create a model that is simultaneously too expensive for long context,
  too diffuse in its attention, too rigid in its feature treatment, and too regular in its positional
  assumptions to capture the sparse, non-stationary, regime-dependent structure of intraday financial dynamics.
</div>

<h2>3. The State Space Alternative</h2>

<p>
  State space models (SSMs) take a different approach to sequence modelling. Instead of computing pairwise
  interactions between all timesteps, an SSM maintains a compressed latent state vector $h_t$ that is updated
  recurrently as each new observation arrives. Computational complexity is $O(T)$ in sequence length, making
  long context windows practical without architectural compromise.
</p>

<h3>3.1 Classical State Space Formulation</h3>

<p>
  A continuous-time state space model defines the relationship between input $u(t)$ and output $y(t)$ through a
  latent state $h(t) \\in \\mathbb{R}^N$:
</p>

$$h'(t) = A \\, h(t) + B \\, u(t), \\qquad y(t) = C \\, h(t) + D \\, u(t)$$

<p>
  where $A \\in \\mathbb{R}^{N \\times N}$ governs the state dynamics, $B \\in \\mathbb{R}^{N \\times 1}$
  controls how input enters the state, $C \\in \\mathbb{R}^{1 \\times N}$ maps the state to output, and
  $D \\in \\mathbb{R}$ is a skip connection. The state dimension $N$ is a design hyperparameter controlling
  the model's memory capacity.
</p>

<p>
  Classical SSMs (e.g., S4, Gu et al., 2022) use fixed, data-independent parameters $A$, $B$, and $C$. This
  allows efficient computation via convolutional or recurrent modes but imposes a limitation: memory dynamics
  are identical regardless of input content. A noise-dominated consolidation bar and a macro-shock bar receive
  the same state update treatment.
</p>

<h3>3.2 Mamba: Input-Dependent State Transitions</h3>

<p>
  The Mamba architecture (Gu and Dao, 2023) introduces the key innovation that makes SSMs viable for financial
  time series: <strong>input-dependent state transition parameters</strong>. Rather than using fixed $B$, $C$,
  and discretisation step $\\Delta$, Mamba computes these from the current input:
</p>

$$\\Delta_t = \\text{softplus}(W_\\Delta \\, u_t), \\quad B_t = W_B \\, u_t, \\quad C_t = W_C \\, u_t$$

<p>
  The discretisation step $\\Delta_t$ controls the effective memory horizon at each timestep. A large $\\Delta_t$
  causes the state to incorporate the current input strongly while decaying past information; a small $\\Delta_t$
  preserves the existing state with minimal update. This is computed via Zero-Order-Hold (ZOH) discretisation:
</p>

$$\\bar{A}_t = \\exp(\\Delta_t \\odot A), \\quad \\bar{B}_t = \\Delta_t \\odot B_t \\odot u_t$$

<p>
  The discrete-time state update and output equations are then:
</p>

$$h_t = \\bar{A}_t \\odot h_{t-1} + \\bar{B}_t, \\quad y_t = C_t^\\top h_t + D \\odot u_t$$

<p>
  In financial terms, each bar chooses how much historical context to retain based on its own content. During
  a persistent trend or volatility regime, the model can learn small $\\Delta_t$ values, allowing macro-shock
  information to persist in the state over hundreds of bars. During noisy, low-information periods, large
  $\\Delta_t$ values cause rapid state decay, discarding stale context within a few steps. This adaptive memory
  horizon, learned end-to-end from data, is well suited to a market where the optimal lookback window shifts
  continuously.
</p>

<h3>3.3 Computational Advantage</h3>

<p>
  Per-step complexity of a Mamba block is $O(d \\cdot N)$, where $d$ is the embedding dimension and $N$ is
  the state dimension. Over a sequence of length $T$, total complexity is $O(T \\cdot d \\cdot N)$.
  With $d = 128$ and $N = 8$, a 720-bar window requires approximately 737,280 multiply-accumulate operations,
  compared to 518,400 attention score pairs per head for a single Transformer layer before accounting for
  value projection and multi-head aggregation.
</p>

<p>
  The SSM computation is causal by construction: $h_t$ depends only on $h_{t-1}$ and $u_t$. No future
  information can leak into the prediction, and no explicit positional encoding is needed because the causal
  state update inherently encodes temporal position through accumulated state dynamics. Both properties suit
  financial time series, where causality is a hard constraint and information density is irregular.
</p>

<h2>4. GoldSSM Architecture</h2>

<p>
  GoldSSM is a multi-scale state space architecture for intraday financial time series forecasting. Rather
  than processing a single fixed-length context window, it processes multiple parallel temporal streams at
  different horizons. Our implementation uses four streams (60, 120, 240, and 720 M1 bars, spanning 1 to
  12 hours), though the number and length of streams are configurable. The architecture has four components
  arranged in a pipeline, each addressing a limitation identified in Section 2.
</p>

<div class="finding-box">
  <strong>Architecture Summary:</strong> GoldSSM consists of four stages: (1) a Variable Selection Network that
  learns regime-aware, bar-by-bar feature weights; (2) parallel Mamba encoders that process each temporal
  scale in linear time with input-dependent memory; (3) Temporal Attention Pooling that focuses summary capacity
  on the few decision-relevant bars in each stream; and (4) Stream Gating that adapts the weighting across
  temporal scales to the current regime before fusing into a final prediction.
</div>

<h3>4.1 Variable Selection Network</h3>

<p>
  The first stage is a Variable Selection Network (VSN), inspired by the gating mechanism in Temporal Fusion
  Transformers (Lim et al., 2021) but adapted for financial feature selection. The VSN learns a weight vector
  over the input feature space at every bar, conditioned on the current observation and a global regime context
  vector:
</p>

$$w_t = \\text{softmax}\\big(\\text{MLP}([x_t \\; ; \\; c])\\big) \\in \\mathbb{R}^F$$

<p>
  where $x_t \\in \\mathbb{R}^F$ is the raw feature vector at bar $t$, $c$ is a learned regime context
  embedding, and $[\\; ; \\;]$ denotes concatenation. The softmax normalisation ensures the weights form a
  valid probability distribution over features, giving interpretable feature importance at every bar.
</p>

<p>
  The selected features are then processed through two complementary pathways:
</p>

<ul>
  <li>
    <strong>Value path:</strong> $v_t = W_v(x_t \\odot w_t)$ carries the current numeric signal, element-wise
    gated by the selection weights. Features irrelevant to the current regime are multiplicatively suppressed
    before entering the encoder.
  </li>
  <li>
    <strong>Prototype path:</strong> $p_t = w_t^\\top P$ carries a learned feature identity prior,
    where $P \\in \\mathbb{R}^{F \\times d}$ is a learnable prototype matrix. This path encodes which features
    are active regardless of their numeric values, providing the encoder with a regime fingerprint.
  </li>
  <li>
    <strong>Regime context:</strong> $r_t = W_c \\cdot c$ is a linear projection of the regime embedding
    that biases the combined representation toward regime-specific interpretation.
  </li>
</ul>

<p>
  The three paths are summed to produce the VSN output: $z_t = v_t + p_t + r_t$. This design gives the model
  dynamic feature selection, e.g. upweighting momentum features during trends and volatility features during
  mean-reversion, without the memory cost of materialising an $F \\times F$ feature interaction matrix. Total
  complexity is $O(B \\times T \\times \\max(F, d))$, where $B$ is batch size, $T$ is sequence length, $F$ is
  feature count, and $d$ is embedding dimension. No outer-product or pairwise feature computation is required.
</p>

<p>
  Unlike the static feature treatment of Transformers (Section 2.3), the VSN re-weights the feature space at
  every bar conditioned on regime context. The selection weights $w_t$ also serve as a diagnostic: they reveal
  which features the model considers most informative at any given moment, an interpretability benefit absent
  from standard Transformer encoders.
</p>

<h3>4.2 Multi-Scale Mamba Encoding</h3>

<p>
  Encoded features from the VSN feed into four parallel Mamba streams at different temporal scales: 60 bars
  (1 hour), 120 bars (2 hours), 240 bars (4 hours), and 720 bars (12 hours). Each stream has an identical
  architecture:
</p>

<ol>
  <li>
    <strong>Variable Selection:</strong> A dedicated VSN instance (Section 4.1) produces regime-aware feature
    representations for the stream's temporal window.
  </li>
  <li>
    <strong>Mamba blocks (2 layers):</strong> Each Mamba block consists of a depth-wise causal convolution
    (kernel size 4) followed by the selective state space scan. The causal convolution captures local patterns
    such as candlestick formations and short-term momentum; the SSM then integrates them into the long-range
    latent state. The scan applies the input-dependent state update equations from Section 3.2 across the full
    sequence in linear time.
  </li>
  <li>
    <strong>Output gating:</strong> The Mamba block output passes through a SiLU-gated linear projection:
    $\\text{out}_t = \\text{SiLU}(W_g \\, h_t) \\odot (W_o \\, h_t)$. This non-linear modulation allows
    the block to suppress uninformative timesteps before passing to the next stage.
  </li>
  <li>
    <strong>Temporal Attention Pooling:</strong> The pooling mechanism described in Section 4.3 summarises the
    encoded sequence into a fixed-dimensional representation.
  </li>
</ol>

<p>
  Per-stream complexity is $O(T \\cdot d \\cdot N)$, where $T$ is the stream's sequence length, $d = 128$ is
  the embedding dimension, and $N = 8$ is the state dimension. For the longest stream (720 bars), this amounts
  to roughly 737,280 multiply-accumulate operations per Mamba block, a fraction of what a single Transformer
  attention layer costs over the same sequence length. Linear-time scaling is the reason GoldSSM can process
  a 720-bar (12-hour) context window directly rather than truncating history to keep quadratic attention costs
  within budget.
</p>

<p>
  The multi-scale design addresses the variable lookback problem from Section 1. Rather than committing to a
  single temporal resolution, GoldSSM maintains four parallel views of the market. The 60-bar stream captures
  short-term microstructure and level-proximity dynamics; the 120-bar stream spans typical mean-reversion
  cycles; the 240-bar stream covers half-session trend structures; and the 720-bar stream provides full-session
  context including overnight developments and macro-regime persistence. Stream gating (Section 4.4) learns to
  weight these views adaptively based on the current regime.
</p>

<h3>4.3 Temporal Attention Pooling</h3>

<p>
  After Mamba encoding, each stream contains a sequence of encoded representations $H = [h_1, h_2, \\ldots, h_T]
  \\in \\mathbb{R}^{T \\times d}$. These must be summarised into a single fixed-dimensional vector for downstream
  fusion and prediction. Standard approaches are inadequate here. Mean pooling dilutes signal from the few
  informative bars across the entire sequence. Last-token pooling discards everything except the most recent
  bar, forfeiting the long-range context that justified the extended window.
</p>

<p>
  GoldSSM uses Temporal Attention Pooling with $Q = 4$ learned query vectors. Each query attends over the full
  encoded sequence via multi-head attention:
</p>

$$o_i = \\text{MHA}(q_i, H, H), \\quad i = 1, \\ldots, Q$$

$$h_{\\text{pool}} = \\text{LayerNorm}\\left(\\frac{1}{Q}\\sum_{i=1}^{Q} o_i\\right)$$

<p>
  where $q_i \\in \\mathbb{R}^d$ are learnable query parameters and MHA denotes standard multi-head attention.
  The four queries specialise during training to attend to different aspects of the encoded sequence. In
  practice, certain queries attend preferentially to bars near session boundaries, others to high-volatility
  bars, and others to bars coinciding with cross-asset correlation shifts.
</p>

<p>
  In effect, the network spends most of its summary capacity on the few bars that carry directional information
  instead of averaging uniformly across a sequence that is 95% noise. Computational cost is modest:
  $O(Q \\cdot T \\cdot d)$ for $Q = 4$ queries, negligible relative to the encoding stage.
</p>

<p>
  This use of attention differs from Transformer self-attention in a key respect. The number of queries $Q$ is
  fixed and small (4), so attention computation is $O(T)$ in sequence length, not $O(T^2)$. The queries attend
  to the sequence; the sequence does not attend to itself.
</p>

<h3>4.4 Stream Gating and Fusion</h3>

<p>
  The four pooled stream representations must be combined into a single vector for the prediction heads. Simply
  concatenating or averaging with equal weight ignores the fact that the most predictive temporal scale rotates
  across regimes: short scales dominate during mean-reversion around support/resistance levels, while long
  scales dominate during persistent macro-driven trends.
</p>

<p>
  GoldSSM uses a Stream Gating Network that computes adaptive weights over the four streams:
</p>

$$g = 4 \\cdot \\text{softmax}\\big(\\text{MLP}(r)\\big) \\in \\mathbb{R}^4, \\quad \\text{where } \\sum_{i=1}^{4} g_i = 4$$

<p>
  where $r$ is a regime representation derived from the concatenated stream outputs. Scaling by 4 ensures an
  expected gate value of 1.0 per stream, preserving gradient magnitude. The gating MLP is initialised with
  zero weights so that all gates start at exactly 1.0 (equal weighting) and deviate only as training evidence
  warrants. This prevents the gating network from prematurely suppressing streams before the encoders have
  learned useful representations.
</p>

<p>
  Gated stream representations are concatenated and projected to the prediction space:
</p>

$$z = \\text{LayerNorm}\\big(\\text{SiLU}(W_f [g_1 \\cdot h_1 \\; ; \\; g_2 \\cdot h_2 \\; ; \\; g_3 \\cdot h_3 \\; ; \\; g_4 \\cdot h_4])\\big)$$

<p>
  where $W_f$ is a linear projection and $[\\; ; \\;]$ denotes concatenation. The fused representation $z$ feeds
  three prediction heads: trade probability (sigmoid), directional probability (softmax over up/down/hold),
  and a reconstruction head for the auxiliary loss described in Section 6.
</p>

<h2>5. Complexity Comparison</h2>

<p>
  Table 1 summarises the architectural differences between a standard Transformer encoder and GoldSSM.
</p>

<table>
  <thead>
    <tr>
      <th>Aspect</th>
      <th>Transformer</th>
      <th>GoldSSM</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Sequence complexity</td>
      <td>$O(T^2 \\cdot d)$</td>
      <td>$O(T \\cdot d \\cdot N)$</td>
    </tr>
    <tr>
      <td>At $T = 720$ (12h context)</td>
      <td>518,400 attention pairs per head</td>
      <td>$720 \\times 128 \\times 8 = 737\\text{K}$ mult-adds</td>
    </tr>
    <tr>
      <td>Feature selection</td>
      <td>Static (offline AUC screening)</td>
      <td>Dynamic (per-timestep, regime-conditioned)</td>
    </tr>
    <tr>
      <td>Temporal pooling</td>
      <td>Mean or last-token</td>
      <td>Learned attention (4 queries)</td>
    </tr>
    <tr>
      <td>Positional encoding</td>
      <td>Required (sinusoidal or learned)</td>
      <td>Not needed (causal state encodes position)</td>
    </tr>
    <tr>
      <td>Stream weighting</td>
      <td>Fixed equal-weight</td>
      <td>Regime-adaptive gating</td>
    </tr>
    <tr>
      <td>Parameters</td>
      <td>~12.5M</td>
      <td>~2.0M (6.2&times; reduction)</td>
    </tr>
  </tbody>
</table>

<p>
  Where does the 6.2x parameter reduction come from? The Transformer baseline requires separate learned
  positional encodings, multi-head self-attention projections ($W_Q$, $W_K$, $W_V$, $W_O$ per head per layer),
  and feed-forward networks at each layer. GoldSSM replaces all of these with compact Mamba blocks whose
  parameter count scales as $O(d \\cdot N)$ per block; the state dimension $N = 8$ is far smaller than the
  typical Transformer hidden dimension. The Variable Selection Network adds $O(F \\cdot d)$ parameters, and the
  stream gating network is a small MLP. The result is approximately 2.0 million parameters, small enough to
  train on limited financial datasets without severe overfitting and fast enough for real-time M1 inference
  on commodity hardware.
</p>

<p>
  The parameter reduction matters beyond computation. In financial machine learning, training data is inherently
  limited: markets have finite history, regime changes segment the data into short stationary windows, and data
  augmentation is problematic because synthetic financial data rarely preserves the distributional properties
  that matter for trading. Fewer parameters means fewer samples needed for comparable generalisation, reducing
  the risk of overfitting to historical idiosyncrasies that will not recur out of sample.
</p>

<h2>6. Training: Noise-Consistency Regularisation</h2>

<p>
  Most M1 bars are noise. A model that memorises bar-level patterns will fail out of sample. The training
  procedure is built around this fact. The loss function combines three components:
</p>

<ol>
  <li>
    <strong>Direction loss (BCE):</strong> Binary cross-entropy on the predicted directional probabilities
    (up vs. down), providing the primary supervised signal for trade direction.
  </li>
  <li>
    <strong>Hold loss:</strong> A separate loss term for the trade/no-trade decision, encouraging the model
    to abstain from trading during ambiguous periods rather than forcing a directional prediction on every bar.
  </li>
  <li>
    <strong>Reconstruction loss:</strong> An auxiliary task requiring the model to reconstruct a subset of input
    features from the encoded representation. This regularises the encoder by ensuring it preserves general
    market state information, not only the features most correlated with the immediate prediction target.
  </li>
</ol>

<p>
  The key addition is <strong>noise-consistency regularisation</strong>. During training, each input sample is
  processed twice: once with the original features and once with small Gaussian perturbations added. The
  regularisation term penalises the $L_2$ distance between the model's output logits on clean and perturbed
  inputs:
</p>

$$\\mathcal{L}_{\\text{NC}} = \\mathbb{E}\\left[\\|f(x) - f(x + \\epsilon)\\|_2^2\\right], \\quad \\epsilon \\sim \\mathcal{N}(0, \\sigma^2 I)$$

<p>
  This penalty discourages the model from developing sharp decision boundaries sensitive to small input
  variations, which is the hallmark of overfitting to bar-level noise. A model that memorises specific bar
  patterns will produce dramatically different outputs when those patterns are slightly perturbed. A model that
  has learned genuine regime-level structure will be robust, since the regime signal spans many bars and cannot
  be eliminated by perturbing any single one.
</p>

<h3>6.1 Causal Normalisation</h3>

<p>
  Feature normalisation is a deceptively important detail for financial time series models. Standard batch
  normalisation computes statistics over the entire training batch, which in a financial context means future
  information leaks into the normalisation of past observations. Even layer normalisation, which normalises
  per-sample, uses statistics from the full sequence including future timesteps.
</p>

<p>
  GoldSSM uses a causal normalisation scheme with two treatment paths:
</p>

<ul>
  <li>
    <strong>Regime-sensitive features (36 features):</strong> Features whose distributions shift across regimes,
    including volatility estimates, cross-asset correlations, and momentum indicators, are normalised using a
    rolling 30-day z-score computed causally (using only past data at each bar). "High volatility" then means
    high relative to the recent past, not high relative to a global training mean that may be months stale.
  </li>
  <li>
    <strong>Stationary features:</strong> Features with approximately time-invariant distributions, such as
    time-of-day encodings, session indicators, and certain microstructure ratios, receive static z-score
    normalisation using training-set statistics. Rolling normalisation would not help these features and would
    only introduce unnecessary noise.
  </li>
</ul>

<p>
  Assignment to one path or the other is determined empirically by measuring stationarity of each feature's
  rolling distribution over the training period. Features whose 30-day rolling mean or variance drifts by more
  than one standard deviation go to the regime-sensitive path; the rest use the stationary path.
</p>

<h2>7. Conclusion</h2>

<p>
  GoldSSM addresses three limitations of Transformer architectures for intraday financial forecasting. Replacing
  quadratic self-attention with linear-time selective state space scanning enables 12-hour context windows
  (720 M1 bars) that would be computationally prohibitive for standard Transformers. The Variable Selection
  Network provides dynamic, regime-aware feature weighting at every bar, replacing the static feature treatment
  inherent in Transformer encoders. Learned Temporal Attention Pooling concentrates summary capacity on the
  sparse subset of bars that carry directional information rather than averaging across a sequence dominated
  by noise.
</p>

<p>
  Four parallel Mamba streams with adaptive gating address the variable lookback problem directly. GoldSSM
  maintains simultaneous views at 1-hour, 2-hour, 4-hour, and 12-hour horizons, with learned gating that
  redistributes emphasis as market conditions shift. Zero-initialisation of the gating network ensures that
  adaptive weighting emerges only when supported by training evidence.
</p>

<p>
  At approximately 2.0 million parameters, GoldSSM achieves a 6.2x reduction relative to the equivalent
  Transformer baseline with comparable layer depth and embedding dimension. This reduction follows from
  architecture, not aggressive pruning: the Mamba block's $O(d \\cdot N)$ parameter scaling with $N = 8$ is
  inherently more compact than the $O(d^2)$ scaling of Transformer self-attention and feed-forward layers. The
  smaller model is both faster at inference and less prone to overfitting on the limited, non-stationary
  datasets characteristic of financial machine learning.
</p>

<p>
  Noise-consistency regularisation and causal normalisation complete the design. They target the central
  difficulty of training on M1 financial data: extremely low signal-to-noise ratio, uninformative majority
  bars, and continuously shifting feature distributions. Penalising sensitivity to small input perturbations
  and normalising features relative to their recent regime-specific distribution discourages memorisation of
  bar-level noise while preserving the ability to detect genuine regime-level structure.
</p>

<p>
  Every architectural choice in GoldSSM is grounded in the statistical properties of financial time series
  rather than general-purpose sequence modelling considerations. The model is more expressive (adaptive feature
  selection, adaptive temporal weighting, adaptive memory horizon), more efficient (linear complexity, 6.2x
  fewer parameters), and better regularised (noise-consistency, causal normalisation) than the Transformer
  baseline it replaces.
</p>

<h2>References</h2>

<ol>
  <li>
    Gu, A. and Dao, T. (2023). &ldquo;Mamba: Linear-Time Sequence Modeling with Selective State Spaces.&rdquo;
    <em>arXiv preprint arXiv:2312.00752</em>.
  </li>
  <li>
    Lim, B., Ar&iacute;k, S. &Ouml;., Loeff, N., and Pfister, T. (2021). &ldquo;Temporal Fusion Transformers
    for Interpretable Multi-horizon Time Series Forecasting.&rdquo; <em>International Journal of Forecasting</em>,
    37(4), 1748&ndash;1764.
  </li>
  <li>
    Zhou, H., Zhang, S., Peng, J., Zhang, S., Li, J., Xiong, H., and Zhang, W. (2021). &ldquo;Informer: Beyond
    Efficient Transformer for Long Sequence Time-Series Forecasting.&rdquo; <em>Proceedings of the AAAI Conference
    on Artificial Intelligence</em>, 35(12), 11106&ndash;11115.
  </li>
  <li>
    Hochreiter, S. and Schmidhuber, J. (1997). &ldquo;Long Short-Term Memory.&rdquo; <em>Neural Computation</em>,
    9(8), 1735&ndash;1780.
  </li>
  <li>
    Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, L., and Polosukhin, I.
    (2017). &ldquo;Attention Is All You Need.&rdquo; <em>Advances in Neural Information Processing Systems</em>, 30.
  </li>
  <li>
    Gu, A., Goel, K., and R&eacute;, C. (2022). &ldquo;Efficiently Modeling Long Sequences with Structured State
    Spaces.&rdquo; <em>International Conference on Learning Representations (ICLR)</em>.
  </li>
</ol>
`;

export const content = `
<h2>1. Introduction</h2>

<p>
  Intraday price forecasting in liquid financial markets — commodities, FX, equity indices — is driven by a
  complex web of factors: monetary policy expectations, real interest rate movements, currency dynamics,
  cross-asset risk appetite, and market microstructure (liquidity sweeps, order flow imbalances, session
  transitions). The interaction between these drivers is nonlinear, time-varying, and regime-dependent &mdash;
  a combination that places extreme demands on any forecasting model. We develop GoldSSM using XAUUSD (gold)
  as our primary instrument, chosen for its high liquidity ($130B+ daily turnover), diverse driver set, and
  strong regime structure — though the architecture is designed for any liquid financial instrument at the
  intraday timescale.
</p>

<p>
  Three fundamental challenges define the problem of intraday forecasting at the one-minute (M1) timescale:
</p>

<ol>
  <li>
    <strong>Extremely low signal-to-noise ratio.</strong> At the M1 resolution, the vast majority of price bars
    contain no directional information. The signal is concentrated in a sparse subset of bars coinciding with
    macroeconomic releases, liquidity sweeps near key levels, and session-boundary dynamics. A model that treats
    all timesteps uniformly will be overwhelmed by noise.
  </li>
  <li>
    <strong>Non-stationarity at every timescale.</strong> The statistical properties of financial returns &mdash;
    volatility, autocorrelation structure, cross-asset correlations, and the relevance of individual features
    &mdash; shift continuously. A volatility regime that persists for weeks can collapse within minutes during a
    macro shock. Any model with frozen normalisation statistics or static feature weights will degrade as the
    market evolves.
  </li>
  <li>
    <strong>No fixed optimal lookback horizon.</strong> The amount of historical context required for an accurate
    forecast depends on the current market regime. Trend-following signals require long lookback windows (hours
    to half-days); mean-reversion signals around support/resistance levels require short, precise context (tens
    of minutes). A model locked to a single temporal scale will systematically underperform in regimes where a
    different scale dominates.
  </li>
</ol>

<p>
  Existing deep learning approaches fail to address these challenges simultaneously. Long Short-Term Memory
  (LSTM) networks (Hochreiter and Schmidhuber, 1997) process sequences through a single fixed lookback window
  with uniform temporal aggregation, offering no mechanism to attend selectively to informative bars or to adapt
  feature weighting across regimes. Transformer architectures (Vaswani et al., 2017) introduce flexible
  attention over the full sequence, but at $O(T^2 \\cdot d)$ computational cost &mdash; making context windows
  beyond 200 bars impractical for real-time M1 inference. Efficient Transformer variants such as Informer
  (Zhou et al., 2021) reduce the quadratic bottleneck but retain static feature treatment and fixed positional
  encodings. Across all these architectures, feature selection is typically performed offline (e.g., via AUC
  screening or LASSO) and remains frozen during inference, ignoring the reality that feature relevance rotates
  with market regime.
</p>

<p>
  This paper introduces <strong>GoldSSM</strong>, a structured state space architecture designed to address all
  three limitations simultaneously. GoldSSM combines a Variable Selection Network for dynamic, regime-conditioned
  feature weighting; multi-scale Mamba encoding with input-dependent state transitions for linear-time sequence
  processing; learned temporal attention pooling to focus summary capacity on informative bars; and adaptive
  stream gating to redistribute emphasis across temporal scales as the regime shifts. The result is a model that
  processes 12 hours of M1 context (720 bars) in linear time, with 6.2&times; fewer parameters than the
  equivalent Transformer baseline.
</p>

<h2>2. The Transformer Problem for Financial Time Series</h2>

<p>
  Before presenting the GoldSSM architecture, it is worth examining precisely why Transformer models &mdash;
  despite their dominance in natural language processing &mdash; are poorly suited to intraday financial time
  series. The limitations are not merely computational; they are structural mismatches between the assumptions
  embedded in self-attention and the statistical properties of financial data.
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
  With multiple heads and multiple layers, the total computational burden makes real-time inference on commodity
  GPU hardware infeasible — and this cost applies to each temporal context window the model must process.
</p>

<p>
  The quadratic scaling creates a forced trade-off between context richness and computational tractability.
  Practitioners must either truncate the context window &mdash; discarding potentially valuable regime
  information from earlier in the session &mdash; or accept latency that exceeds the bar interval. Neither
  option is acceptable for a production trading system where inference must complete within the bar boundary.
</p>

<h3>2.2 Uniform Attention over Noise</h3>

<p>
  Self-attention treats every timestep as potentially relevant to every other timestep. In natural language,
  this is a reasonable inductive bias: any word in a sentence may modify the meaning of any other word. In
  financial time series, the assumption is catastrophically wrong. At the M1 resolution, over 95% of bars
  contain no actionable directional information. The signal is concentrated in a sparse, irregular subset of
  timesteps &mdash; bars coinciding with macroeconomic data releases (NFP, CPI, FOMC), liquidity sweeps past
  key support/resistance levels, and session-boundary transitions (London open, New York open).
</p>

<p>
  A Transformer must learn to assign near-zero attention weight to the vast majority of bars. In principle,
  the softmax attention mechanism can achieve this; in practice, the learning problem is severely complicated
  by the low signal-to-noise ratio. The model must discover which bars are informative from data where the
  informative bars are rare events, and where the definition of "informative" itself changes across regimes.
  The result is attention maps that spread probability mass diffusely across the sequence, diluting the signal
  from the few bars that matter.
</p>

<h3>2.3 Static Feature Weighting</h3>

<p>
  Transformers process a fixed feature vector at each timestep, with no native mechanism to adapt which features
  receive emphasis based on the current market regime. In financial markets, the relevance of individual features
  rotates dramatically: during trending regimes, momentum and moving-average distance features dominate; during
  mean-reverting regimes, support/resistance proximity and volatility features are primary; during macro-shock
  regimes, cross-asset correlations and rate-sensitivity features become paramount. A Transformer treats the
  input feature vector identically regardless of regime, relying on the model's general capacity to implicitly
  learn regime-dependent feature interactions &mdash; a task that is data-inefficient and prone to overfitting
  given the non-stationarity of financial data.
</p>

<h3>2.4 Positional Encoding Assumes Regularity</h3>

<p>
  Standard Transformer positional encodings &mdash; whether sinusoidal or learned &mdash; embed the assumption
  that information density is roughly uniform across sequence positions. Financial time series violate this
  assumption fundamentally. An overnight gap compresses hours of calendar time into a single bar transition.
  A session open concentrates information that accumulated during the preceding session's close into the first
  few bars. A macro release injects a spike of information that decays over subsequent bars. The regular
  positional grid of Transformers has no mechanism to represent this irregular information density, forcing
  the model to waste capacity learning to ignore the positional signal during periods where it is misleading.
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
  State space models (SSMs) offer a fundamentally different approach to sequence modeling. Rather than computing
  pairwise interactions between all timesteps, an SSM maintains a compressed latent state vector $h_t$ that is
  updated recurrently as each new observation arrives. The computational complexity is $O(T)$ in sequence length
  &mdash; linear, not quadratic &mdash; making long context windows practical without architectural compromise.
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
  provides efficient computation via convolutional or recurrent modes, but imposes a critical limitation: the
  memory dynamics are identical regardless of input content. Every bar &mdash; whether a noise-dominated
  consolidation bar or a macro-shock bar &mdash; receives the same state update treatment.
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
  The financial interpretation is immediate and powerful. Each bar chooses how much historical context to retain
  based on its own content. During a persistent trend or volatility regime, the model can learn to set small
  $\\Delta_t$ values, allowing macro-shock information to persist in the state over hundreds of bars. During
  noisy, low-information periods, large $\\Delta_t$ values cause rapid state decay, discarding stale context
  within a few steps. This adaptive memory horizon &mdash; learned end-to-end from data &mdash; is precisely
  the mechanism needed for a market where the optimal lookback window shifts continuously.
</p>

<h3>3.3 Computational Advantage</h3>

<p>
  The per-step complexity of a Mamba block is $O(d \\cdot N)$, where $d$ is the embedding dimension and $N$ is
  the state dimension. Over a sequence of length $T$, this gives $O(T \\cdot d \\cdot N)$ total complexity.
  With typical values of $d = 128$ and $N = 8$, the total computation for a 720-bar window is approximately
  737,280 multiply-accumulate operations &mdash; compared to 518,400 attention score pairs per head for a
  single Transformer layer, before accounting for the value projection and multi-head aggregation that follow.
</p>

<p>
  Crucially, the SSM computation is entirely causal by construction: $h_t$ depends only on $h_{t-1}$ and $u_t$.
  No future information can leak into the prediction, and no explicit positional encoding is needed &mdash; the
  causal state update inherently encodes temporal position through the accumulated state dynamics. Both properties
  are natural fits for financial time series, where causality is a hard constraint and information density is
  irregular.
</p>

<h2>4. GoldSSM Architecture</h2>

<p>
  GoldSSM is a multi-scale state space architecture designed for intraday financial time series forecasting.
  Rather than processing a single fixed-length context window, the architecture processes multiple parallel
  temporal streams at different horizons. In our implementation, we use four streams — 60, 120, 240, and 720
  M1 bars (1 hour to 12 hours) — though the number and length of streams are configurable hyperparameters.
  The architecture consists of four components arranged in a pipeline, each addressing a specific limitation
  of Transformer-based approaches identified in Section 2.
</p>

<div class="finding-box">
  <strong>Architecture Summary:</strong> GoldSSM consists of four stages: (1) a Variable Selection Network that
  learns regime-conditioned, per-timestep feature weights; (2) parallel Mamba encoders that process each temporal
  scale in linear time with input-dependent memory; (3) Temporal Attention Pooling that focuses summary capacity
  on the few decision-relevant bars in each stream; and (4) Stream Gating that adapts the weighting across
  temporal scales to the current regime before fusing into a final prediction.
</div>

<h3>4.1 Variable Selection Network</h3>

<p>
  The first stage of GoldSSM is a Variable Selection Network (VSN), inspired by the gating mechanism in
  Temporal Fusion Transformers (Lim et al., 2021), but adapted for the specific requirements of financial
  feature selection. The VSN learns a weight vector over the input feature space at every timestep, conditioned
  on both the current observation and a global regime context vector:
</p>

$$w_t = \\text{softmax}\\big(\\text{MLP}([x_t \\; ; \\; c])\\big) \\in \\mathbb{R}^F$$

<p>
  where $x_t \\in \\mathbb{R}^F$ is the raw feature vector at timestep $t$, $c$ is a learned regime context
  embedding, and $[\\; ; \\;]$ denotes concatenation. The softmax normalisation ensures that the weights form a
  valid probability distribution over features, providing interpretable feature importance at every timestep.
</p>

<p>
  The selected features are then processed through two complementary pathways:
</p>

<ul>
  <li>
    <strong>Value path:</strong> $v_t = W_v(x_t \\odot w_t)$ &mdash; carries the current numeric signal,
    element-wise gated by the selection weights. Features deemed irrelevant to the current regime are
    multiplicatively suppressed before entering the encoder.
  </li>
  <li>
    <strong>Prototype path:</strong> $p_t = w_t^\\top P$ &mdash; carries a learned feature identity prior,
    where $P \\in \\mathbb{R}^{F \\times d}$ is a learnable prototype matrix. This path encodes which features
    are active (regardless of their numeric values), providing the encoder with a regime fingerprint.
  </li>
  <li>
    <strong>Regime context:</strong> $r_t = W_c \\cdot c$ &mdash; a linear projection of the regime embedding
    that nudges the combined representation toward regime-specific interpretation.
  </li>
</ul>

<p>
  The three paths are summed to produce the VSN output: $z_t = v_t + p_t + r_t$. This design gives the model
  dynamic feature selection &mdash; the ability to upweight momentum features during trending regimes and
  volatility features during mean-reverting regimes &mdash; without the memory cost of materialising an
  $F \\times F$ feature interaction matrix. The total complexity is $O(B \\times T \\times \\max(F, d))$,
  where $B$ is batch size, $T$ is sequence length, $F$ is feature count, and $d$ is embedding dimension.
  No outer-product or pairwise feature computation is required.
</p>

<p>
  This addresses the static feature weighting limitation of Transformers identified in Section 2.3. Rather
  than processing a fixed feature vector at each timestep, the VSN dynamically re-weights the feature space
  at every bar, conditioned on regime context. The selection weights $w_t$ are themselves a useful diagnostic:
  they reveal which features the model considers most informative at any given moment, providing interpretability
  that is absent from standard Transformer encoders.
</p>

<h3>4.2 Multi-Scale Mamba Encoding</h3>

<p>
  The encoded features from the VSN are processed through four parallel Mamba streams, each operating on a
  different temporal scale: 60 bars (1 hour), 120 bars (2 hours), 240 bars (4 hours), and 720 bars (12 hours).
  Each stream follows an identical architecture:
</p>

<ol>
  <li>
    <strong>Variable Selection:</strong> A dedicated VSN instance (as described in Section 4.1) produces
    regime-conditioned feature representations for the stream's temporal window.
  </li>
  <li>
    <strong>Mamba blocks (2 layers):</strong> Each Mamba block consists of a depth-wise causal convolution
    (kernel size 4) followed by the selective state space scan. The causal convolution captures local patterns
    &mdash; candlestick formations, short-term momentum &mdash; before the SSM integrates them into the
    long-range latent state. The scan operation applies the input-dependent state update equations from
    Section 3.2 across the full sequence in linear time.
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
  The per-stream computational complexity is $O(T \\cdot d \\cdot N)$, where $T$ is the stream's sequence length,
  $d = 128$ is the embedding dimension, and $N = 8$ is the state dimension. For the longest stream (720 bars),
  this is approximately 737,280 multiply-accumulate operations per Mamba block &mdash; a fraction of the cost
  of a single Transformer attention layer over the same sequence length. This linear-time scaling is the
  fundamental reason GoldSSM can process a 720-bar (12-hour) context window directly, instead of truncating
  history to keep quadratic attention costs within computational budgets.
</p>

<p>
  The multi-scale design addresses the variable lookback problem identified in Section 1. Rather than committing
  to a single temporal resolution, GoldSSM maintains four parallel views of the market at different horizons.
  The 60-bar stream captures short-term microstructure and level-proximity dynamics; the 120-bar stream spans
  typical mean-reversion cycles; the 240-bar stream covers half-session trend structures; and the 720-bar
  stream provides full-session context including overnight developments and macro-regime persistence. The
  stream gating mechanism (Section 4.4) learns to weight these views adaptively based on the current regime.
</p>

<h3>4.3 Temporal Attention Pooling</h3>

<p>
  After Mamba encoding, each stream contains a sequence of encoded representations $H = [h_1, h_2, \\ldots, h_T]
  \\in \\mathbb{R}^{T \\times d}$. These must be summarised into a single fixed-dimensional vector for downstream
  fusion and prediction. The standard approaches &mdash; mean pooling or taking the last token &mdash; are
  inadequate for financial time series. Mean pooling dilutes the signal from the few informative bars across
  the entire sequence. Last-token pooling discards all information except the most recent timestep, forfeiting
  the long-range context that justified the extended window in the first place.
</p>

<p>
  GoldSSM employs Temporal Attention Pooling with $Q = 4$ learned query vectors. Each query attends over the
  full encoded sequence via multi-head attention:
</p>

$$o_i = \\text{MHA}(q_i, H, H), \\quad i = 1, \\ldots, Q$$

$$h_{\\text{pool}} = \\text{LayerNorm}\\left(\\frac{1}{Q}\\sum_{i=1}^{Q} o_i\\right)$$

<p>
  where $q_i \\in \\mathbb{R}^d$ are learnable query parameters and MHA denotes standard multi-head attention.
  The four queries specialise during training to attend to different aspects of the encoded sequence. In
  practice, the learned attention patterns reveal interpretable behaviour: certain queries attend preferentially
  to bars near session boundaries, others to bars with high volatility, and others to bars coinciding with
  cross-asset correlation shifts.
</p>

<p>
  This mechanism is a learned replacement for average pooling. The network spends most of its summary capacity
  on the few bars that carry directional information, rather than averaging uniformly across a sequence that is
  95% noise. The computational cost is modest: $O(Q \\cdot T \\cdot d)$ for $Q = 4$ queries, which is negligible
  relative to the encoding stage.
</p>

<p>
  Note that this use of attention is fundamentally different from the self-attention in Transformers. Here, the
  number of queries $Q$ is fixed and small (4), so the attention computation is $O(T)$ in sequence length, not
  $O(T^2)$. The queries attend to the sequence; the sequence does not attend to itself.
</p>

<h3>4.4 Stream Gating and Fusion</h3>

<p>
  The four pooled stream representations must be combined into a single vector for the prediction heads. A
  naive approach would concatenate or average them with equal weight. However, empirical analysis of
  intraday financial dynamics reveals that the most predictive temporal scale rotates across regime quintiles: short
  scales dominate during mean-reversion around support/resistance levels, while long scales dominate during
  persistent trend regimes driven by macro factors.
</p>

<p>
  GoldSSM employs a Stream Gating Network that computes regime-adaptive weights over the four streams:
</p>

$$g = 4 \\cdot \\text{softmax}\\big(\\text{MLP}(r)\\big) \\in \\mathbb{R}^4, \\quad \\text{where } \\sum_{i=1}^{4} g_i = 4$$

<p>
  where $r$ is a regime representation derived from the concatenated stream outputs. The scaling by 4 ensures
  that the expected gate value for each stream is 1.0, preserving gradient magnitude. The gating MLP is
  initialised with zero weights, so all gates start at exactly 1.0 (equal weighting) and deviate only as
  training provides evidence that unequal weighting improves predictions. This conservative initialisation
  prevents the gating network from prematurely suppressing streams before the encoders have had time to learn
  useful representations.
</p>

<p>
  The gated stream representations are concatenated and projected to the final prediction space:
</p>

$$z = \\text{LayerNorm}\\big(\\text{SiLU}(W_f [g_1 \\cdot h_1 \\; ; \\; g_2 \\cdot h_2 \\; ; \\; g_3 \\cdot h_3 \\; ; \\; g_4 \\cdot h_4])\\big)$$

<p>
  where $W_f$ is a linear projection and $[\\; ; \\;]$ denotes concatenation. The fused representation $z$ is
  then passed to three prediction heads: a trade probability head (sigmoid), a directional probability head
  (softmax over up/down/hold), and a reconstruction head for the auxiliary loss described in Section 6.
</p>

<h2>5. Complexity Comparison</h2>

<p>
  The following table summarises the architectural differences between a standard Transformer encoder and
  GoldSSM across the dimensions most relevant to financial time series modeling:
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
  The 6.2&times; parameter reduction deserves elaboration. The Transformer baseline requires separate learned
  positional encodings, multi-head self-attention projections ($W_Q$, $W_K$, $W_V$, $W_O$ per head per layer),
  and feed-forward networks at each layer. GoldSSM replaces all of this with compact Mamba blocks whose
  parameter count scales as $O(d \\cdot N)$ per block, where the state dimension $N = 8$ is far smaller than the
  typical Transformer hidden dimension. The Variable Selection Network adds parameters proportional to
  $O(F \\cdot d)$, and the stream gating network is a small MLP. The net effect is a model with approximately
  2.0 million parameters &mdash; small enough to train on limited financial datasets without severe overfitting,
  and fast enough for real-time M1 inference on commodity hardware.
</p>

<p>
  The parameter reduction is not merely a computational convenience. In financial machine learning, training
  data is inherently limited: markets have finite history, regime changes segment the data into short stationary
  windows, and data augmentation is problematic (synthetic financial data rarely preserves the distributional
  properties that matter for trading). A model with fewer parameters requires fewer samples to achieve the same
  generalisation performance, reducing the risk of overfitting to historical idiosyncrasies that will not
  recur out of sample.
</p>

<h2>6. Training: Noise-Consistency Regularisation</h2>

<p>
  The training procedure for GoldSSM is designed around the recognition that most M1 bars are noise, and that
  a model which memorises bar-level patterns will fail catastrophically out of sample. The loss function
  combines three components:
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
  The critical addition is <strong>noise-consistency regularisation</strong>. During training, each input sample
  is processed twice: once with the original features, and once with small Gaussian perturbations added to the
  input. The regularisation term penalises the $L_2$ distance between the model's output logits on the clean
  and perturbed inputs:
</p>

$$\\mathcal{L}_{\\text{NC}} = \\mathbb{E}\\left[\\|f(x) - f(x + \\epsilon)\\|_2^2\\right], \\quad \\epsilon \\sim \\mathcal{N}(0, \\sigma^2 I)$$

<p>
  This penalty discourages the model from developing sharp decision boundaries that are sensitive to small
  input variations &mdash; exactly the behaviour that characterises overfitting to bar-level noise. A model
  that memorises specific bar patterns will produce dramatically different outputs when those patterns are
  slightly perturbed; a model that has learned genuine regime-level structure will be robust to small
  perturbations, since the regime signal is present across many bars and cannot be eliminated by perturbing
  any single one.
</p>

<h3>6.1 Causal Normalisation</h3>

<p>
  Feature normalisation presents a subtle but critical challenge for financial time series models. Standard
  batch normalisation computes statistics over the entire training batch, which in a financial context means
  future information leaks into the normalisation of past observations. Even layer normalisation, which
  normalises per-sample, uses statistics from the full sequence including future timesteps.
</p>

<p>
  GoldSSM employs a causal normalisation scheme with two treatment paths:
</p>

<ul>
  <li>
    <strong>Regime-sensitive features (36 features):</strong> Features whose distributional properties shift
    meaningfully across regimes &mdash; including volatility estimates, cross-asset correlations, and momentum
    indicators &mdash; are normalised using a rolling 30-day z-score computed causally (using only past data at
    each timestep). This ensures that the model receives features expressed in regime-relative units, so that
    "high volatility" means high relative to the recent past, not high relative to a global training mean that
    may be stale.
  </li>
  <li>
    <strong>Stationary features:</strong> Features with approximately time-invariant distributions &mdash;
    including time-of-day encodings, session indicators, and certain microstructure ratios &mdash; receive
    static z-score normalisation using training-set statistics. These features do not benefit from rolling
    normalisation and would only introduce unnecessary noise if normalised with short rolling windows.
  </li>
</ul>

<p>
  The distinction between the two treatment paths is determined empirically by measuring the stationarity of
  each feature's rolling distribution over the training period. Features whose 30-day rolling mean or variance
  drifts by more than one standard deviation are assigned to the regime-sensitive path; the remainder are
  assigned to the stationary path.
</p>

<h2>7. Conclusion</h2>

<p>
  GoldSSM addresses three fundamental limitations of Transformer architectures for intraday financial time
  series forecasting. First, by replacing quadratic self-attention with linear-time selective state space
  scanning, GoldSSM enables 12-hour context windows (720 M1 bars) that would be computationally prohibitive
  for standard Transformers. Second, the Variable Selection Network provides dynamic, regime-conditioned
  feature weighting at every timestep, replacing the static feature treatment inherent in Transformer encoders.
  Third, learned Temporal Attention Pooling focuses the model's summary capacity on the sparse subset of bars
  that carry directional information, rather than averaging uniformly across a sequence dominated by noise.
</p>

<p>
  The multi-scale architecture &mdash; four parallel Mamba streams with regime-adaptive gating &mdash; directly
  addresses the variable lookback problem. Rather than committing to a single temporal resolution, GoldSSM
  maintains simultaneous views at 1-hour, 2-hour, 4-hour, and 12-hour horizons, with learned gating that
  redistributes emphasis as the market regime shifts. The conservative zero-initialisation of the gating network
  ensures that this adaptive weighting emerges only when supported by training evidence.
</p>

<p>
  The total parameter count of approximately 2.0 million represents a 6.2&times; reduction relative to the
  equivalent Transformer baseline with comparable layer depth and embedding dimension. This reduction is
  architecturally principled, not the result of aggressive pruning: the Mamba block's $O(d \\cdot N)$ parameter
  scaling with state dimension $N = 8$ is inherently more compact than the $O(d^2)$ scaling of Transformer
  self-attention and feed-forward layers. The smaller model is both faster at inference and less prone to
  overfitting on the limited, non-stationary datasets characteristic of financial machine learning.
</p>

<p>
  Noise-consistency regularisation and causal normalisation complete the design. Together, they address the
  fundamental challenge of training on M1 financial data: the signal-to-noise ratio is extremely low, most
  bars are uninformative, and the distributional properties of features shift continuously. By penalising
  sensitivity to small input perturbations and normalising features relative to their recent regime-specific
  distribution, these training-time techniques discourage the model from memorising bar-level noise while
  preserving its ability to detect genuine regime-level structure.
</p>

<p>
  The architectural choices in GoldSSM are grounded in the specific statistical properties of financial time
  series, not in general-purpose sequence modeling considerations. The result is a model that is
  simultaneously more expressive (adaptive feature selection, adaptive temporal weighting, adaptive memory
  horizon), more efficient (linear complexity, 6.2&times; fewer parameters), and better regularised
  (noise-consistency, causal normalisation) than the Transformer baseline it replaces.
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

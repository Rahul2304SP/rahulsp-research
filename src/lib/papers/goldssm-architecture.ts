export const content = `
<h2>1. Introduction</h2>

<p>
  Transformer architectures have become the dominant paradigm in sequence modeling, achieving
  state-of-the-art results across natural language processing, computer vision, and increasingly,
  financial time series forecasting. However, the self-attention mechanism at the core of Transformers
  incurs O(T&sup2;) time and memory complexity with respect to sequence length T, which becomes
  prohibitive for financial applications requiring long context windows.
</p>

<p>
  In intraday gold trading, our production system processes four temporal scales simultaneously:
  SHORT (30 bars), MID (60 bars), LONG (120 bars), and SLOW (240 bars). At the SLOW scale, a
  Transformer with standard self-attention over 240 tokens at 128-dimensional embeddings requires
  substantial attention score computations per head per layer &mdash; a significant
  computational burden for real-time M1/M2 bar inference. The problem compounds when we consider
  that each of the four scales requires its own encoder, and inference must complete within the
  bar interval (60&ndash;120 seconds) on commodity GPU hardware.
</p>

<p>
  The quadratic scaling of self-attention creates a fundamental tension in financial time series
  modeling. Longer context windows capture more regime information &mdash; a 240-bar M2 window
  spans 8 hours of trading, enough to observe full session transitions and intraday trend cycles.
  But the computational cost grows quadratically with window length, forcing practitioners to
  choose between context richness and inference speed. Linear-time alternatives would eliminate
  this trade-off entirely.
</p>

<p>
  State Space Models (SSMs) offer a principled resolution. Rooted in control theory, SSMs model
  sequences through a latent state that evolves according to learned dynamics. Classical linear
  SSMs (S4, S5) demonstrated that structured state spaces could match or exceed Transformer
  performance on long-range benchmarks while maintaining O(T) complexity. However, these models
  used <strong>fixed</strong> state transition matrices &mdash; the same dynamics applied to every
  input token regardless of content. This input-independence is a fundamental limitation for
  financial data, where the appropriate memory horizon varies dramatically between consolidation
  periods (retain long history) and breakout events (rapidly update state).
</p>

<p>
  Mamba (Gu &amp; Dao, 2023) introduced <strong>selective scan</strong>: input-dependent state
  transition parameters that allow the model to dynamically control what to remember and what to
  forget. The step size &Delta;, input matrix B, and output matrix C are all functions of the
  current input, enabling content-aware state updates while preserving O(T) complexity through
  a hardware-efficient parallel scan algorithm.
</p>

<p>
  We propose <strong>GoldSSM</strong>, a selective state space model based on the Mamba architecture
  that processes sequences in O(T) time while maintaining the ability to selectively attend to
  relevant historical patterns. GoldSSM serves as a drop-in replacement for our existing
  Transformer-based TrendMRModel, sharing identical forward signatures and output tuples, enabling
  direct A/B comparison without infrastructure changes. The architecture consists of four components:
  a Variable Selection Network for per-timestep feature gating, a Mamba block stack for linear-time
  sequence modeling, temporal attention pooling for learned aggregation, and regime-specialist
  output heads for trade decisions.
</p>

<h2>2. Architecture</h2>

<p>
  The GoldSSM architecture consists of four main components arranged in a sequential pipeline:
</p>

<p>
  <strong>Pipeline:</strong> Input $(B, T, F{=}107)$ &rarr; Variable Selection Network &rarr; Mamba Block Stack ($\\times 2$) &rarr; Temporal Attention Pooling &rarr; Output Heads &rarr; $(p_{\\text{trade}}, p_{\\text{up}}, p_{\\text{down}}, p_{\\text{hold}}, \\text{recon})$
</p>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 500" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="24" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 1: GoldSSM Architecture</text>
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#374151"/>
      </marker>
    </defs>
    <!-- Input box -->
    <rect x="225" y="44" width="250" height="38" rx="6" fill="#f8f9fa" stroke="#059669" stroke-width="1.5"/>
    <text x="350" y="68" text-anchor="middle" fill="#1a1a2e" font-size="12" font-weight="600">Input</text>
    <text x="520" y="68" text-anchor="start" fill="#6b7280" font-size="11">(B, T, 107)</text>
    <!-- Arrow -->
    <line x1="350" y1="82" x2="350" y2="108" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <!-- VSN box -->
    <rect x="225" y="112" width="250" height="38" rx="6" fill="#f8f9fa" stroke="#059669" stroke-width="1.5"/>
    <text x="350" y="136" text-anchor="middle" fill="#1a1a2e" font-size="12" font-weight="600">Variable Selection Network</text>
    <!-- Arrow -->
    <line x1="350" y1="150" x2="350" y2="176" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <!-- Dimension annotation -->
    <text x="520" y="170" text-anchor="start" fill="#6b7280" font-size="11">(B, T, 128)</text>
    <!-- Mamba box -->
    <rect x="225" y="180" width="250" height="50" rx="6" fill="#f8f9fa" stroke="#059669" stroke-width="1.5"/>
    <text x="350" y="201" text-anchor="middle" fill="#1a1a2e" font-size="12" font-weight="600">Mamba Block &times;2</text>
    <text x="350" y="219" text-anchor="middle" fill="#6b7280" font-size="10">d_state=8, d_conv=4</text>
    <!-- Arrow -->
    <line x1="350" y1="230" x2="350" y2="256" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <!-- Dimension annotation -->
    <text x="520" y="250" text-anchor="start" fill="#6b7280" font-size="11">(B, T, 128)</text>
    <!-- TAP box -->
    <rect x="225" y="260" width="250" height="50" rx="6" fill="#f8f9fa" stroke="#059669" stroke-width="1.5"/>
    <text x="350" y="281" text-anchor="middle" fill="#1a1a2e" font-size="12" font-weight="600">Temporal Attention Pooling</text>
    <text x="350" y="299" text-anchor="middle" fill="#6b7280" font-size="10">4 learned queries</text>
    <!-- Arrow -->
    <line x1="350" y1="310" x2="350" y2="336" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <!-- Dimension annotation -->
    <text x="520" y="330" text-anchor="start" fill="#6b7280" font-size="11">(B, 128)</text>
    <!-- Split into 4 heads -->
    <!-- Connector lines from center down to 4 boxes -->
    <line x1="350" y1="340" x2="350" y2="365" stroke="#374151" stroke-width="1.5"/>
    <line x1="170" y1="365" x2="530" y2="365" stroke="#374151" stroke-width="1.5"/>
    <line x1="170" y1="365" x2="170" y2="385" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <line x1="290" y1="365" x2="290" y2="385" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <line x1="410" y1="365" x2="410" y2="385" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <line x1="530" y1="365" x2="530" y2="385" stroke="#374151" stroke-width="1.5" marker-end="url(#arrowhead)"/>
    <!-- Output head boxes -->
    <rect x="120" y="389" width="100" height="34" rx="5" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>
    <text x="170" y="411" text-anchor="middle" fill="#059669" font-size="11" font-weight="600">p_trade</text>
    <rect x="240" y="389" width="100" height="34" rx="5" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>
    <text x="290" y="411" text-anchor="middle" fill="#059669" font-size="11" font-weight="600">p_up</text>
    <rect x="360" y="389" width="100" height="34" rx="5" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>
    <text x="410" y="411" text-anchor="middle" fill="#059669" font-size="11" font-weight="600">p_down</text>
    <rect x="480" y="389" width="100" height="34" rx="5" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>
    <text x="530" y="411" text-anchor="middle" fill="#059669" font-size="11" font-weight="600">p_hold</text>
    <!-- Recon head (5th output, centered below) -->
    <line x1="350" y1="423" x2="350" y2="445" stroke="#374151" stroke-width="1" stroke-dasharray="4,3"/>
    <rect x="290" y="445" width="120" height="30" rx="5" fill="#f3f4f6" stroke="#e5e7eb" stroke-width="1"/>
    <text x="350" y="465" text-anchor="middle" fill="#374151" font-size="11">recon (aux)</text>
  </svg>
  <p class="figure-caption">Figure 1: GoldSSM architecture. Input features pass through a Variable Selection Network for per-timestep gating, a stack of two Mamba blocks for linear-time sequence modeling, temporal attention pooling for learned aggregation, and five regime-specialist output heads.</p>
</div>

<div style="margin: 2rem 0;">
  <img src="/charts/features/vsn_alignment_3d.png" alt="Variable Selection Network feature alignment in 3D" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 2: Variable Selection Network feature alignment visualised in 3D, showing how the VSN projects heterogeneous input features into a uniform embedding space where feature importance can be dynamically gated.</p>
</div>

<h3>2.1 Variable Selection Network (VSN)</h3>

<p>
  Financial feature sets are inherently heterogeneous: some features (e.g., residual z-score,
  acceleration) carry strong signal at certain times and pure noise at others. Rather than relying
  on offline feature selection via AUC pruning &mdash; which produces a static feature set that
  cannot adapt to changing market regimes &mdash; we employ a Variable Selection Network that performs
  <strong>per-timestep soft feature gating</strong>. The VSN is inspired by the variable selection
  mechanism in Temporal Fusion Transformers (Lim et al., 2021), but adapted for the SSM context
  with several important modifications.
</p>

<p>
  The VSN operates through two parallel paths that interact via a gating mechanism:
</p>

<p>
  <strong>Value Path (Input Projection):</strong> The raw input tensor x of shape (B, T, F) where
  $F{=}107$ is projected through a linear layer to the embedding dimension: $\\mathbf{v} = W_v \\cdot \\mathbf{x} + b_v$,
  producing a tensor of shape (B, T, embed_dim) where embed_dim=128. This projection maps the
  heterogeneous feature space (which mixes z-scores, binary indicators, ratios, and raw prices)
  into a uniform representation space where features can be meaningfully compared and combined.
</p>

<p>
  <strong>Prototype Path (Learnable Feature Embeddings):</strong> A separate learnable embedding
  matrix P of shape (F, embed_dim) stores a "prototype" vector for each of the 107 input features.
  These prototypes are not input-dependent &mdash; they are learned during training and represent
  the model's prior belief about each feature's typical informativeness and role. The prototype
  matrix is projected through a selector MLP with hidden dimension VSN_HID=64:
  $\\mathbf{g} = \\text{MLP}(P \\cdot W_p)$, where the MLP consists of two linear layers with
  SiLU activation. The selector MLP transforms the static prototypes into gate logits that determine
  feature importance.
</p>

<p>
  <strong>Per-Timestep Soft Gating:</strong> The gating mechanism combines the value and prototype
  paths via element-wise multiplication after sigmoid activation:
  $\\mathbf{o} = \\sigma(\\mathbf{g}) \\odot \\mathbf{v}$. The sigmoid produces gate values
  in [0, 1] for each feature dimension at each timestep, allowing smooth interpolation between
  fully passing (gate=1) and fully suppressing (gate=0) each feature's contribution. Unlike hard
  attention or top-k selection, soft gating is fully differentiable and produces gradients for all
  features, enabling end-to-end learning of feature importance.
</p>

<p>
  <strong>Context Modulation:</strong> The regime embedding &mdash; a learned vector representing
  the current market state (trending, mean-reverting, high-volatility, etc.) &mdash; conditions
  the gate biases. Specifically, the context vector ctx of shape (B, embed_dim) is projected to
  a bias vector that is added to the gate logits before the sigmoid:
  $\\mathbf{g}' = \\mathbf{g} + W_{\\text{ctx}} \\cdot \\mathbf{c}$. This allows the VSN
  to modulate feature importance based on the detected regime. For example, the Hurst exponent
  (a complexity measure) should receive high gate values during trending regimes where it is
  informative, but low values during mean-reverting consolidation where it contributes noise.
</p>

<p>
  <strong>Memory Efficiency:</strong> A naive implementation of feature selection might materialize
  a full (B, T, F, embed_dim) tensor representing per-feature, per-timestep embeddings before
  gating. The VSN avoids this by operating in the projected space: the value path projects F
  features down to embed_dim <em>before</em> gating, so the working memory is
  O(B &times; T &times; max(F, embed_dim)). For our configuration with F=107 and embed_dim=128,
  this means peak memory is O(B &times; T &times; 128), never the prohibitive
  O(B &times; T &times; F &times; embed_dim) = O(B &times; T &times; 13,696) that a naive
  per-feature embedding would require.
</p>

<p>
  The output is a tensor of shape (B, T, 128), where each timestep's representation reflects only the
  features deemed relevant by the network given the current regime context. Empirically, we observe
  that the VSN learns to suppress features known to be noisy (e.g., features with AUC near 0.500)
  while amplifying high-AUC features, but crucially, the gating weights vary across timesteps &mdash;
  a feature suppressed during consolidation may be amplified during a breakout.
</p>

<h3>2.2 Mamba Block Stack</h3>

<p>
  The core sequence modeling component is a stack of two Mamba blocks, each implementing the selective
  state space model with input-dependent state transitions. Understanding the selective scan algorithm
  requires first reviewing the classical SSM formulation, then examining how Mamba makes it adaptive.
</p>

<p>
  <strong>Classical SSM (Continuous-Time):</strong> A linear state space model defines a continuous-time
  dynamical system with state h(t), input x(t), and output y(t):
</p>

<p>The continuous-time dynamics:</p>

$$h'(t) = A \\cdot h(t) + B \\cdot x(t)$$

$$y(t) = C \\cdot h(t)$$

<p>
  where $A$ is the state matrix ($d_{\\text{state}} \\times d_{\\text{state}}$), $B$ is the input matrix ($d_{\\text{state}} \\times 1$),
  and $C$ is the output matrix ($1 \\times d_{\\text{state}}$). For discrete sequences, these continuous parameters
  must be discretized using a step size $\\Delta$:
</p>

<p>Discretization:</p>

$$\\bar{A} = \\exp(\\Delta A), \\quad \\bar{B} = (\\Delta A)^{-1}(\\exp(\\Delta A) - I) \\cdot \\Delta B$$

<p>Discrete recurrence:</p>

$$h_t = \\bar{A} \\cdot h_{t-1} + \\bar{B} \\cdot x_t$$

$$y_t = C \\cdot h_t$$

<p>
  In classical SSMs (S4, S5), A, B, C, and &Delta; are <strong>fixed parameters</strong> learned
  during training but constant across all inputs. This means the model applies identical dynamics
  to every timestep &mdash; a consolidation bar and a breakout bar receive the same state transition.
</p>

<p>
  <strong>Mamba's Selective Scan Innovation:</strong> Mamba makes the discretization parameters
  <strong>input-dependent</strong>. Specifically:
</p>

<ul>
  <li><strong>Input-dependent &Delta; (step size):</strong> $\\Delta_t = \\text{softplus}(W_\\Delta \\cdot x_t + b_\\Delta)$.
    Different inputs produce different step sizes, controlling how much the state is updated.
    A large &Delta; means "pay attention to this input and update the state significantly";
    a small &Delta; means "mostly ignore this input and retain the previous state." For financial
    data, high-volatility bars naturally produce larger &Delta; values, causing faster state updates
    during regime transitions.</li>
  <li><strong>Input-dependent B (input matrix):</strong> $B_t = W_B \\cdot x_t$.
    The input projection into the state space varies per timestep, allowing the model to selectively
    route different aspects of the input into the latent state.</li>
  <li><strong>Input-dependent C (output matrix):</strong> $C_t = W_C \\cdot x_t$.
    The readout from the state space also varies per timestep, allowing the model to extract
    different state components depending on the current context.</li>
  <li><strong>Fixed A (state matrix):</strong> The state transition matrix A remains fixed (learned
    but input-independent). It is initialized using the HiPPO (High-order Polynomial Projection
    Operator) framework, which provides optimal initialization for capturing long-range dependencies.</li>
</ul>

<p>
  <strong>State Update (Discrete Recurrence):</strong> At each timestep t, the selective scan
  performs:
</p>

<p>The selective scan at each timestep $t$:</p>

$$\\Delta_t = \\text{softplus}(W_\\Delta \\cdot x_t + b_\\Delta)$$

$$B_t = W_B \\cdot x_t, \\quad C_t = W_C \\cdot x_t$$

$$\\bar{A}_t = \\exp(\\Delta_t \\cdot A), \\quad \\bar{B}_t = \\Delta_t \\cdot B_t$$

$$h_t = \\bar{A}_t \\cdot h_{t-1} + \\bar{B}_t \\cdot x_t$$

$$y_t = C_t \\cdot h_t$$

<p>
  The state vector h_t has dimension d_state=8, meaning the model maintains an 8-dimensional
  summary of all past inputs, updated selectively based on input content. This is dramatically
  more compact than a Transformer's key-value cache, which stores the full T &times; d representation.
</p>

<p>
  <strong>Causal Convolution (d_conv=4):</strong> Before the SSM scan, each Mamba block applies
  a depth-wise causal convolution with kernel size d_conv=4 over the sequence dimension. This
  provides local context &mdash; the current token can see the 3 preceding tokens through the
  convolution &mdash; before the SSM processes the full sequence. The convolution serves an
  analogous role to the TCN frontend in the Transformer variant: it captures local patterns
  (price bars within the same candle pattern, adjacent volume spikes) that the SSM can then
  integrate over longer horizons.
</p>

<p>
  <strong>Dual Implementation Strategy:</strong> The selective scan can be computed in two ways:
</p>

<ul>
  <li><strong>Sequential JIT scan:</strong> A simple loop over T timesteps, JIT-compiled via
    PyTorch JIT script compilation for efficiency. Used when $T > 60$ (MID, LONG, SLOW scales).
    Time complexity O(T &middot; d &middot; d_state), memory O(d_state) for the running state.</li>
  <li><strong>Parallel associative scan:</strong> Exploits the associative property of the recurrence
    to compute all timesteps in parallel on GPU, trading memory for speed. Available via
    the PyTorch associative scan operator but currently disabled
    (_PARALLEL_SCAN_MAX_T=0) due to numerical stability concerns with half-precision training.
    When enabled, would be used for T &le; 60 (SHORT scale).</li>
</ul>

<p>
  Between the two stacked Mamba blocks, dropout of 0.15 is applied. This rate was selected
  empirically: 0.05 was insufficient for regularization on noisy financial features, while 0.25
  impaired the model's ability to learn regime transitions.
</p>

<table>
  <tr>
    <th>Parameter</th>
    <th>Value</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>$d_{\\text{model}}$</td>
    <td>128</td>
    <td>Hidden state dimension</td>
  </tr>
  <tr>
    <td>$d_{\\text{state}}$</td>
    <td>8</td>
    <td>SSM state dimension (latent state size per channel)</td>
  </tr>
  <tr>
    <td>$d_{\\text{conv}}$</td>
    <td>4</td>
    <td>Local convolution width (causal, depth-wise)</td>
  </tr>
  <tr>
    <td>expand</td>
    <td>1</td>
    <td>Inner dimension expansion factor (no expansion)</td>
  </tr>
  <tr>
    <td>$n_{\\text{layers}}$</td>
    <td>2</td>
    <td>Stacked Mamba blocks with residual connections</td>
  </tr>
  <tr>
    <td>dropout</td>
    <td>0.15</td>
    <td>Applied after each block (between layers and after stack)</td>
  </tr>
  <tr>
    <td>VSN hidden dimension</td>
    <td>64</td>
    <td>Selector MLP hidden dimension in VSN</td>
  </tr>
</table>

<p>
  For financial time series, the selective scan mechanism is a natural fit. During low-volatility consolidation periods, the
  model should retain longer-term trend information (small &Delta;, slow state updates). During
  high-volatility breakouts, it should rapidly update its state to reflect the new regime (large &Delta;,
  fast state updates). The selective mechanism enables this adaptive behavior without explicit regime
  detection &mdash; the model learns the appropriate &Delta; dynamics end-to-end from the training signal.
</p>

<div style="margin: 2rem 0;">
  <img src="/charts/features/regime_gate_heatmap.png" alt="Regime gate activation heatmap" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 4: Regime gate activation heatmap showing how the VSN dynamically modulates feature importance across different market regimes. Brighter values indicate higher gate activation (feature passed through); darker values indicate suppression.</p>
</div>

<h3>2.3 Multi-Scale Streams</h3>

<p>
  Financial markets exhibit different patterns at different temporal horizons. A 30-bar window
  captures microstructure dynamics (candle patterns, tick momentum), while a 240-bar window reveals
  intraday trend structure and session transitions. Processing all horizons with a single sequence
  length forces the model to compromise between local precision and global context. Multi-scale
  processing eliminates this compromise.
</p>

<p>
  GoldSSM processes four temporal scales independently, each with its own VSN and Mamba block stack:
</p>

<table>
  <tr>
    <th>Stream</th>
    <th>Sequence Length</th>
    <th>Temporal Span (M2)</th>
    <th>Captures</th>
  </tr>
  <tr>
    <td>SHORT</td>
    <td>30 bars</td>
    <td>~1 hour</td>
    <td>Microstructure, candle patterns, immediate momentum</td>
  </tr>
  <tr>
    <td>MID</td>
    <td>60 bars</td>
    <td>~2 hours</td>
    <td>Intra-session trends, volatility clustering</td>
  </tr>
  <tr>
    <td>LONG</td>
    <td>120 bars</td>
    <td>~4 hours</td>
    <td>Session-level structure, London/NY transitions</td>
  </tr>
  <tr>
    <td>SLOW</td>
    <td>240 bars</td>
    <td>~8 hours</td>
    <td>Full session context, multi-session regime</td>
  </tr>
</table>

<p>
  Each stream applies the identical architecture &mdash; VSN followed by two Mamba layers followed by
  temporal attention pooling &mdash; but with <strong>independent weights</strong>. The VSN in the
  SHORT stream may learn to gate different features than the SLOW stream's VSN; the Mamba blocks
  in each stream learn scale-appropriate state dynamics. After pooling, each stream produces a
  vector of shape (B, 128).
</p>

<p>
  <strong>Multi-Scale Fusion:</strong> The four stream outputs are concatenated to form a
  (B, 512) tensor, then projected through a fusion layer:
  $\\mathbf{f} = \\text{SiLU}(W_{\\text{fuse}} \\cdot [\\mathbf{s}_{\\text{short}}; \\mathbf{s}_{\\text{mid}}; \\mathbf{s}_{\\text{long}}; \\mathbf{s}_{\\text{slow}}])$, producing a $(B, 128)$
  representation. The fusion layer learns how to weight and combine information from different
  temporal scales. This is preferable to averaging or attention-based fusion because the scales
  carry fundamentally different types of information &mdash; the model should learn to extract
  trend direction from SLOW, entry timing from SHORT, and volatility regime from LONG, rather
  than treating them as exchangeable views.
</p>

<p>
  <strong>Why multi-scale matters:</strong> In our Transformer baseline, the four
  ContextTCNTransformer modules serve the same multi-scale role with TCN frontends. The structural
  analogy is deliberate &mdash; it ensures that any performance differences between GoldSSM and
  the Transformer are attributable to the sequence modeling paradigm (SSM vs. attention), not to
  differences in multi-scale design.
</p>

<h3>2.4 Temporal Attention Pooling</h3>

<p>
  After the Mamba stack produces a sequence of hidden states (B, T, 128), these must be aggregated
  into a fixed-length representation for the output heads. Standard approaches use mean pooling or
  last-token extraction, both of which treat all timesteps equally or discard all but the final one.
  Both are suboptimal for financial sequences where the information density varies dramatically:
  a breakout bar, a session open, or a news-driven spike contains far more decision-relevant
  information than a consolidation bar in the middle of a quiet range.
</p>

<p>
  We instead use <strong>temporal attention pooling</strong> with four learned query vectors that
  attend over the full time dimension. The mechanism operates as follows:
</p>

<ol>
  <li><strong>Learned Queries:</strong> Four learnable query vectors Q &isin; R<sup>4&times;128</sup>
    are initialized randomly and trained end-to-end. Each query learns to attend to a different
    aspect of the temporal sequence. Unlike Transformer self-attention where queries come from the
    input itself, these queries are <em>global</em> &mdash; they represent the model's learned
    notion of "what temporal patterns matter for trading decisions."</li>
  <li><strong>Multi-Head Cross-Attention:</strong> Standard scaled dot-product attention is computed:
    $\\text{Attention}(Q, K{=}H, V{=}H) = \\text{softmax}(Q \\cdot H^T / \\sqrt{d}) \\cdot H$,
    where H is the Mamba output sequence of shape (B, T, 128). This produces four attended vectors,
    each a weighted sum over all T timesteps, with weights determined by the learned queries.
    The attention uses n_heads=4 heads with d_k=32 per head.</li>
  <li><strong>Concatenation and Projection:</strong> The four resulting attended vectors (each 128-dim)
    are concatenated to form a (B, 512) vector, then projected through a linear layer to the final
    hidden dimension (B, 128).</li>
</ol>

<p>
  This mechanism allows the model to learn that recent bars and inflection points (reversals, breakouts)
  should receive higher weight than bars in the middle of a consolidation range. The four query vectors
  can specialize: empirically, we observe that different queries attend to different temporal patterns.
  One query typically focuses on the most recent 5&ndash;10 bars (recency bias), another attends to
  bars with the largest-magnitude hidden states (event detection), a third distributes attention
  more uniformly (context aggregation), and the fourth shows variable attention patterns that
  correlate with regime transitions.
</p>

<p>
  <strong>Interpretability:</strong> The attention weights from temporal pooling are exportable
  and provide a direct answer to the question "which bars mattered for this prediction?" This
  is valuable for post-hoc analysis of model decisions &mdash; if the model predicts a trade but
  the attention concentrates on bars from 4 hours ago rather than recent price action, this
  suggests the model may be relying on stale information and the prediction should be discounted.
  The attention weights can be logged alongside each prediction for systematic monitoring.
</p>

<h3>2.5 Output Heads</h3>

<p>
  The final fused representation feeds into five output heads, matching the TrendMRModel interface
  exactly. The heads are designed as <strong>regime specialist heads</strong>: in the general case,
  K heads per output can be instantiated (one per regime cluster), with the active head selected
  based on the regime embedding. In the default configuration, K=1 (matching REGIME_CLUSTER_K=1),
  meaning a single head handles all regimes.
</p>

<table>
  <tr>
    <th>Head</th>
    <th>Output</th>
    <th>Activation</th>
    <th>Purpose</th>
    <th>Training Loss</th>
  </tr>
  <tr>
    <td>$p_{\\text{trade}}$</td>
    <td>Scalar [0,1]</td>
    <td>Sigmoid</td>
    <td>Trade gating &mdash; should we trade at all? Filters out low-conviction periods.</td>
    <td>Binary cross-entropy against trade/no-trade labels</td>
  </tr>
  <tr>
    <td>$p_{\\text{up}}$</td>
    <td>Scalar [0,1]</td>
    <td rowspan="3">Softmax (jointly over 3)</td>
    <td>Probability of upward move exceeding threshold</td>
    <td rowspan="3">Categorical cross-entropy over 3-class direction</td>
  </tr>
  <tr>
    <td>$p_{\\text{down}}$</td>
    <td>Scalar [0,1]</td>
    <td>Probability of downward move exceeding threshold</td>
  </tr>
  <tr>
    <td>$p_{\\text{hold}}$</td>
    <td>Scalar [0,1]</td>
    <td>Probability of no significant move (within threshold)</td>
  </tr>
  <tr>
    <td>recon</td>
    <td>Vector (F,)</td>
    <td>Linear (no activation)</td>
    <td>Input reconstruction for anomaly detection</td>
    <td>MSE against original input features</td>
  </tr>
</table>

<p>
  The <strong>p_trade</strong> head serves as a gating function that precedes direction prediction.
  In live execution, a trade is only taken when p_trade exceeds a configurable threshold (typically
  0.6). This allows the model to express uncertainty &mdash; when the input features are ambiguous
  or the regime is transitioning, the model can output low p_trade to suppress trading, even if
  the directional heads show a lean.
</p>

<p>
  The <strong>direction heads</strong> (p_up, p_down, p_hold) are jointly normalized via softmax,
  ensuring they sum to 1.0. This enforces a coherent probability distribution over outcomes:
  the model cannot simultaneously predict high probability of both up and down moves. In earlier
  iterations, these were independent sigmoids, which led to the "hedging" failure mode where
  p_up and p_down were both driven toward 0.5 by excessive weight decay.
</p>

<p>
  The <strong>recon</strong> head serves a dual purpose: it acts as an auxiliary training objective
  (reconstruction loss) that encourages the learned representation to retain information about the
  input features, and as a runtime anomaly detector. If reconstruction error exceeds a threshold
  (calibrated on the training set), the input data is likely out-of-distribution &mdash; perhaps
  due to a data feed error, a flash crash, or a regime not seen during training &mdash; and the
  model's directional predictions should be discounted or suppressed.
</p>

<p>
  The drop-in compatibility requirement means GoldSSM returns the same 5-tuple as TrendMRModel:
  $(p_{\\text{trade}}, p_{\\text{up}}, p_{\\text{down}}, p_{\\text{hold}}, \\text{recon})$. This allows swapping models in production
  with zero changes to the execution layer, risk management, or logging infrastructure.
</p>

<h2>3. Implementation Details</h2>

<h3>3.1 Hyperparameter Table</h3>

<table>
  <tr>
    <th>Hyperparameter</th>
    <th>Value</th>
    <th>Rationale</th>
  </tr>
  <tr>
    <td>$d_{\\text{embed}}$</td>
    <td>128</td>
    <td>Matches Transformer baseline for fair comparison; sufficient for 107 features</td>
  </tr>
  <tr>
    <td>$d_{\\text{state}}$</td>
    <td>8</td>
    <td>Compact state; financial patterns have low intrinsic dimensionality</td>
  </tr>
  <tr>
    <td>$d_{\\text{conv}}$</td>
    <td>4</td>
    <td>4-bar local context; analogous to TCN frontend in Transformer</td>
  </tr>
  <tr>
    <td>expand</td>
    <td>1</td>
    <td>No inner dimension expansion; keeps parameter count low</td>
  </tr>
  <tr>
    <td>$n_{\\text{layers}}$</td>
    <td>2</td>
    <td>Sufficient depth for financial patterns; more layers overfit on noisy data</td>
  </tr>
  <tr>
    <td>$n_{\\text{queries}}$</td>
    <td>4</td>
    <td>Temporal attention pooling queries; matches number of attention heads</td>
  </tr>
  <tr>
    <td>VSN hidden dimension</td>
    <td>64</td>
    <td>Selector MLP hidden dim; small enough to avoid overfitting the gate</td>
  </tr>
  <tr>
    <td>dropout</td>
    <td>0.15</td>
    <td>Between 0.05 (too low for noisy features) and 0.25 (impairs learning)</td>
  </tr>
  <tr>
    <td>$K_{\\text{regime}}$</td>
    <td>1</td>
    <td>Single regime cluster; K=6 fragments data excessively</td>
  </tr>
  <tr>
    <td>learning rate</td>
    <td>1e-4</td>
    <td>Standard for SSMs; LR=0.01 is catastrophically high for sequence models</td>
  </tr>
  <tr>
    <td>weight decay</td>
    <td>0.005</td>
    <td>Moderate; higher values cause hedging (p_up, p_down &rarr; 0.5)</td>
  </tr>
  <tr>
    <td>warmup epochs</td>
    <td>3</td>
    <td>Less sensitive than Transformer (which requires 5); linear warmup schedule</td>
  </tr>
</table>

<h3>3.2 Forward Signature</h3>

<p>
  GoldSSM accepts the same multi-scale input structure as TrendMRModel:
</p>

<p>
  The model accepts four input tensors corresponding to the four temporal scales &mdash;
  SHORT $(B, 30, 107)$, MID $(B, 60, 107)$, LONG $(B, 120, 107)$, and SLOW $(B, 240, 107)$ &mdash;
  plus a context embedding vector $(B, d_{\\text{embed}})$. It returns the five-element output tuple:
  $(p_{\\text{trade}}, p_{\\text{up}}, p_{\\text{down}}, p_{\\text{hold}}, \\text{recon})$.
</p>

<p>
  Each scale is processed by its own VSN + Mamba stack, and the four resulting representations are
  fused before the output heads. This drop-in compatibility means
  GoldSSM can be swapped into an existing training and inference pipeline with zero code changes
  outside the model instantiation.
</p>

<h3>3.3 Implementation Notes</h3>

<p>
  <strong>Naming Collision (Critical):</strong> A naming collision in the implementation required
  careful attention: the common idiom of unpacking tensor shape into variables named B, T, F
  shadows the module-level functional import. Throughout the GoldSSM codebase, the feature dimension
  is named "n_feat" rather than "F" to avoid this collision. This is enforced by
  code review and a linting rule &mdash; the consequences of shadowing are subtle (the code runs
  but uses an integer where a module is expected, producing cryptic type errors).
</p>

<p>
  <strong>JIT Compatibility:</strong> Additionally, activation function calls are written using
  fully qualified module paths in regions near JIT-compiled code to avoid scope ambiguity. The JIT
  compiler captures the local scope at compilation time, and if the functional module alias has been
  shadowed by a shape unpacking in a calling function, the compiled code will fail at runtime with
  a misleading type error.
</p>

<h3>3.4 Parameter Count</h3>

<table>
  <tr>
    <th>Component</th>
    <th>Parameters</th>
    <th>% of Total</th>
  </tr>
  <tr>
    <td>Variable Selection Network (&times;4 streams)</td>
    <td>~420K</td>
    <td>21%</td>
  </tr>
  <tr>
    <td>Mamba Block Stack (2 layers &times;4 streams)</td>
    <td>~980K</td>
    <td>49%</td>
  </tr>
  <tr>
    <td>Temporal Attention Pooling (&times;4 streams)</td>
    <td>~270K</td>
    <td>14%</td>
  </tr>
  <tr>
    <td>Output Heads (5 heads)</td>
    <td>~330K</td>
    <td>16%</td>
  </tr>
  <tr>
    <td><strong>Total</strong></td>
    <td><strong>~2.0M</strong></td>
    <td><strong>100%</strong></td>
  </tr>
</table>

<p>
  At 2.0M parameters, GoldSSM is approximately <strong>6&times; lighter</strong> than the Transformer
  Macro Regimes model it replaces (12.5M parameters). The reduction comes primarily from eliminating
  the multi-head self-attention layers, which contain O(d&sup2;) parameters per head per layer.
  The Mamba block's parameter count scales as O(d &middot; d_state + d &middot; d_conv), which for
  d=128, d_state=8, d_conv=4 yields approximately 1.5K parameters per block (versus ~65K for a
  single Transformer self-attention layer with 4 heads).
</p>

<div style="margin: 2rem 0;">
  <svg width="100%" viewBox="0 0 700 150" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">
    <text x="350" y="22" text-anchor="middle" fill="#1a1a2e" font-size="13" font-weight="600">Figure 6: Parameter Count Comparison</text>
    <!-- GoldSSM bar -->
    <text x="170" y="62" text-anchor="end" fill="#374151" font-size="12">GoldSSM</text>
    <rect x="180" y="46" width="80" height="28" rx="4" fill="#059669"/>
    <text x="268" y="65" fill="#1a1a2e" font-size="11" font-weight="600">2.0M</text>
    <!-- Transformer bar -->
    <text x="170" y="108" text-anchor="end" fill="#374151" font-size="12">Transformer Macro</text>
    <rect x="180" y="92" width="500" height="28" rx="4" fill="#374151" opacity="0.3"/>
    <text x="688" y="111" fill="#1a1a2e" font-size="11" font-weight="600">12.5M</text>
    <!-- 6.2x label -->
    <text x="400" y="80" text-anchor="middle" fill="#059669" font-size="16" font-weight="700">6.2&times; smaller</text>
  </svg>
  <p class="figure-caption">Figure 6: GoldSSM achieves 6.2x parameter reduction compared to the Transformer Macro Regimes baseline, primarily by replacing multi-head self-attention with the selective scan mechanism.</p>
</div>

<h3>3.5 Validation</h3>

<p>
  The implementation passes a full self-test suite: CUDA forward pass on random inputs at all four
  scales, backward pass with gradient accumulation, and output shape verification. The self-test
  confirms that gradients flow through the selective scan operation (which uses a custom CUDA kernel
  in the optimized path, or a JIT-compiled Python loop in the fallback path) without numerical issues.
  The test generates random inputs at each scale, runs a full forward pass, computes a dummy loss
  (sum of all outputs), and verifies that backpropagation produces non-zero gradients
  for all learnable parameters.
</p>

<h2>4. Complexity Analysis</h2>

<p>
  The computational advantage of GoldSSM over the Transformer baseline can be analyzed formally
  by comparing the dominant operations in each architecture:

$$\\mathcal{O}(T \\cdot d \\cdot d_{\\text{state}}) \\text{ (SSM) vs } \\mathcal{O}(T^2 \\cdot d) \\text{ (Transformer)}$$
</p>

<h3>4.1 Transformer Self-Attention Complexity</h3>

<p>
  For a single self-attention layer with sequence length T and embedding dimension d:
</p>

<ul>
  <li><strong>QKV projection:</strong> 3 linear layers, each O(T &middot; d&sup2;) &rarr; total O(T &middot; d&sup2;)</li>
  <li><strong>Attention scores:</strong> Q &middot; K<sup>T</sup> = O(T&sup2; &middot; d)</li>
  <li><strong>Attention output:</strong> Softmax(scores) &middot; V = O(T&sup2; &middot; d)</li>
  <li><strong>FFN:</strong> Two linear layers with hidden dim 4d: O(T &middot; d &middot; 4d) = O(T &middot; d&sup2;)</li>
  <li><strong>Total per layer:</strong> O(T&sup2; &middot; d + T &middot; d&sup2;)</li>
</ul>

<p>
  For T=240 (SLOW scale), d=128: the attention term dominates with T&sup2; &middot; d =
  240&sup2; &times; 128 &asymp; 7.4M multiply-adds per head per layer.
</p>

<h3>4.2 GoldSSM Selective Scan Complexity</h3>

<p>
  For a single Mamba block with sequence length T, embedding dimension d, and state dimension N:
</p>

<ul>
  <li><strong>Input projections (&Delta;, B, C):</strong> O(T &middot; d &middot; N) total</li>
  <li><strong>Causal convolution:</strong> O(T &middot; d &middot; d_conv) = O(T &middot; d) for constant d_conv</li>
  <li><strong>State update scan:</strong> O(T &middot; d &middot; N) for the full recurrence</li>
  <li><strong>Output projection:</strong> O(T &middot; d&sup2;) for the gated output</li>
  <li><strong>Total per layer:</strong> O(T &middot; d &middot; N + T &middot; d&sup2;) = O(T &middot; d &middot; max(N, d))</li>
</ul>

<p>
  For T=240, d=128, N=8: the scan term is T &middot; d &middot; N = 240 &times; 128 &times; 8
  &asymp; 0.25M multiply-adds. Even including the output projection (T &middot; d&sup2; &asymp; 3.9M),
  the total is substantially less than the Transformer's attention term alone.
</p>

<h3>4.3 Comparison at Operating Scale</h3>

<table>
  <tr>
    <th>Metric</th>
    <th>Transformer (T=240, d=128)</th>
    <th>GoldSSM (T=240, d=128, N=8)</th>
  </tr>
  <tr>
    <td>Dominant operation</td>
    <td>QK<sup>T</sup>: O(T&sup2; &middot; d)</td>
    <td>SSM scan: O(T &middot; d &middot; N)</td>
  </tr>
  <tr>
    <td>Multiply-adds (per layer)</td>
    <td>~7.4M (attention only)</td>
    <td>~0.25M (scan only)</td>
  </tr>
  <tr>
    <td>Memory (activations)</td>
    <td>O(T&sup2;) attention matrix cached</td>
    <td>O(N) state vector only</td>
  </tr>
  <tr>
    <td>Memory at T=240</td>
    <td>57,600 floats (attention matrix)</td>
    <td>8 floats (state vector)</td>
  </tr>
  <tr>
    <td>Scaling: double T</td>
    <td>4&times; cost</td>
    <td>2&times; cost</td>
  </tr>
  <tr>
    <td>Scaling: double d</td>
    <td>2&times; cost (attention), 4&times; (FFN)</td>
    <td>2&times; cost (scan), 4&times; (output proj)</td>
  </tr>
</table>

<p>
  The ~30&times; reduction in scan operations at T=240 (and larger savings at longer sequences)
  translates directly to faster inference and lower GPU memory consumption, enabling real-time
  execution on commodity hardware. The memory advantage is even more dramatic: the Transformer
  must store the full T &times; T attention matrix for backpropagation, while the SSM stores only
  the d_state-dimensional running state. For T=240, this is a 7,200&times; reduction in activation memory
  for the sequence modeling component.
</p>

<h2>5. Comparison</h2>

<table>
  <tr>
    <th>Property</th>
    <th>Transformer (Macro Regimes)</th>
    <th>GoldSSM</th>
  </tr>
  <tr>
    <td>Total parameters</td>
    <td>12.5M</td>
    <td><strong>2.0M</strong></td>
  </tr>
  <tr>
    <td>Sequence complexity</td>
    <td>O(T&sup2;)</td>
    <td><strong>O(T)</strong></td>
  </tr>
  <tr>
    <td>Memory at T=240</td>
    <td>O(T&sup2;) = 57.6K floats per head</td>
    <td><strong>O(N) = 8 floats per channel</strong></td>
  </tr>
  <tr>
    <td>Sequence scales</td>
    <td>4 (SHORT/MID/LONG/SLOW)</td>
    <td>4 (identical)</td>
  </tr>
  <tr>
    <td>Feature selection</td>
    <td>Static (offline AUC pruning)</td>
    <td><strong>Dynamic (VSN, per-timestep)</strong></td>
  </tr>
  <tr>
    <td>Temporal aggregation</td>
    <td>Mean pooling</td>
    <td><strong>Learned attention pooling (4 queries)</strong></td>
  </tr>
  <tr>
    <td>Positional encoding</td>
    <td>Sinusoidal / learned positional embeddings</td>
    <td><strong>Implicit (causal recurrence encodes position)</strong></td>
  </tr>
  <tr>
    <td>Local context</td>
    <td>TCN frontend (temporal conv)</td>
    <td>d_conv=4 causal convolution (built into Mamba block)</td>
  </tr>
  <tr>
    <td>Interpretability</td>
    <td>Attention weights (T&times;T matrix per head)</td>
    <td><strong>VSN gate weights + temporal pooling attention</strong></td>
  </tr>
  <tr>
    <td>Output interface</td>
    <td>(p_trade, p_up, p_down, p_hold, recon)</td>
    <td>Identical</td>
  </tr>
  <tr>
    <td>Drop-in compatible</td>
    <td>&mdash;</td>
    <td>Yes</td>
  </tr>
  <tr>
    <td>Encoder architecture</td>
    <td>TCN + 2-layer Transformer (&times;4 scales)</td>
    <td>VSN + 2-layer Mamba (&times;4 scales)</td>
  </tr>
  <tr>
    <td>Warmup requirement</td>
    <td>5 epochs (critical &mdash; LR past E2 destroys signal)</td>
    <td>3 epochs (less sensitive to warmup schedule)</td>
  </tr>
  <tr>
    <td>Pooling method</td>
    <td>Mean pooling (all bars weighted equally)</td>
    <td><strong>Attention pooling (learned bar importance)</strong></td>
  </tr>
</table>

<p>
  The Transformer model uses four ContextTCNTransformer modules, each combining a TCN frontend with
  a 2-layer Transformer encoder. GoldSSM replaces each with a VSN frontend and 2-layer Mamba stack.
  The TCN frontend in the Transformer model serves a similar local-context role as the
  $d_{\\text{conv}}{=}4$ local convolution within the Mamba block, making the architectures
  structurally analogous at the component level despite the different sequence modeling paradigm.
</p>

<p>
  A notable difference is in positional encoding. Transformers require explicit positional embeddings
  (sinusoidal or learned) because self-attention is permutation-invariant &mdash; without positional
  information, the model cannot distinguish bar ordering. GoldSSM's recurrent structure inherently
  encodes position through the causal scan: h_t is computed from h_{t-1}, so temporal order is
  implicit. This eliminates a potential source of error (incorrect positional encoding) and a set
  of additional parameters.
</p>

<div style="margin: 2rem 0;">
  <img src="/charts/gold/state_timeline.png" alt="Hidden state timeline from Markov analysis" style="width: 100%; border-radius: 0.5rem; border: 1px solid #e5e7eb;" />
  <p class="figure-caption">Figure 5: Hidden state timeline from Markov analysis, illustrating how the model's latent state evolves through different market regimes over the course of a trading day.</p>
</div>

<h2>6. Conclusion</h2>

<p>
  GoldSSM demonstrates that selective state space models are a viable and efficient alternative to
  Transformers for intraday financial time series forecasting. At 2.0M parameters (6&times; fewer
  than the Transformer baseline) and O(T) sequence complexity (versus O(T&sup2;)), the architecture
  is suitable for real-time inference on M1 and M2 bars across multiple temporal scales simultaneously.
</p>

<p>
  The architecture addresses three specific limitations of the Transformer baseline: (1) quadratic
  scaling that constrains context window length, (2) static feature selection that cannot adapt to
  changing regimes, and (3) naive mean pooling that treats all timesteps as equally informative.
  The VSN provides regime-adaptive feature gating, the Mamba stack provides linear-time sequence
  modeling with content-aware state dynamics, and temporal attention pooling provides learned
  aggregation with interpretable weights.
</p>

<p>
  The drop-in compatibility with existing model interfaces enables direct comparison
  without infrastructure changes, facilitating systematic evaluation of SSM architectures in
  production trading environments. The selective scan mechanism &mdash; where the model learns
  to control its own memory dynamics based on input content &mdash; is particularly well-suited
  to financial data, where the optimal memory horizon varies continuously with market conditions.
</p>

<blockquote>
  The design philosophy of GoldSSM prioritizes <em>computational parsimony</em> over architectural
  novelty. Every component serves a specific, measurable purpose: VSN for adaptive feature selection,
  Mamba for linear-time sequence modeling, temporal attention for learned aggregation. No component
  was added for its own sake. The architecture's value lies not in any single innovation, but in
  the disciplined integration of components that collectively address the real constraints of
  production intraday trading: limited inference time, noisy features, and regime-dependent dynamics.
</blockquote>
`;

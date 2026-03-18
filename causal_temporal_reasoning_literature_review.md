# Causal Temporal Reasoning in Machine Learning: Comprehensive Literature Review

*Compiled: 2026-03-18*

---

## Table of Contents
1. [Historical Development (Chronological)](#1-historical-development)
2. [Key Papers with Full Citations](#2-key-papers-with-full-citations)
3. [Current Bottlenecks](#3-current-bottlenecks)
4. [Mathematical Foundations](#4-mathematical-foundations)
5. [The Gap: End-to-End Differentiable Causal Structure Learning](#5-the-gap)
6. [Full Reference List](#6-full-reference-list)

---

## 1. Historical Development

### Phase 1: Statistical Foundations (1969-1990s)

**Granger Causality (1969)**
Clive Granger proposed that a time series X "Granger-causes" Y if past values of X contain information that helps predict Y beyond Y's own past. This was the first formal, testable definition of temporal causality in econometrics. The key insight: causality is operationalized as predictive improvement, not true mechanistic causation. Limitations: linear, bivariate, assumes stationarity, confounded by latent variables.

**Structural Equation Models (1970s-1980s)**
Simultaneous equation models in econometrics (Haavelmo, 1943; Goldberger, 1972) evolved into path analysis and structural equation models. Judea Pearl later formalized these as Structural Causal Models (SCMs), but the econometric tradition established the idea that causal relations could be encoded as directed equations with error terms representing exogenous noise.

**PC Algorithm (1991/2000)**
Peter Spirtes, Clark Glymour, and Richard Scheines developed constraint-based causal discovery. The PC algorithm starts with a fully connected graph and removes edges via conditional independence tests, then orients edges using v-structures. This was foundational: it showed causal graphs could be learned from observational data under faithfulness and causal sufficiency assumptions.

### Phase 2: Information-Theoretic and Formal Causal Frameworks (2000-2010)

**Transfer Entropy (Schreiber, 2000)**
Thomas Schreiber introduced transfer entropy as a nonparametric, information-theoretic measure of directed information transfer between time series. Unlike Granger causality, it captures nonlinear dependencies. Defined as the reduction in uncertainty about the future of Y given the past of X, beyond what Y's own past provides. Equivalent to Granger causality for Gaussian processes, but strictly more general.

**Pearl's do-Calculus (2000/2009)**
Judea Pearl's "Causality" book formalized the distinction between observational conditioning P(Y|X) and interventional distributions P(Y|do(X)). The do-calculus provides three rules for reducing interventional queries to observational ones when a causal DAG is known. This was revolutionary: it separated statistical association from causal effect and provided a complete calculus for causal reasoning. The Structural Causal Model (SCM) framework unifies counterfactuals, interventions, and observational distributions.

**FCI Algorithm (Spirtes, 1995/2000)**
The Fast Causal Inference algorithm extended PC to handle latent confounders and selection bias, outputting Partial Ancestral Graphs (PAGs) instead of DAGs. Critical for real-world applications where causal sufficiency cannot be assumed.

### Phase 3: Computational Causal Discovery (2010-2018)

**Score-Based Methods and Continuous Optimization**
Traditional score-based methods (GES, Greedy Equivalence Search) searched over DAG equivalence classes. The breakthrough came with:

**NOTEARS (Zheng et al., 2018)**
"DAGs with NO TEARS" reformulated the combinatorial DAG constraint as a continuous, smooth equality constraint: tr(e^{W circ W}) - d = 0, where W is the weighted adjacency matrix. This enabled gradient-based optimization for structure learning, transforming an NP-hard combinatorial problem into standard continuous optimization. Published at NeurIPS 2018.

**Peters, Janzing, Scholkopf (2017)**
"Elements of Causal Inference" provided a unified treatment of causal discovery from the perspective of asymmetries between cause and effect distributions. Key contributions: additive noise models, independence of cause and mechanism (ICM principle), causal inference from two variables.

### Phase 4: Neural Causal Discovery (2018-2022)

**Neural Granger Causality (Tank et al., 2021)**
Alex Tank, Ian Covert, Nicholas Foti, Ali Shojaie, and Emily Fox parameterized Granger causality using neural networks (MLPs and LSTMs), applying group sparsity penalties on input-layer weights to identify which input series causally influence each output. This allowed nonlinear Granger causality detection while maintaining interpretability through structured sparsity. Published in IEEE TPAMI.

**Temporal Causal Discovery Framework - TCDF (Nauta et al., 2019)**
Meike Nauta, Doina Bucur, and Christin Seifert proposed using attention-based convolutional neural networks for temporal causal discovery. Attention weights serve as proxies for causal influence, with a validation step using causal graph properties.

**PCMCI (Runge, 2018/2019) and PCMCI+ (Runge, 2020)**
Jakob Runge developed PCMCI, combining the PC algorithm's constraint-based approach with momentary conditional independence (MCI) testing specifically designed for autocorrelated time series. PCMCI first removes irrelevant conditions (PC-stable step), then tests remaining links with MCI. PCMCI+ (2020) extended this to discover contemporaneous causal links alongside lagged ones, published at UAI 2020.

**DYNOTEARS (Pamfil et al., 2020)**
Extended NOTEARS to time series, simultaneously learning intra-slice (contemporaneous) and inter-slice (lagged) causal structures in dynamic Bayesian networks. Uses the same continuous acyclicity constraint but applied to temporal adjacency matrices. Published at AISTATS 2020.

### Phase 5: Amortized and Scalable Causal Discovery (2020-2024)

**Amortized Causal Discovery (Lowe et al., 2022)**
Sindy Lowe, David Madras, Richard Zemel, and Max Welling introduced the idea of training a single model to infer causal graphs across multiple time-series datasets with different underlying structures. Rather than fitting a new model per dataset, the approach amortizes the cost by learning shared dynamics. Published at CLeaR 2022.

**Amortized Inference for Causal Structure Learning (Lorch et al., 2022)**
Lars Lorch, Scott Sussex, Jonas Rothfuss, Andreas Krause, and Bernhard Scholkopf proposed learning a function that maps datasets to posterior distributions over causal graphs, enabling rapid inference on new datasets without re-optimization.

**Demystifying Amortized Causal Discovery with Transformers (Montagna et al., 2024)**
Investigated why transformer-based amortized causal discovery (CSIvA) works despite seemingly bypassing identifiability assumptions. Key finding: constraints on training data distributions implicitly define priors on test observations, and training on multiple model classes improves generalization because ambiguous cases are rare in practice. arXiv:2405.16924.

**CUTS and CUTS+ (Cheng et al., 2023)**
Neural causal discovery from irregular time-series data. CUTS uses a Delayed Supervision GNN for imputation combined with causal graph fitting. CUTS+ adds coarse-to-fine discovery with message-passing GNNs for high-dimensional scaling. Published at ICLR 2023 and submitted to AAAI 2024.

### Phase 6: Causal Representation Learning for Temporal Data (2022-2026)

**Learning Latent Causal Dynamics - LiLY (Yao, Chen, Zhang, 2022)**
Identifies hidden causal variables in time series and decomposes distribution shifts into changes in latent dynamics vs. observation generation. Enables few-shot adaptation to new environments.

**Temporally Disentangled Representation Learning - TDRL (Yao, Chen, Zhang, 2022)**
Identifiability theory for recovering time-delayed latent causal variables from sequential data under nonparametric causal influences. Published at NeurIPS 2022.

**CITRIS (Lippe et al., 2022)**
Causal identifiability from temporal intervened sequences. Leverages temporal data and intervention information to identify causal factors in image sequences. Published at ICML 2022.

**CaRiNG (Chen et al., 2024)**
Handles non-invertible (lossy) generation processes in temporal causal representation learning. Establishes identifiability even when the observation mapping loses information. Published at ICML 2024.

**IDOL (Li et al., 2024/2026)**
Identification framework for instantaneous latent dynamics. Handles both time-delayed and instantaneous causal relations among latent variables using sparse influence constraints. arXiv:2405.15325.

**CtrlNS (Song et al., 2024)**
Causal Temporal Representation Learning with Nonstationary Sparse Transition. Removes the need to directly observe domain variables or assume Markov priors. arXiv:2409.03142.

### Phase 7: Latest Advances (2024-2026)

**Jacobian Regularizer-based Neural Granger Causality - JRNGC (Zhou et al., 2024)**
Single-model approach using input-output Jacobian matrices as causal weight matrices, learning both summary and full-time Granger causality simultaneously. Published at ICML 2024.

**GC-KAN (Lin et al., 2024)**
Granger Causality with Kolmogorov-Arnold Networks. KANs outperform MLPs for sparse causal pattern detection in high-dimensional settings. arXiv:2412.15373.

**GC-xLSTM (Poonia et al., 2025)**
Neural Granger causality with Extended LSTM. Dynamic loss penalty on initial projection for sparsity. Accepted at NeurIPS 2025. arXiv:2502.09981.

**SC3D (Das et al., 2026)**
Stable Causal Dynamic Differentiable Discovery. Jointly learns lag-specific adjacency matrices and instantaneous DAGs via two-stage edge preselection and likelihood optimization. arXiv:2602.02830.

**DoFlow (Wu et al., 2026)**
Flow-based generative models for interventional and counterfactual forecasting on time series. Builds on causal DAGs to enable observational, interventional, and counterfactual predictions. Accepted at ICLR 2026. arXiv:2511.02137.

**CausalMamba (Zhan & Cheng, 2025)**
Integrates Mamba state space models with GCNs and NOTEARS for differentiable causal discovery in temporal sequences. arXiv:2511.16191.

**TRACE (Fan et al., 2026)**
Models continuous mechanism evolution (not discrete regime switches) using Mixture-of-Experts for atomic mechanisms with time-varying mixing coefficients. Achieves 0.99 correlation in trajectory recovery. arXiv:2601.21135.

**CHiLD (Li et al., 2025)**
Causally Hierarchical Latent Dynamic identification. Multi-layer latent variable identification from temporal data using hierarchical structure sparsity. arXiv:2510.18310.

**CaDRe (Fu et al., 2025)**
Joint causal discovery and representation learning for climate analysis. Simultaneously uncovers observed causal relations and latent driving forces. arXiv:2501.12500.

**Causal Regime Detection (Thumm, 2025)**
Augmented Time Series Structural Causal Models for energy market regime detection. arXiv:2511.04361.

---

## 2. Key Papers with Full Citations

### Foundational Papers

1. **Granger, C.W.J.** (1969). "Investigating Causal Relations by Econometric Models and Cross-spectral Methods." *Econometrica*, 37(3), 424-438.

2. **Pearl, J.** (2000/2009). *Causality: Models, Reasoning, and Inference*. Cambridge University Press. 2nd edition 2009.

3. **Spirtes, P., Glymour, C., & Scheines, R.** (2000). *Causation, Prediction, and Search*. MIT Press. 2nd edition. (Original 1993.)

4. **Schreiber, T.** (2000). "Measuring Information Transfer." *Physical Review Letters*, 85(2), 461-464.

5. **Peters, J., Janzing, D., & Scholkopf, B.** (2017). *Elements of Causal Inference: Foundations and Learning Algorithms*. MIT Press.

### Continuous Optimization for DAGs

6. **Zheng, X., Aragam, B., Ravikumar, P., & Xing, E.P.** (2018). "DAGs with NO TEARS: Continuous Optimization for Structure Learning." *NeurIPS 2018*. arXiv:1803.01422.

7. **Pamfil, R., Sriwattanaworachai, N., Desai, S., Pilgerstorfer, P., Beaumont, P., Georgatzis, K., & Aragam, B.** (2020). "DYNOTEARS: Structure Learning from Time-Series Data." *AISTATS 2020*. arXiv:2002.00498.

### Neural Granger Causality

8. **Tank, A., Covert, I., Foti, N., Shojaie, A., & Fox, E.B.** (2021). "Neural Granger Causality." *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 44(8), 4267-4279.

9. **Zhou, W., Bai, S., Yu, S., Zhao, Q., & Chen, B.** (2024). "Jacobian Regularizer-based Neural Granger Causality." *ICML 2024*. arXiv:2405.08779.

10. **Lin, H., Ren, M., Barucca, P., & Aste, T.** (2024). "Granger Causality Detection with Kolmogorov-Arnold Networks." arXiv:2412.15373.

11. **Poonia, H., Divo, F., Kersting, K., & Dhami, D.S.** (2025). "Exploring Neural Granger Causality with xLSTMs: Unveiling Temporal Dependencies in Complex Data." *NeurIPS 2025*. arXiv:2502.09981.

### PCMCI Family

12. **Runge, J., Bathiany, S., Bollt, E., Camps-Valls, G., Coumou, D., Deyle, E., ... & Zscheischler, J.** (2019). "Inferring causation from time series in Earth system sciences." *Nature Communications*, 10(1), 2553.

13. **Runge, J.** (2020). "Discovering contemporaneous and lagged causal relations in autocorrelated nonlinear time series datasets." *UAI 2020*, PMLR 124. arXiv:2003.03685.

14. **Runge, J.** (2018). "Causal network reconstruction from time series: From theoretical assumptions to practical estimation." *Chaos*, 28(7), 075310.

15. **Rabel, M. & Runge, J.** (2025). "Context-Specific Causal Graph Discovery with Unobserved Contexts." arXiv:2511.21537.

### Amortized Causal Discovery

16. **Lowe, S., Madras, D., Zemel, R., & Welling, M.** (2022). "Amortized Causal Discovery: Learning to Infer Causal Graphs from Time-Series Data." *CLeaR 2022*. arXiv:2006.10833.

17. **Lorch, L., Sussex, S., Rothfuss, J., Krause, A., & Scholkopf, B.** (2022). "Amortized Inference for Causal Structure Learning." arXiv:2205.12934.

18. **Montagna, F., Cairney-Leeming, M., Sridhar, D., & Locatello, F.** (2024). "Demystifying Amortized Causal Discovery with Transformers." arXiv:2405.16924.

19. **Sypniewski, M., Olko, M., Gajewski, M., & Milos, P.** (2025). "Amortized Causal Discovery with Prior-Fitted Networks." arXiv:2512.11840.

### Neural Causal Discovery

20. **Cheng, Y., Yang, R., Xiao, T., Li, Z., Suo, J., He, K., & Dai, Q.** (2023). "CUTS: Neural Causal Discovery from Irregular Time-Series Data." *ICLR 2023*. arXiv:2302.07458.

21. **Cheng, Y., Li, L., Xiao, T., Li, Z., Zhong, Q., Suo, J., & He, K.** (2023). "CUTS+: High-dimensional Causal Discovery from Irregular Time-series." arXiv:2305.05890.

22. **Das, S., Chakraborty, D., & Maulik, R.** (2026). "SC3D: Dynamic and Differentiable Causal Discovery for Temporal and Instantaneous Graphs." arXiv:2602.02830.

### Causal Representation Learning (Temporal)

23. **Yao, W., Chen, G., & Zhang, K.** (2022). "Learning Latent Causal Dynamics." arXiv:2202.04828.

24. **Yao, W., Chen, G., & Zhang, K.** (2022). "Temporally Disentangled Representation Learning." *NeurIPS 2022*. arXiv:2210.13647.

25. **Lippe, P., Magliacane, S., Lowe, S., Asano, Y.M., Cohen, T., & Gavves, E.** (2022). "CITRIS: Causal Identifiability from Temporal Intervened Sequences." *ICML 2022*. arXiv:2202.03169.

26. **Chen, G., Shen, Y., Chen, Z., Song, X., Sun, Y., Yao, W., Liu, X., & Zhang, K.** (2024). "CaRiNG: Learning Temporal Causal Representation under Non-Invertible Generation Process." *ICML 2024*. arXiv:2401.14535.

27. **Li, Z., Shen, Y., Zheng, K., Cai, R., Song, X., Gong, M., Chen, G., & Zhang, K.** (2024/2026). "On the Identification of Temporally Causal Representation with Instantaneous Dependence." arXiv:2405.15325.

28. **Song, X., Li, Z., Chen, G., Zheng, Y., Fan, Y., Dong, X., & Zhang, K.** (2024). "Causal Temporal Representation Learning with Nonstationary Sparse Transition." arXiv:2409.03142.

29. **Li, Z., Fu, M., Huang, J., Shen, Y., Cai, R., Sun, Y., Chen, G., & Zhang, K.** (2025). "Towards Identifiability of Hierarchical Temporal Causal Representation Learning." arXiv:2510.18310.

30. **Fan, S., Zhang, K., & Cheng, L.** (2026). "TRACE: Trajectory Recovery for Continuous Mechanism Evolution in Causal Representation Learning." arXiv:2601.21135.

### Counterfactual and Interventional Time Series

31. **Wu, D., Qiu, F., & Xie, Y.** (2026). "DoFlow: Flow-based Generative Models for Interventional and Counterfactual Forecasting on Time Series." *ICLR 2026*. arXiv:2511.02137.

32. **Chukwu, E.C., Schouten, R.M., Tabak, M., & Pechenizkiy, M.** (2025). "Counterfactual Explanations for Time Series Should be Human-Centered and Temporally Coherent in Interventions." arXiv:2512.14559.

### Causal Attention and Hybrid Architectures

33. **Zhan, X. & Cheng, X.** (2025). "CausalMamba: Interpretable State Space Modeling for Temporal Rumor Causality." arXiv:2511.16191.

34. **Lu, Z., Tabassum, A., Kulkarni, S., Mi, L., Kutz, J.N., Shea-Brown, E., & Lim, S.-H.** (2023). "Attention for Causal Relationship Discovery from Biological Neural Dynamics." arXiv:2311.06928.

### Surveys

35. **Gong, C., Yao, D., Zhang, C., Li, W., & Bi, J.** (2023). "Causal Discovery from Temporal Data: An Overview and New Perspectives." arXiv:2303.10112. (54 pages.)

36. **Brouillard, P., Lachapelle, S., Kaltenborn, J., Gurwicz, Y., Sridhar, D., Drouin, A., Nowack, P., Runge, J., & Rolnick, D.** (2024). "Causal Representation Learning in Temporal Data via Single-Parent Decoding." arXiv:2410.07013.

37. **Fu, M., Huang, B., Li, Z., Zheng, Y., Ng, I., Chen, G., Hu, Y., & Zhang, K.** (2025). "Learning General Causal Structures with Hidden Dynamic Process." arXiv:2501.12500.

---

## 3. Current Bottlenecks

### 3.1 Latent Confounders
The most fundamental challenge. Most causal discovery methods assume **causal sufficiency** (no unobserved common causes). When violated:
- Granger causality produces spurious causal links
- PC algorithm produces incorrect edge orientations
- NOTEARS/DYNOTEARS learn incorrect graphs
- Only FCI and its descendants (RFCI, PCMCI+ with latent variable extensions) handle this, but at the cost of weaker conclusions (PAGs instead of DAGs)
- **State of the art:** CaDRe (Fu et al., 2025) jointly discovers latent factors and causal structure, but identifiability requires strong assumptions (e.g., sparse generation, sufficient variability)

### 3.2 Instantaneous Effects
When causal effects occur within a single time step:
- Granger causality is fundamentally blind to them (requires temporal precedence)
- Transfer entropy similarly requires a time lag
- PCMCI+ (Runge, 2020) addresses this but requires conditional independence tests at the contemporaneous level, which are statistically harder
- DYNOTEARS and SC3D learn both lagged and instantaneous graphs but face DAG identifiability issues for the contemporaneous part
- **Core tension:** Finer temporal resolution reduces instantaneous effects but increases data requirements and computational cost

### 3.3 Nonlinear Causal Mechanisms
- Linear methods (VAR-based Granger, linear NOTEARS) miss nonlinear causal pathways
- Neural approaches (Tank et al., NGC; CUTS; JRNGC) handle nonlinearity but sacrifice interpretability and identifiability guarantees
- Transfer entropy is nonparametric but requires enormous data for reliable estimation in high dimensions
- **Open question:** How to maintain identifiability guarantees while allowing arbitrary nonlinear mechanisms

### 3.4 Scalability
- Constraint-based methods (PC, FCI, PCMCI) require O(d^k) conditional independence tests where d = number of variables, k = max conditioning set size
- Score-based methods (NOTEARS) scale as O(d^2) parameters but the acyclicity constraint is expensive to evaluate (matrix exponential)
- Neural methods add model training cost on top
- **Real-world challenge:** Financial time series may have hundreds of correlated instruments; climate systems have thousands of spatial variables
- CUTS+ (coarse-to-fine) and amortized approaches help, but scalability to d > 1000 variables remains difficult

### 3.5 Interventional vs. Observational Data
- Most methods assume purely observational data
- Interventional data dramatically improves identifiability (can distinguish between Markov-equivalent DAGs)
- In time series, natural "interventions" (policy changes, market shocks) occur but are hard to formalize
- CITRIS (Lippe et al., 2022) explicitly leverages intervention information but requires knowing when and what was intervened upon
- **Gap:** Methods that can detect and leverage natural experiments / distributional shifts as implicit interventions

### 3.6 Non-Stationarity and Regime Changes
- Most methods assume stationary data-generating processes
- Real temporal data exhibits regime shifts, structural breaks, evolving causal structures
- PCMCI assumes stationarity; applying it to non-stationary data produces averaged/incorrect graphs
- Saggioro et al. (2020) reconstructed regime-dependent causal relationships
- TRACE (Fan et al., 2026) models continuous mechanism evolution
- **Open problem:** Joint detection of regime changes and causal structure changes

### 3.7 Causal Sufficiency vs. Expressiveness Trade-off
- Simple models (linear VAR) have clear identifiability theory but miss real effects
- Complex models (deep neural nets) fit data well but lack causal interpretation
- No existing framework satisfies: (a) handles nonlinearity, (b) handles latent confounders, (c) scales to high dimensions, (d) provides identifiability guarantees, (e) works on irregular/noisy data -- simultaneously

---

## 4. Mathematical Foundations

### 4.1 Granger Causality

**Definition:** X Granger-causes Y if:
```
P(Y_{t+1} | Y_t, Y_{t-1}, ..., X_t, X_{t-1}, ...) != P(Y_{t+1} | Y_t, Y_{t-1}, ...)
```

**VAR formulation:** For a bivariate VAR(p):
```
Y_t = sum_{k=1}^{p} a_k * Y_{t-k} + sum_{k=1}^{p} b_k * X_{t-k} + epsilon_t
```
X Granger-causes Y iff at least one b_k != 0. Tested via F-test or likelihood ratio.

**Multivariate extension:** In a d-dimensional VAR:
```
Z_t = sum_{k=1}^{p} A_k * Z_{t-k} + epsilon_t
```
where Z_t = (X_t^1, ..., X_t^d)^T and A_k are d x d coefficient matrices. X^i Granger-causes X^j if any (A_k)_{j,i} != 0 for k = 1,...,p.

**Conditional Granger Causality:** X Granger-causes Y conditional on Z if including X's past improves prediction of Y beyond Y's and Z's past. This helps control for confounding but requires testing increasingly large conditioning sets.

### 4.2 Transfer Entropy

**Definition (Schreiber, 2000):**
```
TE_{X->Y} = sum p(y_{t+1}, y_t^{(k)}, x_t^{(l)}) * log[ p(y_{t+1} | y_t^{(k)}, x_t^{(l)}) / p(y_{t+1} | y_t^{(k)}) ]
```
where y_t^{(k)} denotes the k-length history of Y, and x_t^{(l)} the l-length history of X.

Equivalently: TE_{X->Y} = H(Y_{t+1} | Y_t^{(k)}) - H(Y_{t+1} | Y_t^{(k)}, X_t^{(l)})

For Gaussian processes, TE is equivalent to Granger causality (up to a factor of 1/2). For non-Gaussian or nonlinear processes, TE captures effects that linear Granger causality misses.

**Estimation:** k-nearest-neighbor estimators (Kraskov-Stogbauer-Grassberger), kernel density estimation, or binning. All suffer from curse of dimensionality.

### 4.3 Structural Causal Models (Pearl)

**Definition:** An SCM M = (U, V, F, P(U)) consists of:
- U: exogenous (unobserved) variables
- V = {V_1, ..., V_d}: endogenous (observed) variables
- F = {f_1, ..., f_d}: structural equations V_i = f_i(PA_i, U_i) where PA_i are parents of V_i
- P(U): distribution over exogenous variables

**The do-operator:** P(Y | do(X = x)) replaces the structural equation for X with X := x, leaving all other equations unchanged. This "mutilates" the graph by removing all arrows into X.

**Three Rules of do-Calculus:**
Given a causal DAG G over variables V:

1. **Insertion/deletion of observations:**
   P(y | do(x), z, w) = P(y | do(x), w) if (Y _||_ Z | X, W)_{G_{X-bar}}

2. **Action/observation exchange:**
   P(y | do(x), do(z), w) = P(y | do(x), z, w) if (Y _||_ Z | X, W)_{G_{X-bar, Z_bar}}

3. **Insertion/deletion of actions:**
   P(y | do(x), do(z), w) = P(y | do(x), w) if (Y _||_ Z | X, W)_{G_{X-bar, Z(S)-bar}}

where G_{X-bar} means G with incoming edges to X removed, and the d-separation conditions are checked on modified graphs.

**Backdoor criterion:** P(y | do(x)) = sum_z P(y | x, z) P(z) if Z blocks all backdoor paths from X to Y and no node in Z is a descendant of X.

**Frontdoor criterion:** P(y | do(x)) = sum_m P(m | x) sum_{x'} P(y | m, x') P(x') if M mediates all causal paths from X to Y and there's no unblocked backdoor path from X to M.

### 4.4 Temporal SCMs

For time series, the SCM is extended to a time-indexed structure:
```
X_t^i = f_i(PA_t^i, PA_{t-1}^i, ..., PA_{t-p}^i, U_t^i)
```
where PA_{t-k}^i denotes the parents of X^i at lag k.

The causal graph becomes a "full-time causal graph" (infinite DAG unrolled over time) or is summarized as a "summary causal graph" (window graph showing lag-specific edges).

**Key property:** Temporal ordering provides a natural constraint -- effects cannot precede causes. This makes the instantaneous graph the only part requiring DAG constraints; the lagged part is automatically acyclic by temporal ordering.

### 4.5 PCMCI Test Statistics

**Step 1 (PC-stable):** For each pair (X^i_{t-tau}, X^j_t), iteratively condition on subsets S of potential parents and test:
```
X^i_{t-tau} _||_ X^j_t | S
```
Remove the link if any conditioning set renders them independent. Uses partial correlation (linear) or CMI (nonlinear) as test statistic.

**Step 2 (MCI - Momentary Conditional Independence):**
```
X^i_{t-tau} _||_ X^j_t | PA(X^j_t) \ {X^i_{t-tau}}, PA(X^i_{t-tau})
```
This conditions on the parents of both the potential cause and effect, controlling for autocorrelation and indirect paths.

**Test statistics used:**
- ParCorr: Partial correlation (for linear Gaussian data)
- GPDC: Gaussian Process Distance Correlation (for nonlinear, continuous data)
- CMIknn: Conditional Mutual Information with k-nearest neighbors (nonparametric)

**p-value correction:** Benjamini-Hochberg FDR control across all tested links.

### 4.6 Neural Parameterization of Causal Graphs

**Neural Granger Causality (Tank et al.):**
For each target variable j, train:
```
X^j_t = g_j(X^1_{t-1:t-p}, ..., X^d_{t-1:t-p}) + epsilon^j_t
```
where g_j is an MLP/LSTM. Apply group lasso on the first-layer weights:
```
L = sum_t ||X_t - g(X_{t-1:t-p})||^2 + lambda * sum_{i,j} ||W^{(1)}_{j,i,:}||_2
```
where W^{(1)}_{j,i,:} groups all first-layer weights connecting input series i to output j. If this group is driven to zero, X^i does not Granger-cause X^j.

**NOTEARS continuous acyclicity constraint:**
```
h(W) = tr(e^{W circ W}) - d = 0
```
where W is the d x d weighted adjacency matrix and circ is element-wise product. This equals zero iff W encodes a DAG. The matrix exponential can be computed via eigendecomposition or truncated series.

**DYNOTEARS temporal extension:**
```
minimize sum_t ||X_t - W_0 X_t - sum_{k=1}^{p} W_k X_{t-k}||^2 + lambda_1 ||W_0||_1 + lambda_2 sum_k ||W_k||_1
subject to: h(W_0) = 0  (acyclicity of contemporaneous graph only)
```
The lagged weight matrices W_k are unconstrained (no acyclicity needed due to temporal ordering).

**JRNGC (Zhou et al., 2024):**
Instead of weight sparsity, uses the Jacobian:
```
J_{ij}(x) = partial g_i(x) / partial x_j
```
The matrix ||J||_F serves as a differentiable, architecture-independent causal strength measure. Sparsity is enforced via:
```
L = L_pred + lambda * sum_{i,j} ||J_{ij}||
```

**SC3D (Das et al., 2026) two-stage:**
Stage 1: Node-wise prediction to preselect edges (reduces search space)
Stage 2: Joint optimization:
```
minimize -loglik(X | W_0, W_1, ..., W_p) + alpha * ||W||_1 + beta * h(W_0)
```
with differentiable acyclicity on instantaneous graph only.

---

## 5. The Gap: End-to-End Differentiable Causal Structure Learning with Temporal Dynamics

### The Dream
Learn a single model that simultaneously:
1. Discovers the causal graph structure (which variables cause which, at what lags)
2. Learns the functional form of causal mechanisms (nonlinear dynamics)
3. Represents latent confounders
4. Handles non-stationarity (evolving causal structure)
5. Produces valid counterfactual predictions
6. Scales to high-dimensional systems

### What Has Been Tried

**Approach 1: NOTEARS + Neural Networks**
- NOTEARS provides differentiable acyclicity, neural nets provide nonlinear mechanisms
- **Problem:** The acyclicity constraint h(W) = tr(e^{W circ W}) - d = 0 is highly non-convex. Augmented Lagrangian optimization often gets stuck in local optima that satisfy h(W) approximately 0 but encode cyclic graphs. In temporal settings (DYNOTEARS), the contemporaneous graph is small but the lag matrices can be large.
- **Why it fails at scale:** Matrix exponential is O(d^3). For d=1000 variables, each gradient step requires computing a 1000x1000 matrix exponential. Approximations exist but lose the exactness guarantee.

**Approach 2: Amortized Causal Discovery**
- Lowe et al. (2022): Train a variational model on synthetic datasets with known causal graphs, then apply to real data.
- **Problem:** Distribution shift between synthetic training data and real data. Montagna et al. (2024) showed this works when training data constraints implicitly match test priors, but this is hard to guarantee for complex real-world temporal systems.
- **Why it partially fails:** The amortized model learns a mapping from data patterns to graphs. If the real data has dynamics not represented in the training distribution (e.g., heavy tails, regime switches, long-range dependencies), the model extrapolates poorly.

**Approach 3: Causal Representation Learning**
- CITRIS, TDRL, CaRiNG, IDOL: Learn latent causal variables and their dynamics jointly.
- **Problem:** Identifiability requires strong assumptions. CITRIS needs intervention labels. TDRL assumes time-delayed-only causal relations (no instantaneous). CaRiNG handles non-invertibility but not latent confounders between the latent variables themselves. IDOL handles instantaneous effects but requires sparse influence.
- **Why it's incomplete:** Each method relaxes one assumption but introduces others. No method handles the full combination of: nonlinear mechanisms + latent confounders + instantaneous effects + non-stationarity.

**Approach 4: Score-based + Constraint-based Hybrids**
- SC3D (2026): Two-stage preselection + optimization
- **Problem:** Still requires the continuous acyclicity constraint. The two-stage approach improves stability but doesn't solve the fundamental optimization difficulty. Edge preselection helps scalability but can prune true edges (irreversible errors).

**Approach 5: Neural ODEs / State Space Models for Continuous-Time Causality**
- Modeling causal dynamics as continuous-time systems (dx/dt = f(x)) with neural ODEs
- **Problem:** Causal structure in continuous time is even harder to identify than discrete time. The Jacobian of f at any point gives local causal influence, but this changes across the state space. No clean separation between "structure" and "dynamics."
- CausalMamba (2025) combines SSMs with NOTEARS but on simplified discrete problems.

### Why the Full Problem Remains Open

1. **Identifiability-Expressiveness Trade-off:** More expressive models (deep nets) fit data better but admit more possible causal explanations for the same data. Identifiability proofs require restricting the model class (e.g., additive noise, sparse mechanisms), but these restrictions may miss real causal effects.

2. **Optimization Landscape:** The joint objective (data likelihood + acyclicity + sparsity + latent variable inference) creates a severely non-convex landscape. Current methods (augmented Lagrangian for NOTEARS, ELBO for VAEs, adversarial objectives for GANs) all have well-documented convergence issues when combined.

3. **Causal vs. Predictive Objectives Conflict:** A model optimized for prediction may learn associations that are not causal. A model constrained to be causal may predict worse than an unconstrained model. The right trade-off depends on downstream use (prediction vs. intervention planning), but most methods optimize a single objective.

4. **Temporal Credit Assignment:** In long time series, causal effects may propagate over many steps through intermediate variables. Discovering that X at t-100 caused Y at t requires either very long conditioning windows (statistical power issues) or correct intermediate structure (chicken-and-egg problem).

5. **Evaluation Problem:** Without ground-truth causal graphs for real data, it is impossible to definitively validate causal discovery methods. Simulated data with known graphs may not reflect real-world complexity. This makes it hard to compare methods or know when the problem is "solved."

### Most Promising Current Directions

1. **Causal representation learning with temporal structure (Kun Zhang's group):** TDRL -> CaRiNG -> IDOL -> CtrlNS -> CHiLD -> TRACE. Progressively relaxing assumptions while maintaining identifiability. The hierarchical direction (CHiLD) and continuous evolution (TRACE) are promising.

2. **Amortized discovery with transformers (Montagna et al., 2024):** Understanding why transformer-based amortization works could lead to principled training strategies that guarantee generalization.

3. **Flow-based counterfactual models (DoFlow, ICLR 2026):** Normalizing flows provide exact likelihood and invertibility, enabling clean counterfactual reasoning. Combining this with causal structure learning is a natural next step.

4. **State space models for causality (CausalMamba):** Mamba/S4-style models naturally handle long sequences; combining their efficiency with causal constraints could address scalability.

5. **Regime-aware causal discovery (Rabel & Runge, 2025; Thumm, 2025):** Moving beyond stationarity to context-specific causal graphs.

---

## 6. Full Reference List

### Foundational
- Granger, C.W.J. (1969). Econometrica, 37(3), 424-438.
- Pearl, J. (2000/2009). Causality. Cambridge University Press.
- Spirtes, P., Glymour, C., Scheines, R. (2000). Causation, Prediction, and Search. MIT Press.
- Schreiber, T. (2000). Physical Review Letters, 85(2), 461-464.
- Peters, J., Janzing, D., Scholkopf, B. (2017). Elements of Causal Inference. MIT Press.

### Algorithms and Methods
- Zheng et al. (2018). DAGs with NO TEARS. NeurIPS. arXiv:1803.01422
- Pamfil et al. (2020). DYNOTEARS. AISTATS. arXiv:2002.00498
- Tank et al. (2021). Neural Granger Causality. IEEE TPAMI.
- Runge, J. (2020). PCMCI+. UAI. arXiv:2003.03685
- Runge et al. (2019). Inferring causation from time series. Nature Comms.
- Lowe et al. (2022). Amortized Causal Discovery. CLeaR. arXiv:2006.10833
- Lorch et al. (2022). Amortized Inference for Causal Structure Learning. arXiv:2205.12934
- Cheng et al. (2023). CUTS. ICLR. arXiv:2302.07458
- Cheng et al. (2023). CUTS+. arXiv:2305.05890
- Zhou et al. (2024). JRNGC. ICML. arXiv:2405.08779
- Lin et al. (2024). GC-KAN. arXiv:2412.15373
- Poonia et al. (2025). GC-xLSTM. NeurIPS. arXiv:2502.09981
- Das et al. (2026). SC3D. arXiv:2602.02830
- Montagna et al. (2024). Demystifying Amortized CD. arXiv:2405.16924
- Sypniewski et al. (2025). Amortized CD with Prior-Fitted Networks. arXiv:2512.11840

### Causal Representation Learning (Temporal)
- Yao et al. (2022). Learning Latent Causal Dynamics (LiLY). arXiv:2202.04828
- Yao et al. (2022). TDRL. NeurIPS. arXiv:2210.13647
- Lippe et al. (2022). CITRIS. ICML. arXiv:2202.03169
- Chen et al. (2024). CaRiNG. ICML. arXiv:2401.14535
- Li et al. (2024/2026). IDOL. arXiv:2405.15325
- Song et al. (2024). CtrlNS. arXiv:2409.03142
- Li et al. (2025). CHiLD. arXiv:2510.18310
- Fan et al. (2026). TRACE. arXiv:2601.21135
- Fu et al. (2025). CaDRe. arXiv:2501.12500
- Brouillard et al. (2024). CDSD. arXiv:2410.07013

### Counterfactual and Interventional
- Wu et al. (2026). DoFlow. ICLR. arXiv:2511.02137
- Chukwu et al. (2025). Counterfactual Explanations for TS. arXiv:2512.14559
- Das, S. & Tan, M. (2026). From Signals to Causes. arXiv:2602.23977

### Causal + State Space / Attention
- Zhan & Cheng (2025). CausalMamba. arXiv:2511.16191
- Lu et al. (2023). Attention for Causal Discovery. arXiv:2311.06928

### Regime and Non-Stationarity
- Saggioro et al. (2020). Regime-dependent causal relationships. arXiv:2007.00267
- Rabel & Runge (2025). Context-Specific Causal Graphs. arXiv:2511.21537
- Thumm (2025). Causal Regime Detection in Energy Markets. arXiv:2511.04361
- Thumm & Ontaneda Mijares (2025). Towards Causal Market Simulators. arXiv:2511.04469
- Gao et al. (2024). Causal Discovery-Driven Change Point Detection. arXiv:2407.07290

### Applications
- Hossain & Gani (2025). Causal TS for Arctic Sea Ice. arXiv:2509.09128
- Biswas et al. (2025). CITS: Nonparametric Causal Modeling for Neural TS. arXiv:2508.01920
- Liu et al. (2025). Lightweight Gradient-based Causal Discovery. arXiv:2507.11178
- Li et al. (2025). ReTimeCausal. arXiv:2507.03310
- Sultan et al. (2025). Emergent Granger Causality in Neural Networks. arXiv:2506.20347
- Hui et al. (2025). Deep learning doubly robust test for GC. arXiv:2509.15798

### Surveys
- Gong et al. (2023). Causal Discovery from Temporal Data: An Overview. arXiv:2303.10112
- Garcia-Garcia et al. (2025). XAI for Economic Time Series: Review. arXiv:2512.12506
- Chang et al. (2025). Survey of Reasoning and Agentic Systems in TS with LLMs. arXiv:2509.11575

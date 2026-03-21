import { content as entrySpeedContent } from "./papers/entry-speed-vs-confirmation";
import { content as crossAssetContent } from "./papers/cross-asset-lead-lag";
import { content as goldssmContent } from "./papers/goldssm-architecture";
import { content as alpha101Content } from "./papers/alpha101-intraday-gold";
import { content as xagDisagreementContent } from "./papers/xag-directional-disagreement";
import { content as featurePipelineContent } from "./papers/107-feature-pipeline";
import { content as dispersionContent } from "./papers/dispersion-trading";
import { content as usIndexesContent } from "./papers/us-indexes-prediction";
import { content as gprContent } from "./papers/gpr-gold";

export interface Paper {
  slug: string;
  title: string;
  date: string;
  category: string;
  abstract: string;
  author: string;
  content: string;
}

export const papers: Paper[] = [
  {
    slug: "us-indexes-prediction",
    title:
      "US Index Prediction: A Multi-Index Framework for DJIA, S&P 500, and NAS100",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "A literature review and research framework for predicting US equity index movements using cross-index dynamics. We identify several unstudied research gaps including price-weighted vs cap-weighted divergence signals and trivariate cointegration regime models. Empirical phases are in progress.",
    author: "Rahul S. P.",
    content: usIndexesContent,
  },
  {
    slug: "gpr-gold",
    title: "Geopolitical Risk and Gold: An Empirical Study",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "Using the Caldara-Iacoviello Geopolitical Risk Index matched to XAUUSD M1 data (2018-2026 overlap, ~94 monthly observations), we test whether GPR predicts gold returns. GPR level regimes condition return distributions (higher volatility and positive skew in high-GPR months), but directional predictive power is weak. The signal operates at monthly frequency, too slow for intraday trading but potentially useful as a regime filter.",
    author: "Rahul S. P.",
    content: gprContent,
  },
  {
    slug: "dispersion-trading",
    title: "Cross-Instrument Dispersion Trading on the Dow 30",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "Dispersion across 21 Dow 30 components strongly predicts forward index volatility (r = 0.164 at 5 minutes) but has zero directional predictive power. A convergence trade buying the index when stocks diverge shows a real but regime-dependent out-of-sample edge across 58 walk-forward windows.",
    author: "Rahul S. P.",
    content: dispersionContent,
  },
  {
    slug: "xag-directional-disagreement",
    title:
      "XAG Directional Disagreement as a Cross-Asset Lot Scaling Signal",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "We show that directional disagreement between XAUUSD and XAGUSD over a 20-bar window is the strongest single predictor of scalping signal quality, with Spearman rho between -0.23 and -0.29 (p approximately 0). Lower disagreement implies stronger co-movement and higher reversal reliability. We design a four-tier lot scaling system based on this metric, with the top tier (disagreement <= 8 plus XAG bar reversal) receiving 1.5x allocation.",
    author: "Rahul S. P.",
    content: xagDisagreementContent,
  },
  {
    slug: "cross-asset-lead-lag",
    title: "Cross-Asset Lead-Lag Dynamics: A 5.5-Year Empirical Study",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "We test for linear lead-lag relationships across major asset pairs over 5.5 years of minute-level data. For gold (XAUUSD), no robust lead-lag signal exists from DXY, silver, or equity indices at any horizon. For equities, only MSFT-to-NAS100 and GS-to-US30 at the 5-minute horizon survive out-of-sample validation. The results challenge common assumptions about cross-asset predictability in systematic trading.",
    author: "Rahul S. P.",
    content: crossAssetContent,
  },
  {
    slug: "entry-speed-vs-confirmation",
    title: "Entry Speed vs Confirmation Quality in Tick-Level Scalping",
    date: "March 2026",
    category: "Empirical Studies",
    abstract:
      "We study the trade-off between entry speed and confirmation quality across 21,000 scalping signals over 90 days. Using 42.9 million ticks of XAUUSD data, we show that the edge in consecutive-bar reversal signals is maximal at the exact instant price crosses last_close and decays rapidly. Pending STOP orders at the break level outperform all confirmation-based entries by $12,646, with a profit factor of 1.59 vs 1.34. Every post-hoc sustain filter tested produced negative returns at all parameter combinations.",
    author: "Rahul S. P.",
    content: entrySpeedContent,
  },
  {
    slug: "goldssm",
    title: "Transformer Models vs SSMs for Financial Time Series",
    date: "February 2026",
    category: "Architecture & Models",
    abstract:
      "We present GoldSSM, a selective state space model for intraday gold price direction forecasting. The architecture combines a Variable Selection Network, a stack of Mamba blocks with selective scan, and temporal attention pooling. At 2.0M parameters, GoldSSM serves as a drop-in replacement for Transformer-based models with identical forward signatures, while offering linear-time sequence processing and improved handling of long-range dependencies in financial time series.",
    author: "Rahul S. P.",
    content: goldssmContent,
  },
  {
    slug: "alpha101-intraday-gold",
    title: "Alpha101 on Intraday Gold: Why Most Equity Factors Fail",
    date: "February 2026",
    category: "Feature Engineering",
    abstract:
      "We evaluate all 101 formulaic alpha factors from Kakushadze (2016) on intraday XAUUSD data. Only 4 of 101 factors achieve AUC above 0.515 for direction prediction, and only two (alpha024 and alpha083) survive forward selection. The failure mode is structural: Alpha101 factors exploit cross-sectional dispersion across a stock universe, a mechanism that does not exist for a single instrument. We document which factor families fail and why.",
    author: "Rahul S. P.",
    content: alpha101Content,
  },
  {
    slug: "107-features-gold-pipeline",
    title: "107 Features for Gold: Building an Institutional Feature Pipeline",
    date: "February 2026",
    category: "Feature Engineering",
    abstract:
      "We describe the design and validation of a 107-feature pipeline for intraday gold trading. The pipeline spans six feature groups: price dynamics, cross-asset signals, volatility regimes, microstructure proxies, temporal patterns, and statistical complexity measures. We detail the engineering choices behind each group, the cache invalidation strategy, and the empirical AUC contribution of each feature family. The pipeline supports both batch backtesting and live execution with sub-second latency.",
    author: "Rahul S. P.",
    content: featurePipelineContent,
  },
];

export function getPaperBySlug(slug: string): Paper | undefined {
  return papers.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return papers.map((p) => p.slug);
}

const CATEGORY_ORDER = [
  "Empirical Studies",
  "Architecture & Models",
  "Feature Engineering",
];

export function getAllCategories(): string[] {
  return CATEGORY_ORDER.filter((cat) =>
    papers.some((p) => p.category === cat)
  );
}

export function getPapersByCategory(category: string): Paper[] {
  return papers.filter((p) => p.category === category);
}

"""
Generate the two summary charts for the 'Price predicts volatility, not direction' paper.
EVERY number below is copied verbatim from the study output files:
  Studies/.../US30_RL_Exit/Outputs/FeatureExp/signal_diagnosis.txt / .json / _targets.csv
  ...                                         /signal_shuffle_null.txt
No values are invented or approximated. Run from the research/ directory.
"""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FormatStrFormatter

OUT = Path(__file__).resolve().parent.parent / "public" / "charts" / "signal-diagnosis"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#1a1a2e"; BLUE = "#1e40af"; TEAL = "#2A9D8F"; RED = "#C1432E"; GREY = "#9ca3af"
plt.rcParams.update({
    "font.size": 11, "axes.edgecolor": "#d1d5db", "axes.linewidth": 0.8,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.titlesize": 13, "figure.dpi": 130,
})

# ---------------------------------------------------------------- Figure 1: direction vs volatility
# IC values (out-of-sample, causal frame) from signal_diagnosis_targets.csv
targets = ["60-min\nreturn", "120-min\nreturn", "240-min\nreturn",
           "60-min ABS\nmove", "60-min\nVOLATILITY"]
ic      = [0.0092, 0.0089, 0.0105, 0.2470, 0.6955]
# z vs label-shuffle null (signal_shuffle_null.txt): ret60 +0.91, fvol60 +36.41
zlab    = {0: "z = +0.9 sigma", 4: "z = +36.4 sigma"}
MDE = 0.0335  # min IC detectable at 80% power (signal_diagnosis.json)

fig, ax = plt.subplots(figsize=(9.6, 5.2))
colors = [GREY, GREY, GREY, TEAL, TEAL]
bars = ax.bar(range(len(ic)), ic, color=colors, width=0.62, zorder=3)
ax.axhline(0, color=INK, lw=0.9)
ax.axhspan(-MDE, MDE, color="#eef2ff", zorder=0)
ax.axhline(MDE, color=BLUE, ls="--", lw=1.1, zorder=2)
# noise-floor label placed in the empty gap between the small and tall bars (no collisions)
ax.text(2.5, 0.052, "noise floor 0.033\n(min detectable at 80% power)",
        color=BLUE, fontsize=9, ha="center", va="bottom")
ax.set_xticks(range(len(ic))); ax.set_xticklabels(targets, fontsize=10)
ax.set_ylabel("Out-of-sample Spearman IC")
ax.set_title("What 106 public features can and cannot predict (US30)", fontweight="bold")
ax.set_ylim(-0.05, 0.80)
# value labels only on the two tall (magnitude) bars; direction values go in the text box
for i in (3, 4):
    ax.text(bars[i].get_x() + bars[i].get_width()/2, ic[i] + 0.015, f"{ic[i]:.3f}",
            ha="center", va="bottom", fontsize=11, fontweight="bold")
# z annotation only on the volatility bar
ax.annotate("vs label-shuffle null:\nz = +36.4 sigma", xy=(4, 0.696), xytext=(2.55, 0.585),
            fontsize=9.5, color=TEAL, fontweight="bold", ha="left",
            arrowprops=dict(arrowstyle="->", color=TEAL, lw=1.2))
# clean explanatory block in the empty upper-left quadrant
ax.text(0.02, 0.96,
        "DIRECTION (grey):  60 / 120 / 240-min IC\n"
        "= 0.009 / 0.009 / 0.011, inside the noise floor\n"
        "and statistically a coin flip (z = +0.9 sigma).\n\n"
        "MAGNITUDE / VOLATILITY (teal):  IC up to 0.70,\n"
        "far above the floor, a strong and real signal.",
        transform=ax.transAxes, fontsize=10, va="top", ha="left", color=INK,
        bbox=dict(boxstyle="round,pad=0.5", fc="#f8fafc", ec="#e5e7eb"))
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig(OUT / "fig1_direction_vs_volatility.png", bbox_inches="tight"); plt.close(fig)

# ---------------------------------------------------------------- Figure 2: per-feature univariate IC
# Top-12 strongest |IC| features (model-free) from signal_diagnosis.txt section B.
feat = ["log_spread_us30_us500", "dxy_ret_60m", "pullback_atr_60", "roro_ratio",
        "log_spread_us30_nas100", "macro_t10y2y", "relative_strength_us30_nas100_60",
        "high_extension_60", "brent_ret_60m", "skew_240m",
        "relative_strength_us30_us500_60", "dow"]
fic  = [-0.0289, 0.0273, 0.0228, 0.0218, -0.0218, 0.0212, -0.0212,
        -0.0201, -0.0190, -0.0187, -0.0184, -0.0175]
order = np.argsort(np.abs(fic))
feat = [feat[i] for i in order]; fic = [fic[i] for i in order]

fig, ax = plt.subplots(figsize=(9.6, 5.4))
cols = [RED if v < 0 else TEAL for v in fic]
ax.barh(range(len(fic)), np.abs(fic), color=cols, zorder=3, height=0.66)
ax.axvline(MDE, color=BLUE, ls="--", lw=1.2, zorder=4)
ax.text(MDE + 0.0006, 0.4, "noise floor 0.033\n(none reach it)", color=BLUE, fontsize=9.5, va="bottom")
ax.set_yticks(range(len(feat))); ax.set_yticklabels(feat, fontsize=9.5)
ax.set_xlabel("Absolute univariate IC vs 60-minute forward return")
ax.set_title("The 12 strongest single features - and 0 of 106 survive multiple-testing control",
             fontweight="bold", fontsize=12)
ax.set_xlim(0, 0.045)
for i, v in enumerate(fic):
    ax.text(abs(v) + 0.0007, i, f"{v:+.3f}", va="center", fontsize=9, color=INK)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.text(0.99, 0.02, "teal = positive sign   red = negative sign", transform=ax.transAxes,
        ha="right", fontsize=8.5, color=GREY)
fig.tight_layout(); fig.savefig(OUT / "fig2_per_feature_ic.png", bbox_inches="tight"); plt.close(fig)

print("wrote:", *(p.name for p in OUT.glob("fig*.png")))

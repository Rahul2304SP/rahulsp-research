"""
Charts for the mean-reversion replication paper. Every number is copied verbatim from the
verified study outputs:
  Studies/.../07 - Overnight Gap Mean Reversion/results_20260316_234010.json (+ report)
  Studies/.../08 - IBS RSI Mean Reversion Replication/results_20260316_232903.json (+ report)
All figures were cross-checked against the raw JSON by an adversarial reviewer. No value invented.
Run from the research/ directory.
"""
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

OUT = Path(__file__).resolve().parent.parent / "public" / "charts" / "replication"
OUT.mkdir(parents=True, exist_ok=True)

INK = "#1a1a2e"; BLUE = "#1e40af"; TEAL = "#2A9D8F"; RED = "#C1432E"; GREY = "#9ca3af"
AMBER = "#d97706"
plt.rcParams.update({
    "font.size": 11, "axes.edgecolor": "#d1d5db", "axes.linewidth": 0.8,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.titlesize": 13, "figure.dpi": 130,
})
INSTR = ["US30", "US500", "NASDAQ"]
ICOL = {"US30": BLUE, "US500": TEAL, "NASDAQ": AMBER}

# ---------------------------------------------------------------- Fig 1: gap-fill collapse
# Fill rate (%) by gap-size bucket, from the report's "Fill Rate by Gap Size" table (JSON-verified)
sizes = ["0 to 0.1%", "0.1 to 0.25%", "0.25 to 0.5%", "0.5 to 1%", "over 1%"]
fill = {
    "US30":   [97.2, 78.1, 48.0, 34.5, 18.2],
    "US500":  [96.6, 65.2, 45.7, 48.8, 18.8],
    "NASDAQ": [96.9, 46.0, 21.9, 15.6, 16.7],
}
x = np.arange(len(sizes)); w = 0.26
fig, ax = plt.subplots(figsize=(9.8, 5.2))
for i, inst in enumerate(INSTR):
    ax.bar(x + (i - 1) * w, fill[inst], w, label=inst, color=ICOL[inst], zorder=3)
ax.axhline(50, color=RED, ls="--", lw=1.3, zorder=2)
ax.text(len(sizes) - 0.5, 52, "50% = a coin flip; a fade needs the gap to FILL", color=RED,
        fontsize=9.5, ha="right", va="bottom")
ax.set_xticks(x); ax.set_xticklabels(sizes)
ax.set_xlabel("Overnight gap size (percent of prior close)")
ax.set_ylabel("Share of gaps that fill intraday (%)")
ax.set_title("The headline gap-fill rate is driven by tiny gaps, not tradable ones", fontweight="bold")
ax.set_ylim(0, 105); ax.legend(loc="upper right", frameon=False)
ax.text(0.012, 0.93,
        "Tiny gaps (<0.1%) fill ~97% of the time and dominate the\n"
        "headline rate. The gaps big enough to fade fill far less often,\n"
        "and on the NASDAQ a 0.5-1% gap fills only 16% of the time.",
        transform=ax.transAxes, fontsize=9.5, va="top",
        bbox=dict(boxstyle="round,pad=0.5", fc="#f8fafc", ec="#e5e7eb"))
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig(OUT / "fig1_gap_fill_collapse.png", bbox_inches="tight"); plt.close(fig)

# ---------------------------------------------------------------- Fig 2: gap-fade vs buy-and-hold
# Best in-sample threshold PnL as a fraction of buy-and-hold (after costs), full sample.
# US30 +1658 / +19302 ; US500 +174 / +4041 ; NASDAQ -666 / +17924  (JSON-verified)
best_pnl = {"US30": 1658.0, "US500": 174.02, "NASDAQ": -665.75}
bh_pnl =   {"US30": 19301.5, "US500": 4040.97, "NASDAQ": 17923.8}
pct = [100 * best_pnl[i] / bh_pnl[i] for i in INSTR]
fig, ax = plt.subplots(figsize=(8.6, 5.0))
bars = ax.bar(INSTR, pct, color=[TEAL if v > 0 else RED for v in pct], width=0.55, zorder=3)
ax.axhline(0, color=INK, lw=0.9)
ax.axhline(100, color=GREY, ls="--", lw=1.2)
ax.text(2.4, 101, "buy-and-hold = 100%", color=GREY, fontsize=9.5, ha="right", va="bottom")
for b, v in zip(bars, pct):
    ax.text(b.get_x() + b.get_width()/2, v + (2 if v >= 0 else -2), f"{v:+.1f}%",
            ha="center", va="bottom" if v >= 0 else "top", fontweight="bold", fontsize=11)
ax.set_ylabel("Best-case gap-fade return as % of buy-and-hold")
ax.set_title("Even the in-sample-best gap-fade captured a sliver of buy-and-hold",
             fontweight="bold", fontsize=12.5)
ax.set_ylim(-12, 112)
ax.text(0.015, 0.82,
        "Bars use the single best threshold chosen in-sample (generous).\n"
        "Out-of-sample, gap-fade beat buy-and-hold in 0/2 (US30),\n"
        "1/3 (US500) and 0/4 (NASDAQ) folds.",
        transform=ax.transAxes, fontsize=9.5, va="top", color=INK,
        bbox=dict(boxstyle="round,pad=0.5", fc="#f8fafc", ec="#e5e7eb"))
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig(OUT / "fig2_gap_vs_buyhold.png", bbox_inches="tight"); plt.close(fig)

# ---------------------------------------------------------------- Fig 3: IBS / RSI win rates
ibs = [49.4, 50.3, 49.4]      # observed full-sample win rate, literature params
rsi = [57.4, 67.2, 59.7]
x = np.arange(len(INSTR)); w = 0.32
fig, ax = plt.subplots(figsize=(9.0, 5.2))
ax.bar(x - w/2, ibs, w, label="IBS (observed)", color=BLUE, zorder=3)
ax.bar(x + w/2, rsi, w, label="RSI(2) (observed)", color=TEAL, zorder=3)
ax.axhline(50, color=GREY, ls=":", lw=1.3)
ax.text(2.45, 50.4, "50% = coin flip", color=GREY, fontsize=9, ha="right", va="bottom")
ax.axhline(70, color=BLUE, ls="--", lw=1.3)
ax.text(0.02, 70.6, "IBS win rate claimed in popular reproductions (~70%)", color=BLUE,
        fontsize=9, ha="left", va="bottom")
for i, (a, b) in enumerate(zip(ibs, rsi)):
    ax.text(i - w/2, a + 0.7, f"{a:.1f}", ha="center", fontsize=9.5, fontweight="bold", color=BLUE)
    ax.text(i + w/2, b + 0.7, f"{b:.1f}", ha="center", fontsize=9.5, fontweight="bold", color=TEAL)
ax.set_xticks(x); ax.set_xticklabels(INSTR)
ax.set_ylabel("Full-sample win rate (%)")
ax.set_title("IBS does not replicate (~50%); RSI(2) is real but only partial", fontweight="bold")
ax.set_ylim(0, 82); ax.legend(loc="lower right", frameon=False)
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout(); fig.savefig(OUT / "fig3_ibs_rsi_winrate.png", bbox_inches="tight"); plt.close(fig)

print("wrote:", *(p.name for p in sorted(OUT.glob("fig*.png"))))

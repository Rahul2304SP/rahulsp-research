"""
Signal Uploader — reads live model CSVs and pushes trades to Supabase.
Runs alongside the models. Only uploads actual trades (not skips).
Delays signals by 15 minutes before uploading.

Usage:
  python upload_signals.py

Requires:
  pip install supabase python-dotenv

Environment (set in .env next to this script):
  SUPABASE_URL=https://xxxxx.supabase.co
  SUPABASE_SERVICE_KEY=eyJhbG...
"""
from __future__ import annotations
import os
import time
import csv
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

# ── Config ─────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DELAY_MINUTES = 15
POLL_SECONDS = 60  # check for new rows every 60s

# Model CSV paths
MODELS = {
    "GoldSSM-28F": Path(
        r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
        r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
        r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
        r"\34F_Embed16_BS2000_LR0005_36M_WD005_Conf065\Outputs\V23 - Custom.csv"
    ),
    "GoldSSM-34F": Path(
        r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
        r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
        r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
        r"\34F_Embed16_BS2000_LR0005_36M_WD005_Conf065\Outputs\V24 - 34F AllGates.csv"
    ),
}

# Columns to publish (safe — no model internals)
TRADE_ACTIONS = {"LONG", "SHORT"}
EXIT_ACTIONS = {"tp_exit", "sl_exit", "max_hold_exit", "trail_exit", "exit_signal"}

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def parse_csv_rows(path: Path) -> list[dict]:
    """Read all rows from a model CSV."""
    if not path.exists():
        return []
    rows = []
    with open(path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def extract_trades(rows: list[dict], model_name: str) -> list[dict]:
    """Extract trade entries and exits from raw model rows."""
    trades = []
    for row in rows:
        action = row.get("action", "").strip()
        bar_ts = row.get("bar_ts", "").strip()

        if not bar_ts:
            continue

        # Parse timestamp
        try:
            ts = datetime.fromisoformat(bar_ts)
        except ValueError:
            continue

        # Only process actual trades
        if action in TRADE_ACTIONS:
            trade = {
                "model": model_name,
                "bar_ts": bar_ts,
                "close": float(row.get("close", 0)),
                "direction": action,
                "entry_price": float(row.get("close", 0)),
                "sl_price": float(row["sl_price"]) if row.get("sl_price") else None,
                "tp_price": float(row["tp_price"]) if row.get("tp_price") else None,
                "lot": float(row.get("lot", 0)),
                "status": "open",
            }
            trades.append(trade)

        # Check for exits on open positions
        exit_reason = row.get("exit_reason", "").strip()
        if exit_reason and exit_reason != "0":
            trade = {
                "model": model_name,
                "bar_ts": bar_ts,
                "close": float(row.get("close", 0)),
                "direction": row.get("entry_side", "EXIT"),
                "exit_reason": exit_reason,
                "exit_price": float(row.get("close", 0)),
                "hold_bars": int(row.get("hold_bars", 0)) if row.get("hold_bars") else None,
                "status": "closed",
            }
            trades.append(trade)

    return trades


def get_last_uploaded_ts(model_name: str) -> datetime | None:
    """Get the most recent bar_ts we've uploaded for this model."""
    result = (
        supabase.table("signals")
        .select("bar_ts")
        .eq("model", model_name)
        .order("bar_ts", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return datetime.fromisoformat(result.data[0]["bar_ts"])
    return None


def upload_new_signals():
    """Main loop iteration: check each model CSV for new trades, upload with delay."""
    now = datetime.now(timezone.utc)
    delay_cutoff = now - timedelta(minutes=DELAY_MINUTES)

    for model_name, csv_path in MODELS.items():
        rows = parse_csv_rows(csv_path)
        if not rows:
            continue

        trades = extract_trades(rows, model_name)
        if not trades:
            continue

        # Get last uploaded timestamp
        last_ts = get_last_uploaded_ts(model_name)

        # Filter: only new trades, and only those older than delay cutoff
        new_trades = []
        for t in trades:
            try:
                trade_ts = datetime.fromisoformat(t["bar_ts"])
            except ValueError:
                continue

            # Must be after last uploaded
            if last_ts and trade_ts <= last_ts:
                continue

            # Must be older than delay (15 min ago)
            if trade_ts.tzinfo is None:
                trade_ts = trade_ts.replace(tzinfo=timezone.utc)
            if trade_ts > delay_cutoff:
                continue

            new_trades.append(t)

        if new_trades:
            # Upload in batches
            print(f"[{now.strftime('%H:%M:%S')}] {model_name}: uploading {len(new_trades)} new signals")
            for batch_start in range(0, len(new_trades), 50):
                batch = new_trades[batch_start:batch_start + 50]
                supabase.table("signals").insert(batch).execute()
        else:
            print(f"[{now.strftime('%H:%M:%S')}] {model_name}: no new signals")


def main():
    print("=" * 60)
    print("Signal Uploader — Supabase")
    print(f"Delay: {DELAY_MINUTES} minutes")
    print(f"Poll interval: {POLL_SECONDS} seconds")
    print(f"Models: {', '.join(MODELS.keys())}")
    print("=" * 60)

    while True:
        try:
            upload_new_signals()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

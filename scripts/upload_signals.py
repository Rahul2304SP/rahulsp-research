"""
Signal Uploader — reads live model CSVs and pushes trades to Supabase.
Runs alongside the models. Only uploads actual trades (not skips/blocks).
Delays signals by 15 minutes before uploading.

Usage:
  python upload_signals.py

Requires:
  pip install supabase python-dotenv
"""
from __future__ import annotations
import os
import time
import csv
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DELAY_MINUTES = 0  # Push immediately — delay enforced on frontend by subscription tier
POLL_SECONDS = 60

# Live model CSV paths
MODELS = {
    "GoldSSM-28F": Path(
        r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
        r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
        r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
        r"\29F_Embed16_BS2000_LR0005_36M_LRPlateau\Outputs\V23 - Custom.csv"
    ),
    "GoldSSM-34F": Path(
        r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
        r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
        r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
        r"\34F_Embed16_BS2000_LR0005_36M_WD005_Conf065\Outputs\V24 - 34F AllGates.csv"
    ),
}

ENTRY_ACTIONS = {"ev_long", "ev_short", "LONG", "SHORT"}

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def parse_live_csv(path: Path) -> list[dict]:
    """Parse all rows from a live model CSV."""
    if not path.exists():
        return []
    with open(path, "r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def extract_live_trades(rows: list[dict], model_name: str) -> list[dict]:
    """
    Extract completed trades from the live CSV.

    Trade lifecycle in the CSV:
      1. Entry row: action = ev_long/ev_short/LONG/SHORT
      2. Hold rows: action = hold (each bar while position is open)
      3. Exit: either exit_reason != 0 on a hold row, or next entry appears
    """
    signals = []
    current_trade = None

    for row in rows:
        action = row.get("action", "").strip()
        bar_ts = row.get("bar_ts", "").strip()
        exit_reason = row.get("exit_reason", "").strip()
        hold_bars = row.get("hold_bars", "0").strip()

        if not bar_ts:
            continue

        # New entry
        if action in ENTRY_ACTIONS:
            # Close previous trade if still open
            if current_trade and current_trade["status"] == "open":
                current_trade["status"] = "closed"
                current_trade["exit_reason"] = "new_entry"
                signals.append(current_trade)

            direction = "LONG" if "long" in action.lower() else "SHORT"
            entry_side = row.get("entry_side", "").strip()
            if entry_side == "1":
                direction = "LONG"
            elif entry_side == "-1":
                direction = "SHORT"

            current_trade = {
                "model": model_name,
                "bar_ts": bar_ts,
                "close": float(row.get("close", 0)),
                "direction": direction,
                "entry_price": float(row.get("close", 0)),
                "sl_price": float(row["sl_price"]) if row.get("sl_price", "").strip() else None,
                "tp_price": float(row["tp_price"]) if row.get("tp_price", "").strip() else None,
                "lot": float(row.get("lot", 0)) if row.get("lot", "").strip() else None,
                "status": "open",
                "exit_reason": None,
                "exit_price": None,
                "pnl": None,
                "hold_bars": None,
            }

        # Hold row with exit
        elif action == "hold" and current_trade and exit_reason and exit_reason != "0":
            close_price = float(row.get("close", 0))
            entry_price = current_trade["entry_price"]
            if current_trade["direction"] == "LONG":
                pnl = close_price - entry_price
            else:
                pnl = entry_price - close_price

            current_trade["status"] = "closed"
            current_trade["exit_reason"] = exit_reason
            current_trade["exit_price"] = close_price
            current_trade["pnl"] = round(pnl, 2)
            current_trade["hold_bars"] = int(hold_bars) if hold_bars else None
            signals.append(current_trade)
            current_trade = None

    # If there's a trade still open at the end, add it as open
    if current_trade and current_trade["status"] == "open":
        signals.append(current_trade)

    return signals


def get_uploaded_count(model_name: str) -> int:
    """Get count of signals already uploaded for this model."""
    result = (
        supabase.table("signals")
        .select("id", count="exact")
        .eq("model", model_name)
        .execute()
    )
    return result.count or 0


def get_last_uploaded_ts(model_name: str) -> datetime | None:
    """Get the most recent bar_ts uploaded for this model."""
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
    """Check each model CSV for new completed trades, upload with delay."""
    now = datetime.now(timezone.utc)
    delay_cutoff = now - timedelta(minutes=DELAY_MINUTES)

    for model_name, csv_path in MODELS.items():
        rows = parse_live_csv(csv_path)
        if not rows:
            continue

        trades = extract_live_trades(rows, model_name)
        if not trades:
            print(f"[{now.strftime('%H:%M:%S')}] {model_name}: no trades found in CSV")
            continue

        last_ts = get_last_uploaded_ts(model_name)

        new_trades = []
        for t in trades:
            try:
                trade_ts = datetime.fromisoformat(t["bar_ts"])
            except ValueError:
                continue

            # MT5 broker writes in EET/EEST but labels as +00:00 — correct to UTC
            if trade_ts.tzinfo is None:
                trade_ts = trade_ts.replace(tzinfo=timezone.utc)
            month = trade_ts.month
            is_summer = 4 <= month <= 9
            if month == 3:
                last_sun = 31 - (datetime(trade_ts.year, 3, 31).weekday() + 1) % 7
                is_summer = trade_ts.day >= last_sun
            elif month == 10:
                last_sun = 31 - (datetime(trade_ts.year, 10, 31).weekday() + 1) % 7
                is_summer = trade_ts.day < last_sun
            broker_offset = 3 if is_summer else 2
            trade_ts = trade_ts - timedelta(hours=broker_offset)

            # Skip if already uploaded
            if last_ts and trade_ts <= last_ts:
                continue

            # Enforce delay
            if trade_ts > delay_cutoff:
                continue

            new_trades.append(t)

        if new_trades:
            print(f"[{now.strftime('%H:%M:%S')}] {model_name}: uploading {len(new_trades)} new signals")
            for i in range(0, len(new_trades), 50):
                batch = new_trades[i:i + 50]
                supabase.table("signals").insert(batch).execute()
        else:
            count = get_uploaded_count(model_name)
            print(f"[{now.strftime('%H:%M:%S')}] {model_name}: no new signals (total uploaded: {count})")


def main():
    print("=" * 60)
    print("Signal Uploader — Supabase")
    print(f"Delay: {DELAY_MINUTES} minutes | Poll: {POLL_SECONDS}s")
    for name, path in MODELS.items():
        exists = "OK" if path.exists() else "NOT FOUND"
        print(f"  {name}: {exists}")
    print("=" * 60)

    while True:
        try:
            upload_new_signals()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

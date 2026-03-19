"""
Scalper Signal Uploader — reads scalper_exit_log.csv and pushes trades to Supabase.
Each row in the CSV is a completed trade (already closed).

Usage:
  python upload_scalper.py

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
POLL_SECONDS = 60

CSV_PATH = Path(
    r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
    r"\Advanced Modelling\Scalper\scalper_exit_log.csv"
)

# Config name -> model name for Supabase
# Only include configs the user wants published
ALLOWED_CONFIGS = {
    "0.05,3+":     "Scalper-990",
    "0.03,3+":     "Scalper-991",
    "0.03,2+":     "Scalper-992",
    "0.05,3+,RB":  "Scalper-993",
    "0.03,2+,XAG": "Scalper-996",
    "0.05,2+,TS":  "Scalper-997",
}

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)




def parse_scalper_csv() -> list[dict]:
    """Parse scalper exit log and return trades for allowed configs."""
    if not CSV_PATH.exists():
        return []

    trades = []
    with open(CSV_PATH, "r", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            config = row.get("config", "").strip()
            if config not in ALLOWED_CONFIGS:
                continue

            exit_time = row.get("exit_time_utc", "").strip()
            if not exit_time:
                continue

            ticket = row.get("ticket", "").strip()
            if not ticket:
                continue

            try:
                pnl = float(row.get("pnl", 0))
            except (ValueError, TypeError):
                continue

            direction = row.get("direction", "").strip()
            if direction == "BUY":
                direction = "LONG"
            elif direction == "SELL":
                direction = "SHORT"

            try:
                entry_price = float(row["entry_price"])
                exit_price = float(row["exit_price"])
            except (ValueError, KeyError):
                continue

            hold_bars = None
            try:
                hold_bars = int(row.get("hold_bars", 0))
            except (ValueError, TypeError):
                pass

            trades.append({
                "model": ALLOWED_CONFIGS[config],
                "bar_ts": exit_time,
                "close": float(ticket),  # store ticket in close field for dedup
                "direction": direction,
                "entry_price": entry_price,
                "sl_price": None,
                "tp_price": None,
                "exit_reason": row.get("exit_reason", "").strip() or None,
                "exit_price": exit_price,
                "pnl": round(pnl, 2),
                "hold_bars": hold_bars,
                "status": "closed",
                "published_at": exit_time,  # use trade time, not upload time
            })

    return trades


def get_uploaded_count() -> int:
    """Get count of scalper signals in DB."""
    result = (
        supabase.table("signals")
        .select("id", count="exact")
        .like("model", "Scalper-*")
        .execute()
    )
    return result.count or 0


def get_last_uploaded_bar_ts() -> str | None:
    """Get the most recent bar_ts for any scalper signal."""
    result = (
        supabase.table("signals")
        .select("bar_ts")
        .like("model", "Scalper-*")
        .order("bar_ts", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["bar_ts"]
    return None


def upload_new_scalper_trades():
    """Check CSV for new scalper trades and upload them."""
    now = datetime.now(timezone.utc)

    trades = parse_scalper_csv()
    if not trades:
        print(f"[{now.strftime('%H:%M:%S')}] Scalper: no trades in CSV")
        return

    last_ts = get_last_uploaded_bar_ts()
    db_count = get_uploaded_count()

    new_trades = []
    for t in trades:
        # Only upload trades newer than the last uploaded timestamp
        if last_ts and t["bar_ts"] <= last_ts:
            continue
        new_trades.append(t)

    if new_trades:
        print(f"[{now.strftime('%H:%M:%S')}] Scalper: uploading {len(new_trades)} new trades")
        for i in range(0, len(new_trades), 50):
            batch = new_trades[i:i + 50]
            supabase.table("signals").insert(batch).execute()
    else:
        print(f"[{now.strftime('%H:%M:%S')}] Scalper: no new trades (DB: {db_count}, CSV: {len(trades)})")


def main():
    print("=" * 60)
    print("Scalper Signal Uploader — Supabase")
    print(f"Poll: {POLL_SECONDS}s")
    print(f"CSV: {'OK' if CSV_PATH.exists() else 'NOT FOUND'}")
    print(f"Configs: {', '.join(ALLOWED_CONFIGS.values())}")
    print("=" * 60)

    while True:
        try:
            upload_new_scalper_trades()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

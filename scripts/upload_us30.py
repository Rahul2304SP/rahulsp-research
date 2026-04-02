"""
US30 LS Signal Uploader — reads trade_journal.csv and pushes trades to Supabase.
Each row in the CSV is a completed trade (already closed).

Usage:
  python upload_us30.py

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
    r"\Studies\US Indexes\Phase 4 - Out of Sample\Outputs\US30"
    r"\Deployment Log\trade_journal.csv"
)

MODEL_NAME = "US30-LS"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def broker_to_utc(ts_str: str) -> str:
    """Convert broker timestamp (labelled +00:00 but actually EET/EEST) to real UTC."""
    try:
        ts = datetime.fromisoformat(ts_str)
    except ValueError:
        return ts_str

    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    month = ts.month
    is_summer = 4 <= month <= 9
    if month == 3:
        last_sun = 31 - (datetime(ts.year, 3, 31).weekday() + 1) % 7
        is_summer = ts.day >= last_sun
    elif month == 10:
        last_sun = 31 - (datetime(ts.year, 10, 31).weekday() + 1) % 7
        is_summer = ts.day < last_sun
    broker_offset = 3 if is_summer else 2
    utc_ts = ts - timedelta(hours=broker_offset)
    return utc_ts.isoformat()


def parse_trade_journal() -> list[dict]:
    """Parse trade_journal.csv and return signal dicts."""
    if not CSV_PATH.exists():
        return []

    trades = []
    with open(CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry_time = row.get("entry_time", "").strip()
            exit_time = row.get("exit_time", "").strip()
            if not entry_time or not exit_time:
                continue

            try:
                entry_price = float(row["entry_price"])
                exit_price = float(row["exit_price"])
                pnl_pts = float(row["pnl_pts"])
            except (ValueError, KeyError):
                continue

            direction = row.get("direction", "").strip().upper()
            if direction not in ("LONG", "SHORT"):
                continue

            bars_held = None
            try:
                bars_held = int(row.get("bars_held", 0))
            except (ValueError, TypeError):
                pass

            trades.append({
                "model": MODEL_NAME,
                "bar_ts": broker_to_utc(entry_time),
                "close": entry_price,
                "direction": direction,
                "entry_price": entry_price,
                "sl_price": None,
                "tp_price": None,
                "exit_reason": row.get("exit_reason", "").strip() or None,
                "exit_price": exit_price,
                "pnl": round(pnl_pts, 2),
                "hold_bars": bars_held,
                "status": "closed",
            })

    return trades


def get_uploaded_count() -> int:
    """Get count of US30-LS signals in DB."""
    result = (
        supabase.table("signals")
        .select("id", count="exact")
        .eq("model", MODEL_NAME)
        .execute()
    )
    return result.count or 0


def upload_new_trades():
    """Check CSV for new trades and upload them.

    Dedup: append-only CSV. Skip first db_count rows, insert the tail.
    """
    now = datetime.now(timezone.utc)

    trades = parse_trade_journal()
    if not trades:
        print(f"[{now.strftime('%H:%M:%S')}] {MODEL_NAME}: no trades in CSV")
        return

    db_count = get_uploaded_count()

    if db_count >= len(trades):
        print(f"[{now.strftime('%H:%M:%S')}] {MODEL_NAME}: no new trades (DB: {db_count}, CSV: {len(trades)})")
        return

    new_trades = trades[db_count:]
    print(f"[{now.strftime('%H:%M:%S')}] {MODEL_NAME}: uploading {len(new_trades)} new trades (DB: {db_count}, CSV: {len(trades)})")
    for i in range(0, len(new_trades), 50):
        batch = new_trades[i:i + 50]
        supabase.table("signals").insert(batch).execute()


def main():
    print("=" * 60)
    print(f"{MODEL_NAME} Signal Uploader — Supabase")
    print(f"Poll: {POLL_SECONDS}s")
    print(f"CSV: {'OK' if CSV_PATH.exists() else 'NOT FOUND'}")
    print("=" * 60)

    while True:
        try:
            upload_new_trades()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

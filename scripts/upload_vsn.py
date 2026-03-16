"""
VSN Weight Uploader — reads live VSN diagnostics and pushes to Supabase.
Uploads the long stream weights every 15 minutes (delayed).

Usage:
  python upload_vsn.py

Requires:
  pip install supabase python-dotenv
"""
from __future__ import annotations
import os
import time
import csv
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
DELAY_MINUTES = 15
POLL_SECONDS = 60

# Live VSN weights CSV (V23 — has the VSN diagnostics)
VSN_CSV = Path(
    r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
    r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
    r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
    r"\29F_Embed16_BS2000_LR0005_36M_LRPlateau\Outputs\diagnostics\live"
    r"\vsn_weights.csv"
)

META_JSON = Path(
    r"C:\Users\Rahul Parmeshwar\Documents\GitHub\Stock-Forecaster"
    r"\Advanced Modelling\Final Execution Files\T V MR Exit\Dynamic SLTP"
    r"\DENOISED CUSTOM TRANSFORM\Custom Macro Test"
    r"\29F_Embed16_BS2000_LR0005_36M_LRPlateau\Outputs\diagnostics"
    r"\meta.json"
)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def load_feature_names() -> list[str]:
    """Load feature names from meta.json."""
    if META_JSON.exists():
        with open(META_JSON) as f:
            meta = json.load(f)
            return meta.get("feature_names", [])
    return []


def get_last_uploaded_bar() -> int:
    """Get the most recent bar number we've uploaded."""
    result = (
        supabase.table("vsn_weights")
        .select("bar")
        .order("bar", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["bar"]
    return 0


def upload_new_weights():
    """Read VSN CSV, find new rows, upload with delay."""
    if not VSN_CSV.exists():
        print(f"  VSN CSV not found: {VSN_CSV}")
        return

    now = datetime.now(timezone.utc)
    delay_cutoff = now - timedelta(minutes=DELAY_MINUTES)
    last_bar = get_last_uploaded_bar()
    feature_names = load_feature_names()

    rows_to_upload = []

    with open(VSN_CSV, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            bar = int(row.get("bar", 0))
            stream = row.get("stream", "").strip()
            ts_str = row.get("timestamp", "").strip()

            # Only upload long stream (for the website)
            if stream != "long":
                continue

            # Skip already uploaded
            if bar <= last_bar:
                continue

            # Parse timestamp and enforce delay
            try:
                ts = datetime.fromisoformat(ts_str)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts > delay_cutoff:
                    continue
            except ValueError:
                continue

            # Extract weights as dict with feature names
            w_cols = [c for c in row.keys() if c.startswith("w_")]
            weights = {}
            for wc in sorted(w_cols, key=lambda x: int(x.split("_")[1])):
                idx = int(wc.split("_")[1])
                fname = feature_names[idx] if idx < len(feature_names) else wc
                weights[fname] = round(float(row[wc]), 6)

            rows_to_upload.append({
                "bar": bar,
                "timestamp": ts_str,
                "stream": stream,
                "weights": json.dumps(weights),
            })

    if rows_to_upload:
        print(f"[{now.strftime('%H:%M:%S')}] VSN: uploading {len(rows_to_upload)} bars")
        for i in range(0, len(rows_to_upload), 50):
            batch = rows_to_upload[i:i + 50]
            supabase.table("vsn_weights").insert(batch).execute()
    else:
        print(f"[{now.strftime('%H:%M:%S')}] VSN: no new bars to upload")


def main():
    print("=" * 60)
    print("VSN Weight Uploader — Supabase")
    print(f"Delay: {DELAY_MINUTES} min | Poll: {POLL_SECONDS}s")
    print(f"CSV: {'OK' if VSN_CSV.exists() else 'NOT FOUND'}")
    print("=" * 60)

    while True:
        try:
            upload_new_weights()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

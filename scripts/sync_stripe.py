"""
Stripe → Supabase Subscription Sync
====================================
Polls Stripe for active subscriptions and marks users as "pro" in Supabase.
Run alongside the signal uploader, or as a cron job.

Usage:
  python sync_stripe.py

Requires:
  pip install stripe supabase python-dotenv
"""
from __future__ import annotations
import os
import time
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
import stripe
from supabase import create_client

load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
STRIPE_SECRET_KEY = os.environ["STRIPE_SECRET_KEY"]
POLL_SECONDS = 60  # check every 60 seconds

stripe.api_key = STRIPE_SECRET_KEY
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def sync_subscriptions():
    """Fetch all active Stripe subscriptions and sync to Supabase."""
    now = datetime.now(timezone.utc)

    # Get all active subscriptions from Stripe
    subscriptions = stripe.Subscription.list(status="active", limit=100)

    active_customers = set()

    for sub in subscriptions.data:
        customer_id = sub.customer
        active_customers.add(customer_id)

        # Get customer email
        try:
            customer = stripe.Customer.retrieve(customer_id)
            email = customer.email
        except Exception as e:
            print(f"  Error fetching customer {customer_id}: {e}")
            continue

        if not email:
            continue

        # Get period end
        period_end = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc).isoformat()

        # Find matching Supabase user
        user_id = None
        try:
            users_resp = supabase.auth.admin.list_users()
            for u in users_resp:
                if hasattr(u, 'email') and u.email and u.email.lower() == email.lower():
                    user_id = u.id
                    break
        except Exception:
            pass

        # Upsert subscriber
        try:
            supabase.table("subscribers").upsert(
                {
                    "email": email.lower(),
                    "user_id": user_id,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": sub.id,
                    "status": "pro",
                    "current_period_end": period_end,
                    "updated_at": now.isoformat(),
                },
                on_conflict="email",
            ).execute()
        except Exception as e:
            print(f"  Error upserting {email}: {e}")

    # Mark expired subscriptions as free
    try:
        result = supabase.table("subscribers").select("email, stripe_customer_id, status").eq("status", "pro").execute()
        for row in result.data or []:
            if row.get("stripe_customer_id") and row["stripe_customer_id"] not in active_customers:
                supabase.table("subscribers").update(
                    {"status": "free", "updated_at": now.isoformat()}
                ).eq("email", row["email"]).execute()
                print(f"  Marked {row['email']} as free (subscription ended)")
    except Exception as e:
        print(f"  Error checking expired: {e}")

    print(f"[{now.strftime('%H:%M:%S')}] Synced {len(active_customers)} active subscriptions")


def main():
    print("=" * 60)
    print("Stripe → Supabase Subscription Sync")
    print(f"Poll interval: {POLL_SECONDS}s")
    print("=" * 60)

    while True:
        try:
            sync_subscriptions()
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

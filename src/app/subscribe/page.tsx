"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/5kQ5kC65R6sb8c63gV4gg00";
const STRIPE_CUSTOMER_PORTAL = "https://billing.stripe.com/p/login/PLACEHOLDER";

export default function SubscribePage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<{
    status: string;
    current_period_end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from("subscribers")
          .select("status, current_period_end")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => {
            setSubscription(data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const isPro = subscription?.status === "pro";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-3xl text-[#1a1a2e]">Subscription</h1>
        <p className="mt-2 text-[#6b7280] text-sm">
          Get instant access to real-time model signals.
        </p>
      </div>

      {/* Current plan badge */}
      {user && (
        <div className="text-center mb-10">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPro
                ? "bg-[#dcfce7] text-[#166534]"
                : "bg-[#f3f4f6] text-[#374151]"
            }`}
          >
            Current plan: {isPro ? "Pro" : "Free"}
          </span>
          {isPro && subscription?.current_period_end && (
            <p className="mt-2 text-xs text-[#6b7280]">
              Renews{" "}
              {new Date(subscription.current_period_end).toLocaleDateString(
                "en-GB",
                { day: "numeric", month: "long", year: "numeric" }
              )}
            </p>
          )}
        </div>
      )}

      {/* Plan comparison */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">
        {/* Free tier */}
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#1a1a2e]">Free</h2>
          <p className="mt-1 text-2xl font-bold text-[#1a1a2e]">
            $0<span className="text-sm font-normal text-[#6b7280]">/mo</span>
          </p>
          <ul className="mt-6 space-y-3">
            <PlanItem included>15-minute delayed signals</PlanItem>
            <PlanItem included>All research papers</PlanItem>
            <PlanItem included>Performance dashboard</PlanItem>
            <PlanItem>Real-time signals</PlanItem>
            <PlanItem>Email alerts</PlanItem>
            <PlanItem>Priority support</PlanItem>
          </ul>
          {!user && (
            <a
              href="/login"
              className="mt-6 block text-center rounded-md border border-[#e5e7eb] px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              Sign up free
            </a>
          )}
        </div>

        {/* Pro tier */}
        <div className="rounded-lg border-2 border-[#1e40af] bg-white p-6 relative">
          <div className="absolute -top-3 left-6 px-2 py-0.5 bg-[#1e40af] text-white text-xs font-medium rounded">
            Recommended
          </div>
          <h2 className="text-lg font-semibold text-[#1a1a2e]">Pro</h2>
          <p className="mt-1 text-2xl font-bold text-[#1a1a2e]">
            $15<span className="text-sm font-normal text-[#6b7280]">/mo</span>
          </p>
          <ul className="mt-6 space-y-3">
            <PlanItem included>Instant signals (0 delay)</PlanItem>
            <PlanItem included>All research papers</PlanItem>
            <PlanItem included>Performance dashboard</PlanItem>
            <PlanItem included>Real-time signals</PlanItem>
            <PlanItem included soon>
              Email alerts
            </PlanItem>
            <PlanItem included>Priority support</PlanItem>
          </ul>

          {isPro ? (
            <a
              href={STRIPE_CUSTOMER_PORTAL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block text-center rounded-md border border-[#e5e7eb] px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              Manage subscription
            </a>
          ) : user ? (
            <a
              href={`${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(
                user.email ?? ""
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block text-center rounded-md bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a8a] transition-colors"
            >
              Subscribe &mdash; $15/month
            </a>
          ) : (
            <a
              href="/login"
              className="mt-6 block text-center rounded-md bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a8a] transition-colors"
            >
              Sign in to subscribe
            </a>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#9ca3af]">
        Cancel anytime. Payments processed securely via Stripe.
      </p>
    </div>
  );
}

function PlanItem({
  children,
  included,
  soon,
}: {
  children: React.ReactNode;
  included?: boolean;
  soon?: boolean;
}) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <svg
          className="h-4 w-4 mt-0.5 text-[#059669] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4 mt-0.5 text-[#d1d5db] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      <span className={included ? "text-[#374151]" : "text-[#9ca3af]"}>
        {children}
        {soon && (
          <span className="ml-1.5 text-[10px] font-medium text-[#6b7280] bg-[#f3f4f6] px-1.5 py-0.5 rounded">
            coming soon
          </span>
        )}
      </span>
    </li>
  );
}

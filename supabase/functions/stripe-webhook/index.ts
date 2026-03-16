// Supabase Edge Function: Stripe Webhook Handler
// Deployed via: supabase functions deploy stripe-webhook
// Stripe webhook URL: https://skthypriuhjcayuxaydf.supabase.co/functions/v1/stripe-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple Stripe signature verification
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split("=");
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const expectedSig = parts["v1"];

  if (!timestamp || !expectedSig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSig === expectedSig;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  // Verify signature
  const valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error("Invalid Stripe signature");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(body);
  console.log(`Stripe event: ${event.type}`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email = session.customer_details?.email || session.customer_email;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!email) {
        console.error("No email in checkout session");
        break;
      }

      console.log(`Checkout completed: ${email}, subscription: ${stripeSubscriptionId}`);

      // Find the Supabase user by email
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users?.find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      // Upsert subscriber record
      const { error } = await supabase.from("subscribers").upsert(
        {
          email: email.toLowerCase(),
          user_id: user?.id || null,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          status: "pro",
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );

      if (error) {
        console.error("Upsert error:", error);
      } else {
        console.log(`Marked ${email} as pro`);
      }
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId = sub.customer;
      const status = sub.status === "active" ? "pro" : "free";
      const cancelAtPeriodEnd = sub.cancel_at_period_end;

      // Update by stripe_customer_id
      const { error } = await supabase
        .from("subscribers")
        .update({
          status: cancelAtPeriodEnd ? "canceling" : status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.error("Update error:", error);
      } else {
        console.log(`Updated subscription for customer ${customerId}: ${status}`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      await supabase
        .from("subscribers")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", customerId);

      console.log(`Payment failed for customer ${customerId}`);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

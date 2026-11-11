/**
 * Cloudflare Pages Function: eBay marketplace account deletion/closure endpoint.
 *
 *   GET  /api/ebay-deletion?challenge_code=...  -> proves we own this URL
 *   POST /api/ebay-deletion                     -> receives real deletion notices
 *
 * WHY THIS EXISTS. eBay disables a production keyset until the developer either
 * claims an exemption or stands up this endpoint. Ours was disabled, which is
 * what made the OAuth token request return 401 invalid_client -- the keys were
 * correct all along. Standing this up re-enables the keyset, which is what lets
 * the PC part alerter read eBay prices through the Browse API instead of
 * scraping search pages that answer with HTTP 403.
 *
 * VALIDATION. On save, eBay GETs this URL with ?challenge_code=XYZ. We must
 * answer 200 application/json with
 *
 *     { "challengeResponse": sha256hex(challengeCode + verificationToken + endpoint) }
 *
 * The three parts are concatenated IN THAT ORDER and the endpoint must be the
 * exact URL registered with eBay -- same scheme, host and path, no trailing
 * slash. A mismatch anywhere yields a well-formed hash that simply does not
 * match theirs, and the only symptom is "endpoint validation failed".
 *
 * SECRET -- never committed:
 *   wrangler pages secret put EBAY_VERIFICATION_TOKEN
 * It must be the SAME string typed into the eBay portal's "Verification token"
 * field (32-80 chars, letters/digits/_/- only).
 *
 * WHAT WE ACTUALLY STORE. Nothing about eBay users. This tool reads public
 * listing prices only, so a deletion notice has no personal data of ours to
 * erase. We still acknowledge every notice, because failing to respond 200 is
 * itself grounds for eBay disabling the keyset again.
 */

// The URL registered with eBay. Must match byte for byte, so it is written out
// rather than derived from the request -- a proxy or a redirect could otherwise
// hand us a host that is not the one eBay has on file.
const ENDPOINT = "https://rahulsp.com/api/ebay-deletion";

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const challengeCode = url.searchParams.get("challenge_code");

  // A plain GET with no challenge is a health check, not a validation attempt.
  if (!challengeCode) {
    return new Response(
      JSON.stringify({ status: "ok", endpoint: ENDPOINT }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const token = env.EBAY_VERIFICATION_TOKEN;
  if (!token) {
    // Returning 200 with a wrong hash would read to eBay as "validation
    // failed" with no clue why. 500 makes the missing secret visible.
    return new Response(
      JSON.stringify({ error: "EBAY_VERIFICATION_TOKEN is not set" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(challengeCode + token + ENDPOINT),
  );

  return new Response(JSON.stringify({ challengeResponse: hex(digest) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPost({ request }) {
  // A real account-deletion notice. We hold no eBay user data, so there is
  // nothing to erase -- but the acknowledgement is mandatory. Read and discard
  // the body so a malformed payload cannot turn into a non-200.
  try {
    await request.text();
  } catch {
    // ignore -- acknowledge regardless
  }
  return new Response(null, { status: 200 });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

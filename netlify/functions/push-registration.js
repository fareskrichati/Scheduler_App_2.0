const { configured, database, supabaseBase, validEndpoint, validSubscription, validTimezone } = require("./lib/planner-push");

function reply(statusCode, payload) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(payload) };
}

exports.handler = async (event) => {
  if (!configured()) return reply(503, { error: "Push notifications are unavailable on this deployment." });
  if (event.httpMethod === "GET") return reply(200, { publicKey: process.env.PUSH_VAPID_PUBLIC_KEY });
  if (!["POST", "DELETE"].includes(event.httpMethod)) return reply(405, { error: "Unsupported request." });
  const authorization = event.headers?.authorization;
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in to manage push notifications." });
  if (!event.body || event.body.length > 8192) return reply(400, { error: "Invalid push subscription." });

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return reply(400, { error: "Invalid push subscription." });
  }

  try {
    const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const session = await fetch(`${supabaseBase()}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: authorization }, signal: AbortSignal.timeout(5000),
    });
    if (!session.ok) return reply(401, { error: "Sign in to manage push notifications." });
    const { id: userId } = await session.json();

    if (event.httpMethod === "DELETE") {
      if (!validEndpoint(payload?.endpoint)) return reply(400, { error: "Invalid push endpoint." });
      const filter = new URLSearchParams({ user_id: `eq.${userId}`, endpoint: `eq.${payload.endpoint}` });
      await database(`planner_push_subscriptions?${filter}`, { method: "DELETE" });
    } else {
      const { subscription, timezone } = payload || {};
      if (!validSubscription(subscription) || !validTimezone(timezone)) {
        return reply(400, { error: "This browser's push subscription is unsupported." });
      }
      const { endpoint, keys: { p256dh, auth } } = subscription;
      await database("planner_push_subscriptions?on_conflict=user_id,endpoint", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, endpoint, timezone, subscription: { endpoint, keys: { p256dh, auth } } }),
      });
    }
    return reply(200, { ok: true });
  } catch (error) {
    console.error("Push registration failed:", error.message);
    return reply(502, { error: "UniPlan could not save your push notification setting. Try again." });
  }
};

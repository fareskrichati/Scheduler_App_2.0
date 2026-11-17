const webPush = require("web-push");
const { configured, database, dueNotifications, validSubscription } = require("./lib/planner-push");

async function deliver(device, notification) {
  const claim = { subscription_id: device.id, notification_key: notification.key };
  const inserted = await database("planner_push_deliveries?on_conflict=subscription_id,notification_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(claim),
  });
  if (!inserted.length) return;

  try {
    await webPush.sendNotification(device.subscription, JSON.stringify(notification), {
      TTL: 3600, timeout: 5000, topic: notification.key,
      vapidDetails: {
        subject: process.env.PUSH_VAPID_SUBJECT,
        publicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
        privateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
      },
    });
  } catch (error) {
    if ([404, 410].includes(error.statusCode)) {
      await database(`planner_push_subscriptions?id=eq.${device.id}&user_id=eq.${device.user_id}`, { method: "DELETE" });
      return;
    }
    await database(`planner_push_deliveries?subscription_id=eq.${device.id}&notification_key=eq.${notification.key}`, { method: "DELETE" });
    throw error;
  }
}

exports.handler = async () => {
  if (!configured()) return { statusCode: 200, body: "Push delivery is disabled." };
  const now = Date.now();
  const pageSize = 100;
  let failed = 0;
  let after = "";
  try {
    while (true) {
      const filter = new URLSearchParams({
        select: "id,user_id,subscription,timezone,planner_profiles!inner(data)",
        order: "id.asc",
        limit: String(pageSize),
      });
      if (after) filter.set("id", `gt.${after}`);
      const devices = await database(`planner_push_subscriptions?${filter}`);
      const jobs = devices.flatMap((device) => validSubscription(device.subscription)
        ? dueNotifications(device.planner_profiles?.data, device.timezone, now, device.user_id)
          .map((notification) => ({ device, notification }))
        : []);
      for (let index = 0; index < jobs.length; index += 10) {
        const results = await Promise.allSettled(jobs.slice(index, index + 10)
          .map(({ device, notification }) => deliver(device, notification)));
        failed += results.filter((result) => result.status === "rejected").length;
      }
      if (devices.length < pageSize) break;
      after = devices.at(-1).id;
    }

    // Claims only need to outlive the delivery window.
    if (new Date(now).getUTCMinutes() === 0) {
      const cutoff = new Date(now - 7 * 86_400_000).toISOString();
      await database(`planner_push_deliveries?${new URLSearchParams({ created_at: `lt.${cutoff}` })}`, { method: "DELETE" });
    }
  } catch (error) {
    console.error("Push dispatch failed:", error.message);
    failed += 1;
  }
  if (failed) console.error(`Push dispatch had ${failed} failed operations.`);
  return { statusCode: failed ? 502 : 200, body: JSON.stringify({ failed }) };
};

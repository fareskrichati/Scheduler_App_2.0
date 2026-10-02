exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  try {
    const { feedUrl } = JSON.parse(event.body || "{}");
    const url = new URL(feedUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".instructure.com") || !/^\/feeds\/calendars\/[^/]+\.ics$/i.test(url.pathname)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid Canvas calendar feed URL." }) };
    }
    const response = await fetch(url, { headers: { Accept: "text/calendar" }, redirect: "error" });
    if (!response.ok) throw new Error(`Canvas returned ${response.status}.`);
    const ics = await response.text();
    if (ics.length > 2_000_000 || !ics.includes("BEGIN:VCALENDAR")) throw new Error("Canvas returned an invalid or oversized calendar.");
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ ics }) };
  } catch (error) {
    return { statusCode: 502, headers: { "Cache-Control": "no-store" }, body: JSON.stringify({ error: error.message || "Could not read Canvas calendar." }) };
  }
};

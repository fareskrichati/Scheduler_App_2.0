const OPENAI_URL = "https://api.openai.com/v1/responses";
const SUPABASE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmFoc2xieGRza3poaXd4eG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTE2MzksImV4cCI6MjA5NDAyNzYzOX0.ovt30I4ZqPclxcXR5XJVrtBKUn_bVz17vrTJklxg3h8";

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!process.env.OPENAI_API_KEY) return json(503, { error: "Event photo import is not configured yet." });

  try {
    await requirePlannerUser(event.headers.authorization || event.headers.Authorization);
    const input = JSON.parse(event.body || "{}");
    const images = Array.isArray(input.images) ? input.images.slice(0, 4) : [];
    if (!images.length || images.some((image) => typeof image !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(image))) {
      return json(400, { error: "Upload at least one valid schedule screenshot." });
    }

    const prompt = `First transcribe the visible text in these screenshots exactly, in reading order. Then pull events only from that transcription. Today is ${clean(input.currentDate, 10)} and the user's timezone is ${clean(input.timezone, 80) || "UTC"}.
Return the transcription in sourceText. Extract each distinct event, game, match, practice, meeting, lift, training session, tournament, or activity whose name, date or weekday, and any shown time can be supported by sourceText. Use the schedule heading and surrounding text to create a useful title.

For free-form weekly schedules, a weekday heading applies to every time line beneath it until the next weekday heading. Split multiple time ranges on one weekday into separate events. Treat text after @ as the location. If only a weekday is supplied, use its next occurrence on or after today and add "Repeats weekly on <weekday>" to notes. Do not collapse separate meetings, lifts, or training sessions into one event.

For dated schedules, resolve dates to YYYY-MM-DD and infer the most logical current or upcoming year when omitted. Use 24-hour HH:MM times. If a start time is shown but no end is shown, set end one hour after start and explain that in notes. If no time is shown, use 09:00 to 10:00 and explain that in notes. Preserve home/away, opponent, venue, team level, and useful details. Ignore prose that is not an event. Do not invent, infer, or add an event that is not supported by sourceText. Return events in chronological order.`;
    const content = [{ type: "input_text", text: prompt }, ...images.map((image_url) => ({ type: "input_image", image_url, detail: "high" }))];
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_EVENT_IMPORT_MODEL || "gpt-5.4-mini",
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "event_schedule", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["sourceText", "events"], properties: {
            sourceText: { type: "string" },
            events: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "date", "start", "end", "location", "notes"], properties: {
              title: { type: "string" }, date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, start: { type: "string", pattern: "^\\d{2}:\\d{2}$" }, end: { type: "string", pattern: "^\\d{2}:\\d{2}$" }, location: { type: "string" }, notes: { type: "string" }
            } } }
          }
        } } }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "Event schedule recognition failed.");
    return json(200, JSON.parse(extractOutputText(payload)));
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || "Event schedule recognition failed." });
  }
};

async function requirePlannerUser(authorization) {
  const url = process.env.SUPABASE_URL || "";
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLIC_ANON_KEY;
  if (!url) throw Object.assign(new Error("Backend authentication is not configured. Add SUPABASE_URL in Netlify."), { statusCode: 503 });
  if (!authorization?.startsWith("Bearer ")) throw Object.assign(new Error("Sign in before importing an event schedule."), { statusCode: 401 });
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: authorization } });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    if (/invalid api key/i.test(failure.message || failure.msg || "")) {
      throw Object.assign(new Error("Event import authentication is misconfigured. Check the Supabase URL and public API key in Netlify, then redeploy. Signing in again will not fix this."), { statusCode: 503 });
    }
    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error("Your sign-in could not be verified. Sign out, sign in again, and retry."), { statusCode: 401 });
    }
    throw Object.assign(new Error("The sign-in service is temporarily unavailable. Try reading the screenshot again shortly."), { statusCode: 503 });
  }
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("No event data was returned.");
}

function clean(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) }; }

const OPENAI_URL = "https://api.openai.com/v1/responses";

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!process.env.OPENAI_API_KEY) return json(503, { error: "Homework photo import is not configured yet." });

  try {
    await requirePlannerUser(event.headers.authorization || event.headers.Authorization);
    const input = JSON.parse(event.body || "{}");
    const images = Array.isArray(input.images) ? input.images.slice(0, 4) : [];
    if (!images.length || images.some((image) => typeof image !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(image))) {
      return json(400, { error: "Upload at least one valid Canvas screenshot." });
    }
    const knownCourses = Array.isArray(input.knownCourses) ? input.knownCourses.slice(0, 100).map((value) => clean(value, 120)).filter(Boolean) : [];
    const prompt = `Read these screenshots as Canvas coursework. Today is ${clean(input.currentDate, 10)} and the user's timezone is ${clean(input.timezone, 80) || "UTC"}.

Extract every visible, incomplete homework, assignment, discussion, quiz, test, midterm, final, or exam that has a due date. Return one item per visible coursework row and do not merge distinct rows.

Layout rules:
- Canvas Grades: the course may appear once in a page heading or course selector. Apply that course to its assignment rows. The assignment group below a title can identify Homework or Exams.
- Canvas Agenda/To Do: a date heading applies to every following row until the next date heading. A course block label applies to its rows. Use the row's assignment/discussion/quiz label, title, and DUE time together.
- Ignore rows marked completed, submitted, or shown only inside a completed-items section. Ignore "Nothing Planned Yet".
- Classify quizzes, tests, midterms, finals, and exams as "exam"; classify all other coursework as "homework".
- When a year is missing, infer the most logical current or upcoming academic date relative to today. Dates must be YYYY-MM-DD and times must be 24-hour HH:MM. Use an empty time only when none is visible.
- Preserve the visible title without adding the course name to it. Match the course to one of the saved course names when clearly possible; otherwise return the visible course label.
- Never invent coursework, dates, or times. Use confidence "low" when important text is ambiguous.

Saved course names: ${knownCourses.length ? knownCourses.join(" | ") : "none supplied"}`;
    const content = [{ type: "input_text", text: prompt }, ...images.map((image_url) => ({ type: "input_image", image_url, detail: "high" }))];
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_HOMEWORK_IMPORT_MODEL || "gpt-5.4-mini",
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "canvas_coursework", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["items"], properties: {
            items: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "course", "kind", "date", "time", "notes", "confidence"], properties: {
              title: { type: "string" }, course: { type: "string" }, kind: { type: "string", enum: ["homework", "exam"] }, date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, time: { type: "string", pattern: "^(?:|\\d{2}:\\d{2})$" }, notes: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] }
            } } }
          }
        } } }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "Canvas screenshot recognition failed.");
    return json(200, JSON.parse(extractOutputText(payload)));
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || "Canvas screenshot recognition failed." });
  }
};

async function requirePlannerUser(authorization) {
  const url = process.env.SUPABASE_URL || "";
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!url || !apiKey) throw Object.assign(new Error("Backend authentication is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Netlify."), { statusCode: 503 });
  if (!authorization?.startsWith("Bearer ")) throw Object.assign(new Error("Sign in before importing Canvas screenshots."), { statusCode: 401 });
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: authorization } });
  if (!response.ok) throw Object.assign(new Error("Your sign-in could not be verified. Sign out, sign in again, and retry."), { statusCode: 401 });
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("No coursework data was returned.");
}

function clean(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) }; }

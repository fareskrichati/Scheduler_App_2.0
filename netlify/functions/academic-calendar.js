const OPENAI_URL = "https://api.openai.com/v1/responses";
// This is the same public anon key used by the browser client. It is safe to ship publicly
// and is required when validating an end-user access token with Supabase Auth.
const SUPABASE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmFoc2xieGRza3poaXd4eG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTE2MzksImV4cCI6MjA5NDAyNzYzOX0.ovt30I4ZqPclxcXR5XJVrtBKUn_bVz17vrTJklxg3h8";

exports.handler = async function handler(event) {
  const authConfig = getSupabaseAuthConfig();
  if (event.httpMethod === "GET") {
    const missing = [];
    if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
    if (!authConfig.url) missing.push("SUPABASE_URL");
    if (!authConfig.apiKey) missing.push("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY");
    return json(200, { configured: missing.length === 0, missing });
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!process.env.OPENAI_API_KEY) return json(503, { error: "School-calendar lookup is not configured yet." });

  try {
    await requirePlannerUser(event.headers.authorization || event.headers.Authorization);
    const input = JSON.parse(event.body || "{}");
    const schoolName = clean(input.schoolName, 140);
    const academicYear = clean(input.academicYear, 30);
    const termSystem = ["quarter", "semester", "trimester"].includes(input.termSystem) ? input.termSystem : "semester";
    const termName = clean(input.termName, 60);
    if (!schoolName || !academicYear) return json(400, { error: "School name and academic year are required." });

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CALENDAR_MODEL || "gpt-5.4-mini",
        tools: [{ type: "web_search" }],
        max_tool_calls: 4,
        input: `Research the official academic calendar for ${schoolName}, academic year ${academicYear}. The school uses a ${termSystem} system. ${termName ? `Return the ${termName} term.` : "Return the first relevant term in that academic year."}\nUse only official school-controlled websites or official calendar PDFs. Do not use third-party calendar sites. Return the exact instructional term start/end dates and named no-class breaks inside that term. If sources conflict or the exact school cannot be confidently identified, set confidence to low and explain why.`,
        text: {
          format: {
            type: "json_schema",
            name: "academic_calendar",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["schoolName", "academicYear", "termSystem", "termName", "start", "end", "breaks", "sources", "confidence", "notes"],
              properties: {
                schoolName: { type: "string" }, academicYear: { type: "string" }, termSystem: { type: "string", enum: ["quarter", "semester", "trimester"] }, termName: { type: "string" },
                start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, end: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                breaks: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "start", "end"], properties: { name: { type: "string" }, start: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, end: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } } },
                sources: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } } },
                confidence: { type: "string", enum: ["high", "medium", "low"] }, notes: { type: "string" }
              }
            }
          }
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "Calendar research failed.");
    const result = JSON.parse(extractOutputText(payload));
    if (!result.sources.every((source) => /^https:\/\//i.test(source.url))) throw new Error("Official source links were not returned.");
    return json(200, result);
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || "Calendar research failed." });
  }
};

async function requirePlannerUser(authorization) {
  const { url, apiKey } = getSupabaseAuthConfig();
  if (!url || !apiKey) throw Object.assign(new Error("Backend authentication is not configured. Add SUPABASE_URL and a Supabase publishable or anon key in Netlify."), { statusCode: 503 });
  if (!authorization?.startsWith("Bearer ")) throw Object.assign(new Error("Sign in before researching a school calendar."), { statusCode: 401 });
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: authorization } });
  if (!response.ok) throw Object.assign(new Error("Your sign-in could not be verified. Sign out, sign in again, and retry."), { statusCode: 401 });
}

function getSupabaseAuthConfig() {
  return {
    url: process.env.SUPABASE_URL || "",
    apiKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLIC_ANON_KEY
  };
}

function extractOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) return content.text;
  throw new Error("No calendar data was returned.");
}

function clean(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) }; }

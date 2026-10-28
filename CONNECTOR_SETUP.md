# UniPlan connector for ChatGPT and Claude

The connector lets an AI app manage the signed-in user's UniPlan planner. AI conversations stay in ChatGPT or Claude; it does not change the pet into an AI chatbot. The connector itself makes no model/API requests.

## Enable the connector

1. The `planner_connector_oauth_grants` migration has been applied to the existing UniPlan Supabase project (`mgvahslbxdskzhiwxxod`). For a new environment, run `supabase-connector.sql` in its Supabase SQL editor. The table has RLS and is accessible only to the server service role, not public or signed-in browser roles.
2. In Netlify's server environment, configure:

   | Variable | Value |
   | --- | --- |
   | `CONNECTOR_PUBLIC_URL` | Your canonical HTTPS origin, such as `https://your-site.netlify.app`, with no path. OAuth discovery, consent and `/mcp` must use this same origin. |
   | `CONNECTOR_SIGNING_SECRET` | A separate random secret of at least 32 characters. Generate with `openssl rand -hex 32` and store only in Netlify. Rotating it invalidates existing connections and registrations. |
   | `SUPABASE_URL` | The existing UniPlan Supabase project URL. |
   | `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | The existing project's public browser key, used to verify UniPlan sign-in. |
   | `SUPABASE_SERVICE_ROLE_KEY` | The existing project's server-only service key. Never add it to browser config. |

3. Deploy using the existing `node build-deploy.js` Netlify build. It includes both backend functions, their shared modules, the OAuth consent page, discovery rewrites and page headers. A static-only host cannot run the connector.
4. Open UniPlan Settings → **Connect ChatGPT or Claude**. Use **Refresh connections** to check server configuration and copy the connector URL. `/connector/status` must return `ready: true` before proceeding.

No OpenAI or Anthropic API key is required for this connector. Existing hosting/database usage still follows your provider plans.

## Connect an AI app

- **ChatGPT:** Open Plugins → Add custom MCP server, enter the UniPlan `/mcp` URL, and choose OAuth if prompted. Your account/workspace must allow custom MCP servers. Follow the [official setup guide](https://developers.openai.com/api/docs/guides/custom-mcp-server).
- **Claude:** Open Settings → Connectors → Add custom connector and enter the same URL. Use automatic/dynamic OAuth client registration if asked to choose an OAuth client; this server advertises a registration endpoint. Follow the [official connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
- Sign in on the UniPlan consent page, review the app name and return destination, and approve the connection. Uncheck permission to change the planner for a read-only connection.
- To disconnect, use UniPlan Settings → **Disconnect**. Revocation immediately invalidates that connection's access and refresh tokens.

Try:

- “What classes and deadlines do I have today in UniPlan?”
- “Add this assignment to UniPlan for Friday at 11:59 PM, using its class color.”
- “Move my study group to 4 PM.”
- “Mark my reading assignment done.”
- “Import these weekly classes for October 1–December 20, excluding my school breaks.”

The AI can interpret screenshots, email text, or other data available in its own conversation and call the connector with the resulting details. The connector does not independently connect to email, other calendars, or Canvas. Canvas items already imported into UniPlan are available to it. Unknown required dates/times must be clarified rather than invented.

## Behavior and access

- Six tools: planner context, date-range schedule, create item, update one occurrence, set to-do status, and import a weekly class schedule.
- All planner access is bound to the UniPlan account that approved OAuth. There is no tool argument for choosing a user ID.
- Read responses return item fields, course colors, and academic dates. Account credentials, private Canvas feed links and other settings are excluded.
- Course code matches preserve colors across lecture/discussion sections. Imports respect school breaks and do not replace the existing school term. Update term dates in UniPlan first if importing a new term.
- Repeated creates/imports skip matching existing items. Status updates are idempotent. Updates affect one occurrence, not an entire series.
- Writes compare the planner's cloud revision and reject a concurrent change instead of overwriting it. The AI should re-read after a conflict.
- Authorization codes expire in 5 minutes and are single-use with S256 PKCE. Access tokens last 1 hour; rotating refresh tokens expire after 30 days without refresh. Only hashes of authorization codes and refresh secrets are stored.
- The RLS advisor may report “RLS enabled, no policy” for the grant table. This is intentional: browser roles have no grants and no policies; access is through the owner-scoped backend service only. [RLS advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Verify

Run `node --test tests/connector.test.js` and `node build-deploy.js`. Tests use isolated mock storage and never create real planner events.

After deployment, complete one real consent round trip in each AI app, read your schedule, add a disposable test reminder, mark it done, then disconnect and confirm access is denied. These live provider checks cannot be completed from a static preview or before Netlify is configured.

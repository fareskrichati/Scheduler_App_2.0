const fs = require("fs");
const path = require("path");

const root = __dirname;
const sharedCss = readSource(["css/styles.css", "styles.css"]);
const customizationCss = readSource(["css/customization.css"]);
const mobileCss = readSource(["css/mobile.css", "mobile.css"]);
const configJs = readSource(["js/config.js", "config.js"]);
const customizationJs = readSource(["js/customization.js"]);
const scheduleShareJs = readSource(["js/schedule-share.js"]);
const appJs = readSource(["js/app.js", "app.js"]);
const redirectJs = readSource(["js/device-redirect.js", "device-redirect.js"]);

fs.mkdirSync(resolvePath("deploy"), { recursive: true });
fs.mkdirSync(resolvePath("deploy/scriptable"), { recursive: true });
fs.mkdirSync(resolvePath("deploy/netlify/functions"), { recursive: true });

buildPage({
  source: "index.html",
  target: "deploy/index.html",
  extraCss: "",
  includeRedirect: true,
});

buildPage({
  source: "mobile.html",
  target: "deploy/mobile.html",
  extraCss: mobileCss,
  includeRedirect: false,
});

fs.copyFileSync(resolvePath("widget-preview.html"), resolvePath("deploy/widget-preview.html"));
fs.mkdirSync(resolvePath("deploy/css"), { recursive: true });
fs.mkdirSync(resolvePath("deploy/js"), { recursive: true });
fs.copyFileSync(resolvePath("css/widget-preview.css"), resolvePath("deploy/css/widget-preview.css"));
fs.copyFileSync(resolvePath("js/widget-preview.js"), resolvePath("deploy/js/widget-preview.js"));

fs.writeFileSync(resolvePath("deploy/netlify.toml"), '[build]\n  publish = "."\n\n[functions]\n  directory = "netlify/functions"\n\n[functions."weekly-schedule-reminders"]\n  schedule = "*/15 * * * *"\n');
fs.copyFileSync(resolvePath("netlify/functions/academic-calendar.js"), resolvePath("deploy/netlify/functions/academic-calendar.js"));
fs.copyFileSync(resolvePath("netlify/functions/event-photo-import.js"), resolvePath("deploy/netlify/functions/event-photo-import.js"));
fs.copyFileSync(resolvePath("netlify/functions/homework-photo-import.js"), resolvePath("deploy/netlify/functions/homework-photo-import.js"));
fs.copyFileSync(resolvePath("netlify/functions/canvas-calendar-feed.js"), resolvePath("deploy/netlify/functions/canvas-calendar-feed.js"));
fs.copyFileSync(resolvePath("netlify/functions/weekly-schedule-reminders.js"), resolvePath("deploy/netlify/functions/weekly-schedule-reminders.js"));
fs.copyFileSync(
  findSource(["scriptable/DailyPlannerWidget.js", "DailyPlannerWidget.js"]),
  resolvePath("deploy/scriptable/DailyPlannerWidget.js"),
);
fs.copyFileSync(resolvePath("SCRIPTABLE_SETUP.md"), resolvePath("deploy/SCRIPTABLE_SETUP.md"));
fs.copyFileSync(resolvePath("IMAGE_IMPORT_SETUP.md"), resolvePath("deploy/IMAGE_IMPORT_SETUP.md"));

function resolvePath(relativePath) {
  return path.resolve(root, relativePath);
}

function findSource(candidates) {
  const match = candidates.map(resolvePath).find((candidate) => fs.existsSync(candidate));
  if (match) {
    return match;
  }

  throw new Error(`Missing build source. Checked: ${candidates.join(", ")}`);
}

function readSource(candidates) {
  return fs.readFileSync(findSource(candidates), "utf8");
}

function buildPage({ source, target, extraCss, includeRedirect }) {
  let html = fs.readFileSync(resolvePath(source), "utf8");

  html = html.replace(
    /    <link rel="stylesheet" href="css\/styles\.css" \/>\n?/,
    `    <style>\n${sharedCss}\n${extraCss}\n${customizationCss}\n    </style>\n`,
  );
  html = html.replace(/    <link rel="stylesheet" href="css\/mobile\.css" \/>\n?/, "");
  html = html.replace(/    <link rel="stylesheet" href="css\/customization\.css" \/>\n?/, "");
  html = html.replace(
    /    <script src="js\/config\.js"><\/script>/,
    `    <script>\n${configJs}\n    </script>`,
  );

  if (includeRedirect) {
    html = html.replace(
      /    <script src="js\/device-redirect\.js"><\/script>/,
      `    <script>\n${redirectJs}\n    </script>`,
    );
  } else {
    html = html.replace(/    <script src="js\/device-redirect\.js"><\/script>\n?/, "");
  }

  html = html.replace(
    /    <script src="js\/customization\.js"><\/script>/,
    () => `    <script>\n${customizationJs}\n    </script>`,
  );

  html = html.replace(
    /    <script src="js\/app\.js"><\/script>/,
    `    <script>\n${appJs}\n    </script>`,
  );

  html = html.replace(/    <script src="js\/schedule-share\.js"><\/script>/, () => `    <script>\n${scheduleShareJs}\n    </script>`);

  fs.writeFileSync(resolvePath(target), html);
}

// Publish 2.0 as the main app and retain the frozen 1.5.1 archive.
// Include the connector's backend and discovery routes in the downloadable build.
fs.cpSync(resolvePath('netlify/functions/lib'), resolvePath('deploy/netlify/functions/lib'), {recursive:true});
for (const name of ['connector-auth.js', 'planner-mcp.js']) fs.copyFileSync(resolvePath('netlify/functions/'+name), resolvePath('deploy/netlify/functions/'+name));
fs.copyFileSync(resolvePath('netlify/connector-redirects'), resolvePath('deploy/_redirects'));
fs.copyFileSync(resolvePath('netlify/connector-headers'), resolvePath('deploy/_headers'));
require('./build-v2').buildV2();

const fs = require("fs");
const path = require("path");

const root = __dirname;
const sharedCss = readSource(["css/styles.css", "styles.css"]);
const mobileCss = readSource(["css/mobile.css", "mobile.css"]);
const configJs = readSource(["js/config.js", "config.js"]);
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
fs.copyFileSync(resolvePath("netlify/functions/weekly-schedule-reminders.js"), resolvePath("deploy/netlify/functions/weekly-schedule-reminders.js"));
fs.copyFileSync(
  findSource(["scriptable/DailyPlannerWidget.js", "DailyPlannerWidget.js"]),
  resolvePath("deploy/scriptable/DailyPlannerWidget.js"),
);
fs.copyFileSync(resolvePath("SCRIPTABLE_SETUP.md"), resolvePath("deploy/SCRIPTABLE_SETUP.md"));

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
    `    <style>\n${sharedCss}\n${extraCss}\n    </style>\n`,
  );
  html = html.replace(/    <link rel="stylesheet" href="css\/mobile\.css" \/>\n?/, "");
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
    /    <script src="js\/app\.js"><\/script>/,
    `    <script>\n${appJs}\n    </script>`,
  );

  fs.writeFileSync(resolvePath(target), html);
}

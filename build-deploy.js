const fs = require("fs");

const sharedCss = fs.readFileSync("css/styles.css", "utf8");
const mobileCss = fs.readFileSync("css/mobile.css", "utf8");
const appJs = fs.readFileSync("js/app.js", "utf8");
const redirectJs = fs.readFileSync("js/device-redirect.js", "utf8");

fs.mkdirSync("deploy", { recursive: true });

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

fs.writeFileSync("deploy/netlify.toml", '[build]\n  publish = "."\n');

function buildPage({ source, target, extraCss, includeRedirect }) {
  let html = fs.readFileSync(source, "utf8");

  html = html.replace(
    /    <link rel="stylesheet" href="css\/styles\.css" \/>\n?/,
    `    <style>\n${sharedCss}\n${extraCss}\n    </style>\n`,
  );
  html = html.replace(/    <link rel="stylesheet" href="css\/mobile\.css" \/>\n?/, "");

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

  fs.writeFileSync(target, html);
}

import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const required = [
  "site/index.html",
  "site/404.html",
  "site/config.js",
  "site/styles.css",
  "site/manifest.webmanifest",
  "site/js/app.js",
  "site/js/api.js",
  "site/js/report.js",
  "site/js/templates.js",
  "site/js/exports.js",
];
for (const file of required) await access(file, constants.R_OK);
const index = await readFile("site/index.html", "utf8");
if (!index.includes('id="main-content"') || !index.includes('./js/app.js')) throw new Error("GitHub Pages entrypoint is incomplete");
const config = await readFile("site/config.js", "utf8");
if (!config.includes("__WEBCHECK_API_BASE_URL__")) throw new Error("Runtime API placeholder is missing");
console.log(`GitHub Pages site validated (${required.length} required files).`);

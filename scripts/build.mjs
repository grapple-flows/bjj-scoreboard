// Builds the package with esbuild:
//   dist/bjj-scoreboard.js      ESM; importing it registers <bjj-scoreboard>
//   dist/scoring.js             ESM; scoring logic only, no side effects
//   dist/bjj-scoreboard.min.js  minified IIFE for a <script> tag (self-registers,
//                               exposes window.BjjScoreboard)
// Type declarations come from `tsc -p tsconfig.build.json` (see package.json).

import { rmSync, readFileSync } from "node:fs";
import { build, transform } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const banner = `/*! ${pkg.name} v${pkg.version} | MIT License | (c) Grapple Flows | https://grappleflows.com/bjj-scoreboard */`;

rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });

// Minify the shadow DOM stylesheet (a template string in src/styles.ts).
const minifyStyles = {
  name: "minify-styles",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /[\\/]src[\\/]styles\.ts$/ }, async (args) => {
      const source = readFileSync(args.path, "utf8");
      const css = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));
      const { code } = await transform(css, { loader: "css", minify: true });
      return { contents: `export const STYLES = ${JSON.stringify(code.trim())};`, loader: "ts" };
    });
  },
};

const shared = {
  plugins: [minifyStyles],
  bundle: true,
  target: "es2020",
  legalComments: "inline",
  banner: { js: banner },
  logLevel: "info",
};

await Promise.all([
  build({ ...shared, entryPoints: ["src/index.ts"], outfile: "dist/bjj-scoreboard.js", format: "esm" }),
  build({ ...shared, entryPoints: ["src/scoring.ts"], outfile: "dist/scoring.js", format: "esm" }),
  build({
    ...shared,
    entryPoints: ["src/index.ts"],
    outfile: "dist/bjj-scoreboard.min.js",
    format: "iife",
    globalName: "BjjScoreboard",
    minify: true,
  }),
]);

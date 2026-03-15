// Patches Next.js generateBuildId bug where config.generateBuildId is undefined
const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "build",
  "generate-build-id.js"
);

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf8");
  const oldCode = "let buildId = await generate();";
  const newCode =
    'let buildId = typeof generate === "function" ? await generate() : null;';

  if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(file, content);
    console.log("Patched next/dist/build/generate-build-id.js");
  }
}

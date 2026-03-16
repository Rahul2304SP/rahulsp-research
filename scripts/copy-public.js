/**
 * Copy public/ assets into .next/static/media/ and .next/standalone/public/
 * so Cloudflare Pages serves them correctly.
 * Also copies into out/ if static export produced it.
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const publicDir = path.join(__dirname, "..", "public");
const targets = [
  path.join(__dirname, "..", ".next", "standalone", "public"),
  path.join(__dirname, "..", ".next", "static", "public"),
  path.join(__dirname, "..", "out"),
];

let copied = 0;
for (const target of targets) {
  const parent = path.dirname(target);
  if (fs.existsSync(parent)) {
    copyDir(publicDir, target);
    copied++;
    console.log(`Copied public/ -> ${target}`);
  }
}

// Also ensure .next/server/app has access to public files
// by copying charts directly into .next/ root
const nextPublic = path.join(__dirname, "..", ".next", "public");
if (!fs.existsSync(nextPublic)) {
  copyDir(publicDir, nextPublic);
  copied++;
  console.log(`Copied public/ -> ${nextPublic}`);
}

if (copied === 0) {
  console.log("Warning: no build output directories found to copy public/ into");
}

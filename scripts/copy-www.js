const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const runtimeEntries = ['index.html', 'manifest.json', 'sw.js', 'css', 'icons', 'js', 'src'];
const excludedRuntimePaths = new Set(['js/crypto.js']);

function copyRecursive(src, dest, relativePath) {
  if (excludedRuntimePaths.has(relativePath)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const childRelative = relativePath ? `${relativePath}/${entry}` : entry;
      copyRecursive(path.join(src, entry), path.join(dest, entry), childRelative);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (fs.existsSync(www)) fs.rmSync(www, { recursive: true });
fs.mkdirSync(www, { recursive: true });
for (const entry of runtimeEntries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copyRecursive(src, path.join(www, entry), entry);
}
console.log('www/ ready for Capacitor (runtime assets only)');

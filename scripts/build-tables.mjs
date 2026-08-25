import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAPER = path.join(ROOT, "paper", "main.tex");
const BUILD = path.join(ROOT, "scripts", ".tables-build");
const OUT = path.join(ROOT, "public", "figures", "tables");

// ---------- helpers ----------
function readBalanced(text, openIdx) {
  // openIdx points at the opening '{'
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return "";
}

function latexCaptionToHtml(s) {
  return s
    .replace(/\\textbf\{([^}]*)\}/g, "<b>$1</b>")
    .replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>")
    .replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\\$/g, "$")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/~/g, " ")
    .replace(/\\\\/g, " ")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTableBody(s) {
  return s
    .replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}/g, "") // drop images
    .replace(/\\cite\{([^}]*)\}/g, "[$1]") // keep citation keys as text
    .replace(/\\ref\{([^}]*)\}/g, "?") // dangling refs -> ?
    .replace(/\\label\{([^}]*)\}/g, ""); // drop labels
}

// Drop table floats so only "global" definitions are collected.
function removeTableRegions(text) {
  const lines = text.split("\n");
  const res = [];
  let inside = false;
  for (const l of lines) {
    const tl = l.trim();
    if (/^%/.test(tl)) {
      res.push(l);
      continue;
    }
    if (/\\begin\{table\*?\}/.test(l)) {
      inside = true;
      continue;
    }
    if (/\\end\{table\*?\}/.test(l)) {
      inside = false;
      continue;
    }
    if (!inside) res.push(l);
  }
  return res.join("\n");
}

// Collect every custom \newcommand / \definecolor / etc. from the body,
// keeping the last definition per name (mirrors how the full paper resolves).
// \newcommand/\renewcommand are rewritten to \providecommand so duplicates
// with the package preamble never abort the compile.
function scanDefs(text) {
  const defs = new Map();
  const re = /\\(newcommand|renewcommand|providecommand|newcolumntype|definecolor|def)\*?/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const macro = m[1];
    let p = re.lastIndex;
    while (p < text.length && /\s/.test(text[p])) p++;
    let name;
    if (macro === "def") {
      if (text[p] !== "\\") continue;
      let q = p + 1;
      while (q < text.length && /[a-zA-Z]/.test(text[q])) q++;
      name = text.slice(p + 1, q);
      p = q;
      while (p < text.length && text[p] === "#") {
        p++;
        while (p < text.length && /[0-9]/.test(text[p])) p++;
      }
    } else {
      if (text[p] !== "{") continue;
      let q = p + 1;
      let depth = 1;
      let nameTok = "";
      while (q < text.length && depth > 0) {
        const c = text[q];
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) break;
        }
        nameTok += c;
        q++;
      }
      name = nameTok.replace(/^\\/, "");
      p = q + 1;
    }
    if (macro === "definecolor") {
      let grp = "";
      for (let k = 0; k < 2; k++) {
        while (p < text.length && /\s/.test(text[p])) p++;
        if (text[p] !== "{") break;
        const g = readBalanced(text, p);
        grp += "{" + g + "}";
        p = p + 1 + g.length + 1;
      }
      defs.set(name, text.slice(start, p));
      continue;
    }
    while (p < text.length && text[p] === "[") {
      let q = p + 1;
      let depth = 1;
      while (q < text.length && depth > 0) {
        if (text[q] === "[") depth++;
        else if (text[q] === "]") depth--;
        q++;
      }
      p = q;
    }
    if (text[p] !== "{") continue;
    const body = readBalanced(text, p);
    const closeIdx = p + 1 + body.length;
    let full = text.slice(start, closeIdx + 1);
    full = full.replace(/^\\(re)?newcommand(\*?)/, "\\providecommand$2");
    defs.set(name, full);
  }
  return Array.from(defs.values()).join("\n");
}

// ---------- read paper ----------
const tex = fs.readFileSync(PAPER, "utf8");
const docBegin = tex.indexOf("\\begin{document}");
const preamble = tex.slice(0, docBegin); // package preamble
const bodyText = tex.slice(
  docBegin + "\\begin{document}".length,
  tex.indexOf("\\end{document}")
);
const defsBlock = scanDefs(removeTableRegions(bodyText));

// ---------- extract active table* blocks ----------
const tables = [];
const lines = tex.split("\n");
let i = 0;
while (i < lines.length) {
  const trimmed = lines[i].trim();
  const m = trimmed.match(/^\\begin\{table\*?\}\s*\[/);
  if (m && !trimmed.startsWith("%")) {
    // collect until matching \end{table*}
    let buf = lines[i] + "\n";
    let depth = 0;
    // count opens from this line
    const openHere = (lines[i].match(/\\begin\{table\*?\}/g) || []).length;
    depth += openHere;
    let j = i + 1;
    while (j < lines.length && depth > 0) {
      const l = lines[j];
      depth += (l.match(/\\begin\{table\*?\}/g) || []).length;
      depth -= (l.match(/\\end\{table\*?\}/g) || []).length;
      buf += l + "\n";
      j++;
    }
    const body = sanitizeTableBody(buf);
    const capIdx = body.indexOf("\\caption{");
    const captionRaw = capIdx >= 0 ? readBalanced(body, capIdx + 8) : "";
    tables.push({ body, caption: latexCaptionToHtml(captionRaw) });
    i = j;
  } else {
    i++;
  }
}

if (tables.length === 0) {
  console.log("No active tables found.");
  process.exit(0);
}
console.log(`Found ${tables.length} active tables.\n`);

fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const manifest = [];

tables.forEach((t, idx) => {
  const n = idx + 1;
  const base = `table${n}`;
  const texPath = path.join(BUILD, `${base}.tex`);
  const pdfPath = path.join(BUILD, `${base}.pdf`);
  const pngPath = path.join(OUT, `${base}.png`);

  const standalone = `${preamble}\n\\begin{document}\n${defsBlock}\n${t.body}\n\\end{document}\n`;
  fs.writeFileSync(texPath, standalone);

  try {
    execFileSync(
      "pdflatex",
      ["-interaction=nonstopmode", "-halt-on-error", `-output-directory=${BUILD}`, texPath],
      { cwd: BUILD, stdio: "ignore" }
    );
  } catch (e) {
    console.warn(`  [warn] pdflatex reported errors for ${base} (continuing)`);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`  [fail] ${base}: PDF not produced`);
    return;
  }

  // rasterize with the existing converter
  try {
    execFileSync("node", [path.join(ROOT, "scripts", "pdf2png.mjs"), pdfPath, "--force"], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch (e) {
    console.error(`  [fail] ${base}: png conversion error`);
    return;
  }

  const builtPng = pdfPath.replace(/\.pdf$/i, ".png");
  if (fs.existsSync(builtPng)) {
    fs.copyFileSync(builtPng, pngPath);
    console.log(
      `  table${n}.png  (${path.basename(pngPath)}, ${(fs.statSync(pngPath).size / 1024).toFixed(0)} KB)`
    );
    manifest.push({
      src: `/figures/tables/table${n}.png`,
      caption: t.caption || `Table ${n}`,
    });
  }
});

// write a data module so App.jsx stays in sync
const dataModule = `// AUTO-GENERATED by scripts/build-tables.mjs — do not edit by hand.
export const TABLES = ${JSON.stringify(manifest, null, 2)};
`;
fs.writeFileSync(path.join(ROOT, "src", "tables-data.js"), dataModule);
console.log(`\nDone. ${manifest.length} table image(s) -> public/figures/tables/`);

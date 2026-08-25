import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAPER = path.join(ROOT, "paper", "main.tex");
const OUT = path.join(ROOT, "src", "tables-html.js");

// Which section each extracted table (in document order) belongs to.
const SECTION_OF = ["datasets", "datasets", "semantic", "physical", "embodied"];

// ---------- low level helpers ----------
function readBalanced(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { inner: text.slice(openIdx + 1, i), end: i + 1 };
    }
  }
  return { inner: "", end: openIdx + 1 };
}

function takeBraced(s, idx) {
  // idx points at '{'
  let depth = 0;
  for (let i = idx; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) {
        const r = readBalanced(s, i);
        return { inner: r.inner, end: r.end };
      }
      depth++;
    } else if (s[i] === "}") depth--;
  }
  return { inner: "", end: idx + 1 };
}

// ---------- inline text -> html ----------
const MC = "\\makecell";
function replaceMakecell(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.startsWith(MC, i)) {
      let j = i + MC.length;
      if (s[j] === "[") {
        const e = s.indexOf("]", j);
        j = e + 1;
      }
      if (s[j] === "{") {
        const b = takeBraced(s, j);
        out += "<span class='cell'>" + b.inner.replace(/\\\\/g, "<br>") + "</span>";
        i = b.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

// Protect line-breaks (\\ ) that live INSIDE \makecell so the row splitter
// does not mistake them for real row separators.
function protectMakecell(s) {
  const MC = "\\makecell";
  let out = "";
  let i = 0;
  let repl = 0;
  while (i < s.length) {
    if (s.startsWith(MC, i)) {
      const pre = s.slice(i, i + MC.length);
      let j = i + MC.length;
      if (s[j] === "[") {
        const e = s.indexOf("]", j);
        j = e + 1;
      }
      if (s[j] === "{") {
        const b = takeBraced(s, j);
        const replaced = b.inner.replace(/\\\\/g, "@@BR@@");
        repl += (b.inner.match(/\\\\/g) || []).length;
        out += pre + s.slice(i + MC.length, j) + "{" + replaced + "}";
        i = b.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

function inline(s) {
  s = replaceMakecell(s);
  s = s.replace(/\\cmark/g, "✓");
  s = s.replace(/\\xmark/g, "✗");
  s = s.replace(/\\ding\{51\}/g, "✓").replace(/\\ding\{55\}/g, "✗");
  s = s.replace(/\\posbar/g, "<span class='pos'>•</span>");
  s = s.replace(/\\textcolor\{[^}]*\}\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\textbf\{([^{}]*)\}/g, "<b>$1</b>");
  s = s.replace(/\\emph\{([^{}]*)\}/g, "<em>$1</em>");
  s = s.replace(/\\texttt\{([^{}]*)\}/g, "<code>$1</code>");
  s = s.replace(/\\textendash/g, "–").replace(/\\texttimes/g, "×");
  s = s.replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\_/g, "_");
  s = s.replace(/\\\$/g, "$").replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  s = s.replace(/\\~/g, " ").replace(/\\,/g, " ").replace(/\\:/g, " ");
  s = s.replace(/\\;/g, " ").replace(/\\!/g, " ").replace(/\\ /g, " ").replace(/\\>/g, " ");
  s = s.replace(/\\(hspace|vspace)\{[^}]*\}/g, "");
  s = s.replace(/\\(toprule|midrule|bottomrule|hline)/g, "");
  s = s.replace(/\\cline\{[^}]*\}/g, "");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\$/g, "");
  s = s.replace(/~/g, " ");
  s = s.replace(/@@BR@@/g, "<br>");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ---------- cell parsing ----------
function parseCell(str) {
  str = str.trim();
  let m;
  if ((m = str.match(/^\\multirow\{(\d+)\}\{[^}]*\}\{([\s\S]*)\}$/))) {
    return { html: inline(m[2]), colspan: 1, rowspan: parseInt(m[1], 10) };
  }
  if ((m = str.match(/^\\multicolumn\{(\d+)\}\{[^}]*\}\{([\s\S]*)\}$/))) {
    return { html: inline(m[2]), colspan: parseInt(m[1], 10), rowspan: 1 };
  }
  return { html: inline(str), colspan: 1, rowspan: 1 };
}

// ---------- row helpers ----------
function splitCells(row) {
  const cells = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === "&" && depth === 0) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  cells.push(cur);
  return cells;
}

function cleanRow(row) {
  row = row.replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, "");
  row = row.replace(/\\cline\{[^}]*\}/g, "");
  row = row.replace(/\\noalign\{[^}]*\}/g, "");
  let bg = null;
  const rc = row.match(/\\rowcolor\{([^}]*)\}/);
  if (rc) {
    bg = rc[1];
    row = row.replace(/\\rowcolor\{[^}]*\}/, "");
  }
  return { row: row.trim(), bg };
}

const BG = {
  GreenBG: "#ecfdf3",
  LightGray: "#f6f7f9",
  BlueBG: "#eff6ff",
  RedBG: "#fef2f2",
  OrangeBG: "#fff7ed",
  PurpleBG: "#faf5ff",
  CyanBG: "#ecfeff",
  RowGray: "#f6f7f9",
  GrayRule: "#f6f7f9",
};
function colorToBg(name) {
  return BG[name] || null;
}

// ---------- table assembly ----------
function renderTable(rows) {
  const pending = [];
  const dec = () => {
    for (let k = 0; k < pending.length; k++) if (pending[k] > 0) pending[k]--;
  };
  let thead = "";
  let tbody = "";
  rows.forEach((rowStr, idx) => {
    dec();
    const { row, bg } = cleanRow(rowStr);
    if (row === "") return;
    const cellStrs = splitCells(row);
    let html = "";
    let col = 0;
    for (const cs of cellStrs) {
      while ((pending[col] || 0) > 0) col++;
      const cell = parseCell(cs);
      if (cell.rowspan > 1) pending[col] = cell.rowspan - 1;
      const attrs =
        (cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "") +
        (cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "");
      html += `<td${attrs}>${cell.html}</td>`;
      col += cell.colspan;
    }
    const bgStyle = bg ? ` style="background:${colorToBg(bg) || "transparent"}"` : "";
    const tr = `<tr${bgStyle}>${html}</tr>`;
    if (idx === 0) thead += tr;
    else tbody += tr;
  });
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function splitRows(inner) {
  const rows = [];
  let depth = 0;
  let cur = "";
  let i = 0;
  while (i < inner.length) {
    const c = inner[i];
    if (c === "{") {
      depth++;
      cur += c;
      i++;
      continue;
    }
    if (c === "}") {
      depth--;
      cur += c;
      i++;
      continue;
    }
    if (c === "\\" && inner[i + 1] === "\\") {
      rows.push(cur);
      cur = "";
      i += 2;
      if (inner[i] === "*") i++;
      else if (inner[i] === "[") {
        const e = inner.indexOf("]", i);
        if (e > i) i = e + 1;
      }
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.trim() !== "") rows.push(cur);
  return rows;
}

// strip non-cell preamble lines inside a table environment
function stripPreamble(s) {
  return s
    .replace(/\\centering/g, "")
    .replace(/\\scriptsize/g, "")
    .replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\renewcommand\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .replace(/\\caption\{[^}]*\}/g, "")
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\(cite|ref)\{[^}]*\}/g, "");
}

function unwrapResizebox(s) {
  // \resizebox{..}{..}{<inner>} -> <inner>
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("\\resizebox", i)) {
      let j = i + 10;
      // two brace groups for the dims
      let cnt = 0;
      while (cnt < 2 && j < s.length) {
        if (s[j] === "{") {
          const b = takeBraced(s, j);
          j = b.end;
          cnt++;
        } else j++;
      }
      if (s[j] === "{") {
        const b = takeBraced(s, j);
        out += b.inner;
        i = b.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

function extractTabular(body) {
  const start = body.indexOf("\\begin{tabular");
  if (start < 0) return null;
  let p = start + "\\begin{tabular".length;
  if (body[p] === "x") p++;
  while (p < body.length && body[p] !== "{") p++;
  // consume every top-level opening argument group (e.g. {\textwidth}{cols})
  while (p < body.length && body[p] === "{") {
    const b = takeBraced(body, p);
    p = b.end;
    while (p < body.length && /\s/.test(body[p])) p++;
  }
  const contentStart = p;
  const endIdx = body.indexOf("\\end{tabular", contentStart);
  return body.slice(contentStart, endIdx);
}

// ---------- extract table blocks ----------
const tex = fs.readFileSync(PAPER, "utf8");
const lines = tex.split("\n");
const blocks = [];
let i = 0;
while (i < lines.length) {
  const tr = lines[i].trim();
  const m = tr.match(/^\\begin\{table\*?\}\s*\[/);
  if (m && !tr.startsWith("%")) {
    let buf = [lines[i]];
    let d = (lines[i].match(/\\begin\{table\*?\}/g) || []).length;
    let j = i + 1;
    while (j < lines.length && d > 0) {
      const l = lines[j];
      d += (l.match(/\\begin\{table\*?\}/g) || []).length;
      d -= (l.match(/\\end\{table\*?\}/g) || []).length;
      buf.push(l);
      j++;
    }
    blocks.push(buf.join("\n"));
    i = j;
  } else i++;
}

if (blocks.length === 0) {
  console.log("No active tables found.");
  process.exit(0);
}
console.log(`Found ${blocks.length} active tables.`);

const manifest = [];
blocks.forEach((block, idx) => {
  // caption
  const capIdx = block.indexOf("\\caption{");
  let caption = "";
  if (capIdx >= 0) {
    const b = readBalanced(block, block.indexOf("{", capIdx));
    caption = b.inner
      .replace(/\\textbf\{([^{}]*)\}/g, "<b>$1</b>")
      .replace(/\\emph\{([^{}]*)\}/g, "<em>$1</em>")
      .replace(/\\&/g, "&")
      .replace(/\\%/g, "%")
      .replace(/\\_/g, "_")
      .replace(/\\\{/g, "{")
      .replace(/\\\}/g, "}")
      .replace(/\\\\/g, " ")
      .replace(/\\[a-zA-Z]+/g, "")
      .replace(/[{}]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  let body = stripPreamble(block);
  body = unwrapResizebox(body);
  const inner = protectMakecell(extractTabular(body));
  if (!inner) {
    console.warn(`  [warn] table ${idx + 1}: no tabular found`);
    return;
  }
  const rows = splitRows(inner).filter((r) => cleanRow(r).row !== "");
  const html = renderTable(rows);
  manifest.push({
    index: idx + 1,
    section: SECTION_OF[idx] || "misc",
    caption,
    html,
  });
  console.log(`  table ${idx + 1} -> ${SECTION_OF[idx]} (${rows.length} rows)`);
});

const moduleText = `// AUTO-GENERATED by scripts/build-tables-html.mjs — do not edit by hand.
export const TABLES_HTML = ${JSON.stringify(manifest, null, 2)};
`;
fs.writeFileSync(OUT, moduleText);
console.log(`\nDone. Wrote ${manifest.length} tables -> src/tables-html.js`);

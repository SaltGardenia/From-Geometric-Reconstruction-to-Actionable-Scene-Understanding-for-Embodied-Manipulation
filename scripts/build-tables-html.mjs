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

// Brace-aware unwrap of \cmd[opt]{a1}{a2}... -> keep the content of arg `keepArg`.
function unwrapTexCmd(s, name, keepArg) {
  const needle = "\\" + name;
  let out = "";
  let i = 0;
  let guard = 0;
  while (i < s.length && guard++ < 100000) {
    const atName =
      s.startsWith(needle, i) &&
      (i + needle.length === s.length ||
        !/[a-zA-Z]/.test(s[i + needle.length]));
    if (atName) {
      let j = i + needle.length;
      if (s[j] === "[") {
        const e = s.indexOf("]", j);
        if (e >= 0) j = e + 1;
      }
      const args = [];
      while (args.length < keepArg && j < s.length) {
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === "{") {
          const b = takeBraced(s, j);
          args.push(b.inner);
          j = b.end;
        } else break;
      }
      if (args.length >= keepArg) {
        out += args[keepArg - 1];
        i = j;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

// Strip leading formatting/color commands (row-level noise) from a cell string.
function cleanLeading(str) {
  const drop = [
    "arrayrulecolor",
    "rowcolor",
    "cellcolor",
    "color",
    "addlinespace",
    "hspace",
    "vspace",
  ];
  const bare = [
    "bfseries",
    "Centering",
    "RaggedRight",
    "RaggedLeft",
    "centering",
    "arraybackslash",
  ];
  let s = str;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;
    s = s.replace(/^\s+/, "");
    for (const c of drop) {
      const re = new RegExp("^\\\\" + c + "(\\[[^\\]]*\\])?\\{[^}]*\\}");
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
    for (const c of bare) {
      const re = new RegExp("^\\\\" + c + "\\b");
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
  }
  return s;
}

function protectMakecell(s) {
  const MC = "\\makecell";
  let out = "";
  let i = 0;
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
  // Brace-aware unwrap of \textcolor{col}{content} -> content (handles nested braces).
  for (let k = 0; k < 4; k++) {
    const u = unwrapTexCmd(s, "textcolor", 2);
    if (u === s) break;
    s = u;
  }
  s = s.replace(/\\cmark/g, "✓");
  s = s.replace(/\\xmark/g, "✗");
  s = s.replace(/\\ding\{51\}/g, "✓").replace(/\\ding\{55\}/g, "✗");
  s = s.replace(/\\posbar/g, "<span class='pos'>•</span>");
  s = s.replace(/\\negbar/g, "<span class='neg'>•</span>");
  s = s.replace(/\\arrayrulecolor(\[[^\]]*\])?\{[^}]*\}/g, "");
  s = s.replace(/\\rowcolors\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, "");
  s = s.replace(/\\addlinespace(\[[^\]]*\])?/g, "");
  s = s.replace(/\\rowcolor(\[[^\]]*\])?\{[^}]*\}/g, "");
  s = s.replace(/\\color(\[[^\]]*\])?\{[^}]*\}/g, "");
  s = s.replace(/\\cellcolor\{[^}]*\}/g, "");
  s = s.replace(/\\arraybackslash/g, "");
  s = s.replace(/\\centering/g, "");
  s = s.replace(/\\textbf\{([^{}]*)\}/g, "<b>$1</b>");
  s = s.replace(/\\emph\{([^{}]*)\}/g, "<em>$1</em>");
  s = s.replace(/\\texttt\{([^{}]*)\}/g, "<code>$1</code>");
  s = s.replace(/\\textendash/g, "–").replace(/\\texttimes/g, "×");
  s = s.replace(/\\downarrow/g, "↓").replace(/\\uparrow/g, "↑");
  s = s.replace(/\\rightarrow/g, "→").replace(/\\leftarrow/g, "←");
  s = s.replace(/\\geq/g, "≥").replace(/\\leq/g, "≤");
  s = s.replace(/\\times/g, "×").replace(/\\cdot/g, "·");
  s = s.replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\_/g, "_");
  s = s.replace(/\\\$/g, "$").replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  s = s.replace(/\\~/g, " ").replace(/\\,/g, " ").replace(/\\:/g, " ");
  s = s.replace(/\\;/g, " ").replace(/\\!/g, " ").replace(/\\ /g, " ").replace(/\\>/g, " ");
  s = s.replace(/\\(hspace|vspace)\{[^}]*\}/g, "");
  s = s.replace(/\\(toprule|midrule|bottomrule|hline)/g, "");
  s = s.replace(/\\cline\{[^}]*\}/g, "");
  s = s.replace(/\\cmidrule(\[[^\]]*\])?(\([^)]*\))?\{[^}]*\}/g, "");
  s = s.replace(/\\specialrule\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, "");
  s = s.replace(/\\noalign\{[^}]*\}/g, "");
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\$/g, "");
  s = s.replace(/~/g, " ");
  s = s.replace(/@@BR@@/g, "<br>");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Detect per-cell horizontal alignment override (e.g. \Centering in a header).
function cellAlignOverride(str) {
  if (/\\(Centering|centering)\b/.test(str)) return "center";
  if (/\\(RaggedRight|raggedright)\b/.test(str)) return "left";
  if (/\\(RaggedLeft|raggedleft)\b/.test(str)) return "right";
  return null;
}

// ---------- cell parsing (brace-aware for \multirow / \multicolumn) ----------
function parseCell(str, colAlign) {
  const override = cellAlignOverride(str);
  str = cleanLeading(str);
  str = str.trim();
  const make = (html, colspan, rowspan) => ({
    html,
    colspan,
    rowspan,
    align: override || colAlign || "left",
  });
  if (str.startsWith("\\multirow")) {
    let p = str.indexOf("{");
    const b1 = takeBraced(str, p);
    const n = parseInt(b1.inner, 10) || 1;
    let p2 = b1.end;
    while (p2 < str.length && str[p2] !== "{") p2++;
    const b2 = takeBraced(str, p2); // width/* spec
    let p3 = b2.end;
    while (p3 < str.length && str[p3] !== "{") p3++;
    const b3 = takeBraced(str, p3); // content
    return make(inline(b3.inner), 1, n);
  }
  if (str.startsWith("\\multicolumn")) {
    let p = str.indexOf("{");
    const b1 = takeBraced(str, p);
    const n = parseInt(b1.inner, 10) || 1;
    let p2 = b1.end;
    while (p2 < str.length && str[p2] !== "{") p2++;
    const b2 = takeBraced(str, p2); // spec (ignored)
    let p3 = b2.end;
    while (p3 < str.length && str[p3] !== "{") p3++;
    const b3 = takeBraced(str, p3); // content
    return make(inline(b3.inner), n, 1);
  }
  return make(inline(str), 1, 1);
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
  row = row.replace(/\\cmidrule(\[[^\]]*\])?(\([^)]*\))?\{[^}]*\}/g, "");
  row = row.replace(/\\specialrule\{[^}]*\}\{[^}]*\}\{[^}]*\}/g, "");
  row = row.replace(/\\noalign\{[^}]*\}/g, "");
  let bg = null;
  const rc = row.match(/\\rowcolor(\[[^\]]*\])?\{[^}]*\}/);
  if (rc) {
    bg = rc[0].replace(/\\rowcolor(\[[^\]]*\])?\{|\}/g, "");
    row = row.replace(/\\rowcolor(\[[^\]]*\])?\{[^}]*\}/, "");
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

// ---------- column spec parsing ----------
function parseColSpec(spec) {
  const cols = [];
  let align = "left";
  let alignSet = false;
  const push = (width, vAlign, force) => {
    const a = force || align;
    cols.push({ align: a, width: width || null, vAlign: vAlign || "middle" });
  };
  let i = 0;
  while (i < spec.length) {
    const c = spec[i];
    if (c === " " || c === "\n" || c === "\t" || c === "|") {
      i++;
      continue;
    }
    if (c === "@") {
      const e = spec.indexOf("}", i);
      i = e < 0 ? spec.length : e + 1;
      continue;
    }
    if (c === ">") {
      const e = spec.indexOf("}", i);
      const pre = spec.slice(i + 1, e);
      if (/centering/i.test(pre)) {
        align = "center";
        alignSet = true;
      } else if (/raggedleft/i.test(pre)) {
        align = "right";
        alignSet = true;
      } else if (/raggedright/i.test(pre)) {
        align = "left";
        alignSet = true;
      }
      i = e + 1;
      continue;
    }
    if (c === "<") {
      const e = spec.indexOf("}", i);
      i = e < 0 ? spec.length : e + 1;
      continue;
    }
    if (c === "*") {
      const e1 = spec.indexOf("}", i);
      const n = parseInt(spec.slice(i + 2, e1), 10) || 1;
      const b = readBalanced(spec, e1 + 1);
      const sub = parseColSpec(b.inner);
      for (let k = 0; k < n; k++) cols.push(...sub);
      i = b.end;
      continue;
    }
    if (c === "c") {
      push(null, "middle", "center");
      i++;
      continue;
    }
    if (c === "l") {
      push(null, "middle", "left");
      i++;
      continue;
    }
    if (c === "r") {
      push(null, "middle", "right");
      i++;
      continue;
    }
    if (c === "X") {
      push(null, "middle", alignSet ? align : "center");
      i++;
      continue;
    }
    if (c === "m" || c === "p" || c === "b") {
      const open = spec.indexOf("{", i);
      const b = readBalanced(spec, open);
      const vAlign = c === "m" ? "middle" : c === "p" ? "top" : "bottom";
      const force = c === "p" ? "left" : "center";
      push(b.inner, vAlign, alignSet ? null : force);
      i = b.end;
      continue;
    }
    i++;
  }
  return cols;
}

// ---------- table assembly ----------
function renderTable(rows, cols) {
  const pending = [];
  const dec = () => {
    for (let k = 0; k < pending.length; k++) if (pending[k] > 0) pending[k]--;
  };
  let colgroup = "";
  if (cols && cols.length) {
    const fixed = cols.map((c) => (c.width ? parseFloat(c.width) : 0));
    const sumFixed = fixed.reduce((a, b) => a + b, 0);
    const numX = cols.filter((c) => !c.width).length;
    const avg = numX ? sumFixed / Math.max(1, cols.length - numX) : 0;
    const total = sumFixed + numX * avg;
    colgroup = "<colgroup>";
    cols.forEach((c, i) => {
      const w = c.width ? fixed[i] : avg;
      const pct = total > 0 ? (w / total) * 100 : 100 / cols.length;
      const st = ["width:" + pct.toFixed(2) + "%"];
      st.push("text-align:" + c.align);
      st.push("vertical-align:" + c.vAlign);
      colgroup += '<col style="' + st.join(";") + '">';
    });
    colgroup += "</colgroup>";
  }
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
      const cell = parseCell(cs, cols[col] ? cols[col].align : "left");
      if (cell.rowspan > 1) pending[col] = cell.rowspan - 1;
      const attrs =
        (cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "") +
        (cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "") +
        ` style="text-align:${cell.align}"`;
      html += "<td" + attrs + ">" + cell.html + "</td>";
      col += cell.colspan;
    }
    const bgStyle = bg ? ` style="background:${colorToBg(bg) || "transparent"}"` : "";
    const tr = "<tr" + bgStyle + ">" + html + "</tr>";
    if (idx === 0) thead += tr;
    else tbody += tr;
  });
  return "<table>" + colgroup + "<thead>" + thead + "</thead><tbody>" + tbody + "</tbody></table>";
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

// strip LaTeX comments (but keep \%)
function stripComments(s) {
  return s
    .split("\n")
    .map((line) => {
      let res = "";
      let i = 0;
      while (i < line.length) {
        if (line[i] === "\\" && line[i + 1] === "%") {
          res += "%";
          i += 2;
          continue;
        }
        if (line[i] === "%") break;
        res += line[i];
        i++;
      }
      return res;
    })
    .join("\n");
}

function unwrapMakebox(s) {
  let out = "";
  let i = 0;
  const MK = "\\makebox";
  while (i < s.length) {
    if (s.startsWith(MK, i)) {
      let j = i + MK.length;
      if (s[j] === "[") {
        const e = s.indexOf("]", j);
        j = e + 1;
      }
      if (s[j] === "[") {
        const e = s.indexOf("]", j);
        j = e + 1;
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

function unwrapResizebox(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("\\resizebox", i)) {
      let j = i + 10;
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
  let spec = "";
  while (p < body.length && body[p] === "{") {
    const b = takeBraced(body, p);
    spec = b.inner;
    p = b.end;
    while (p < body.length && /\s/.test(body[p])) p++;
  }
  const contentStart = p;
  const endIdx = body.indexOf("\\end{tabular", contentStart);
  return { spec, inner: body.slice(contentStart, endIdx) };
}

function stripPreamble(s) {
  // NOTE: do NOT strip \centering here — it is used inside column specs
  // (e.g. >{\centering\arraybackslash}) and must survive for parseColSpec.
  return s
    .replace(/\\scriptsize/g, "")
    .replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\renewcommand\{[^}]*\}\{[^}]*\}/g, "")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .replace(/\\caption\{[^}]*\}/g, "")
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\(cite|ref)\{[^}]*\}/g, "");
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
  body = stripComments(body);
  body = unwrapMakebox(body);
  body = unwrapResizebox(body);
  const tab = extractTabular(body);
  if (!tab) {
    console.warn(`  [warn] table ${idx + 1}: no tabular found`);
    return;
  }
  const inner = protectMakecell(tab.inner);
  const cols = parseColSpec(tab.spec || "");
  const rows = splitRows(inner).filter((r) => cleanRow(r).row !== "");
  const html = renderTable(rows, cols);
  manifest.push({
    index: idx + 1,
    section: SECTION_OF[idx] || "misc",
    caption,
    html,
  });
  console.log(`  table ${idx + 1} -> ${SECTION_OF[idx]} (${rows.length} rows, ${cols.length} cols)`);
});

const moduleText = `// AUTO-GENERATED by scripts/build-tables-html.mjs — do not edit by hand.
export const TABLES_HTML = ${JSON.stringify(manifest, null, 2)};
`;
fs.writeFileSync(OUT, moduleText);
console.log(`\nDone. Wrote ${manifest.length} tables -> src/tables-html.js`);

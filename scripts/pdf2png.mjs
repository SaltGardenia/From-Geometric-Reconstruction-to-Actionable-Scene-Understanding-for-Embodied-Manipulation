import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- pdfjs setup (node side, no browser globals) ---
const workerSrc = pathToFileURL(
  path.join(ROOT, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs")
).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const CMAP_URL = pathToFileURL(
  path.join(ROOT, "node_modules/pdfjs-dist/cmaps/")
).href;
const STANDARD_FONT_URL = pathToFileURL(
  path.join(ROOT, "node_modules/pdfjs-dist/standard_fonts/")
).href;

// Use a prebuilt canvas (Skia backed) so no native toolchain is needed.
const canvasFactory = {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  },
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },
  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
};

/**
 * Losslessly rasterize every page of a PDF to PNG.
 * @param {string} pdfPath  absolute path to the .pdf
 * @param {object} opts
 * @param {number} opts.scale device-pixel scale (higher = sharper)
 * @param {boolean} opts.force overwrite existing png
 */
async function pdfToPng(pdfPath, { scale = 3, force = false } = {}) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_URL,
  }).promise;

  const outPaths = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const w = Math.ceil(viewport.width);
    const h = Math.ceil(viewport.height);

    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    await page
      .render({
        canvasContext: ctx,
        viewport,
        canvasFactory,
        canvas,
      })
      .promise;

    const suffix = doc.numPages > 1 ? `_p${i}` : "";
    const outPath = pdfPath.replace(/\.pdf$/i, `${suffix}.png`);
    if (fs.existsSync(outPath) && !force) {
      console.log(`  skip (exists): ${path.basename(outPath)}`);
      outPaths.push(outPath);
      continue;
    }
    fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
    console.log(
      `  -> ${path.basename(outPath)}  (${w}x${h}, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`
    );
    outPaths.push(outPath);
    page.cleanup();
  }
  try {
    if (typeof doc.destroy === "function") await doc.destroy();
    else if (typeof doc.cleanup === "function") await doc.cleanup();
  } catch {
    /* best-effort teardown */
  }
  return outPaths;
}

async function run() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  const scale = Number(args.find((a) => a.startsWith("--scale="))?.split("=")[1]) || 3;
  const force = args.includes("--force");

  const input = target
    ? path.resolve(target)
    : path.join(ROOT, "public/figures");

  let files = [];
  if (fs.statSync(input).isDirectory()) {
    files = fs
      .readdirSync(input)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => path.join(input, f));
  } else {
    files = [input];
  }

  if (files.length === 0) {
    console.log("No PDF files found.");
    return;
  }

  console.log(
    `Converting ${files.length} PDF file(s) -> PNG (lossless, scale=${scale})${
      force ? ", force" : ""
    }\n`
  );
  for (const f of files) {
    console.log(path.basename(f));
    await pdfToPng(f, { scale, force });
  }
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

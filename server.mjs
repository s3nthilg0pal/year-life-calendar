import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./generate-year-wallpaper.mjs";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let wasmReady;
async function ensureWasmReady() {
  if (!wasmReady) {
    const wasmPath = path.join(__dirname, "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm");
    const wasm = await fs.readFile(wasmPath);
    wasmReady = initWasm(wasm);
  }
  await wasmReady;
}

let cachedFontUrl;
let cachedFontPromise;
async function getFontBuffer(fontUrl) {
  if (!fontUrl) {
    return null;
  }
  if (cachedFontUrl !== fontUrl) {
    cachedFontUrl = fontUrl;
    cachedFontPromise = (async () => {
      const res = await fetch(fontUrl);
      if (!res.ok) {
        throw new Error(`Font fetch failed: ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    })();
  }
  return cachedFontPromise;
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function inlineSvgColors(svg) {
  return svg
    .replace(/var\(--bg0\)/g, "#070A0F")
    .replace(/var\(--bg1\)/g, "#0B1220")
    .replace(/var\(--dot\)/g, "#FFFFFF")
    .replace(/var\(--accent\)/g, "#7DD3FC")
    .replace(/var\(--todayFill\)/g, "rgba(255,255,255,0.22)")
    .replace(/var\(--ringW\)/g, "3px");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const now = new Date();

    const year = toInt(url.searchParams.get("year"), now.getUTCFullYear());
    const todayStr = url.searchParams.get("today") ?? now.toISOString().slice(0, 10);

    const width = clamp(toInt(url.searchParams.get("width"), 1179), 320, 4096);
    const height = clamp(toInt(url.searchParams.get("height"), 2556), 320, 8192);

    const svg = generate({
      year,
      todayStr,
      width,
      height,
      marginX: 80,
      marginTop: 320,
      marginBottom: 160,
      cols: 19,
      rows: 20,
      gapRatio: 0.55,
      dotFillRatio: 0.78,
      todayScale: 1.35,
      ringWidth: 3,
      enableProgressRamp: true,
      showFooter: true,
      footerGapRatio: 1.6,
      footerSize: 34,
      footerMutedSize: 28
    });

    const format = (url.searchParams.get("format") ?? "png").toLowerCase();
    if (format === "svg") {
      res.writeHead(200, {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600"
      });
      res.end(svg);
      return;
    }

    await ensureWasmReady();

    const svgForPng = inlineSvgColors(svg);
    const fontUrl = url.searchParams.get("fontUrl") ?? "https://rsms.me/inter/font-files/Inter-Regular.woff2";
    let fontBuffer = null;
    try {
      fontBuffer = await getFontBuffer(fontUrl);
    } catch {
      fontBuffer = null;
    }

    const resvg = new Resvg(svgForPng, fontBuffer ? {
      font: {
        fontBuffers: [fontBuffer],
        defaultFontFamily: "Inter"
      }
    } : undefined);
    const pngData = resvg.render();
    const pngBytes = pngData.asPng();

    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600"
    });
    res.end(Buffer.from(pngBytes));
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(err instanceof Error ? err.message : "Internal error");
  }
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`year-wallpaper listening on :${port}`);
});

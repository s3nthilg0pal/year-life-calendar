import { generate } from "./generate-year-wallpaper.mjs";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

let wasmReady;
function ensureWasmReady() {
  if (!wasmReady) {
    wasmReady = initWasm(resvgWasm);
  }
  return wasmReady;
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

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
      return new Response(svg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=3600"
        }
      });
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

    return new Response(pngBytes, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=3600"
      }
    });
  }
};

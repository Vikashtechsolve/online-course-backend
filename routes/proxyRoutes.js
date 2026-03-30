const express = require("express");
const { Readable } = require("stream");

const router = express.Router();

const R2_PUBLIC = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

/** Public API origin for rewriting HLS playlists (HTTPS). Override if proxy headers are wrong. */
function getPublicProxyBase(req) {
  const explicit = (process.env.PUBLIC_API_ORIGIN || "").trim().replace(/\/$/, "");
  if (explicit) {
    return `${explicit}/api/proxy/video`;
  }
  const proto = req.protocol || "http";
  const host = req.get("host") || "localhost";
  return `${proto}://${host}/api/proxy/video`;
}

function isAllowedUrl(url) {
  if (!R2_PUBLIC || !url) return false;
  try {
    const u = new URL(url);
    return u.origin === new URL(R2_PUBLIC).origin || url.startsWith(R2_PUBLIC);
  } catch {
    return false;
  }
}

function resolveUrl(base, ref) {
  if (!ref || ref.startsWith("#")) return ref;
  try {
    return new URL(ref, base + "/").href;
  } catch {
    return ref;
  }
}

router.get("/video", async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).json({ message: "Missing url parameter" });
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(rawUrl);
  } catch {
    return res.status(400).json({ message: "Invalid url" });
  }

  if (!isAllowedUrl(targetUrl)) {
    return res.status(403).json({ message: "URL not allowed" });
  }

  const isManifestPath = /\.m3u8(\?|$)/i.test(targetUrl);

  try {
    if (isManifestPath) {
      const response = await fetch(targetUrl, {
        headers: { Accept: "*/*" },
        redirect: "follow",
      });

      if (!response.ok) {
        return res.status(response.status).send(response.statusText);
      }

      const contentType =
        response.headers.get("content-type") || "application/vnd.apple.mpegurl";
      const text = await response.text();
      const baseUrl = targetUrl.replace(/\/[^/]+$/, "");
      const apiBase = getPublicProxyBase(req);

      const rewritten = text
        .split("\n")
        .map((line) => {
          const t = line.trim();
          if (!t || t.startsWith("#")) return line;
          const absolute = resolveUrl(baseUrl, t);
          if (isAllowedUrl(absolute)) {
            return `${apiBase}?url=${encodeURIComponent(absolute)}`;
          }
          return line;
        })
        .join("\n");

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(rewritten);
    }

    const upstreamHeaders = { Accept: "*/*" };
    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    const response = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    const contentRange = response.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);
    const contentLength = response.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);

    res.status(response.status);

    if (response.body && typeof Readable.fromWeb === "function") {
      const nodeStream = Readable.fromWeb(response.body);
      nodeStream.on("error", (err) => {
        console.error("Proxy stream error:", err.message);
        if (!res.headersSent) res.status(502).end();
      });
      return nodeStream.pipe(res);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(502).json({ message: "Failed to fetch resource" });
  }
});

module.exports = router;

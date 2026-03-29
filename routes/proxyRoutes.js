const express = require("express");
const router = express.Router();

const R2_PUBLIC = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

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

  try {
    const response = await fetch(targetUrl, {
      headers: { Accept: "*/*" },
      redirect: "follow",
    });

    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");

    const isM3u8 = targetUrl.includes(".m3u8") || contentType.includes("mpegurl");
    const baseUrl = targetUrl.replace(/\/[^/]+$/, "");

    if (isM3u8) {
      const text = await response.text();
      const apiBase = `${req.protocol}://${req.get("host")}/api/proxy/video`;
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
      res.send(rewritten);
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    }
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(502).json({ message: "Failed to fetch resource" });
  }
});

module.exports = router;

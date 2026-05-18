const fs = require("fs");
const path = require("path");

/** Writable temp dir for large uploads (avoid small /tmp on EC2). */
function getUploadTempDir() {
  const configured = (process.env.UPLOAD_TEMP_DIR || "").trim();
  const base = configured || path.join(process.cwd(), "data", "upload-temp");
  fs.mkdirSync(base, { recursive: true });
  return base;
}

module.exports = { getUploadTempDir };

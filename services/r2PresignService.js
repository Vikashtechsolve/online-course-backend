const path = require("path");
const crypto = require("crypto");
const { PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { isR2Configured } = require("./uploadService");

let r2Client;
try {
  r2Client = require("../config/r2");
} catch {
  r2Client = null;
}

function buildSourceVideoKey(lectureId, filename) {
  const ext = path.extname(filename || "") || ".mp4";
  const hash = crypto.randomBytes(16).toString("hex");
  return `lectures/source/${lectureId}/${hash}${ext}`;
}

async function createVideoUploadPresign(lectureId, filename, contentType, fileSize) {
  if (!r2Client || !isR2Configured()) {
    throw new Error("Cloud storage is not configured on the server.");
  }

  const key = buildSourceVideoKey(lectureId, filename);
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType || "video/mp4",
    ContentLength: fileSize > 0 ? fileSize : undefined,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 * 60 });

  return {
    uploadUrl,
    key,
    expiresIn: 3600,
    publicUrl: `${(process.env.R2_PUBLIC_URL || "").replace(/\/$/, "")}/${key}`,
  };
}

async function verifyObjectExists(key) {
  if (!r2Client || !isR2Configured()) return false;
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  createVideoUploadPresign,
  verifyObjectExists,
  buildSourceVideoKey,
};

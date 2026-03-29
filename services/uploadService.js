const fs = require("fs").promises;
const {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");
const crypto = require("crypto");

let r2Client;
try {
  r2Client = require("../config/r2");
} catch {
  r2Client = null;
}

function isR2Configured() {
  if (process.env.USE_LOCAL_UPLOADS === "true") return false;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const placeholder = /your_|^$/i;
  return (
    accountId &&
    accessKey &&
    secretKey &&
    bucket &&
    !placeholder.test(String(accountId)) &&
    !placeholder.test(String(accessKey)) &&
    !placeholder.test(String(secretKey)) &&
    !placeholder.test(String(bucket))
  );
}

function generateUniqueKey(folder, originalName) {
  const ext = path.extname(originalName) || ".jpg";
  const hash = crypto.randomBytes(16).toString("hex");
  return `${folder}/${hash}${ext}`;
}

async function uploadToR2(file, folder = "uploads") {
  const key = generateUniqueKey(folder, file.originalname);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await r2Client.send(command);

  const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
  return { key, url: publicUrl };
}

async function uploadBufferToR2(key, buffer, contentType = "application/octet-stream") {
  if (!r2Client || !isR2Configured()) throw new Error("R2 not configured");
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await r2Client.send(command);
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function deleteFromR2(key) {
  if (!r2Client || !isR2Configured()) return;
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  await r2Client.send(command).catch(() => {});
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function uploadToLocal(file, folder, baseUrl) {
  const key = generateUniqueKey(folder, file.originalname);
  const dir = path.join(UPLOADS_DIR, path.dirname(key));
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, key);
  await fs.writeFile(filePath, file.buffer);
  const url = `${baseUrl.replace(/\/$/, "")}/uploads/${key}`;
  return { key, url };
}

function isLocalAvatarUrl(url) {
  return url && (url.includes("/uploads/") || url.startsWith("/uploads"));
}

async function deleteLocalFile(url) {
  if (!url || !url.includes("/uploads/")) return;
  const relativePath = url.split("/uploads/")[1];
  if (!relativePath) return;
  const filePath = path.join(UPLOADS_DIR, relativePath);
  await fs.unlink(filePath).catch(() => {});
}

module.exports = {
  uploadToR2,
  uploadBufferToR2,
  deleteFromR2,
  getSignedDownloadUrl,
  isR2Configured,
  uploadToLocal,
  isLocalAvatarUrl,
  deleteLocalFile,
};

const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

let r2Client;
try {
  r2Client = require("../config/r2");
} catch {
  r2Client = null;
}

ffmpeg.setFfmpegPath(ffmpegPath);

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

async function uploadBufferToR2(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await r2Client.send(command);
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Transcode video to HLS and upload segments to R2.
 * @param {Buffer} buffer - Video file buffer
 * @param {string} lectureId - Lecture ID for folder path
 * @returns {Promise<string|null>} - URL of the master m3u8, or null on failure
 */
async function transcodeAndUploadHLS(buffer, lectureId) {
  if (!isR2Configured() || !r2Client) {
    console.error("R2 not configured; HLS upload skipped");
    return null;
  }

  const tmpDir = path.join(os.tmpdir(), `hls-${crypto.randomBytes(8).toString("hex")}`);
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputDir = path.join(tmpDir, "output");
  const outputBase = path.join(outputDir, "playlist");

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-profile:v baseline",
          "-level 3.0",
          "-start_number 0",
          "-hls_time 10",
          "-hls_list_size 0",
          "-f hls",
        ])
        .output(`${outputBase}.m3u8`)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    const files = await fs.readdir(outputDir);
    const r2Folder = `lectures/videos/${lectureId}`;

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;

      const key = `${r2Folder}/${file}`;
      const content = await fs.readFile(filePath);
      const contentType = file.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/MP2T";

      await uploadBufferToR2(key, content, contentType);
    }

    const m3u8Url = `${process.env.R2_PUBLIC_URL}/${r2Folder}/playlist.m3u8`;
    return m3u8Url;
  } catch (err) {
    console.error("HLS transcoding error:", err);
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  transcodeAndUploadHLS,
  isR2Configured,
};

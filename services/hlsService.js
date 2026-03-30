const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const crypto = require("crypto");
const { isR2Configured, uploadBufferToR2 } = require("./uploadService");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Transcode video to HLS and upload segments to R2.
 * @param {Buffer} buffer - Video file buffer
 * @param {string} lectureId - Lecture ID for folder path
 * @returns {Promise<string|null>} - URL of the master m3u8, or null on failure
 */
async function transcodeAndUploadHLS(buffer, lectureId) {
  if (!isR2Configured()) {
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

module.exports = { transcodeAndUploadHLS };

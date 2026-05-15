const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const crypto = require("crypto");
const { isR2Configured, uploadFilePathToR2 } = require("./uploadService");

ffmpeg.setFfmpegPath(ffmpegPath);

/** Parallel PUTs to R2 — sequential was a major bottleneck for long videos (many .ts files). */
const SEGMENT_UPLOAD_CONCURRENCY = Math.min(
  16,
  Math.max(2, parseInt(process.env.HLS_R2_UPLOAD_CONCURRENCY || "8", 10) || 8)
);

const HLS_SEGMENT_SECONDS = Math.max(
  4,
  parseInt(process.env.HLS_SEGMENT_SECONDS || "10", 10) || 10
);

/**
 * Build HLS with full transcode (never stream-copy into MPEG-TS).
 * Stream copy (-c copy) often succeeds but causes distorted / slow / "demonic" audio
 * at segment boundaries when source has VFR, odd sample rates, or MP4 edit lists.
 */
function runHlsFfmpeg(inputPath, outputBase) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(["-fflags", "+genpts"])
      .outputOptions([
        "-c:v",
        "libx264",
        "-preset",
        process.env.FFMPEG_PRESET || "veryfast",
        "-crf",
        "23",
        "-profile:v",
        "main",
        "-level",
        "4.0",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        // Fix drift / pitch issues from messy source timestamps (screen recordings, phone video).
        "-af",
        "aresample=async=1:first_pts=0",
        "-avoid_negative_ts",
        "make_zero",
        "-max_muxing_queue_size",
        "1024",
        "-start_number",
        "0",
        "-hls_time",
        String(HLS_SEGMENT_SECONDS),
        "-hls_list_size",
        "0",
        "-hls_segment_type",
        "mpegts",
        "-hls_flags",
        "independent_segments",
        "-f",
        "hls",
      ])
      .output(`${outputBase}.m3u8`)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

async function muxToHlsSegments(inputPath, outputDir, outputBase) {
  await fs.mkdir(outputDir, { recursive: true });
  await runHlsFfmpeg(inputPath, outputBase);
}

async function uploadSegmentsParallel(outputDir, r2Folder) {
  const names = await fs.readdir(outputDir);
  const tasks = [];
  for (const file of names) {
    const filePath = path.join(outputDir, file);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    const key = `${r2Folder}/${file}`;
    const contentType = file.endsWith(".m3u8")
      ? "application/vnd.apple.mpegurl"
      : "video/MP2T";
    tasks.push({ key, path: filePath, contentType });
  }

  for (let i = 0; i < tasks.length; i += SEGMENT_UPLOAD_CONCURRENCY) {
    const batch = tasks.slice(i, i + SEGMENT_UPLOAD_CONCURRENCY);
    await Promise.all(
      batch.map((t) => uploadFilePathToR2(t.key, t.path, t.contentType))
    );
  }
}

/**
 * Transcode video to HLS and upload segments to R2.
 * @param {Buffer|string} inputSource - Video file buffer or path on disk
 * @param {string} lectureId - Lecture ID for folder path
 * @returns {Promise<string|null>} - URL of the master m3u8, or null on failure
 */
async function transcodeAndUploadHLS(inputSource, lectureId) {
  if (!isR2Configured()) {
    console.error("R2 not configured; HLS upload skipped");
    return null;
  }

  const isPath = typeof inputSource === "string";
  const tmpDir = path.join(os.tmpdir(), `hls-${crypto.randomBytes(8).toString("hex")}`);
  const inputPath = isPath ? inputSource : path.join(tmpDir, "input.mp4");
  const outputDir = path.join(tmpDir, "output");
  const outputBase = path.join(outputDir, "playlist");

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    if (!isPath) {
      await fs.writeFile(inputPath, inputSource);
    }

    console.log(`[hls] Transcoding lecture ${lectureId} (audio → AAC 48kHz stereo)`);
    await muxToHlsSegments(inputPath, outputDir, outputBase);

    const r2Folder = `lectures/videos/${lectureId}`;
    await uploadSegmentsParallel(outputDir, r2Folder);

    return `${process.env.R2_PUBLIC_URL}/${r2Folder}/playlist.m3u8`;
  } catch (err) {
    console.error("HLS transcoding error:", err);
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { transcodeAndUploadHLS };

const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const crypto = require("crypto");
const { isR2Configured, uploadFilePathToR2 } = require("./uploadService");

ffmpeg.setFfmpegPath(ffmpegPath);

const SEGMENT_UPLOAD_CONCURRENCY = Math.min(
  16,
  Math.max(2, parseInt(process.env.HLS_R2_UPLOAD_CONCURRENCY || "8", 10) || 8)
);

const HLS_SEGMENT_SECONDS = Math.max(
  4,
  parseInt(process.env.HLS_SEGMENT_SECONDS || "10", 10) || 10
);

const HLS_COMMON_OUTPUT = [
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
];

/** Fast path: keep H.264 video, re-encode audio to AAC 48kHz (fixes pitch/sync, much faster than full transcode). */
function runHlsAudioFix(inputPath, outputBase) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(["-fflags", "+genpts"])
      .outputOptions([
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-af",
        "aresample=async=1:first_pts=0",
        ...HLS_COMMON_OUTPUT,
      ])
      .output(`${outputBase}.m3u8`)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

/** Full transcode when audio-fix / copy is not possible. */
function runHlsFullTranscode(inputPath, outputBase) {
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
        "-af",
        "aresample=async=1:first_pts=0",
        ...HLS_COMMON_OUTPUT,
      ])
      .output(`${outputBase}.m3u8`)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

async function muxToHlsSegments(inputPath, outputDir, outputBase) {
  await fs.mkdir(outputDir, { recursive: true });
  try {
    await runHlsAudioFix(inputPath, outputBase);
  } catch (audioFixErr) {
    console.warn(
      "[hls] Audio-fix (video copy) failed, full transcode:",
      audioFixErr.message
    );
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(outputDir, { recursive: true });
    await runHlsFullTranscode(inputPath, outputBase);
  }
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

    console.log(`[hls] Processing lecture ${lectureId}…`);
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

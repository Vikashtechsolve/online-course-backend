const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { pipeline } = require("stream/promises");
const { GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const Lecture = require("../models/Lecture");
const { getUploadTempDir } = require("../config/uploadPaths");
const { transcodeAndUploadHLS } = require("./hlsService");
const { uploadFileFromPathAndGetUrl, isR2Configured } = require("./uploadService");

let r2Client;
try {
  r2Client = require("../config/r2");
} catch {
  r2Client = null;
}

const activeJobs = new Map();

async function downloadR2ObjectToFile(key, destPath) {
  if (!r2Client || !isR2Configured()) {
    throw new Error("Cloud storage is not configured.");
  }
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
  await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
  await pipeline(response.Body, fs.createWriteStream(destPath));
  return destPath;
}

async function deleteR2SourceIfConfigured(key) {
  if (process.env.HLS_DELETE_SOURCE_AFTER_PROCESS !== "true") return;
  if (!r2Client || !isR2Configured()) return;
  await r2Client
    .send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      })
    )
    .catch(() => {});
}

async function processLectureVideo(lectureId, sourcePath, originalname, mimetype, sourceR2Key) {
  try {
    const hlsUrl = await transcodeAndUploadHLS(sourcePath, lectureId);
    let videoUrl = hlsUrl;

    if (!videoUrl) {
      videoUrl = await uploadFileFromPathAndGetUrl(
        sourcePath,
        originalname,
        mimetype,
        "lectures/videos"
      );
    }

    if (videoUrl) {
      await Lecture.findByIdAndUpdate(lectureId, {
        $set: {
          videoUrl,
          videoProcessingStatus: "ready",
          videoProcessingError: "",
        },
      });
      if (sourceR2Key) await deleteR2SourceIfConfigured(sourceR2Key);
      console.log(`[video] Lecture ${lectureId} ready: ${videoUrl}`);
    } else {
      await Lecture.findByIdAndUpdate(lectureId, {
        $set: {
          videoProcessingStatus: "failed",
          videoProcessingError: "Video processing failed. Please try uploading again.",
        },
      });
    }
  } catch (err) {
    console.error(`[video] Lecture ${lectureId} failed:`, err);
    await Lecture.findByIdAndUpdate(lectureId, {
      $set: {
        videoProcessingStatus: "failed",
        videoProcessingError: err.message || "Video processing failed.",
      },
    }).catch(() => {});
  } finally {
    if (sourcePath) await fsPromises.unlink(sourcePath).catch(() => {});
  }
}

function startLectureVideoProcessing(lectureId, sourcePath, originalname, mimetype) {
  runJob(lectureId, () =>
    processLectureVideo(lectureId, sourcePath, originalname, mimetype, null)
  );
}

function startLectureVideoProcessingFromR2(lectureId, r2Key, originalname, mimetype) {
  runJob(lectureId, async () => {
    const ext = path.extname(originalname || r2Key) || ".mp4";
    const localPath = path.join(
      getUploadTempDir(),
      `src-${lectureId}-${crypto.randomBytes(8).toString("hex")}${ext}`
    );
    await downloadR2ObjectToFile(r2Key, localPath);
    await processLectureVideo(lectureId, localPath, originalname, mimetype, r2Key);
  });
}

function runJob(lectureId, fn) {
  const id = String(lectureId);
  const prev = activeJobs.get(id);
  if (prev) prev.catch(() => {});

  const job = Promise.resolve().then(fn);
  activeJobs.set(id, job);
  job.finally(() => {
    if (activeJobs.get(id) === job) activeJobs.delete(id);
  });
}

module.exports = {
  startLectureVideoProcessing,
  startLectureVideoProcessingFromR2,
};

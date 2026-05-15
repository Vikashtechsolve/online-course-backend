const fs = require("fs").promises;
const path = require("path");
const Lecture = require("../models/Lecture");
const { transcodeAndUploadHLS } = require("./hlsService");
const { uploadFileFromPathAndGetUrl } = require("./uploadService");

const activeJobs = new Map();

async function processLectureVideo(lectureId, sourcePath, originalname, mimetype) {
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
    await fs.unlink(sourcePath).catch(() => {});
  }
}

/**
 * Start HLS processing in the background (do not await in the HTTP handler).
 */
function startLectureVideoProcessing(lectureId, sourcePath, originalname, mimetype) {
  const id = String(lectureId);
  const prev = activeJobs.get(id);
  if (prev) {
    prev.catch(() => {});
  }

  const job = processLectureVideo(id, sourcePath, originalname, mimetype);
  activeJobs.set(id, job);
  job.finally(() => {
    if (activeJobs.get(id) === job) activeJobs.delete(id);
  });
}

module.exports = { startLectureVideoProcessing };

const Lecture = require("../models/Lecture");
const { canManageLectureMaterials } = require("../utils/lecturePermissions");
const { createVideoUploadPresign, verifyObjectExists } = require("../services/r2PresignService");
const { startLectureVideoProcessingFromR2 } = require("../services/videoProcessingService");
const { isR2Configured } = require("../services/uploadService");

const MAX_UPLOAD_MB = Math.min(
  2048,
  Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || "2048", 10) || 2048)
);

// POST /api/lectures/:id/video/upload-session
const createVideoUploadSession = async (req, res) => {
  try {
    if (!isR2Configured()) {
      return res.status(503).json({
        message: "Direct video upload is not available. Contact support.",
      });
    }

    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    if (!(await canManageLectureMaterials(req.user, lecture))) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const { fileName, contentType, fileSize } = req.body || {};
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ message: "fileName is required" });
    }

    const size = Number(fileSize) || 0;
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    if (size > maxBytes) {
      return res.status(413).json({
        message: `File is too large. Maximum allowed size is ${MAX_UPLOAD_MB} MB.`,
      });
    }

    const session = await createVideoUploadPresign(
      String(lecture._id),
      fileName,
      contentType || "video/mp4",
      size
    );

    res.json(session);
  } catch (error) {
    console.error("createVideoUploadSession error:", error);
    res.status(500).json({ message: error.message || "Could not start upload session" });
  }
};

// POST /api/lectures/:id/video/complete
const completeVideoUpload = async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    if (!(await canManageLectureMaterials(req.user, lecture))) {
      return res.status(403).json({ message: "You are not assigned to this course" });
    }

    const { key, fileName, contentType } = req.body || {};
    if (!key || typeof key !== "string") {
      return res.status(400).json({ message: "key is required" });
    }

    const expectedPrefix = `lectures/source/${lecture._id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return res.status(400).json({ message: "Invalid upload key" });
    }

    const exists = await verifyObjectExists(key);
    if (!exists) {
      return res.status(400).json({
        message: "Upload not found in storage. Finish uploading the file first.",
      });
    }

    await Lecture.findByIdAndUpdate(lecture._id, {
      $set: {
        videoProcessingStatus: "processing",
        videoProcessingError: "",
      },
    });

    startLectureVideoProcessingFromR2(
      String(lecture._id),
      key,
      fileName || "video.mp4",
      contentType || "video/mp4"
    );

    const updated = await Lecture.findById(lecture._id)
      .populate("course", "title slug")
      .populate("teacher", "name email avatar");

    res.json({
      lecture: updated,
      message:
        "Upload received. Video is processing — you can leave this page and check back in a few minutes.",
    });
  } catch (error) {
    console.error("completeVideoUpload error:", error);
    res.status(500).json({ message: error.message || "Could not complete upload" });
  }
};

module.exports = {
  createVideoUploadSession,
  completeVideoUpload,
};

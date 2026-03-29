const path = require("path");
const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImages = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedDocs = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed",
  ];
  const allowedVideos = ["video/mp4", "video/webm", "video/quicktime"];

  const allAllowed = [...allowedImages, ...allowedDocs, ...allowedVideos];
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".pdf",
    ".pptx",
    ".docx",
    ".zip",
    ".mp4",
    ".webm",
    ".mov",
  ];

  if (allAllowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type ${file.mimetype} is not supported. Allowed: images, PDF, DOCX, PPTX, ZIP, MP4, WebM`
      ),
      false
    );
  }
};

const imageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const uploadAvatar = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isImageMime = imageMimes.includes(file.mimetype);
    const isImageExt = imageExts.includes(ext);
    const isOctetWithImageExt = file.mimetype === "application/octet-stream" && isImageExt;
    if (isImageMime || isOctetWithImageExt) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${imageMimes.join(", ")}`), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

const uploadFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("file");

const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).array("files", 10);

const csvMimes = ["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"];
const uploadCsv = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const isCsv = csvMimes.includes(file.mimetype) || ext === ".csv";
    if (isCsv || file.mimetype === "application/octet-stream") {
      cb(null, true);
    } else {
      cb(new Error("CSV file required"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("csv");

const uploadLectureMaterials = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "notesPdf", maxCount: 1 },
  { name: "pptFile", maxCount: 1 },
]);

module.exports = {
  uploadAvatar,
  uploadFile,
  uploadMultiple,
  uploadCsv,
  uploadLectureMaterials,
};

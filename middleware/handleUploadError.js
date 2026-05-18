const MAX_UPLOAD_MB = Math.min(
  2048,
  Math.max(1, parseInt(process.env.MAX_UPLOAD_MB || "2048", 10) || 2048)
);

/**
 * Express error handler for multer / multipart failures.
 * Must be registered with arity 4: (err, req, res, next).
 */
function handleUploadError(err, req, res, next) {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: `File is too large. Maximum allowed size is ${MAX_UPLOAD_MB} MB.`,
      code: "LIMIT_FILE_SIZE",
      maxMb: MAX_UPLOAD_MB,
    });
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      message: "Unexpected file field. Use video, notesPdf, or pptFile.",
      code: "LIMIT_UNEXPECTED_FILE",
    });
  }

  if (err.message) {
    const msg = String(err.message);
    if (/error -122|EDQUOT|ENOSPC|no space left/i.test(msg)) {
      return res.status(507).json({
        message:
          "Server storage is full. Free disk space on the server or use direct cloud upload (redeploy latest backend).",
        code: "INSUFFICIENT_STORAGE",
      });
    }
    return res.status(400).json({ message: msg });
  }

  return next(err);
}

/** Wrap a multer middleware so errors reach handleUploadError. */
function wrapMulter(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  };
}

module.exports = { handleUploadError, wrapMulter, MAX_UPLOAD_MB };

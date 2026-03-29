const express = require("express");
const protect = require("../middleware/auth");
const { getCertificates, getCertificateById, downloadCertificate } = require("../controllers/certificateController");

const router = express.Router();

router.use(protect);
router.get("/", getCertificates);
router.get("/:id/download", downloadCertificate);
router.get("/:id", getCertificateById);

module.exports = router;

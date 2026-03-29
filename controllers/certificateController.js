const Certificate = require("../models/Certificate");
const fs = require("fs").promises;
const path = require("path");

// GET /api/certificates — list certificates for logged-in student
const getCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({ student: req.user._id })
      .populate("course", "title description batch")
      .sort({ issuedAt: -1 });

    res.json({ certificates });
  } catch (error) {
    console.error("Get certificates error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/certificates/:id — get single certificate (student's own)
const getCertificateById = async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id)
      .populate("course", "title description")
      .populate("student", "name email");

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    if (cert.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ certificate: cert });
  } catch (error) {
    console.error("Get certificate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/certificates/:id/download — stream PDF with proper download headers
const downloadCertificate = async (req, res) => {
  try {
    const cert = await Certificate.findById(req.params.id)
      .populate("course", "title");

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    if (cert.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pdfUrl = cert.pdfUrl;
    if (!pdfUrl) {
      return res.status(404).json({ message: "Certificate PDF not available" });
    }

    const safeName = (cert.course?.title || "certificate").replace(/[^a-zA-Z0-9-_]/g, "-");
    const filename = `certificate-${safeName}-${cert.certificateId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const uploadsMatch = pdfUrl.match(/\/uploads\/(.+)$/);
    if (uploadsMatch) {
      const relativePath = uploadsMatch[1];
      const filePath = path.join(process.cwd(), "uploads", relativePath);
      try {
        const buffer = await fs.readFile(filePath);
        return res.send(buffer);
      } catch {
        // fallback to fetch if file not found locally
      }
    }

    const response = await fetch(pdfUrl, { redirect: "follow" });
    if (!response.ok) {
      return res.status(502).json({ message: "Failed to fetch certificate" });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error("Download certificate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getCertificates,
  getCertificateById,
  downloadCertificate,
};

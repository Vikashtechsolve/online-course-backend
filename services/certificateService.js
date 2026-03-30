const fs = require("fs").promises;
const path = require("path");
const PDFDocument = require("pdfkit");
const Certificate = require("../models/Certificate");
const { uploadBufferToR2, isR2Configured, getApiBaseUrl } = require("./uploadService");

const BORDER_WIDTH = 8;
const RED = "#B11C20";
const BLACK = "#000000";

function generateCertificateId() {
  const year = new Date().getFullYear();
  const random = Math.floor(100 + Math.random() * 900);
  return `VTS-CC-${year}-${random}`;
}

function formatIssuedDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function truncateText(str, maxLen = 120) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "...";
}

async function generateCertificatePDF(student, course, certificateId, issuedAt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const w = doc.page.width;
    const h = doc.page.height;

    doc.rect(0, 0, w, h).fill("#FFFFFF");
    doc
      .rect(BORDER_WIDTH, BORDER_WIDTH, w - BORDER_WIDTH * 2, h - BORDER_WIDTH * 2)
      .lineWidth(BORDER_WIDTH)
      .strokeColor(RED)
      .stroke();

    const innerLeft = BORDER_WIDTH * 2 + 20;
    const innerRight = w - BORDER_WIDTH * 2 - 20;
    const innerTop = BORDER_WIDTH * 2 + 20;
    const innerBottom = h - BORDER_WIDTH * 2 - 20;
    const centerX = w / 2;

    doc.fontSize(14).fillColor(RED);
    doc.text("VIKASH TECH SOLUTION", centerX, innerTop, { align: "center", width: 400 });

    doc.fontSize(28).fillColor(BLACK).font("Helvetica-Bold");
    doc.text("CERTIFICATE OF COMPLETION", centerX, innerTop + 35, { align: "center", width: 500 });

    doc.fontSize(16).fillColor(BLACK);
    doc.text("VTS LMS ACADEMY", centerX, innerTop + 75, { align: "center", width: 300 });

    doc
      .moveTo(centerX - 150, innerTop + 95)
      .lineTo(centerX + 150, innerTop + 95)
      .strokeColor(RED)
      .lineWidth(2)
      .stroke();

    doc.fontSize(12).fillColor(BLACK).font("Helvetica");
    doc.text("This is to certify that", centerX, innerTop + 130, { align: "center", width: 400 });

    const studentName = truncateText((student?.name || "Student").toUpperCase(), 60);
    doc.fontSize(32).font("Helvetica-Bold").fillColor(BLACK);
    doc.text(studentName, centerX, innerTop + 155, { align: "center", width: 550 });

    doc.fontSize(12).font("Helvetica");
    doc.text("has successfully completed the requirements for the course", centerX, innerTop + 210, {
      align: "center",
      width: 450,
    });

    const courseTitle = truncateText((course?.title || "Course").toUpperCase(), 80);
    doc.fontSize(20).font("Helvetica-Bold").fillColor(BLACK);
    doc.text(courseTitle, centerX, innerTop + 245, { align: "center", width: 500 });

    const rawDesc = course?.description || "A comprehensive program covering the course curriculum.";
    const description = truncateText(rawDesc, 200);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(description, centerX, innerTop + 285, { align: "center", width: 480, height: 45, ellipsis: true });

    const footerY = innerBottom - 50;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(BLACK);
    doc.text(`Issued On: ${formatIssuedDate(issuedAt)}`, innerLeft, footerY, { width: 250 });
    doc.fontSize(9).font("Helvetica");
    doc.text("[Signature of Instructor/Director]", innerLeft, footerY + 20, { width: 250 });

    doc.fontSize(10).font("Helvetica-Bold").fillColor(BLACK);
    doc.text("Issued By: VTS LMS Academy", innerRight - 220, footerY, { width: 220, align: "right" });
    doc.text(`Certificate ID: ${certificateId}`, innerRight - 220, footerY + 18, {
      width: 220,
      align: "right",
    });

    doc.end();
  });
}

async function createAndStoreCertificate(student, course, issuedBy) {
  let certificateId = generateCertificateId();
  while (await Certificate.findOne({ certificateId })) {
    certificateId = generateCertificateId();
  }

  const issuedAt = new Date();
  const pdfBuffer = await generateCertificatePDF(student, course, certificateId, issuedAt);

  let pdfUrl = "";
  const fileName = `${course._id}-${Date.now()}.pdf`;

  try {
    if (isR2Configured()) {
      const key = `certificates/${student._id}/${fileName}`;
      pdfUrl = await uploadBufferToR2(key, pdfBuffer, "application/pdf");
    }
  } catch {
    // fallback to local
  }
  if (!pdfUrl) {
    const certDir = path.join(process.cwd(), "uploads", "certificates", String(student._id));
    await fs.mkdir(certDir, { recursive: true });
    await fs.writeFile(path.join(certDir, fileName), pdfBuffer);
    pdfUrl = `${getApiBaseUrl()}/uploads/certificates/${student._id}/${fileName}`;
  }

  const certificate = await Certificate.create({
    student: student._id,
    course: course._id,
    certificateId,
    issuedAt,
    pdfUrl,
    issuedBy: issuedBy || null,
  });

  return certificate;
}

module.exports = {
  createAndStoreCertificate,
  generateCertificatePDF,
};

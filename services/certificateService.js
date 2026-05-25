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

function fitFontSize(doc, text, font, maxSize, minSize, maxWidth) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    doc.font(font).fontSize(size);
    if (doc.widthOfString(text) <= maxWidth) return size;
  }
  return minSize;
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
    const contentWidth = innerRight - innerLeft;

    // ── Pre-measure all dynamic content before positioning ──
    const studentName = truncateText((student?.name || "Student").toUpperCase(), 60);
    const nameFontSize = fitFontSize(doc, studentName, "Helvetica-Bold", 32, 18, contentWidth - 40);
    doc.font("Helvetica-Bold").fontSize(nameFontSize);
    const nameH = doc.heightOfString(studentName, { width: contentWidth });

    const courseTitle = truncateText((course?.title || "Course").toUpperCase(), 80);
    const courseFontSize = fitFontSize(doc, courseTitle, "Helvetica-Bold", 20, 12, contentWidth - 40);
    doc.font("Helvetica-Bold").fontSize(courseFontSize);
    const courseH = doc.heightOfString(courseTitle, { width: contentWidth });

    const rawDesc = course?.description || "A comprehensive program covering the course curriculum.";
    const description = truncateText(rawDesc, 200);
    doc.font("Helvetica").fontSize(10);
    const descH = Math.min(45, doc.heightOfString(description, { width: contentWidth - 120 }));

    doc.font("Helvetica").fontSize(12);
    const certifyH = doc.heightOfString("This is to certify that", { width: contentWidth });
    const completedH = doc.heightOfString(
      "has successfully completed the requirements for the course",
      { width: contentWidth }
    );

    // ── Vertical layout: distribute space equally between header, main, and footer ──
    const headerHeight = 100;
    const footerHeight = 40;
    const footerY = innerBottom - footerHeight;

    const innerGap = 12;
    const mainH = certifyH + innerGap + nameH + innerGap + completedH + innerGap + courseH + innerGap + descH;

    const availableHeight = footerY - innerTop;
    const contentHeight = headerHeight + mainH;
    const sectionGap = Math.max(15, (availableHeight - contentHeight) / 3);

    const headerStartY = innerTop + sectionGap;
    const mainStartY = headerStartY + headerHeight + sectionGap;

    // ── Render header ──
    doc.fontSize(14).fillColor(RED).font("Helvetica");
    doc.text("VIKASH TECH SOLUTION", innerLeft, headerStartY, {
      align: "center",
      width: contentWidth,
    });

    doc.fontSize(28).fillColor(BLACK).font("Helvetica-Bold");
    doc.text("CERTIFICATE OF COMPLETION", innerLeft, headerStartY + 35, {
      align: "center",
      width: contentWidth,
    });

    doc.fontSize(16).fillColor(BLACK).font("Helvetica");
    doc.text("VTS LMS ACADEMY", innerLeft, headerStartY + 75, {
      align: "center",
      width: contentWidth,
    });

    doc
      .moveTo(centerX - 150, headerStartY + 98)
      .lineTo(centerX + 150, headerStartY + 98)
      .strokeColor(RED)
      .lineWidth(2)
      .stroke();

    // ── Render main content (vertically centered between header and footer) ──
    let y = mainStartY;

    doc.fontSize(12).fillColor(BLACK).font("Helvetica");
    doc.text("This is to certify that", innerLeft, y, {
      align: "center",
      width: contentWidth,
    });
    y += certifyH + innerGap;

    doc.fontSize(nameFontSize).font("Helvetica-Bold").fillColor(BLACK);
    doc.text(studentName, innerLeft, y, {
      align: "center",
      width: contentWidth,
    });
    y += nameH + innerGap;

    doc.fontSize(12).font("Helvetica").fillColor(BLACK);
    doc.text("has successfully completed the requirements for the course", innerLeft, y, {
      align: "center",
      width: contentWidth,
    });
    y += completedH + innerGap;

    doc.fontSize(courseFontSize).font("Helvetica-Bold").fillColor(BLACK);
    doc.text(courseTitle, innerLeft, y, {
      align: "center",
      width: contentWidth,
    });
    y += courseH + innerGap;

    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(description, innerLeft + 60, y, {
      align: "center",
      width: contentWidth - 120,
      height: 45,
      ellipsis: true,
    });

    // ── Render footer (anchored to bottom) ──
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

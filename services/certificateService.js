const fs = require("fs").promises;
const path = require("path");
const puppeteer = require("puppeteer");
const Certificate = require("../models/Certificate");
const { uploadBufferToR2, isR2Configured, getApiBaseUrl } = require("./uploadService");

// ── Template & asset cache (loaded once, reused across requests) ──
let _template = null;
let _logoBase64 = null;
let _sigBase64 = null;
let _calendarBase64 = null;
let _badgeBase64 = null;
let _browser = null;

async function getTemplate() {
  if (!_template) {
    _template = await fs.readFile(
      path.join(__dirname, "..", "templates", "certificate.html"),
      "utf-8"
    );
  }
  return _template;
}

async function getAssetBase64(filename) {

  try{
  
  const file=
  await fs.readFile(
  path.join(
  __dirname,
  "..",
  "assets",
  filename
  )
  );
  
  const ext=
  path.extname(
  filename
  )
  .toLowerCase();
  
  const mime =
  ext===".svg"
  ? "image/svg+xml;charset=utf-8"
  : "image/png";
  
  return `data:${mime};base64,${file.toString("base64")}`;
  
  }
  
  catch{
  
  return "";
  
  }
  
  }

async function getLogoBase64() {
  if (!_logoBase64) _logoBase64 = await getAssetBase64("logo.png");
  return _logoBase64;
}

async function getSigBase64() {
  if (!_sigBase64) _sigBase64 = await getAssetBase64("signature.png");
  return _sigBase64;
}

async function getCalendarBase64(){

  if(!_calendarBase64){
  
  _calendarBase64=
  await getAssetBase64(
  "calendar.png"
  );
  
  }
  
  return _calendarBase64;
  
  }
  
  async function getBadgeBase64(){
  
  if(!_badgeBase64){
  
  _badgeBase64=
  await getAssetBase64(
  "badge.png"
  );
  
  }
  
  return _badgeBase64;
  
  }

async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
  }
  return _browser;
}

// ── Utilities ──

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── PDF generation ──

async function generateCertificatePDF(student, course, certificateId, issuedAt) {
  const [

    template,
    
    logoSrc,
    
    sigSrc,
    
    calendarSrc,
    
    badgeSrc
    
    ]
    
    =
    
    await Promise.all([
    
    getTemplate(),
    
    getLogoBase64(),
    
    getSigBase64(),
    
    getCalendarBase64(),
    
    getBadgeBase64(),
    
    ]);

  const studentName = truncateText(student?.name || "Student", 60);
  const courseTitle = truncateText(course?.title || "Course", 80);

  const nameClass =
    studentName.length > 45 ? "student-name-sm" :
    studentName.length > 28 ? "student-name-md" : "";

  const courseClass =
    courseTitle.length > 55 ? "course-title-sm" :
    courseTitle.length > 35 ? "course-title-md" : "";

  const html = template
    .replace(/\{\{LOGO_SRC\}\}/g, logoSrc)
    .replace(/\{\{SIGNATURE_SRC\}\}/g, sigSrc)
    .replace(/\{\{CALENDAR_SRC\}\}/g, calendarSrc)
    .replace(/\{\{BADGE_SRC\}\}/g, badgeSrc)
    .replace(/\{\{STUDENT_NAME\}\}/g, escapeHtml(studentName))
    .replace(/\{\{COURSE_TITLE\}\}/g, escapeHtml(courseTitle))
    .replace(/\{\{ISSUED_DATE\}\}/g, escapeHtml(formatIssuedDate(issuedAt)))
    .replace(/\{\{CERTIFICATE_ID\}\}/g, escapeHtml(certificateId))
    .replace(/\{\{NAME_CLASS\}\}/g, nameClass)
    .replace(/\{\{COURSE_CLASS\}\}/g, courseClass);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      width: "297mm",
      height: "210mm",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

// ── Certificate creation & storage (unchanged) ──

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

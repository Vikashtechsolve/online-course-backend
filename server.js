require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const batchRoutes = require("./routes/batchRoutes");
const batchStudentRoutes = require("./routes/batchStudentRoutes");
const courseRoutes = require("./routes/courseRoutes");
const lectureRoutes = require("./routes/lectureRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const proxyRoutes = require("./routes/proxyRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const supportTicketRoutes = require("./routes/supportTicketRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const courseLeadRoutes = require("./routes/courseLeadRoutes");

const app = express();

connectDB();

// Serve uploaded files (local fallback when R2 is not configured)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/**
 * CORS (env `CORS_ORIGINS`):
 * - Unset or empty: reflect request Origin (`origin: true`) + credentials.
 * - `*` or `all` (case-insensitive): any origin allowed (still reflects Origin so credentials work).
 * - Otherwise: comma-separated allowlist, e.g. https://a.com,https://b.com
 */
function corsOptions() {
  const raw = process.env.CORS_ORIGINS;
  const trimmed = raw != null ? String(raw).trim() : "";
  if (!trimmed) {
    return { origin: true, credentials: true };
  }
  const allowAny = /^(?:\*|all)$/i.test(trimmed);
  if (allowAny) {
    return { origin: true, credentials: true };
  }

  const allowed = trimmed
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, "");
      if (allowed.includes(normalized)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  };
}

app.use(cors(corsOptions()));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/batches/:batchId/students", batchStudentRoutes); // must be after batchRoutes
app.use("/api/courses", courseRoutes);
app.use("/api/lectures", lectureRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/tickets", supportTicketRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/course-leads", courseLeadRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

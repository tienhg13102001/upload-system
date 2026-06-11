import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Config (lấy từ biến môi trường) ----
const PORT = parseInt(process.env.PORT || "3000", 10);
// Thư mục lưu file. Trong Docker sẽ mount volume vào đây.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
// URL gốc dùng để dựng link trả về, ví dụ: https://yumest.synology.me:8080
// Nếu để trống, app tự suy ra từ request (dùng được nhưng kém chính xác sau reverse proxy).
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
// API key để bảo vệ endpoint upload. Bắt buộc đặt khi chạy thật.
const API_KEY = process.env.API_KEY || "";
// Giới hạn dung lượng 1 file (MB)
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || "50", 10);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");

// ---- Middleware kiểm tra API key ----
function requireApiKey(req, res, next) {
  if (!API_KEY) return next(); // chưa cấu hình key -> bỏ qua (chỉ nên dùng khi test)
  const key = req.get("x-api-key");
  if (key && key === API_KEY) return next();
  return res.status(401).json({ error: "Unauthorized: thiếu hoặc sai x-api-key" });
}

// ---- Lưu file với tên duy nhất, giữ nguyên phần mở rộng ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = crypto.randomBytes(16).toString("hex");
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
});

function buildFileUrl(req, filename) {
  const base = PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/files/${encodeURIComponent(filename)}`;
}

// ---- Routes ----
app.get("/health", (req, res) => res.json({ ok: true }));

// Serve file đã upload (public, read-only)
app.use(
  "/files",
  express.static(UPLOAD_DIR, {
    index: false,
    maxAge: "365d",
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

// Upload 1 file: field name = "file"
app.post("/upload", requireApiKey, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: "Không có file (field 'file')" });
    return res.status(201).json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: buildFileUrl(req, req.file.filename),
    });
  });
});

// Upload nhiều file cùng lúc: field name = "files"
app.post("/upload/multiple", requireApiKey, (req, res) => {
  upload.array("files", 20)(req, res, (err) => {
    if (err) {
      const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(code).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: "Không có file (field 'files')" });
    return res.status(201).json({
      files: req.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        url: buildFileUrl(req, f.filename),
      })),
    });
  });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`uploadfile-api đang chạy tại http://0.0.0.0:${PORT}`);
  console.log(`  UPLOAD_DIR      = ${UPLOAD_DIR}`);
  console.log(`  PUBLIC_BASE_URL = ${PUBLIC_BASE_URL || "(tự suy ra từ request)"}`);
  console.log(`  API_KEY         = ${API_KEY ? "đã đặt" : "(CHƯA đặt - endpoint đang mở)"}`);
});

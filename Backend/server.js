import express from "express";
import cors from "cors";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- App config ---
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET || !MONGODB_URI) {
  console.error("Missing environment variables");
  process.exit(1);
}

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middlewares
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","DELETE"] }));
app.use(express.json());

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
}).array("files", 5);

// MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(() => process.exit(1));

// --- Schemas ---
const userSchema = new mongoose.Schema({
  id: String,
  role: String,
  name: String,
  email: String,
  rollNumber: String,
  department: String,
  passwordHash: String,
});

const fileSchema = new mongoose.Schema({
  url: String,
  originalName: String,
  mimetype: String,
  size: Number,
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  studentId: String,
  files: [fileSchema],
  submittedAt: Date,
  marks: Number,
  feedback: String,
  isLate: Boolean,
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  id: String,
  courseId: String,
  title: String,
  description: String,
  dueDate: String,
  maxMarks: Number,
  createdBy: String,
  createdAt: Date,
  submissions: [submissionSchema],
});

const courseSchema = new mongoose.Schema({
  id: String,
  name: String,
  teacherId: String,
  students: [String],
});

const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const Assignment = mongoose.model("Assignment", assignmentSchema);

// --- Helpers ---
async function uploadToCloudinary(file, folder) {
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "auto",
  });
  return {
    url: result.secure_url,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };
}

async function deleteFromCloudinary(url) {
  const publicId = url.split("/").pop().split(".")[0];
  await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
}

// --- Auth middleware ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// --- Create Assignment (FIXED) ---
app.post("/api/assignments", auth, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers allowed" });
  }

  const { courseId, title, description, dueDate, maxMarks } = req.body;

  if (
    typeof courseId !== "string" ||
    typeof title !== "string" ||
    typeof dueDate !== "string" ||
    typeof maxMarks !== "number"
  ) {
    return res.status(400).json({
      message: "Invalid payload",
      expected: { courseId:"string", title:"string", dueDate:"ISO", maxMarks:"number" }
    });
  }

  const course = await Course.findOne({ id: courseId });
  if (!course || course.teacherId !== req.user.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const assignment = new Assignment({
    id: uuidv4(),
    courseId,
    title,
    description: description || "",
    dueDate: new Date(dueDate).toISOString(),
    maxMarks,
    createdBy: req.user.id,
    createdAt: new Date(),
    submissions: [],
  });

  await assignment.save();
  res.json(assignment);
});

// --- Submit Assignment ---
app.post("/api/assignments/:id/submit", auth, (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Students only" });
  }

  upload(req, res, async () => {
    const assignment = await Assignment.findOne({ id: req.params.id });
    if (!assignment) return res.status(404).json({ message: "Not found" });

    const files = [];
    for (const f of req.files || []) {
      files.push(await uploadToCloudinary(f, "assignments"));
    }

    assignment.submissions.push({
      studentId: req.user.id,
      files,
      submittedAt: new Date(),
      isLate: new Date() > new Date(assignment.dueDate),
    });

    await assignment.save();
    res.json({ message: "Submitted" });
  });
});

// --- DELETE uploaded file ---
app.delete("/api/assignments/:id/files", auth, async (req, res) => {
  const { fileUrl } = req.body;
  const assignment = await Assignment.findOne({ id: req.params.id });
  if (!assignment) return res.status(404).json({ message: "Not found" });

  const submission = assignment.submissions.find(
    s => s.studentId === req.user.id
  );
  if (!submission) return res.status(404).json({ message: "No submission" });

  submission.files = submission.files.filter(f => f.url !== fileUrl);
  await deleteFromCloudinary(fileUrl);
  await assignment.save();

  res.json({ message: "File deleted" });
});

// --- Health ---
app.get("/", (_, res) => res.send("Backend running"));

app.listen(PORT, () =>
  console.log(`✅ Server running on ${PORT}`)
);

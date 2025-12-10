import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// ================== BASIC SETUP ==================
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET || !MONGODB_URI) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }));
app.use(express.json());

// ================== CLOUDINARY ==================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================== MULTER ==================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).array("files", 5);

// ================== DATABASE ==================
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// ================== SCHEMAS ==================
const userSchema = new mongoose.Schema({
  id: String,
  role: String,
  name: String,
  email: String,
  rollNumber: String,
  department: String,
  passwordHash: String,
});

const fileSchema = new mongoose.Schema(
  {
    url: String,
    originalName: String,
    mimetype: String,
    size: Number,
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    studentId: String,
    files: [fileSchema],
    submittedAt: Date,
    marks: Number,
    feedback: String,
    isLate: Boolean,
  },
  { _id: false }
);

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

// ================== HELPERS ==================
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
  // handles folders correctly
  const parts = url.split("/");
  const filename = parts.pop();
  const folder = parts.slice(parts.indexOf("upload") + 1).join("/");
  const publicId = `${folder}/${filename.split(".")[0]}`;

  await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
}

// ================== AUTH ==================
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

// ================== CREATE ASSIGNMENT (FIXED) ==================
app.post("/api/assignments", auth, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers allowed" });
  }

  let { courseId, title, description, dueDate, maxMarks } = req.body;

  if (!courseId || !title || maxMarks === undefined) {
    return res.status(400).json({
      message: "courseId, title and maxMarks are required",
    });
  }

  const maxMarksNum = Number(maxMarks);
  if (Number.isNaN(maxMarksNum) || maxMarksNum <= 0) {
    return res.status(400).json({ message: "Invalid maxMarks" });
  }

  const course = await Course.findOne({ id: courseId });
  if (!course || course.teacherId !== req.user.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const finalDueDate = dueDate
    ? new Date(dueDate).toISOString()
    : new Date().toISOString();

  const assignment = new Assignment({
    id: uuidv4(),
    courseId,
    title,
    description: description || "",
    dueDate: finalDueDate,
    maxMarks: maxMarksNum,
    createdBy: req.user.id,
    createdAt: new Date(),
    submissions: [],
  });

  await assignment.save();
  res.json(assignment);
});

// ================== SUBMIT ASSIGNMENT ===============

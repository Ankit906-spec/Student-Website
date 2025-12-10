import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
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
  limits: { fileSize: 20 * 1024 * 1024 },
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

const Assignment = mongoose.model("Assignment", assignmentSchema);
const Course = mongoose.model("Course", courseSchema);

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
// ================== USER SCHEMA ==================
const userSchema = new mongoose.Schema({
  id: String,
  role: String,
  name: String,
  email: String,
  rollNumber: String,
  passwordHash: String,
});

const User = mongoose.model("User", userSchema);

// ================== SIGNUP ==================
app.post("/api/signup", async (req, res) => {
  const { role, name, email, rollNumber, password } = req.body;

  if (!role || !name || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(password, 10);

  const user = new User({
    id: uuidv4(),
    role,
    name,
    email: email || null,
    rollNumber: rollNumber || null,
    passwordHash: hash,
  });

  await user.save();

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);

  res.json({
    token,
    user: { id: user.id, role: user.role, name: user.name }
  });
});

// ================== LOGIN ==================
app.post("/api/login", async (req, res) => {
  const { role, identifier, password } = req.body;

  const bcrypt = (await import("bcryptjs")).default;

  const user = role === "student"
    ? await User.findOne({ rollNumber: identifier })
    : await User.findOne({ email: identifier });

  if (!user) return res.status(400).json({ message: "User not found" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ message: "Wrong password" });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);

  res.json({
    token,
    user: { id: user.id, role: user.role, name: user.name }
  });
});


// ================== CREATE ASSIGNMENT ==================
app.post("/api/assignments", auth, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers allowed" });
  }

  let { courseId, title, description, dueDate, maxMarks } = req.body;

  if (!courseId || !title || maxMarks === undefined) {
    return res
      .status(400)
      .json({ message: "courseId, title and maxMarks are required" });
  }

  const maxMarksNum = Number(maxMarks);
  if (Number.isNaN(maxMarksNum) || maxMarksNum <= 0) {
    return res.status(400).json({ message: "Invalid maxMarks" });
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
    dueDate: dueDate
      ? new Date(dueDate).toISOString()
      : new Date().toISOString(),
    maxMarks: maxMarksNum,
    createdBy: req.user.id,
    createdAt: new Date(),
    submissions: [],
  });

  await assignment.save();
  res.json(assignment);
});

// ================== SUBMIT ASSIGNMENT ==================
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

// ================== DELETE FILE ==================
app.delete("/api/assignments/:id/files", auth, async (req, res) => {
  const { fileUrl } = req.body;

  const assignment = await Assignment.findOne({ id: req.params.id });
  if (!assignment) return res.status(404).json({ message: "Not found" });

  const submission = assignment.submissions.find(
    (s) => s.studentId === req.user.id
  );
  if (!submission) return res.status(404).json({ message: "No submission" });

  submission.files = submission.files.filter((f) => f.url !== fileUrl);
  await deleteFromCloudinary(fileUrl);
  await assignment.save();

  res.json({ message: "File deleted" });
});

// ================== HEALTH ==================
app.get("/", (_, res) => res.send("✅ Backend running"));

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);


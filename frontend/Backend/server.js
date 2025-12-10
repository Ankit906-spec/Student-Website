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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null; // optional teacher admin

if (!JWT_SECRET || !MONGODB_URI) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
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
    console.error("Mongo error", e);
    process.exit(1);
  });

// ================== SCHEMAS ==================
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  role: { type: String, enum: ["student", "teacher"], required: true },
  name: String,
  email: String,
  rollNumber: String,
  branch: String,
  year: String,
  department: String,
  profilePhotoUrl: String,
  passwordHash: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now },
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
    marks: { type: Number, default: null },
    feedback: { type: String, default: null },
    isLate: { type: Boolean, default: false },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  courseId: String,
  title: String,
  description: String,
  dueDate: String, // ISO string
  maxMarks: Number,
  createdBy: String, // teacher id
  createdAt: Date,
  submissions: [submissionSchema],
});

const courseSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  code: { type: String, unique: true },
  description: String,
  teacherId: String,
  students: [String], // user ids
  materials: [fileSchema],
});

const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  courseId: String,
  userId: String,
  content: String,
  createdAt: Date,
});

const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const Assignment = mongoose.model("Assignment", assignmentSchema);
const Message = mongoose.model("Message", messageSchema);

// ================== HELPERS ==================
async function uploadToCloudinary(file, folder) {
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString(
    "base64"
  )}`;
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

async function isAdminUser(userId) {
  const user = await User.findOne({ id: userId });
  if (!user) return false;
  if (ADMIN_EMAIL) {
    return user.role === "teacher" && user.email === ADMIN_EMAIL;
  }
  return user.role === "teacher";
}

// ================== AUTH MIDDLEWARE ==================
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ================== AUTH ROUTES ==================

// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const {
      role,
      name,
      email,
      rollNumber,
      branch,
      year,
      department,
      password,
    } = req.body;

    if (!role || !name || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (role === "student") {
      if (!rollNumber || !branch || !year) {
        return res.status(400).json({
          message: "Student must have rollNumber, branch and year",
        });
      }
      const existing = await User.findOne({ role: "student", rollNumber });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Student with this roll number already exists" });
      }
    } else if (role === "teacher") {
      if (!email || !department) {
        return res.status(400).json({
          message: "Teacher must have email and department",
        });
      }
      if (ADMIN_EMAIL && email !== ADMIN_EMAIL) {
        return res.status(403).json({
          message:
            "Teacher registration is restricted. Contact admin to create a teacher account.",
        });
      }
      const existing = await User.findOne({ role: "teacher", email });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Teacher with this email already exists" });
      }
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      id: uuidv4(),
      role,
      name,
      email: email || null,
      rollNumber: rollNumber || null,
      branch: branch || null,
      year: year || null,
      department: department || null,
      profilePhotoUrl: null,
      passwordHash,
      createdAt: new Date(),
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: newUser.id,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        rollNumber: newUser.rollNumber,
        branch: newUser.branch,
        year: newUser.year,
        department: newUser.department,
      },
    });
  } catch (e) {
    console.error("Signup error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { role, identifier, password } = req.body;
    if (!role || !identifier || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    let user;
    if (role === "student") {
      user = await User.findOne({ role: "student", rollNumber: identifier });
    } else if (role === "teacher") {
      user = await User.findOne({ role: "teacher", email: identifier });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber,
        branch: user.branch,
        year: user.year,
        department: user.department,
      },
    });
  } catch (e) {
    console.error("Login error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Forgot password
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Identifier required" });
    }
    let user =
      (await User.findOne({ email: identifier })) ||
      (await User.findOne({ rollNumber: identifier }));

    if (!user) {
      return res.json({
        message:
          "If an account exists with that identifier, a reset link/token has been created.",
      });
    }

    const token = uuidv4();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // For now, return token in response (in real life, send email)
    res.json({
      message: "Password reset token created (valid for 1 hour).",
      token,
    });
  } catch (e) {
    console.error("Forgot password error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Reset password
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and newPassword required" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (e) {
    console.error("Reset password error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user profile
app.get("/api/me", auth, async (req, res) => {
  const user = await User.findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    rollNumber: user.rollNumber,
    branch: user.branch,
    year: user.year,
    department: user.department,
    profilePhotoUrl: user.profilePhotoUrl,
  });
});

// Update profile / change password
app.put("/api/me", auth, async (req, res) => {
  try {
    const {
      name,
      branch,
      year,
      department,
      profilePhotoUrl,
      currentPassword,
      newPassword,
    } = req.body;

    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (user.role === "student") {
      if (branch) user.branch = branch;
      if (year) user.year = year;
    } else if (user.role === "teacher") {
      if (department) user.department = department;
    }
    if (profilePhotoUrl) user.profilePhotoUrl = profilePhotoUrl;

    if (currentPassword && newPassword) {
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok)
        return res
          .status(400)
          .json({ message: "Current password incorrect" });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ message: "Profile updated" });
  } catch (e) {
    console.error("Update profile error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ================== COURSES ==================

// Get all courses (with optional search)
app.get("/api/courses", auth, async (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  let courses = await Course.find({});
  if (q) {
    courses = courses.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
    );
  }

  const teacherIds = [
    ...new Set(courses.map((c) => c.teacherId).filter(Boolean)),
  ];
  const teachers = await User.find({ id: { $in: teacherIds } });
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

  const result = courses.map((c) => ({
    ...c.toObject(),
    teacherName: c.teacherId ? teacherMap.get(c.teacherId) : null,
    studentCount: (c.students || []).length,
  }));

  res.json(result);
});

// Create course (admin teacher only)
app.post("/api/courses", auth, async (req, res) => {
  if (req.user.role !== "teacher")
    return res.status(403).json({ message: "Only teachers can create courses" });

  if (!(await isAdminUser(req.user.id))) {
    return res.status(403).json({
      message: "Course creation is restricted to the admin teacher account.",
    });
  }

  const { name, code, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({ message: "Name and code are required" });
  }

  const existing = await Course.findOne({ code });
  if (existing) {
    return res.status(400).json({ message: "Course code already exists" });
  }

  const course = new Course({
    id: uuidv4(),
    name,
    code,
    description: description || "",
    teacherId: req.user.id,
    students: [],
    materials: [],
  });

  await course.save();
  res.json(course);
});

// Student joins course
app.post("/api/courses/:courseId/join", auth, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can join courses" });
  }

  const { courseId } = req.params;
  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (!course.students.includes(req.user.id)) {
    course.students.push(req.user.id);
    await course.save();
  }

  res.json({ message: "Joined course", course });
});

// Get courses of current user
app.get("/api/my-courses", auth, async (req, res) => {
  let courses;
  if (req.user.role === "student") {
    courses = await Course.find({ students: req.user.id });
  } else if (req.user.role === "teacher") {
    courses = await Course.find({ teacherId: req.user.id });
  } else {
    return res.status(400).json({ message: "Unknown role" });
  }

  const teacherIds = [
    ...new Set(courses.map((c) => c.teacherId).filter(Boolean)),
  ];
  const teachers = await User.find({ id: { $in: teacherIds } });
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

  const result = courses.map((c) => ({
    ...c.toObject(),
    teacherName: c.teacherId ? teacherMap.get(c.teacherId) : null,
    studentCount: (c.students || []).length,
  }));

  res.json(result);
});

// ================== ASSIGNMENTS ==================

// Create assignment (teacher)
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

// Get assignments for a course
app.get("/api/courses/:courseId/assignments", auth, async (req, res) => {
  const { courseId } = req.params;
  const assignments = await Assignment.find({ courseId });
  res.json(assignments);
});

// Submit assignment (student) + upload files
app.post("/api/assignments/:id/submit", auth, (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Students only" });
  }

  upload(req, res, async () => {
    try {
      const assignment = await Assignment.findOne({ id: req.params.id });
      if (!assignment)
        return res.status(404).json({ message: "Assignment not found" });

      const course = await Course.findOne({ id: assignment.courseId });
      if (!course || !course.students.includes(req.user.id)) {
        return res.status(403).json({ message: "Not enrolled in course" });
      }

      const uploaded = [];
      for (const f of req.files || []) {
        uploaded.push(await uploadToCloudinary(f, "assignments"));
      }

      const now = new Date();
      const due = new Date(assignment.dueDate);
      const isLate = now > due;

      let sub =
        assignment.submissions.find((s) => s.studentId === req.user.id) ||
        null;

      if (!sub) {
        sub = {
          studentId: req.user.id,
          files: uploaded,
          submittedAt: now,
          marks: null,
          feedback: null,
          isLate,
        };
        assignment.submissions.push(sub);
      } else {
        sub.files.push(...uploaded);
        sub.submittedAt = now;
        sub.isLate = isLate;
      }

      await assignment.save();
      res.json({ message: "Submitted", submission: sub });
    } catch (e) {
      console.error("Submit error", e);
      res.status(500).json({ message: "Server error" });
    }
  });
});

// Get submissions (teacher sees all, student sees own)
app.get("/api/assignments/:id/submissions", auth, async (req, res) => {
  const assignment = await Assignment.findOne({ id: req.params.id });
  if (!assignment)
    return res.status(404).json({ message: "Assignment not found" });

  const course = await Course.findOne({ id: assignment.courseId });
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (req.user.role === "teacher") {
    if (course.teacherId !== req.user.id) {
      return res.status(403).json({ message: "Not course teacher" });
    }

    const studentIds = assignment.submissions.map((s) => s.studentId);
    const students = await User.find({ id: { $in: studentIds } });
    const map = new Map(students.map((s) => [s.id, s]));

    const subs = assignment.submissions.map((s) => {
      const st = map.get(s.studentId);
      return {
        studentId: s.studentId,
        studentName: st ? st.name : "Unknown",
        rollNumber: st ? st.rollNumber : null,
        files: s.files,
        submittedAt: s.submittedAt,
        marks: s.marks,
        feedback: s.feedback,
        isLate: s.isLate || false,
      };
    });

    return res.json({ assignmentId: assignment.id, submissions: subs });
  }

  // student
  if (req.user.role === "student") {
    if (!course.students.includes(req.user.id)) {
      return res.status(403).json({ message: "Not enrolled" });
    }
    const sub = assignment.submissions.find(
      (s) => s.studentId === req.user.id
    );
    return res.json({
      assignmentId: assignment.id,
      submissions: sub ? [sub] : [],
    });
  }

  res.status(400).json({ message: "Unknown role" });
});

// Grade submission (teacher)
app.post("/api/assignments/:id/grade", auth, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers can grade" });
  }

  const { id } = req.params;
  const { studentId, marks, feedback } = req.body;

  const assignment = await Assignment.findOne({ id });
  if (!assignment)
    return res.status(404).json({ message: "Assignment not found" });

  const course = await Course.findOne({ id: assignment.courseId });
  if (!course || course.teacherId !== req.user.id) {
    return res.status(403).json({ message: "Not course teacher" });
  }

  const sub = assignment.submissions.find((s) => s.studentId === studentId);
  if (!sub) return res.status(404).json({ message: "Submission not found" });

  sub.marks = marks;
  sub.feedback = feedback || null;

  await assignment.save();
  res.json({ message: "Graded", submission: sub });
});

// Delete one file from a student's submission
app.delete("/api/assignments/:id/files", auth, async (req, res) => {
  const { fileUrl } = req.body;
  const assignment = await Assignment.findOne({ id: req.params.id });
  if (!assignment)
    return res.status(404).json({ message: "Assignment not found" });

  const sub = assignment.submissions.find(
    (s) => s.studentId === req.user.id
  );
  if (!sub) return res.status(404).json({ message: "No submission" });

  const file = sub.files.find((f) => f.url === fileUrl);
  sub.files = sub.files.filter((f) => f.url !== fileUrl);

  if (file) {
    try {
      await deleteFromCloudinary(file.url);
    } catch (e) {
      console.error("Cloudinary delete error", e);
    }
  }

  await assignment.save();
  res.json({ message: "File deleted" });
});

// ================== MESSAGES ==================
app.get("/api/courses/:courseId/messages", auth, async (req, res) => {
  const { courseId } = req.params;
  const messages = await Message.find({ courseId }).sort({ createdAt: 1 });

  const userIds = [...new Set(messages.map((m) => m.userId))];
  const users = await User.find({ id: { $in: userIds } });
  const map = new Map(users.map((u) => [u.id, u]));

  const result = messages.map((m) => {
    const u = map.get(m.userId);
    return {
      ...m.toObject(),
      userName: u ? u.name : "Unknown",
      userRole: u ? u.role : null,
    };
  });

  res.json(result);
});

app.post("/api/courses/:courseId/messages", auth, async (req, res) => {
  const { courseId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Content required" });

  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ message: "Course not found" });

  if (req.user.role === "student" && !course.students.includes(req.user.id)) {
    return res.status(403).json({ message: "Not enrolled" });
  }
  if (req.user.role === "teacher" && course.teacherId !== req.user.id) {
    return res.status(403).json({ message: "Not course teacher" });
  }

  const msg = new Message({
    id: uuidv4(),
    courseId,
    userId: req.user.id,
    content,
    createdAt: new Date(),
  });

  await msg.save();
  res.json(msg);
});

// ================== STUDY MATERIALS ==================
app.post("/api/courses/:courseId/materials", auth, (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers can upload" });
  }

  upload(req, res, async () => {
    try {
      const { courseId } = req.params;
      const course = await Course.findOne({ id: courseId });
      if (!course)
        return res.status(404).json({ message: "Course not found" });

      if (course.teacherId !== req.user.id) {
        return res.status(403).json({ message: "Not course teacher" });
      }

      const uploaded = [];
      for (const f of req.files || []) {
        const meta = await uploadToCloudinary(f, "materials");
        uploaded.push(meta);
        course.materials.push(meta);
      }

      await course.save();
      res.json({ message: "Material uploaded", files: uploaded });
    } catch (e) {
      console.error("Material upload error", e);
      res.status(500).json({ message: "Server error" });
    }
  });
});

// ================== DASHBOARD SUMMARY ==================
app.get("/api/dashboard/summary", auth, async (req, res) => {
  if (req.user.role === "student") {
    const myCourses = await Course.find({ students: req.user.id });
    const courseIds = myCourses.map((c) => c.id);

    const myAssignments = await Assignment.find({
      courseId: { $in: courseIds },
    });

    const now = new Date();
    const pending = myAssignments.filter((a) => {
      const sub = a.submissions.find((s) => s.studentId === req.user.id);
      const due = new Date(a.dueDate);
      return !sub && due >= now;
    });

    const recentMessages = await Message.find({
      courseId: { $in: courseIds },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      myCoursesCount: myCourses.length,
      pendingAssignmentsCount: pending.length,
      pendingAssignments: pending,
      recentMessages,
    });
  }

  if (req.user.role === "teacher") {
    const myCourses = await Course.find({ teacherId: req.user.id });
    const courseIds = myCourses.map((c) => c.id);

    const myAssignments = await Assignment.find({
      courseId: { $in: courseIds },
    });

    const toGrade = [];
    myAssignments.forEach((a) => {
      a.submissions.forEach((s) => {
        if (s.marks === null || s.marks === undefined) {
          toGrade.push({
            assignmentId: a.id,
            courseId: a.courseId,
            studentId: s.studentId,
            submittedAt: s.submittedAt,
            isLate: s.isLate || false,
          });
        }
      });
    });

    return res.json({
      myCoursesCount: myCourses.length,
      assignmentsCount: myAssignments.length,
      submissionsToGradeCount: toGrade.length,
    });
  }

  res.status(400).json({ message: "Unknown role" });
});

// ================== HEALTH ==================
app.get("/", (_, res) => res.send("✅ Backend running"));

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

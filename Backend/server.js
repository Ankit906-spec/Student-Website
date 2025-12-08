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

// --- Config ---
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is not set in environment variables");
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set in environment variables");
  process.exit(1);
}

// Cloudinary config (must be set in Render env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middlewares
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Multer: in-memory (no local files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
}).array("files", 5);

// --- MongoDB / Mongoose setup ---
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Schemas
const userSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // for JWT + consistency
  role: { type: String, enum: ["student", "teacher"], required: true },
  name: { type: String, required: true },
  email: { type: String, default: null },
  rollNumber: { type: String, default: null },
  branch: { type: String, default: null },
  year: { type: String, default: null },
  department: { type: String, default: null },
  profilePhotoUrl: { type: String, default: null },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const fileSchema = new mongoose.Schema(
  {
    url: String, // Cloudinary URL
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
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  code: { type: String, unique: true },
  description: { type: String, default: "" },
  teacherId: String, // user.id
  students: [String], // array of user.id (students)
  materials: [fileSchema], // study materials (Cloudinary URLs)
});

const assignmentSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  courseId: String, // course.id
  title: String,
  description: { type: String, default: "" },
  dueDate: String,
  maxMarks: Number,
  createdBy: String, // teacher user.id
  createdAt: { type: Date, default: Date.now },
  submissions: [submissionSchema],
});

const messageSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  courseId: String,
  userId: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const Assignment = mongoose.model("Assignment", assignmentSchema);
const Message = mongoose.model("Message", messageSchema);

// --- Helpers ---

// Upload a single file buffer to Cloudinary and return meta
async function uploadToCloudinary(file, folder) {
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(base64, {
    folder: folder || "student-portal",
    resource_type: "auto",
  });

  return {
    url: result.secure_url,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  };
}

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ message: "No token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
}

// --- Auth routes ---
// Signup: role = 'student' or 'teacher'
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
        return res
          .status(400)
          .json({ message: "Student must have rollNumber, branch and year" });
      }
      const existingStudent = await User.findOne({
        role: "student",
        rollNumber,
      });
      if (existingStudent) {
        return res
          .status(400)
          .json({ message: "Student with this roll number already exists" });
      }
    } else if (role === "teacher") {
      if (!email || !department) {
        return res
          .status(400)
          .json({ message: "Teacher must have email and department" });
      }
      const existingTeacher = await User.findOne({
        role: "teacher",
        email,
      });
      if (existingTeacher) {
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
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login: student => rollNumber, teacher => email
app.post("/api/login", async (req, res) => {
  try {
    const { role, identifier, password } = req.body;
    if (!role || !identifier || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    let user;
    if (role === "student") {
      user = await User.findOne({
        role: "student",
        rollNumber: identifier,
      });
    } else if (role === "teacher") {
      user = await User.findOne({
        role: "teacher",
        email: identifier,
      });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

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
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user profile
app.get("/api/me", authMiddleware, async (req, res) => {
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

// Update profile + change password
app.put("/api/me", authMiddleware, async (req, res) => {
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
    }
    if (user.role === "teacher") {
      if (department) user.department = department;
    }
    if (profilePhotoUrl) user.profilePhotoUrl = profilePhotoUrl;

    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch)
        return res.status(400).json({ message: "Current password incorrect" });
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// --- Courses ---
// Get all courses (search optional)
app.get("/api/courses", authMiddleware, async (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  let courses = await Course.find({});
  if (q) {
    courses = courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }

  const teacherIds = [...new Set(courses.map((c) => c.teacherId).filter(Boolean))];
  const teachers = await User.find({ id: { $in: teacherIds } });
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

  const result = courses.map((c) => ({
    ...c.toObject(),
    teacherName: c.teacherId ? teacherMap.get(c.teacherId) : null,
  }));

  res.json(result);
});

// Teacher creates a course
app.post("/api/courses", authMiddleware, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res.status(403).json({ message: "Only teachers can create courses" });
  }

  const { name, code, description } = req.body;
  if (!name || !code) {
    return res.status(400).json({ message: "Name and code are required" });
  }

  const existing = await Course.findOne({ code });
  if (existing) {
    return res.status(400).json({ message: "Course code already exists" });
  }

  const newCourse = new Course({
    id: uuidv4(),
    name,
    code,
    description: description || "",
    teacherId: req.user.id,
    students: [],
    materials: [],
  });

  await newCourse.save();
  res.json(newCourse);
});

// Student joins a course
app.post("/api/courses/:courseId/join", authMiddleware, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({
      message: "Only students can join courses",
    });
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
app.get("/api/my-courses", authMiddleware, async (req, res) => {
  let courses;
  if (req.user.role === "student") {
    courses = await Course.find({
      students: req.user.id,
    });
  } else if (req.user.role === "teacher") {
    courses = await Course.find({ teacherId: req.user.id });
  } else {
    return res.status(400).json({ message: "Unknown role" });
  }

  const teacherIds = [...new Set(courses.map((c) => c.teacherId).filter(Boolean))];
  const teachers = await User.find({ id: { $in: teacherIds } });
  const teacherMap = new Map(teachers.map((t) => [t.id, t.name]));

  const result = courses.map((c) => ({

    ...c.toObject(),
    teacherName: c.teacherId ? teacherMap.get(c.teacherId) : null,
    studentCount: c.students.length,
  }));

  res.json(result);
});

// --- Assignments ---
// Teacher creates assignment
app.post("/api/assignments", authMiddleware, async (req, res) => {
  if (req.user.role !== "teacher") {
    return res
      .status(403)
      .json({ message: "Only teachers can create assignments" });
  }

  const { courseId, title, description, dueDate, maxMarks } = req.body;
  if (!courseId || !title || !dueDate || !maxMarks) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const course = await Course.findOne({ id: courseId });
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (course.teacherId !== req.user.id) {
    return res.status(403).json({
      message: "You are not the teacher of this course",
    });
  }

  const newAssignment = new Assignment({
    id: uuidv4(),
    courseId,
    title,
    description: description || "",
    dueDate,
    maxMarks,
    createdBy: req.user.id,
    createdAt: new Date(),
    submissions: [],
  });

  await newAssignment.save();
  res.json(newAssignment);
});

// Get assignments for a course
app.get(
  "/api/courses/:courseId/assignments",
  authMiddleware,
  async (req, res) => {
    const { courseId } = req.params;
    const assignments = await Assignment.find({ courseId });
    res.json(assignments);
  }
);

// Student submits assignment (multiple files) → Cloudinary
app.post(
  "/api/assignments/:assignmentId/submit",
  authMiddleware,
  (req, res) => {
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can submit assignments",
      });
    }

    upload(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({
          message: err.message || "Upload error",
        });
      }

      try {
        const { assignmentId } = req.params;
        const assignment = await Assignment.findOne({
          id: assignmentId,
        });
        if (!assignment) {
          return res.status(404).json({ message: "Assignment not found" });
        }

        const course = await Course.findOne({
          id: assignment.courseId,
        });
        if (!course || !course.students.includes(req.user.id)) {
          return res.status(403).json({
            message: "You are not enrolled in this course",
          });
        }

        const uploadedFiles = [];
        for (const file of req.files || []) {
          const meta = await uploadToCloudinary(file, "assignments");
          uploadedFiles.push(meta);
        }

        let submission =
          assignment.submissions.find((s) => s.studentId === req.user.id) || null;

        if (!submission) {
          submission = {
            studentId: req.user.id,
            files: uploadedFiles,
            submittedAt: new Date(),
            marks: null,
            feedback: null,
          };
          assignment.submissions.push(submission);
        } else {
          submission.files.push(...uploadedFiles);
          submission.submittedAt = new Date();
        }

        await assignment.save();
        res.json({ message: "Submitted", submission });
      } catch (e) {
        console.error("Submit error:", e);
        res.status(500).json({ message: "Server error" });
      }
    });
  }
);

// Teacher views submissions for an assignment
app.get(
  "/api/assignments/:assignmentId/submissions",
  authMiddleware,
  async (req, res) => {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can view submissions",
      });
    }

    const { assignmentId } = req.params;
    const assignment = await Assignment.findOne({
      id: assignmentId,
    });
    if (!assignment)
      return res.status(404).json({
        message: "Assignment not found",
      });

    const course = await Course.findOne({
      id: assignment.courseId,
    });
    if (!course || course.teacherId !== req.user.id) {
      return res.status(403).json({
        message: "You are not teacher of this course",
      });
    }

    const studentIds = assignment.submissions.map((s) => s.studentId);
    const students = await User.find({ id: { $in: studentIds } });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const result = assignment.submissions.map((s) => {
      const student = studentMap.get(s.studentId);
      return {
        studentId: s.studentId,
        studentName: student ? student.name : "Unknown",
        rollNumber: student ? student.rollNumber : null,
        files: s.files, // each file has url
        submittedAt: s.submittedAt,
        marks: s.marks,
        feedback: s.feedback,
      };
    });

    res.json({ assignmentId, submissions: result });
  }
);

// Teacher grades a submission
app.post(
  "/api/assignments/:assignmentId/grade",
  authMiddleware,
  async (req, res) => {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can grade",
      });
    }

    const { assignmentId } = req.params;
    const { studentId, marks, feedback } = req.body;

    const assignment = await Assignment.findOne({
      id: assignmentId,
    });
    if (!assignment)
      return res.status(404).json({
        message: "Assignment not found",
      });

    const course = await Course.findOne({
      id: assignment.courseId,
    });
    if (!course || course.teacherId !== req.user.id) {
      return res.status(403).json({
        message: "You are not teacher of this course",
      });
    }

    const submission = assignment.submissions.find(
      (s) => s.studentId === studentId
    );
    if (!submission)
      return res.status(404).json({
        message: "Submission not found",
      });

    submission.marks = marks;
    if (feedback) submission.feedback = feedback;

    await assignment.save();

    res.json({ message: "Graded", submission });
  }
);

// --- Course messages (discussion board) ---
// Get messages for a course
app.get(
  "/api/courses/:courseId/messages",
  authMiddleware,
  async (req, res) => {
    const { courseId } = req.params;
    const messages = await Message.find({ courseId }).sort({
      createdAt: 1,
    });

    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await User.find({ id: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const result = messages.map((m) => {
      const user = userMap.get(m.userId);
      return {
        ...m.toObject(),
        userName: user ? user.name : "Unknown",
        userRole: user ? user.role : null,
      };
    });

    res.json(result);
  }
);

// Post a message in a course
app.post(
  "/api/courses/:courseId/messages",
  authMiddleware,
  async (req, res) => {
    const { courseId } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "Content required" });

    const course = await Course.findOne({ id: courseId });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role === "student" && !course.students.includes(req.user.id)) {
      return res.status(403).json({
        message: "You are not enrolled in this course",
      });
    }
    if (req.user.role === "teacher" && course.teacherId !== req.user.id) {
      return res.status(403).json({
        message: "You are not teacher of this course",
      });
    }

    const newMessage = new Message({
      id: uuidv4(),
      courseId,
      userId: req.user.id,
      content,
      createdAt: new Date(),
    });

    await newMessage.save();
    res.json(newMessage);
  }
);

// --- Study materials upload (Cloudinary) ---
app.post(
  "/api/courses/:courseId/materials",
  authMiddleware,
  (req, res) => {
    if (req.user.role !== "teacher") {
      return res.status(403).json({
        message: "Only teachers can upload materials",
      });
    }

    upload(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({
          message: err.message || "Upload error",
        });
      }

      try {
        const { courseId } = req.params;
        const course = await Course.findOne({ id: courseId });
        if (!course)
          return res.status(404).json({
            message: "Course not found",
          });

        if (course.teacherId !== req.user.id) {
          return res.status(403).json({
            message: "You are not the teacher of this course",
          });
        }

        // 🔧 FIX: make sure materials array exists before pushing
        if (!course.materials) {
          course.materials = [];
        }

        const uploadedFiles = [];
        for (const file of req.files || []) {
          const meta = await uploadToCloudinary(file, "materials");
          uploadedFiles.push(meta);
          course.materials.push(meta);
        }

        await course.save();

        res.json({
          message: "Material uploaded",
          files: uploadedFiles,
        });
      } catch (e) {
        console.error("Material upload error:", e);
        res.status(500).json({ message: "Server error" });
      }
    });
  }
);

// --- Dashboard summary ---
app.get("/api/dashboard/summary", authMiddleware, async (req, res) => {
  if (req.user.role === "student") {
    const myCourses = await Course.find({
      students: req.user.id,
    });
    const courseIds = myCourses.map((c) => c.id);

    const myAssignments = await Assignment.find({
      courseId: { $in: courseIds },
    });

    const now = new Date();
    const pendingAssignments = myAssignments.filter((a) => {
      const submission = a.submissions.find(
        (s) => s.studentId === req.user.id
      );
      const due = new Date(a.dueDate);
      return !submission && due >= now;
    });

    const recentMessages = await Message.find({
      courseId: { $in: courseIds },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      myCoursesCount: myCourses.length,
      pendingAssignmentsCount: pendingAssignments.length,
      pendingAssignments,
      recentMessages,
    });
  } else if (req.user.role === "teacher") {
    const myCourses = await Course.find({
      teacherId: req.user.id,
    });
    const courseIds = myCourses.map((c) => c.id);

    const myAssignments = await Assignment.find({
      courseId: { $in: courseIds },
    });

    let submissionsToGrade = [];
    myAssignments.forEach((a) => {
      a.submissions.forEach((s) => {
        if (s.marks === null || s.marks === undefined) {
          submissionsToGrade.push({
            assignmentId: a.id,
            courseId: a.courseId,
            studentId: s.studentId,
            submittedAt: s.submittedAt,
          });
        }
      });
    });

    res.json({
      myCoursesCount: myCourses.length,
      assignmentsCount: myAssignments.length,
      submissionsToGradeCount: submissionsToGrade.length,
    });
  } else {
    res.status(400).json({ message: "Unknown role" });
  }
});

// Simple health check
app.get("/", (req, res) => {
  res.send("Student Backend API is running");
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

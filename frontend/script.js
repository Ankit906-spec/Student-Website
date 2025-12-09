// ================== CONFIG ==================
const API_BASE = "https://student-website-1-mx8v.onrender.com";
const ADMIN_COURSE_EMAIL = "David_2028@woxsen.edu.in";

// ================== SESSION ==================
function getToken() { return localStorage.getItem("token"); }
function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}
function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// ================== API ==================
async function api(path, options = {}) {
  const token = getToken();
  const headers = options.headers ? { ...options.headers } : {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return res.json().catch(() => ({}));
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("login-form")) initAuthPage();
  if (document.querySelector(".layout")) initDashboardPage();
});

// ================== AUTH ==================
function initAuthPage() {
  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = document.getElementById("login-role").value;
    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ role, identifier, password })
      });
      saveSession(data.token, data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      document.getElementById("login-error").textContent = err.message;
    }
  });
}

// ================== DASHBOARD ==================
function initDashboardPage() {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("user-name").textContent = user.name;
  document.getElementById("user-role-badge").textContent =
    user.role === "student" ? "Student" : "Teacher";

  document.getElementById("logout-btn").onclick = () => {
    clearSession();
    window.location.href = "index.html";
  };

  if (user.role === "student") {
    document.querySelectorAll(".teacher-only")
      .forEach(el => el.style.display = "none");
    document.getElementById("teacher-only-submissions").style.display = "none";
  } else {
    document.getElementById("student-only-pending").style.display = "none";
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-" + btn.dataset.view).classList.add("active");

      if (btn.dataset.view === "assignments") loadAssignments();
      if (btn.dataset.view === "overview") loadDashboardSummary();
    };
  });

  loadDashboardSummary();
  loadAssignments();
}

// ================== DASHBOARD SUMMARY ==================
async function loadDashboardSummary() {
  const data = await api("/api/dashboard/summary");
  const user = getUser();

  document.getElementById("stat-courses").textContent = data.myCoursesCount || 0;

  if (user.role === "student") {
    document.getElementById("stat-pending").textContent =
      data.pendingAssignmentsCount || 0;
  } else {
    document.getElementById("stat-to-grade").textContent =
      data.submissionsToGradeCount || 0;
  }
}

// ================== ASSIGNMENTS ==================
let cachedAssignments = [];

async function loadAssignments() {
  const myCourses = await api("/api/my-courses");
  const all = [];

  for (const c of myCourses) {
    const assignments = await api(`/api/courses/${c.id}/assignments`);
    assignments.forEach(a => all.push({ ...a, course: c }));
  }

  cachedAssignments = all;
  renderAssignments();
}

function renderAssignments() {
  const container = document.getElementById("assignments-list");
  const user = getUser();
  container.innerHTML = "";

  cachedAssignments.forEach(a => {
    const card = document.createElement("div");
    card.className = "assignment-card";
    card.innerHTML = `
      <h4>${a.title}</h4>
      <div class="small">${a.course.name}</div>
      <div class="small">Due: ${new Date(a.dueDate).toLocaleString()}</div>
      <div class="small">Max Marks: ${a.maxMarks}</div>
      <div id="act-${a.id}"></div>
    `;
    container.appendChild(card);

    const actions = card.querySelector(`#act-${a.id}`);

    if (user.role === "student") {
      const btn = document.createElement("button");
      btn.textContent = "Submit / Manage files";
      btn.onclick = () => openSubmitAssignmentModal(a);
      actions.appendChild(btn);
    }

    if (user.role === "teacher") {
      const btn = document.createElement("button");
      btn.textContent = "View submissions / Grade";
      btn.onclick = () => openGradeModal(a);
      actions.appendChild(btn);
    }
  });
}

// ================== STUDENT SUBMIT + DELETE ==================
function openSubmitAssignmentModal(assignment) {
  openModal("Submit Assignment", async (body) => {
    body.innerHTML = `
      <label>Upload files</label>
      <input type="file" id="files" multiple>
      <h4>Existing files</h4>
      <div id="existing-files"></div>
    `;

    const data = await api(`/api/assignments/${assignment.id}/submissions`);
    const me = data.submissions.find(s => s.studentId === getUser().id);

    const list = body.querySelector("#existing-files");
    if (me) {
      me.files.forEach(f => {
        const row = document.createElement("div");
        row.innerHTML = `
          <a href="${f.url}" target="_blank">View</a>
          <button>Delete</button>
        `;
        row.querySelector("button").onclick = async () => {
          await api(`/api/assignments/${assignment.id}/files`, {
            method: "DELETE",
            body: JSON.stringify({ fileUrl: f.url })
          });
          alert("File deleted");
          loadAssignments();
        };
        list.appendChild(row);
      });
    }

    return async () => {
      const input = document.getElementById("files");
      if (!input.files.length) return;

      const fd = new FormData();
      for (const f of input.files) fd.append("files", f);

      await fetch(`${API_BASE}/api/assignments/${assignment.id}/submit`, {
        method: "POST",
        headers: { Authorization: "Bearer " + getToken() },
        body: fd
      });

      alert("Uploaded");
      loadAssignments();
    };
  });
}

// ================== TEACHER GRADING ==================
function openGradeModal(assignment) {
  openModal("Grade Submissions", async (body) => {
    const data = await api(`/api/assignments/${assignment.id}/submissions`);

    body.innerHTML = data.submissions.map(s => `
      <div class="card">
        <strong>${s.studentName}</strong>
        ${s.files.map(f => `<a href="${f.url}" target="_blank">View</a>`).join("<br>")}
        <input id="m-${s.studentId}" type="number" value="${s.marks ?? ""}">
        <textarea id="f-${s.studen

// ================== CONFIG ==================
const API_BASE = "https://student-website-1-mx8v.onrender.com";

// Only THIS teacher email can create courses (admin)
const ADMIN_COURSE_EMAIL = "David_2028@woxsen.edu.in";

// ================== SESSION HELPERS ==================
function getToken() {
  return localStorage.getItem("token");
}
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

// ================== GENERIC API HELPER ==================
async function api(path, options = {}) {
  const token = getToken();
  const headers = options.headers ? { ...options.headers } : {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return res.json().catch(() => ({}));
}

// ================== SIMPLE ROUTING ==================
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("login-form")) {
    initAuthPage();
  }
  if (document.querySelector(".layout")) {
    initDashboardPage();
  }
});

// ================== AUTH PAGE ==================
function initAuthPage() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tabContents.forEach((c) => {
        if (c.id === tab + "-tab") c.classList.add("active");
        else c.classList.remove("active");
      });
    });
  });

  const signupRole = document.getElementById("signup-role");
  const studentExtra = document.getElementById("student-extra");
  const teacherExtra = document.getElementById("teacher-extra");

  if (signupRole) {
    signupRole.addEventListener("change", () => {
      if (signupRole.value === "student") {
        studentExtra?.classList.remove("hidden");
        teacherExtra?.classList.add("hidden");
      } else {
        studentExtra?.classList.add("hidden");
        teacherExtra?.classList.remove("hidden");
      }
    });
  }

  // ----- Login -----
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const role = document.getElementById("login-role").value;
      const identifier = document
        .getElementById("login-identifier")
        .value.trim();
      const password = document.getElementById("login-password").value;

      try {
        const data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ role, identifier, password })
        });
        saveSession(data.token, data.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        if (loginError) loginError.textContent = err.message;
      }
    });
  }

  // ----- Signup -----
  const signupForm = document.getElementById("signup-form");
  const signupError = document.getElementById("signup-error");

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (signupError) signupError.textContent = "";

      const role = signupRole ? signupRole.value : "student";
      const name = document.getElementById("signup-name").value.trim();
      const branchOrDept = document
        .getElementById("signup-branch-dept")
        .value.trim();
      const rollNumber = document.getElementById("signup-roll").value.trim();
      const year = document.getElementById("signup-year").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;

      const payload = { role, name, password };

      if (role === "student") {
        payload.branch = branchOrDept;
        payload.rollNumber = rollNumber;
        payload.year = year;
      } else {
        payload.department = branchOrDept;
        payload.email = email;
      }

      try {
        const data = await api("/api/signup", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        saveSession(data.token, data.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        if (signupError) signupError.textContent = err.message;
      }
    });
  }

  // Password visibility toggles
  initPasswordToggles();

  if (getToken() && getUser()) {
    window.location.href = "dashboard.html";
  }
}

// ================== DASHBOARD PAGE ==================
function initDashboardPage() {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = "index.html";
    return;
  }

  const userNameSpan = document.getElementById("user-name");
  const userRoleBadge = document.getElementById("user-role-badge");
  const logoutBtn = document.getElementById("logout-btn");

  if (userNameSpan) userNameSpan.textContent = user.name;
  if (userRoleBadge) {
    userRoleBadge.textContent = user.role === "student" ? "Student" : "Teacher";
  }

  if (user.role === "student") {
    document
      .querySelectorAll(".teacher-only")
      .forEach((el) => (el.style.display = "none"));
    document.getElementById("teacher-only-submissions").style.display = "none";
  } else {
    document.getElementById("student-only-pending").style.display = "none";
  }

  logoutBtn.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });

  const navBtns = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      views.forEach((v) => {
        if (v.id === "view-" + view) v.classList.add("active");
        else v.classList.remove("active");
      });

      if (view === "courses") loadCourses();
      if (view === "assignments") loadAssignments();
      if (view === "messages") initMessagesView();
      if (view === "profile") loadProfile();
      if (view === "materials") initMaterialsView();
      if (view === "overview") loadDashboardSummary();
    });
  });

  loadDashboardSummary();
  loadCourses();
  loadAssignments();
  initMessagesView();
  loadProfile();
  initCoursesSection(user);
  initAssignmentsSection(user);
  initProfileSection(user);

  initPasswordToggles();
}

// ================== DASHBOARD SUMMARY ==================
async function loadDashboardSummary() {
  try {
    const data = await api("/api/dashboard/summary");
    const user = getUser();
    if (!user) return;

    document.getElementById("stat-courses").textContent =
      data.myCoursesCount ?? "0";

    if (user.role === "student") {
      document.getElementById("stat-pending").textContent =
        data.pendingAssignmentsCount ?? "0";
    } else {
      document.getElementById("stat-to-grade").textContent =
        data.submissionsToGradeCount ?? "0";
    }
  } catch (err) {
    console.error("Dashboard summary error:", err);
  }
}

// ================== COURSES ==================
let cachedCourses = [];

async function loadCourses() {
  try {
    const search = document.getElementById("course-search")?.value.trim() || "";
    const res = await api(
      "/api/courses" + (search ? `?q=${encodeURIComponent(search)}` : "")
    );
    cachedCourses = res;
    renderCourses();
  } catch (err) {
    console.error("Courses error:", err);
  }
}

function renderCourses() {
  const container = document.getElementById("courses-list");
  const user = getUser();
  if (!container || !user) return;

  container.innerHTML = "";

  cachedCourses.forEach((c) => {
    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <h4>${c.name}</h4>
      <div class="small">${c.code}</div>
      <div class="small">${c.description || ""}</div>
      <div class="small">Teacher: ${c.teacherName || "Not assigned"}</div>
      <div class="small">Students: ${c.studentCount ?? 0}</div>
      <div class="small"><span class="tag">Course ID</span> ${c.id}</div>
      <div class="small" id="course-actions-${c.id}"></div>
    `;
    container.appendChild(card);

    const actions = card.querySelector(`#course-actions-${c.id}`);

    if (user.role === "student") {
      const isJoined = (c.students || []).includes(user.id);
      const btn = document.createElement("button");
      btn.className = "btn-primary-small";
      btn.textContent = isJoined ? "Joined" : "Join course";
      btn.disabled = isJoined;
      btn.addEventListener("click", () => joinCourse(c.id));
      actions.appendChild(btn);
    }
  });
}

async function joinCourse(courseId) {
  try {
    await api(`/api/courses/${courseId}/join`, { method: "POST" });
    await loadCourses();
    await loadDashboardSummary();
  } catch (err) {
    alert("Error joining course: " + err.message);
  }
}

function initCoursesSection(user) {
  const searchInput = document.getElementById("course-search");
  const refreshBtn = document.getElementById("btn-refresh-courses");
  const createBtn = document.getElementById("btn-create-course");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      const filtered = cachedCourses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
      );
      const backup = cachedCourses;
      cachedCourses = filtered;
      renderCourses();
      cachedCourses = backup;
    });
  }

  if (refreshBtn) refreshBtn.addEventListener("click", loadCourses);

  // Only the admin email can create courses
  if (
    user.role === "teacher" &&
    user.email === ADMIN_COURSE_EMAIL &&
    createBtn
  ) {
    createBtn.style.display = "inline-flex";
    createBtn.addEventListener("click", () => {
      openModal("Create course", (body, close) => {
        body.innerHTML = `
          <label>Course name</label>
          <input type="text" id="modal-course-name">
          <label>Course code</label>
          <input type="text" id="modal-course-code">
          <label>Description</label>
          <input type="text" id="modal-course-desc">
        `;
        return async () => {
          const name = document
            .getElementById("modal-course-name")
            .value.trim();
          const code = document
            .getElementById("modal-course-code")
            .value.trim();
          const description = document
            .getElementById("modal-course-desc")
            .value.trim();

          try {
            await api("/api/courses", {
              method: "POST",
              body: JSON.stringify({ name, code, description })
            });
            close();
            loadCourses();
          } catch (err) {
            alert("Error: " + err.message);
          }
        };
      });
    });
  } else if (createBtn) {
    createBtn.style.display = "none";
  }
}

// ================== ASSIGNMENTS ==================
let cachedAssignments = [];

async function loadAssignments() {
  try {
    const myCourses = await api("/api/my-courses");
    const all = [];

    for (const c of myCourses) {
      const assignments = await api(`/api/courses/${c.id}/assignments`);
      assignments.forEach((a) => all.push({ ...a, course: c }));
    }

    cachedAssignments = all;
    renderAssignments();
  } catch (err) {
    console.error("Assignments error:", err);
  }
}

function renderAssignments() {
  const container = document.getElementById("assignments-list");
  const user = getUser();
  if (!container || !user) return;

  container.innerHTML = "";

  cachedAssignments.forEach((a) => {
    const card = document.createElement("div");
    card.className = "assignment-card";
    card.innerHTML = `
      <h4>${a.title}</h4>
      <div class="small">${a.course.name} (${a.course.code})</div>
      <div class="small">Due: ${new Date(a.dueDate).toLocaleString()}</div>
      <div class="small">Max marks: ${a.maxMarks}</div>
      <div class="small">${a.description || ""}</div>
      <div class="small" id="assignment-actions-${a.id}"></div>
    `;
    container.appendChild(card);

    const actions = card.querySelector(`#assignment-actions-${a.id}`);

    if (user.role === "student") {
      const btn = document.createElement("button");
      btn.className = "btn-primary-small";
      btn.textContent = "Submit / Add files";
      btn.addEventListener("click", () => openSubmitAssignmentModal(a));
      actions.appendChild(btn);
    }
  });
}

function initAssignmentsSection(user) {
  const searchInput = document.getElementById("assignment-search");
  const refreshBtn = document.getElementById("btn-refresh-assignments");
  const createBtn = document.getElementById("btn-create-assignment");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      const filtered = cachedAssignments.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.course.name.toLowerCase().includes(q) ||
          a.course.code.toLowerCase().includes(q)
      );
      const backup = cachedAssignments;
      cachedAssignments = filtered;
      renderAssignments();
      cachedAssignments = backup;
    });
  }

  if (refreshBtn) refreshBtn.addEventListener("click", loadAssignments);

  if (user.role === "teacher" && createBtn) {
    createBtn.addEventListener("click", async () => {
      const myCourses = await api("/api/my-courses");
      if (!myCourses.length) {
        alert("You have no courses.");
        return;
      }

      openModal("Create assignment", (body, close) => {
        const options = myCourses
          .map((c) => `<option value="${c.id}">${c.name} (${c.code})</option>`)
          .join("");

        body.innerHTML = `
          <label>Course</label>
          <select id="modal-assignment-course">${options}</select>
          <label>Title</label>
          <input type="text" id="modal-assignment-title">
          <label>Description</label>
          <input type="text" id="modal-assignment-desc">
          <label>Due date</label>
          <input type="datetime-local" id="modal-assignment-due">
          <label>Max marks</label>
          <input type="number" id="modal-assignment-max" value="100">
        `;

        return async () => {
          const courseId = document.getElementById("modal-assignment-course").value;
          const title = document.getElementById("modal-assignment-title").value.trim();
          const description = document.getElementById("modal-assignment-desc").value.trim();
          const dueLocal = document.getElementById("modal-assignment-due").value;
          const maxMarks = parseInt(
            document.getElementById("modal-assignment-max").value,
            10
          );

          const dueDate = dueLocal ? new Date(dueLocal).toISOString() : null;

          try {
            await api("/api/assignments", {
              method: "POST",
              body: JSON.stringify({
                courseId,
                title,
                description,
                dueDate,
                maxMarks
              })
            });
            close();
            loadAssignments();
          } catch (err) {
            alert("Error: " + err.message);
          }
        };
      });
    });
  }
}

// ================== SUBMIT ASSIGNMENT ==================
function openSubmitAssignmentModal(assignment) {
  openModal("Submit assignment", (body, close) => {
    body.innerHTML = `
      <p class="small">${assignment.title} — ${assignment.course.name}</p>
      <label>Upload files</label>
      <input type="file" id="modal-files" multiple>
      <div id="modal-files-preview" class="small hint"></div>
    `;

    const input = body.querySelector("#modal-files");
    const preview = body.querySelector("#modal-files-preview");

    input.addEventListener("change", () => {
      const files = Array.from(input.files);
      preview.innerHTML = files
        .map((f) => `• ${f.name} (${Math.round(f.size / 1024)} KB)`)
        .join("<br>");
    });

    return async () => {
      const files = document.getElementById("modal-files").files;

      if (!files.length) {
        alert("Select at least one file.");
        return;
      }

      const formData = new FormData();
      for (const f of files) formData.append("files", f);

      try {
        await fetch(`${API_BASE}/api/assignments/${assignment.id}/submit`, {
          method: "POST",
          headers: { Authorization: "Bearer " + getToken() },
          body: formData
        });
        close();
        alert("Submission uploaded.");
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
  });
}

// ================== MESSAGES (FIXED REFRESH BUTTON) ==================
async function initMessagesView() {
  const select = document.getElementById("messages-course-select");
  const container = document.getElementById("messages-container");
  const form = document.getElementById("message-form");
  const refreshBtn = document.getElementById("btn-refresh-messages");

  if (!select || !container || !form) return;

  const myCourses = await api("/api/my-courses");
  select.innerHTML = myCourses
    .map((c) => `<option value="${c.id}">${c.name} (${c.code})</option>`)
    .join("");

  async function loadMessages() {
    const courseId = select.value;
    container.innerHTML = "";

    if (!courseId) return;

    try {
      const messages = await api(`/api/courses/${courseId}/messages`);
      messages.forEach((m) => {
        const div = document.createElement("div");
        div.className = "message";
        div.innerHTML = `
          <div class="message-header">
            ${m.userName} • ${m.userRole} • ${new Date(
              m.createdAt
            ).toLocaleString()}
          </div>
          <div class="message-content">${m.content}</div>
        `;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }

  select.addEventListener("change", loadMessages);

  // ⭐ FIXED: correct refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadMessages);
  }

  await loadMessages();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = document.getElementById("message-input").value.trim();
    if (!content) return;

    try {
      await api(`/api/courses/${select.value}/messages`, {
        method: "POST",
        body: JSON.stringify({ content })
      });
      document.getElementById("message-input").value = "";
      await loadMessages();
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

// ================== PROFILE ==================
async function loadProfile() {
  try {
    const data = await api("/api/me");

    document.getElementById("profile-name").value = data.name || "";
    document.getElementById("profile-role").value = data.role || "";
    document.getElementById("profile-roll").value = data.rollNumber || "";
    document.getElementById("profile-branch-dept").value =
      data.branch || data.department || "";
    document.getElementById("profile-year").value = data.year || "";
    document.getElementById("profile-email").value = data.email || "";
    document.getElementById("profile-photo").value = data.profilePhotoUrl || "";
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

function initProfileSection(user) {
  const form = document.getElementById("profile-form");
  const message = document.getElementById("profile-message");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    message.textContent = "";

    const payload = {
      name: document.getElementById("profile-name").value.trim(),
      profilePhotoUrl: document.getElementById("profile-photo").value.trim()
    };

    if (user.role === "student") {
      payload.branch = document
        .getElementById("profile-branch-dept")
        .value.trim();
      payload.year = document.getElementById("profile-year").value.trim();
    } else {
      payload.department = document
        .getElementById("profile-branch-dept")
        .value.trim();
    }

    const currentPassword = document.getElementById(
      "profile-current-password"
    ).value;
    const newPassword = document.getElementById("profile-new-password").value;

    if (currentPassword && newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    try {
      await api("/api/me", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      message.textContent = "Profile updated.";
      loadProfile();
    } catch (err) {
      message.textContent = err.message;
    }
  });
}

// ================== MATERIALS ==================
async function initMaterialsView() {
  const courseSelect = document.getElementById("materials-course-select");
  const materialsList = document.getElementById("materials-list");
  const uploadBtn = document.getElementById("btn-upload-material");
  const user = getUser();

  if (!courseSelect || !materialsList) return;

  const myCourses = await api("/api/my-courses");

  courseSelect.innerHTML = myCourses
    .map((c) => `<option value="${c.id}">${c.name} (${c.code})</option>`)
    .join("");

  async function loadMaterials() {
    const courseId = courseSelect.value;
    materialsList.innerHTML = "";

    if (!courseId) {
      materialsList.innerHTML = "<p class='hint'>Select a course.</p>";
      return;
    }

    const allCourses = await api("/api/courses");
    const course = allCourses.find((c) => c.id === courseId);

    if (!course || !course.materials.length) {
      materialsList.innerHTML =
        "<p class='hint'>No study material uploaded yet.</p>";
      return;
    }

    course.materials.forEach((m) => {
      const card = document.createElement("div");
      card.className = "assignment-card";
      card.innerHTML = `
        <h4>${m.originalName}</h4>
        <a href="${m.url}" target="_blank" class="small">Download</a>
      `;
      materialsList.appendChild(card);
    });
  }

  courseSelect.addEventListener("change", loadMaterials);
  await loadMaterials();

  if (user.role === "teacher") {
    uploadBtn.onclick = () => {
      openModal("Upload material", (body, close) => {
        body.innerHTML = `
          <label>Select file(s)</label>
          <input type="file" id="materialFiles" multiple>
          <div id="material-files-preview" class="small hint"></div>
        `;

        const input = body.querySelector("#materialFiles");
        const preview = body.querySelector("#material-files-preview");

        input.addEventListener("change", () => {
          const files = Array.from(input.files);
          preview.innerHTML = files
            .map((f) => `• ${f.name} (${Math.round(f.size / 1024)} KB)`)
            .join("<br>");
        });

        return async () => {
          const files = document.getElementById("materialFiles").files;

          if (!files.length) {
            alert("Select at least one file.");
            return;
          }

          const formData = new FormData();
          for (const f of files) formData.append("files", f);

          try {
            await fetch(
              `${API_BASE}/api/courses/${courseSelect.value}/materials`,
              {
                method: "POST",
                headers: { Authorization: "Bearer " + getToken() },
                body: formData
              }
            );
            close();
            loadMaterials();
          } catch (e) {
            alert("Error: " + e.message);
          }
        };
      });
    };
  } else {
    uploadBtn.style.display = "none";
  }
}

// ================== PASSWORD TOGGLE ==================
function attachPasswordToggle(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.hasToggle === "1") return;

  const wrapper = document.createElement("div");
  wrapper.className = "password-wrapper";

  const parent = input.parentNode;
  parent.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "toggle-password-btn";
  btn.textContent = "👁";

  btn.addEventListener("click", () => {
    const isPwd = input.type === "password";
    input.type = isPwd ? "text" : "password";
    btn.textContent = isPwd ? "🙈" : "👁";
  });

  wrapper.appendChild(btn);
  input.dataset.hasToggle = "1";
}

function initPasswordToggles() {
  [
    "login-password",
    "signup-password",
    "profile-current-password",
    "profile-new-password",
    "reset-new-password",
    "reset-confirm-password"
  ].forEach((id) => attachPasswordToggle(id));
}

// ================== MODAL ==================
function openModal(title, buildFn) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const btnCancel = document.getElementById("modal-cancel");
  const btnSave = document.getElementById("modal-save");

  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modal.classList.remove("hidden");

  let onSave = null;

  const close = () => {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
  };

  onSave = buildFn(modalBody, close);

  btnCancel.onclick = close;
  btnSave.onclick = async () => {
    if (onSave) await onSave();
  };
}

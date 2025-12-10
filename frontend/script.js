// ================== CONFIG ==================
const API_BASE = "https://student-website-1-mx8v.onrender.com";

// ================== SESSION ==================
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

// ================== API ==================
async function api(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getToken();

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
  if (document.getElementById("login-form")) {
    initAuthPage();
  }
  if (document.querySelector(".layout")) {
    initDashboardPage();
  }
});

// ================== AUTH (LOGIN + SIGNUP SAFE) ==================
function initAuthPage() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loginError) loginError.textContent = "";

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
      if (loginError) loginError.textContent = err.message;
    }
  });
}

// ================== DASHBOARD (SAFE LOAD) ==================
function initDashboardPage() {
  const user = getUser();
  if (!user || !getToken()) {
    window.location.href = "index.html";
    return;
  }

  const nameEl = document.getElementById("user-name");
  const roleEl = document.getElementById("user-role-badge");
  const logoutBtn = document.getElementById("logout-btn");

  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role === "student" ? "Student" : "Teacher";

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      clearSession();
      window.location.href = "index.html";
    };
  }
}

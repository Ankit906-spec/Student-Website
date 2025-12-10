// ================= CONFIG =================
const API_BASE = "https://student-website-1-mx8v.onrender.com";

// ================= SESSION =================
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

// ================= API =================
async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(API_BASE + path, {
    ...options,
    headers
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return res.json();
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  initPasswordToggle();

  if (document.getElementById("login-form")) initAuthPage();
  if (document.querySelector(".layout")) initDashboard();
});

// ================= PASSWORD TOGGLE =================
function initPasswordToggle() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("eye-toggle")) {
      const input = document.getElementById(e.target.dataset.target);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
      }
    }
  });
}

// ================= AUTH =================
function initAuthPage() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const role = document.getElementById("login-role").value;
      const identifier = document.getElementById("login-identifier").value.trim();
      const password = document.getElementById("login-password").value;

      document.getElementById("login-error").textContent = "";

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

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const role = document.getElementById("signup-role").value;
      const name = document.getElementById("signup-name").value.trim();
      const password = document.getElementById("signup-password").value;
      const branchDept = document.getElementById("signup-branch-dept").value.trim();
      const roll = document.getElementById("signup-roll")?.value.trim();
      const year = document.getElementById("signup-year")?.value.trim();
      const email = document.getElementById("signup-email")?.value.trim();

      document.getElementById("signup-error").textContent = "";

      const payload = { role, name, password };

      if (role === "student") {
        payload.rollNumber = roll;
      } else {
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
        document.getElementById("signup-error").textContent = err.message;
      }
    });
  }

  const forgot = document.getElementById("forgot-password");
  if (forgot) {
    forgot.onclick = () => {
      alert("Password reset will be added later.");
    };
  }
}

// ================= DASHBOARD =================
function initDashboard() {
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

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
    };
  });
}

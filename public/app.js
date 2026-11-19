const $ = (id) => document.getElementById(id);
let currentUser = null;
let authMode = "login";
let currentTab = "overview";
let toastTimer;

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function showHome() {
  $("homeView").classList.remove("hidden");
  $("services").classList.remove("hidden");
  $("about").classList.remove("hidden");
  $("authView").classList.add("hidden");
  $("dashboardView").classList.add("hidden");
  $("siteFooter").classList.remove("hidden");
  $("topNav").classList.remove("mobile-open");
  $("topNav").classList.remove("hidden");
  $("topActions").classList.remove("hidden");
}
function showAuth(mode) {
  authMode = mode;
  $("homeView").classList.add("hidden");
  $("services").classList.add("hidden");
  $("about").classList.add("hidden");
  $("authView").classList.remove("hidden");
  $("dashboardView").classList.add("hidden");
  $("siteFooter").classList.add("hidden");
  $("topNav").classList.add("hidden");
  $("topActions").classList.add("hidden");
  $("nameField").classList.toggle("hidden", mode !== "signup");
  $("name").required = mode === "signup";
  $("authTitle").textContent = mode === "signup" ? "Create your account" : "Welcome back";
  $("authSubtitle").textContent = mode === "signup" ? "A few details to set up your patient account." : "Enter your details to access your account.";
  $("authSubmit").innerHTML = mode === "signup" ? "Create account <span>→</span>" : "Log in <span>→</span>";
  $("switchText").textContent = mode === "signup" ? "Already have an account?" : "New to SmartHealth?";
  $("switchMode").textContent = mode === "signup" ? "Log in" : "Create an account";
  $("password").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("formError").classList.add("hidden");
  $("authForm").reset();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showDashboard() {
  $("homeView").classList.add("hidden");
  $("services").classList.add("hidden");
  $("about").classList.add("hidden");
  $("authView").classList.add("hidden");
  $("dashboardView").classList.remove("hidden");
  $("siteFooter").classList.add("hidden");
  $("topNav").classList.add("hidden");
  $("topActions").classList.add("hidden");
  $("userName").textContent = currentUser.name;
  $("userRole").textContent = currentUser.role;
  $("userAvatar").textContent = currentUser.name.trim().charAt(0).toUpperCase();
  $("welcomeTitle").textContent = `Welcome back, ${currentUser.name.split(" ")[0]}`;
  renderTab(currentTab);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function statusClass(status) {
  return ({ Confirmed: "status-confirmed", Completed: "status-completed", Cancelled: "status-cancelled" })[status] || "";
}
function emptyState(title, detail) {
  return `<div class="empty-state"><div class="empty-icon">✚</div><b>${esc(title)}</b>${esc(detail)}</div>`;
}
async function renderTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".side-link[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  const titles = { overview: "Overview", appointments: "Appointments", profile: "My profile", admin: "Admin panel" };
  $("breadcrumbTitle").textContent = titles[tab] || "Overview";
  const content = $("dashboardContent");
  content.innerHTML = `<div class="panel">${emptyState("Loading your workspace…", "Please wait a moment.")}</div>`;
  try {
    if (currentUser.role === "admin") {
      const [summary, usersData, appointmentData] = await Promise.all([
        api("/api/admin/summary"), api("/api/admin/users"), api("/api/appointments")
      ]);
      if (tab === "profile") {
        content.innerHTML = profileView();
      } else if (tab === "appointments") {
        content.innerHTML = adminAppointmentsView(appointmentData.appointments);
      } else {
        content.innerHTML = adminOverviewView(summary, usersData.users, appointmentData.appointments);
      }
    } else {
      const { appointments } = await api("/api/appointments");
      if (tab === "profile") content.innerHTML = profileView();
      else if (tab === "appointments") content.innerHTML = patientAppointmentsView(appointments);
      else content.innerHTML = patientOverviewView(appointments);
    }
    wireDynamicControls();
  } catch (err) {
    content.innerHTML = `<div class="panel">${emptyState("Unable to load data", err.message)}</div>`;
  }
}
function statsCard(label, value, caption, symbol) {
  return `<article class="dash-card"><div class="dash-card-top">${label}<span class="dash-card-icon">${symbol}</span></div><strong>${value}</strong><small>${caption}</small></article>`;
}
function patientOverviewView(appointments) {
  const upcoming = appointments.filter(a => !["Completed", "Cancelled"].includes(a.status));
  const next = appointments.slice().sort((a,b) => new Date(a.appointment_date)-new Date(b.appointment_date))[0];
  return `<div class="dash-cards">
    ${statsCard("My appointments", appointments.length, "All your appointment requests", "▣")}
    ${statsCard("Upcoming visits", upcoming.length, "Not completed or cancelled", "◷")}
    ${statsCard("Care status", "Active", "Your patient workspace", "♡")}
  </div>
  <section class="panel"><div class="panel-header"><div><h2>Recent appointments</h2><p>Keep track of your care schedule.</p></div><button class="btn btn-outline" data-go-tab="appointments">View all →</button></div>
  ${appointments.length ? appointmentTable(appointments.slice(0,5), false) : emptyState("No appointments yet", "Book an appointment to see it listed here.")}</section>
  <section class="panel"><div class="panel-header"><div><h2>Quick action</h2><p>Request a visit with a healthcare professional.</p></div></div>
  ${appointmentForm()}</section>`;
}
function patientAppointmentsView(appointments) {
  return `<section class="panel"><div class="panel-header"><div><h2>My appointments</h2><p>Review your appointment requests and their status.</p></div></div>
  ${appointments.length ? appointmentTable(appointments, false) : emptyState("Nothing scheduled yet", "Use the form below to request your first appointment.")}</section>
  <section class="panel"><div class="panel-header"><div><h2>Request an appointment</h2><p>Choose a provider and a future date.</p></div></div>${appointmentForm()}</section>`;
}
function appointmentForm() {
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  return `<form id="appointmentForm" class="appointment-form">
    <div class="field-group"><label for="doctor">Healthcare professional</label><select id="doctor" name="doctor" required><option value="">Choose a provider</option><option>Dr. Meera Sharma — General Medicine</option><option>Dr. Arjun Desai — Cardiology</option><option>Dr. Sana Khan — Dermatology</option><option>Dr. Rahul Patil — Pediatrics</option></select></div>
    <div class="field-group"><label for="date">Appointment date & time</label><input id="date" name="date" type="datetime-local" min="${minDate}" required></div>
    <div class="field-group full-field"><label for="reason">Reason for visit</label><textarea id="reason" name="reason" rows="3" maxlength="300" placeholder="Briefly describe the reason (avoid sensitive details in this demo)." required></textarea></div>
    <button class="btn btn-primary" type="submit">Request appointment →</button>
  </form>`;
}
function appointmentTable(appointments, isAdmin) {
  return `<div class="table-wrap"><table><thead><tr>${isAdmin ? "<th>Patient</th>" : ""}<th>Provider</th><th>Date & time</th><th>Reason</th><th>Status</th>${isAdmin ? "<th>Update status</th>" : ""}</tr></thead><tbody>
  ${appointments.map(a => `<tr>${isAdmin ? `<td>${esc(a.patient_name)}<br><small>${esc(a.patient_email)}</small></td>` : ""}<td>${esc(a.doctor_name)}</td><td>${fmtDate(a.appointment_date)}</td><td>${esc(a.reason)}</td><td><span class="status-pill ${statusClass(a.status)}">${esc(a.status)}</span></td>${isAdmin ? `<td><select aria-label="Update status for appointment ${a.id}" data-status-id="${a.id}" class="status-select">${["Pending","Confirmed","Completed","Cancelled"].map(s=>`<option ${a.status===s?"selected":""}>${s}</option>`).join("")}</select></td>` : ""}</tr>`).join("")}
  </tbody></table></div>`;
}
function adminOverviewView(summary, users, appointments) {
  return `<div class="dash-cards">${statsCard("Patient accounts", summary.users, "Registered patient users", "♙")}${statsCard("Appointments", summary.appointments, "Total appointment requests", "▣")}${statsCard("Pending requests", summary.pending, "Waiting for admin review", "◷")}</div>
  <section class="panel"><div class="panel-header"><div><h2>Recent appointment activity</h2><p>Review requests and update their status.</p></div><button class="btn btn-outline" data-go-tab="appointments">Manage all →</button></div>
  ${appointments.length ? appointmentTable(appointments.slice(0,5), true) : emptyState("No appointment activity", "Patient appointment requests will appear here.")}</section>
  <section class="panel"><div class="panel-header"><div><h2>User management</h2><p>Accounts registered on this demo platform.</p></div><span class="status-pill status-confirmed">${users.length} accounts</span></div>${userTable(users.slice(0,6))}</section>`;
}
function adminAppointmentsView(appointments) {
  return `<section class="panel"><div class="panel-header"><div><h2>Appointment management</h2><p>Review patient requests and update appointment status.</p></div></div>${appointments.length ? appointmentTable(appointments, true) : emptyState("No appointments", "Appointments will appear here when patients make requests.")}</section>`;
}
function userTable(users) {
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="status-pill ${u.role==="admin"?"status-confirmed":""}">${esc(u.role)}</span></td><td>${u.role==="admin" ? "—" : `<span class="user-table-actions"><button data-delete-user="${u.id}">Remove</button></span>`}</td></tr>`).join("")}</tbody></table></div>`;
}
function profileView() {
  return `<section class="panel"><div class="panel-header"><div><h2>My profile</h2><p>Your account details for this demo.</p></div></div><div class="profile-grid"><div class="profile-item"><small>Full name</small><b>${esc(currentUser.name)}</b></div><div class="profile-item"><small>Email address</small><b>${esc(currentUser.email)}</b></div><div class="profile-item"><small>Account role</small><b>${esc(currentUser.role)}</b></div><div class="profile-item"><small>Platform</small><b>Smart Healthcare Cloud</b></div></div><p class="demo-note">This is an academic prototype. Do not store real patient records or sensitive medical information.</p></section>`;
}
function wireDynamicControls() {
  document.querySelectorAll("[data-go-tab]").forEach(b => b.addEventListener("click", () => renderTab(b.dataset.goTab)));
  const form = $("appointmentForm");
  if (form) form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await api("/api/appointments", { method: "POST", body: data });
      showToast("Appointment request submitted.");
      renderTab(currentTab);
    } catch (err) { showToast(err.message); }
  });
  document.querySelectorAll("[data-status-id]").forEach(select => select.addEventListener("change", async () => {
    try {
      await api(`/api/appointments/${select.dataset.statusId}/status`, { method: "PATCH", body: { status: select.value } });
      showToast("Appointment status updated.");
      renderTab(currentTab);
    } catch (err) { showToast(err.message); }
  }));
  document.querySelectorAll("[data-delete-user]").forEach(button => button.addEventListener("click", async () => {
    if (!confirm("Remove this demo user and their appointments?")) return;
    try {
      await api(`/api/admin/users/${button.dataset.deleteUser}`, { method: "DELETE" });
      showToast("User removed.");
      renderTab(currentTab);
    } catch (err) { showToast(err.message); }
  }));
}
document.querySelectorAll("#showLogin,#heroLogin").forEach(b => b.addEventListener("click", () => showAuth("login")));
document.querySelectorAll("#showSignup,#heroSignup,#aboutSignup").forEach(b => b.addEventListener("click", () => showAuth("signup")));
$("switchMode").addEventListener("click", () => showAuth(authMode === "login" ? "signup" : "login"));
$("backHome").addEventListener("click", showHome);
$("brandHome").addEventListener("click", (e) => { e.preventDefault(); showHome(); });
$("menuToggle").addEventListener("click", () => $("topNav").classList.toggle("mobile-open"));
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorBox = $("formError");
  errorBox.classList.add("hidden");
  const formData = Object.fromEntries(new FormData(event.currentTarget).entries());
  try {
    const result = await api(authMode === "signup" ? "/api/signup" : "/api/login", { method: "POST", body: formData });
    currentUser = result.user;
    currentTab = "overview";
    showDashboard();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
});
document.querySelectorAll(".side-link[data-tab]").forEach(b => b.addEventListener("click", () => renderTab(b.dataset.tab)));
$("logoutBtn").addEventListener("click", async () => {
  try { await api("/api/logout", { method: "POST" }); } catch (_) {}
  currentUser = null;
  showHome();
  showToast("You have logged out.");
});
(async function init() {
  try {
    const result = await api("/api/me");
    if (result.user) { currentUser = result.user; showDashboard(); }
    else showHome();
  } catch (_) { showHome(); }
})();

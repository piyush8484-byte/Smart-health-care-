const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// TEMPORARY IN-MEMORY STORAGE: all users and appointments disappear when
// this Node.js process stops or restarts. No database is used.
const users = [];
const appointments = [];
let nextUserId = 1;
let nextAppointmentId = 1;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || "replace-this-local-demo-secret-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, "public")));

const userPublic = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please log in first." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

// Demo admin is kept in server memory and recreated whenever the server starts.
const adminEmail = "admin@healthcloud.local";
users.push({
  id: nextUserId++,
  name: "System Admin",
  email: adminEmail,
  password_hash: bcrypt.hashSync("Admin@123", 10),
  role: "admin",
  created_at: new Date().toISOString()
});

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  app: "Smart Healthcare Cloud",
  storage: "temporary in-memory (no database)"
}));

app.post("/api/signup", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2) return res.status(400).json({ error: "Enter your full name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (users.some(u => u.email === email)) return res.status(409).json({ error: "An account with this email already exists." });

  const user = {
    id: nextUserId++,
    name,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    role: "patient",
    created_at: new Date().toISOString()
  };
  users.push(user);
  req.session.user = userPublic(user);
  res.status(201).json({ user: req.session.user });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start a session." });
    req.session.user = userPublic(user);
    res.json({ user: req.session.user });
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ message: "Logged out." }));
});

app.get("/api/me", (req, res) => res.json({ user: req.session.user || null }));

app.get("/api/appointments", requireAuth, (req, res) => {
  const result = req.session.user.role === "admin"
    ? appointments.map(a => {
        const patient = users.find(u => u.id === a.patient_id);
        return { ...a, patient_name: patient ? patient.name : "Unknown", patient_email: patient ? patient.email : "" };
      }).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
    : appointments.filter(a => a.patient_id === req.session.user.id)
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
  res.json({ appointments: result });
});

app.post("/api/appointments", requireAuth, (req, res) => {
  if (req.session.user.role !== "patient") return res.status(403).json({ error: "Only patient accounts can book appointments." });
  const doctor = String(req.body.doctor || "").trim();
  const date = String(req.body.date || "").trim();
  const reason = String(req.body.reason || "").trim();
  if (!doctor || !date || !reason) return res.status(400).json({ error: "Complete all appointment fields." });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return res.status(400).json({ error: "Choose a valid appointment date and time." });
  }
  if (Date.parse(date) < Date.now()) return res.status(400).json({ error: "Appointment must be in the future." });

  const appointment = {
    id: nextAppointmentId++,
    patient_id: req.session.user.id,
    doctor_name: doctor,
    appointment_date: date,
    reason,
    status: "Pending",
    created_at: new Date().toISOString()
  };
  appointments.push(appointment);
  res.status(201).json({ appointment });
});

app.patch("/api/appointments/:id/status", requireAdmin, (req, res) => {
  const status = String(req.body.status || "");
  if (!["Pending", "Confirmed", "Completed", "Cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid appointment status." });
  }
  const appointment = appointments.find(a => a.id === Number(req.params.id));
  if (!appointment) return res.status(404).json({ error: "Appointment not found." });
  appointment.status = status;
  res.json({ message: "Appointment status updated." });
});

app.get("/api/admin/summary", requireAdmin, (_req, res) => {
  res.json({
    users: users.filter(u => u.role === "patient").length,
    appointments: appointments.length,
    pending: appointments.filter(a => a.status === "Pending").length
  });
});

app.get("/api/admin/users", requireAdmin, (_req, res) => {
  res.json({
    users: users.map(({ password_hash, ...u }) => u)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  });
});

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.user.id) return res.status(400).json({ error: "You cannot delete your own admin account." });
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: "User not found." });
  if (users[index].role === "admin") return res.status(403).json({ error: "Admin accounts cannot be deleted here." });
  users.splice(index, 1);
  for (let i = appointments.length - 1; i >= 0; i--) {
    if (appointments[i].patient_id === id) appointments.splice(i, 1);
  }
  res.json({ message: "User and their demo appointments deleted." });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Smart Healthcare Cloud running at http://localhost:${PORT}`);
  console.log("Temporary in-memory storage enabled. Data resets when the server restarts.");
  console.log("Demo admin: admin@healthcloud.local / Admin@123");
});

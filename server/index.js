//index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const PsychiatristModel = require("./Models/Psychiatrist");
const PatientModel = require("./Models/Patient");
const AppointmentModel = require("./Models/Appointment");
const LicenseRequestModel = require("./Models/License"); // unify model usage
const NotificationModel = require("./Models/Notification");
const AvailabilityModel = require("./Models/Availability");
const AnnouncementModel = require("./Models/Announcement");
const AnnouncementReceiptModel = require("./Models/AnnouncementReceipt");
const crypto = require("crypto");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch {
  nodemailer = null;
}
let sgMail;
try {
  sgMail = require("@sendgrid/mail");
} catch {
  sgMail = null;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());
const path = require("path");

app.use(cors());
app.use(express.json());


app.use('/api/patients', require('./routes/patients'));
app.use('/api/psychiatrists', require('./routes/psychiatrists'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/licenses', require('./routes/licenses'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/announcement-receipts', require('./routes/announcementReceipts'));

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/build')));

// Catch-all handler: send back React's index.html for any other requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});



// Database URI (prefer env on Render/Prod)
const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://Patient:rossjohn123@profelect5.mictope.mongodb.net/?appName=profelect5";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("[db] Connected to MongoDB"))
  .catch((err) => console.error("[db] Error connecting to MongoDB:", err));

// Root route and health for Render
app.get("/", (req, res) => {
  res.type("text/plain").send("Appointment System API is running");
});
app.get("/health", (req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

// (moved to bottom) serve built client when SERVE_CLIENT=1

const bcrypt = require("bcrypt");

// Modified Login endpoint with OTP verification
app.post("/login", async (req, res) => {
  try {
    const { email, password, role, otpVerified } = req.body;
    
    console.log('[Login] Attempt:', { email, role, hasPassword: !!password, otpVerified });

    // Validate inputs
    if (!email || !password) {
      console.error('[Login] Missing credentials');
      return res.status(400).json({ 
        status: "bad_request", 
        message: "Email and password are required" 
      });
    }

    // Find user in either collection
    let user = await PsychiatristModel.findOne({ email });
    let userType = 'Psychiatrist';
    
    if (!user) {
      user = await PatientModel.findOne({ email });
      userType = 'Patient';
    }

    if (!user) {
      console.error('[Login] User not found:', email);
      return res.json({ 
        status: "not_found", 
        message: "User not registered" 
      });
    }

    console.log('[Login] User found:', { 
      email, 
      userType, 
      userId: user._id,
      hasFirstName: !!user.firstName,
      hasLastName: !!user.lastName
    });

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.error('[Login] Password mismatch for:', email);
      return res.json({
        status: "wrong_password",
        message: "Password didn't match",
      });
    }

    // Verify role matches if provided
    if (role && role !== user.role) {
      console.error('[Login] Role mismatch:', { requested: role, actual: user.role });
      return res.status(403).json({
        status: "role_mismatch",
        message: "Selected role does not match this account",
      });
    }

    // **NEW: Check OTP verification for login**
    if (!otpVerified) {
      console.log('[Login] OTP verification required for:', email);
      return res.json({
        status: "otp_required",
        message: "OTP verification required",
        userId: user._id,
        role: user.role
      });
    }

    // **NEW: Verify OTP is actually verified in store**
    const emailRaw = String(email).trim().toLowerCase();
    const otpData = otpStore.get(emailRaw);
    
    if (!otpData || !otpData.verified || otpData.purpose !== 'login') {
      console.error('[Login] OTP not verified for:', email);
      return res.status(403).json({ 
        status: 'otp_not_verified',
        message: "Please verify your email with OTP before logging in"
      });
    }

    // Check if OTP expired
    if (Date.now() > otpData.expires) {
      otpStore.delete(emailRaw);
      console.error('[Login] OTP expired for:', email);
      return res.status(403).json({ 
        status: 'otp_expired',
        message: "Your OTP has expired. Please request a new one."
      });
    }

    // License verification for psychiatrists
    if (user.role === "Psychiatrist") {
      try {
        const emailSafe = String(user.email || "").trim();
        const re = new RegExp(
          `^${emailSafe.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`,
          "i"
        );
        
        const approved = await LicenseRequestModel.findOne({
          doctorEmail: re,
          status: "approved",
        });
        
        if (approved) {
          console.log('[Login] Psychiatrist has approved license');
        } else {
          const pending = await LicenseRequestModel.findOne({
            doctorEmail: re,
            status: "pending",
          });
          const rejected = await LicenseRequestModel.findOne({
            doctorEmail: re,
            status: "rejected",
          });
          
          if (pending) {
            console.error('[Login] Psychiatrist license pending:', email);
            return res.json({
              status: "invalid_license",
              message: "Your License Number is Pending",
            });
          }
          if (rejected) {
            console.error('[Login] Psychiatrist license rejected:', email);
            return res.json({
              status: "invalid_license",
              message: "License was rejected. Please update your license number in your profile.",
            });
          }
        }
      } catch (licenseErr) {
        console.error('[Login] License check error:', licenseErr);
        return res.status(500).json({
          status: "error",
          message: "Server error during license verification",
          details: licenseErr.message,
        });
      }
    }

    // **NEW: Clear OTP after successful login**
    otpStore.delete(emailRaw);
    console.log('[Login] OTP cleared for:', email);

    // Prepare safe user object (exclude password)
    const safeUser = user.toObject();
    delete safeUser.password;

    console.log('[Login] Login successful:', { 
      userId: user._id, 
      role: user.role,
      email: user.email,
      firstName: safeUser.firstName,
      lastName: safeUser.lastName
    });

    // Handle navigation logic
    if (user.role === 'Psychiatrist') {
      return res.json({
        status: "success",
        role: user.role,
        userId: user._id,
        user: safeUser,
        message: "Login successful",
        redirect: '/dashboard'
      });
    }

    // For patients, check profile completion
    try {
      const check = await axios.post(apiUrl('/patient/check-profile'), { email });
      if (check.data && check.data.complete) {
        return res.json({
          status: "success",
          role: user.role,
          userId: user._id,
          user: safeUser,
          message: "Login successful",
          redirect: '/PatientDashboard'
        });
      } else {
        return res.json({
          status: "success",
          role: user.role,
          userId: user._id,
          user: safeUser,
          message: "Login successful",
          redirect: '/PatientForm'
        });
      }
    } catch (_) {
      return res.json({
        status: "success",
        role: user.role,
        userId: user._id,
        user: safeUser,
        message: "Login successful",
        redirect: '/PatientForm'
      });
    }
  } catch (err) {
    console.error('[Login] Server error:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    return res.status(500).json({ 
      status: "error", 
      message: "Server error", 
      details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
  }
});

// Modified Sign Up endpoint with OTP verification
app.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, role, licenseNumber } = req.body;

  // Enhanced validation with detailed error messages
  if (!firstName || !lastName || !email || !password || !role) {
    const missing = [];
    if (!firstName) missing.push('firstName');
    if (!lastName) missing.push('lastName');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!role) missing.push('role');
    
    console.error('[Register] Missing required fields:', missing);
    return res.status(400).json({ 
      status: 'error',
      error: "Missing required fields",
      missingFields: missing
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('[Register] Invalid email format:', email);
    return res.status(400).json({ 
      status: 'error',
      error: "Invalid email format" 
    });
  }

  // **NEW: Check OTP verification**
  const emailRaw = String(email).trim().toLowerCase();
  const otpData = otpStore.get(emailRaw);
  
  if (!otpData || !otpData.verified) {
    console.error('[Register] OTP not verified for:', email);
    return res.status(403).json({ 
      status: 'otp_required',
      error: "Email verification required",
      message: "Please verify your email with OTP before registering"
    });
  }

  // Check if OTP expired
  if (Date.now() > otpData.expires) {
    otpStore.delete(emailRaw);
    console.error('[Register] OTP expired for:', email);
    return res.status(403).json({ 
      status: 'otp_expired',
      error: "OTP expired",
      message: "Your OTP has expired. Please request a new one."
    });
  }

  // License validation for psychiatrists
  let normalizedLicense = null;
  if (role === "Psychiatrist") {
    const supplied = String(licenseNumber || "").trim();
    if (!supplied) {
      console.error('[Register] License number missing for Psychiatrist');
      return res.status(400).json({
        status: "license_required",
        message: "License number is required for Psychiatrist registration",
      });
    }
    const pattern = /^\d{4}-\d{4}-\d{3}$/;
    if (!pattern.test(supplied)) {
      console.error('[Register] Invalid license format:', supplied);
      return res.status(400).json({
        status: "invalid_license_format",
        message: "Invalid License Format. Use: 1234-1234-123",
      });
    }
    normalizedLicense = supplied;
  }

  try {
    // Check if user already exists
    const existingPsych = await PsychiatristModel.findOne({ email });
    const existingPatient = await PatientModel.findOne({ email });
    
    if (existingPsych || existingPatient) {
      console.error('[Register] Email already registered:', email);
      return res.status(409).json({ 
        status: 'error',
        error: "Email already registered",
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (role === "Psychiatrist") {
      console.log('[Register] Creating Psychiatrist account:', { email, firstName, lastName });
      user = await PsychiatristModel.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
      });
      
      // Create pending license request
      if (normalizedLicense) {
        try {
          const existing = await LicenseRequestModel.findOne({
            doctorEmail: email,
            licenseNumber: normalizedLicense,
          });
          if (!existing) {
            const newReq = await LicenseRequestModel.create({
              doctorEmail: email,
              licenseNumber: normalizedLicense,
              status: "pending",
            });
            console.log('[Register] License request created:', newReq._id);
            try {
              sseBroadcast("license_request_pending", {
                id: newReq._id,
                doctorEmail: email,
                licenseNumber: normalizedLicense,
                createdAt: newReq.createdAt,
              });
            } catch (sseErr) {
              console.error('[Register] SSE broadcast failed:', sseErr.message);
            }
          }
        } catch (licenseErr) {
          if (licenseErr.code !== 11000) {
            console.error('[Register] License request creation error:', licenseErr);
          }
        }
      }
    } else if (role === "Patient") {
      console.log('[Register] Creating Patient account:', { email, firstName, lastName });
      user = await PatientModel.create({
        name: `${firstName} ${lastName}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password: hashedPassword,
        role,
      });
      console.log('[Register] Patient created successfully with firstName and lastName');
    } else {
      console.error('[Register] Invalid role provided:', role);
      return res.status(400).json({ 
        status: 'error',
        error: "Invalid role",
        message: "Role must be either 'Patient' or 'Psychiatrist'"
      });
    }

    // **NEW: Clear OTP after successful registration**
    otpStore.delete(emailRaw);
    console.log('[Register] OTP cleared for:', email);

    const safeUser = user.toObject();
    delete safeUser.password;

    console.log('[Register] Registration successful:', { 
      userId: user._id, 
      role, 
      email,
      hasFirstName: !!safeUser.firstName,
      hasLastName: !!safeUser.lastName
    });

    res.json({ 
      status: "success", 
      user: safeUser,
      message: "Account created successfully"
    });
  } catch (err) {
    console.error('[Register] Database error:', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name
    });
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(409).json({ 
        status: 'error',
        error: "Duplicate entry",
        message: "An account with this email already exists"
      });
    }
    
    res.status(500).json({ 
      status: 'error',
      error: "Error saving to database", 
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.get("/api/license/status", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email)
      return res
        .status(400)
        .json({ status: "bad_request", message: "email required" });

    const latest = await LicenseRequestModel.findOne({ doctorEmail: email }).sort({ createdAt: -1, updatedAt: -1 });
    const approved = await LicenseRequestModel.findOne({ doctorEmail: email, status: "approved" }).sort({ updatedAt: -1 });
    const pending = await LicenseRequestModel.findOne({ doctorEmail: email, status: "pending" }).sort({ createdAt: -1 });
    const rejected = await LicenseRequestModel.findOne({ doctorEmail: email, status: "rejected" }).sort({ updatedAt: -1 });

    return res.json({
      status: "success",
      license: latest || null,
      approved: approved || null,
      pending: pending || null,
      rejected: rejected || null,
    });
  } catch (err) {
    console.error("License status error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// New: submit/change license (creates new pending request even if previous approved exists)
app.post("/api/license/submit", async (req, res) => {
  try {
    const { email, licenseNumber } = req.body;
    if (!email || !licenseNumber)
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "email and licenseNumber required",
        });
    const pattern = /^\d{4}-\d{4}-\d{3}$/;
    const trimmed = String(licenseNumber).trim();
    if (!pattern.test(trimmed))
      return res
        .status(400)
        .json({
          status: "invalid_license_format",
          message: "Invalid License Format. Use: 1234-1234-123",
        });
    // Prevent duplicate pending for same license
    const existing = await LicenseRequestModel.findOne({
      doctorEmail: email,
      licenseNumber: trimmed,
    });
    if (existing) {
      if (existing.status === "pending")
        return res.json({ status: "already_pending", request: existing });
      if (existing.status === "approved")
        return res.json({ status: "already_approved", request: existing });
      // If rejected previously, allow resubmission as a fresh pending (create new doc with same license? Keep uniqueness constraint) -> replace rejected with pending
      if (existing.status === "rejected") {
        // Update status back to pending
        existing.status = "pending";
        existing.note = undefined;
        await existing.save();
        try {
          sseBroadcast("license_request_pending", {
            id: existing._id,
            doctorEmail: email,
            licenseNumber: trimmed,
            revived: true,
            createdAt: existing.createdAt,
          });
        } catch {}
        return res.json({ status: "revived_pending", request: existing });
      }
    }

    try {
      const newReq = await LicenseRequestModel.create({
        doctorEmail: email,
        licenseNumber: trimmed,
        status: "pending",
      });
      try {
        sseBroadcast("license_request_pending", {
          id: newReq._id,
          doctorEmail: email,
          licenseNumber: trimmed,
          createdAt: newReq.createdAt,
        });
      } catch {}
      return res.json({ status: "success", request: newReq });
    } catch (e) {
      if (e.code === 11000) {
        const dup = await LicenseRequestModel.findOne({
          doctorEmail: email,
          licenseNumber: trimmed,
        });
        return res.json({ status: "duplicate", request: dup });
      }
      console.error("Submit license error:", e);
      return res
        .status(500)
        .json({ status: "error", message: "Server error", details: e.message });
    }
  } catch (err) {
    console.error("Submit license error outer:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Patient Count in Doctor Dashboard
app.get("/api/patients/count", async (req, res) => {
  try {
    const count = await PatientModel.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("Error fetching patient count:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/appointments/stats", async (req, res) => {
  try {
    const now = new Date();
    const { doctorId } = req.query;

    const base = {};
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid doctorId" });
      }
      base.doctor = new mongoose.Types.ObjectId(doctorId);
    }

    const [approved, pending, completed] = await Promise.all([
      AppointmentModel.countDocuments({
        ...base,
        status: "approved",
        date: { $gte: now },
      }),
      AppointmentModel.countDocuments({
        ...base,
        status: "pending",
      }),
      AppointmentModel.countDocuments({
        ...base,
        status: "completed",
      }),
    ]);

    res.json({ approved, pending, completed, scopedByDoctor: !!doctorId });
  } catch (err) {
    console.error("Error fetching appointment stats:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/doctor/:doctorId/stats", async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const base = { doctor: new mongoose.Types.ObjectId(doctorId) };

    const [upcoming, pending, completed] = await Promise.all([
      AppointmentModel.countDocuments({
        ...base,
        status: "approved",
        date: { $gte: startOfToday },
      }),
      AppointmentModel.countDocuments({ ...base, status: "pending" }),
      AppointmentModel.countDocuments({ ...base, status: "completed" }),
    ]);

    return res.json({ status: "success", upcoming, pending, completed });
  } catch (err) {
    console.error("doctor stats error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Unique patient count for a doctor (based on any appointment with this doctor)
app.get("/api/doctor/:doctorId/patients/count", async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const ids = await AppointmentModel.distinct("patient", {
      doctor: new mongoose.Types.ObjectId(doctorId),
    });
    return res.json({ status: "success", count: ids.length });
  } catch (err) {
    console.error("doctor patients count error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.get("/api/doctor/:doctorId/appointments/active", async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const items = await AppointmentModel.find({
      doctor: new mongoose.Types.ObjectId(doctorId),
      status: { $in: ["pending", "approved"] },
    })
      .populate(
        "patient",
        "firstName lastName name email age gender contact profileImage"
      )
      .sort({ date: -1, updatedAt: -1 });

    return res.json({ status: "success", appointments: items });
  } catch (err) {
    console.error("List doctor active appointments error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Booking logs (completed + cancelled)
app.get("/api/doctor/:doctorId/appointments/logs", async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const items = await AppointmentModel.find({
      doctor: new mongoose.Types.ObjectId(doctorId),
      status: { $in: ["completed", "cancelled"] },
    })
      .populate(
        "patient",
        "firstName lastName name email age gender contact profileImage"
      )
      .sort({ date: -1, updatedAt: -1 });

    return res.json({ status: "success", appointments: items });
  } catch (err) {
    console.error("List doctor log appointments error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Get appointments for a specific doctor (optionally filter by status)
app.get("/api/doctor/:doctorId/appointments", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query; // pending | approved | completed | cancelled

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const query = { doctor: new mongoose.Types.ObjectId(doctorId) };
    if (status) {
      const allowed = ["pending", "approved", "completed", "cancelled"];
      if (!allowed.includes(String(status))) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid status filter" });
      }
      query.status = status;
    }

    const items = await AppointmentModel.find(query)
      .populate(
        "patient",
        "firstName lastName name email age gender contact profileImage"
      )
      .sort({ date: -1, updatedAt: -1 });

    return res.json({ status: "success", appointments: items });
  } catch (err) {
    console.error("List doctor appointments error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

function normalizeDateOnly(input) {
  // replaced below
  const d = new Date(input);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(min) {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function isValidRange(r) {
  return (
    /^\d{2}:\d{2}$/.test(r.start) &&
    /^\d{2}:\d{2}$/.test(r.end) &&
    toMinutes(r.end) > toMinutes(r.start)
  );
}

// Add a safe local parser for 'YYYY-MM-DD'
function parseYMDToLocalDate(ymd) {
  if (typeof ymd !== "string") return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayStartLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function nowHHMMLocal() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(
    n.getMinutes()
  ).padStart(2, "0")}`;
}

// Round up an HH:mm string to the next step minute (default: 5 mins)
function roundUpHHMM(hhmm, step = 5) {
  try {
    const mins = toMinutes(hhmm);
    const rounded = Math.ceil(mins / step) * step;
    // clamp to 23:59 max to keep within the day
    const capped = Math.min(rounded, 24 * 60 - 1);
    return fromMinutes(capped);
  } catch {
    return hhmm;
  }
}

app.get("/doctor/availability", async (req, res) => {
  try {
    const { email, date } = req.query;
    if (!email || !date) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "email and date are required",
        });
    }
    const doctor = await PsychiatristModel.findOne({ email });
    if (!doctor)
      return res
        .status(404)
        .json({ status: "not_found", message: "Doctor not found" });

    // Prevent doctors with pending or rejected license requests from setting availability
    try {
      const hasPending = await LicenseRequestModel.exists({ doctorEmail: doctor.email, status: 'pending' });
      const hasRejected = await LicenseRequestModel.exists({ doctorEmail: doctor.email, status: 'rejected' });
      if (hasPending || hasRejected) {
        return res.status(403).json({ status: 'license_blocked', message: 'Cannot set availability while license verification is pending or rejected.' });
      }
    } catch (e) {
      console.error('License check error during availability save:', e?.message || e);
    }

    const day = parseYMDToLocalDate(String(date));
    if (!day)
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid date" });

    const availability = await AvailabilityModel.findOne({
      doctor: doctor._id,
      date: day,
    });
    return res.json({ status: "success", availability: availability || null });
  } catch (err) {
    console.error("Get availability error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Save/replace availability for a given date (doctor identifies by email)
app.post("/doctor/availability", async (req, res) => {
  try {
    const { email, date, ranges } = req.body;
    if (!email || !date) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "email and date are required",
        });
    }
    if (!Array.isArray(ranges)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "ranges must be an array" });
    }

    // Validate ranges (if any provided)
    for (const r of ranges) {
      if (!isValidRange(r)) {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "Invalid time range(s). Ensure HH:mm and end > start.",
          });
      }
    }

    // Check for duplicates
    const seen = new Set();
    for (const r of ranges) {
      const key = `${r.start}-${r.end}`;
      if (seen.has(key)) {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "Duplicate time slots detected.",
          });
      }
      seen.add(key);
    }

    const doctor = await PsychiatristModel.findOne({ email });
    if (!doctor)
      return res
        .status(404)
        .json({ status: "not_found", message: "Doctor not found" });

    const day = parseYMDToLocalDate(date);
    if (!day)
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid date" });

    const startToday = todayStartLocal();
    if (day < startToday) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "Cannot set availability for past dates.",
        });
    }

    let finalRanges = ranges;
    
    // Only filter for past times if:
    // 1. The date is today AND
    // 2. There are actually ranges to filter
    if (day.getTime() === startToday.getTime() && ranges.length > 0) {
      const now = nowHHMMLocal();
      // Keep ranges that are not fully in the past
      finalRanges = ranges.filter((r) => r.end > now);
      
      // Only show error if there were ranges but ALL are in the past
      if (ranges.length > 0 && finalRanges.length === 0) {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "All time ranges are in the past for today.",
          });
      }
    }

    const doc = await AvailabilityModel.findOneAndUpdate(
      { doctor: doctor._id, date: day },
      { doctor: doctor._id, date: day, ranges: finalRanges },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ status: "success", availability: doc });
  } catch (err) {
    console.error("Save availability error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Bulk save/replace availability for multiple dates
app.post("/doctor/availability/bulk", async (req, res) => {
  try {
    const { email, dates, ranges } = req.body;
    if (!email || !Array.isArray(dates) || !Array.isArray(ranges)) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "email, dates and ranges are required",
        });
    }

    // Validate ranges
    for (const r of ranges) {
      if (!isValidRange(r)) {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "Invalid time range(s). Ensure HH:mm and end > start.",
          });
      }
    }

    // Check for duplicates
    const seen = new Set();
    for (const r of ranges) {
      const key = `${r.start}-${r.end}`;
      if (seen.has(key)) {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "Duplicate time slots detected.",
          });
      }
      seen.add(key);
    }

    const doctor = await PsychiatristModel.findOne({ email });
    if (!doctor)
      return res
        .status(404)
        .json({ status: "not_found", message: "Doctor not found" });

    const startToday = todayStartLocal();
    const now = nowHHMMLocal();
    let updated = 0;

    for (const ymd of dates) {
      const day = parseYMDToLocalDate(ymd);
      if (!day || day < startToday) continue;

      let dayRanges = ranges;
      if (day.getTime() === startToday.getTime()) {
        dayRanges = ranges.filter((r) => r.end > now);
        if (!dayRanges.length) continue;
      }

      await AvailabilityModel.findOneAndUpdate(
        { doctor: doctor._id, date: day },
        { doctor: doctor._id, date: day, ranges: dayRanges },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updated++;
    }

    return res.json({ status: "success", updated });
  } catch (err) {
    console.error("Bulk availability error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.get("/api/doctor/:doctorId/available-slots", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, slot, as } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }
    if (!date) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "date is required (YYYY-MM-DD)",
        });
    }

    const day = parseYMDToLocalDate(String(date));
    if (!day) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid date format" });
    }

    const availability = await AvailabilityModel.findOne({
      doctor: new mongoose.Types.ObjectId(doctorId),
      date: day,
    });

    if (
      !availability ||
      !Array.isArray(availability.ranges) ||
      availability.ranges.length === 0
    ) {
      // return empty for both modes
      return res.json({ status: "success", slots: [], ranges: [] });
    }

    // Find already booked starts for that day (pending/approved)
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const booked = await AppointmentModel.find({
      doctor: new mongoose.Types.ObjectId(doctorId),
      status: { $in: ["pending", "approved"] },
      date: { $gte: day, $lt: nextDay },
    }).select("date");

    const bookedSet = new Set(
      booked.map((b) => {
        const d = new Date(b.date);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      })
    );

    // If the client asks for ranges, return only the unbooked ranges (by start time)
    if (String(as) === "ranges") {
      const startToday = todayStartLocal();
      const now = nowHHMMLocal();
      const nowRounded = roundUpHHMM(now, 5);

      const ranges = availability.ranges
        .filter((r) => isValidRange(r))
        .map((r) => {
          // For today, trim partially past ranges so they start at the next rounded minute
          if (day.getTime() === startToday.getTime()) {
            if (r.end <= nowRounded) return null; // fully past
            if (r.start < nowRounded) {
              return { ...r, start: nowRounded };
            }
          }
          return r;
        })
        .filter(Boolean)
        // exclude ranges whose start is already booked
        .filter((r) => !bookedSet.has(r.start));

      return res.json({ status: "success", ranges });
    }

    // Default behavior (legacy): generate split slots
    const slotLen = Math.min(Math.max(parseInt(slot, 10) || 60, 5), 240);
    const candidates = [];
    for (const r of availability.ranges) {
      if (!isValidRange(r)) continue;
      let startM = toMinutes(r.start);
      const endM = toMinutes(r.end);
      while (startM + slotLen <= endM) {
        candidates.push(fromMinutes(startM));
        startM += slotLen;
      }
    }

    const startToday = todayStartLocal();
    let filtered = candidates;
    if (day.getTime() === startToday.getTime()) {
      const now = nowHHMMLocal();
      filtered = candidates.filter((t) => t > now);
    }

    const slots = filtered.filter((t) => !bookedSet.has(t));
    return res.json({ status: "success", slots });
  } catch (err) {
    console.error("available-slots error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// List appointments in PDashboard
app.get("/api/appointments", async (req, res) => {
  try {
    const { patientId, patientEmail, status } = req.query;
    const query = {};

    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid patientId" });
      }
      query.patient = new mongoose.Types.ObjectId(patientId);
    } else if (patientEmail) {
      const patient = await PatientModel.findOne({ email: patientEmail });
      if (!patient)
        return res
          .status(404)
          .json({ status: "not_found", message: "Patient not found" });
      query.patient = patient._id;
    }

    if (status) {
      const statuses = String(status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length) query.status = { $in: statuses };
    } else {
      // default to active bookings
      query.status = { $in: ["pending", "approved"] };
    }

    const items = await AppointmentModel.find(query)
      // include essential doctor fields so patient details can render immediately without extra fetches
      .populate(
        "doctor",
        "firstName lastName email contact fees role profileImage specialty experience"
      )
      .populate("patient", "firstName lastName name email profileImage")
      .sort({ date: -1, updatedAt: -1 });

    return res.json({ status: "success", appointments: items });
  } catch (err) {
    console.error("List appointments error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Create an appointment (Patient books an appointment with a doctor)
app.post("/api/appointments", async (req, res) => {
  try {
    const {
      doctorId,
      patientEmail,
      date,
      notes,
      localYMD, // 'YYYY-MM-DD'
      timeHHMM, // 'HH:mm'
    } = req.body;

    if (!doctorId || !patientEmail || (!date && !(localYMD && timeHHMM))) {
      return res.status(400).json({
        status: "bad_request",
        message:
          "doctorId, patientEmail and appointment date/time are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }

    const [doctor, patient] = await Promise.all([
      PsychiatristModel.findById(doctorId),
      PatientModel.findOne({ email: patientEmail }),
    ]);

    if (!doctor)
      return res
        .status(404)
        .json({ status: "not_found", message: "Doctor not found" });
    if (!patient)
      return res
        .status(404)
        .json({ status: "not_found", message: "Patient not found" });

    // Block booking when doctor has a pending or rejected license request
    try {
      const hasPending = await LicenseRequestModel.exists({ doctorEmail: doctor.email, status: 'pending' });
      const hasRejected = await LicenseRequestModel.exists({ doctorEmail: doctor.email, status: 'rejected' });
      if (hasPending || hasRejected) {
        return res.status(403).json({
          status: 'license_blocked',
          message: 'Doctor is not accepting bookings while license verification is pending or rejected.'
        });
      }
    } catch (e) {
      // don't fail booking on license-check errors; log and continue
      console.error('License check error during booking:', e?.message || e);
    }

    // Build appointment Date in LOCAL time (no unintended offsets)
    let appointmentDate = null;
    if (localYMD && timeHHMM) {
      const base = parseYMDToLocalDate(localYMD);
      const [h, m] = String(timeHHMM).split(":").map(Number);
      if (!base || Number.isNaN(h) || Number.isNaN(m)) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid local date/time" });
      }
      base.setHours(h, m, 0, 0);
      appointmentDate = base;
    } else {
      // fallback to legacy ISO string if still used by any client
      const iso = new Date(date);
      if (isNaN(iso)) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid appointment date" });
      }
      appointmentDate = iso;
    }

    const now = new Date();
    if (appointmentDate < now) {
      return res.status(400).json({
        status: "past_date",
        message: "You cannot book a past date/time.",
      });
    }

    // Limit active bookings with this doctor
    const activeWithThisDoctor = await AppointmentModel.countDocuments({
      doctor: doctor._id,
      patient: patient._id,
      status: { $in: ["pending", "approved"] },
    });
    if (activeWithThisDoctor >= 5) {
      return res.status(409).json({
        status: "limit_reached",
        message: "You can have up to 5 active bookings with this doctor.",
      });
    }

    // Prevent booking an already taken 30-min start slot
    const slotTaken = await AppointmentModel.exists({
      doctor: doctor._id,
      date: appointmentDate,
      status: { $in: ["pending", "approved"] },
    });
    if (slotTaken) {
      return res
        .status(409)
        .json({
          status: "conflict",
          message: "This time slot is not available.",
        });
    }

    const appt = await AppointmentModel.create({
      doctor: doctor._id,
      patient: patient._id,
      date: appointmentDate,
      status: "pending",
      notes: notes || "",
    });

    const populated = await AppointmentModel.findById(appt._id)
      .populate("patient", "firstName lastName name email age gender contact")
      // include contact/fees/specialty/experience so PatientAppDetails has full info on redirect
      .populate(
        "doctor",
        "firstName lastName email contact fees role profileImage specialty experience"
      );

    // Save and broadcast SSE notification for doctors
    try {
      const patientName =
        populated?.patient?.name ||
        `${populated?.patient?.firstName || ""} ${
          populated?.patient?.lastName || ""
        }`.trim();
      const text = `New appointment from ${
        patientName || populated?.patient?.email || "a patient"
      }`;
      const notif = await NotificationModel.create({
        userType: "doctor",
        userId: doctor._id,
        type: "appointment_booked",
        apptId: appt._id,
        doctorId: doctor._id,
        patientId: patient._id,
        text,
        read: false,
        hidden: false,
        meta: { date: populated?.date },
      });
      sseBroadcast("appointment_booked", {
        notifId: String(notif._id),
        apptId: String(appt._id),
        doctorId: String(doctor._id),
        patient: { name: patientName, email: populated?.patient?.email },
        date: populated?.date,
        status: populated?.status || "pending",
      });
    } catch {}

    return res.json({ status: "success", appointment: populated });
  } catch (err) {
    console.error("Create appointment error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.get("/api/appointments/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write("retry: 10000\n\n");
  sseClients.add(res);

  const timer = setInterval(() => {
    try {
      res.write("event: ping\ndata: {}\n\n");
    } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(timer);
    sseClients.delete(res);
  });
});

// Get appointment by id (populated)
app.get("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid appointment id" });
    }

    const appt = await AppointmentModel.findById(id)
      .populate(
        "patient",
        "firstName lastName name email age gender contact hmoNumber hmoCardImage"
      )
      // include about/experience/education so clients can show full profile
      .populate(
        "doctor",
        "firstName lastName email contact fees role profileImage specialty experience education about address1 address2"
      );

    if (!appt)
      return res
        .status(404)
        .json({ status: "not_found", message: "Appointment not found" });

    return res.json({ status: "success", appointment: appt });
  } catch (err) {
    console.error("Get appointment error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Update appointment status or notes
app.patch("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let { status, notes, cancelledBy } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid appointment id" });
    }

    const update = {};
    if (status !== undefined) {
      status = String(status).toLowerCase();
      const allowed = ["pending", "approved", "completed", "cancelled"];
      if (!allowed.includes(status)) {
        return res
          .status(400)
          .json({ status: "bad_request", message: "Invalid status value" });
      }
      update.status = status;
    }
    if (notes !== undefined) update.notes = notes;

    if (Object.keys(update).length === 0) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Nothing to update" });
    }

    // Load current appointment so we can validate doctor license when approving
    const currentAppt = await AppointmentModel.findById(id);
    if (!currentAppt)
      return res
        .status(404)
        .json({ status: "not_found", message: "Appointment not found" });

    // If attempting to approve the appointment, ensure the doctor is allowed to approve (no pending/rejected license)
    if (String(update.status) === 'approved') {
      try {
        const doc = await PsychiatristModel.findById(currentAppt.doctor);
        const hasPending = await LicenseRequestModel.exists({ doctorEmail: doc?.email, status: 'pending' });
        const hasRejected = await LicenseRequestModel.exists({ doctorEmail: doc?.email, status: 'rejected' });
        if (hasPending || hasRejected) {
          return res.status(403).json({ status: 'license_blocked', message: 'Doctor cannot approve appointments while license verification is pending or rejected.' });
        }
      } catch (e) {
        console.error('License check error during appointment approval:', e?.message || e);
      }
    }

    const updated = await AppointmentModel.findByIdAndUpdate(id, update, {
      new: true,
    })
      .populate("patient", "firstName lastName name email")
      .populate("doctor", "firstName lastName email");

    // Save and broadcast status change to patient
    try {
      const doctorName = `${updated.doctor?.firstName || ""} ${
        updated.doctor?.lastName || ""
      }`.trim();
      let text = "Appointment update";
      if (updated.status === "approved")
        text = `Doctor ${doctorName} approved your appointment`;
      else if (updated.status === "cancelled") {
        // Check who cancelled the appointment
        if (cancelledBy === "patient") {
          text = `You cancelled your appointment with Dr. ${doctorName}`;
        } else {
          text = `Doctor ${doctorName} declined your appointment`;
        }
      } else if (updated.status === "pending")
        text = `Your appointment is pending`;
      else if (updated.status === "completed")
        text = `Your appointment was completed`;

      const notif = await NotificationModel.create({
        userType: "patient",
        userId: updated.patient?._id,
        email: updated.patient?.email,
        type: "appointment_status",
        apptId: updated._id,
        doctorId: updated.doctor?._id,
        patientId: updated.patient?._id,
        text,
        read: false,
        hidden: false,
        meta: { status: updated.status, cancelledBy },
      });

      sseBroadcast("appointment_status", {
        notifId: String(notif._id),
        apptId: String(updated._id),
        status: updated.status,
        doctorId: String(updated.doctor?._id || ""),
        doctorName,
        patientId: String(updated.patient?._id || ""),
        patientEmail: updated.patient?.email || "",
        cancelledBy,
        at: new Date().toISOString(),
      });
    } catch {}

    return res.json({ status: "success", appointment: updated });
  } catch (err) {
    console.error("Update appointment error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Delete an appointment (used for removing completed/cancelled logs)
app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid appointment id" });
    }
    const appt = await AppointmentModel.findById(id);
    if (!appt)
      return res
        .status(404)
        .json({ status: "not_found", message: "Appointment not found" });
    // Only allow deleting non-active logs
    const s = String(appt.status || "").toLowerCase();
    if (s !== "completed" && s !== "cancelled") {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "Only completed or cancelled appointments can be deleted",
        });
    }
    await AppointmentModel.findByIdAndDelete(id);
    return res.json({ status: "success" });
  } catch (err) {
    console.error("Delete appointment error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Save/Update Patient Profile Form
app.post("/patient/profile", async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      birthday,
      age,
      gender,
      contact,
      address,
      medicalHistory,
      hmoNumber,
      emergencyName,
      emergencyContact,
      emergencyAddress,
      hmoCardImage,
      profileImage,
    } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email is required" });
    }

    // build update object cleanly
    const update = {
      firstName,
      lastName,
      birthday,
      age,
      gender,
      contact,
      address,
      medicalHistory,
      hmoNumber,
      emergencyName,
      emergencyContact,
      emergencyAddress,
      hmoCardImage,
      profileImage,
    };

    // filter out undefined values to avoid overwriting existing data
    Object.keys(update).forEach(
      (key) => update[key] === undefined && delete update[key]
    );

    // ensure name field (for compatibility)
    if (firstName && lastName) update.name = `${firstName} ${lastName}`;

    // find by email and update or create if not found
    const updatedPatient = await PatientModel.findOneAndUpdate(
      { email },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ status: "success", patient: updatedPatient });
  } catch (err) {
    console.error("Profile save error:", err);
    res.status(500).json({
      status: "error",
      message: "Error saving profile",
      details: err.message,
    });
  }
});

// Import/save anonymous preâ€‘assessment into a patient's profile
app.post("/patient/pre-assessment", async (req, res) => {
  try {
    const { email, data } = req.body || {};
    if (!email || !data) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "email and data are required",
        });
    }
    const patient = await PatientModel.findOne({ email });
    if (!patient)
      return res
        .status(404)
        .json({ status: "not_found", message: "Patient not found" });

    const pct = Number(data.percentage);
    const interp = data.interpretation || {};
    const safe = {
      percentage: Number.isFinite(pct)
        ? Math.max(0, Math.min(100, Math.round(pct)))
        : 0,
      interpretation: {
        range: String(interp.range || ""),
        label: String(interp.label || ""),
      },
      answers:
        typeof data.answers === "object" && data.answers ? data.answers : {},
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      version: Number.isFinite(Number(data.version)) ? Number(data.version) : 1,
    };

    patient.preAssessment = safe;
    await patient.save();
    return res.json({
      status: "success",
      preAssessment: patient.preAssessment,
    });
  } catch (err) {
    console.error("Save pre-assessment error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.post("/patient/check-profile", async (req, res) => {
  try {
    const { email } = req.body;
    const patient = await PatientModel.findOne({ email });
    if (!patient) {
      return res.json({ complete: false });
    }
    // check if all required details are filled
    const isComplete =
      patient.name &&
      patient.age &&
      patient.gender &&
      patient.contact &&
      patient.address &&
      patient.emergencyName &&
      patient.emergencyContact &&
      patient.emergencyAddress;
    res.json({ complete: !!isComplete });
  } catch (err) {
    res.status(500).json({ complete: false, error: err.message });
  }
});

// check if patient already filled patient form
app.post("/patient/get-profile", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const patient = await PatientModel.findOne({ email });
    res.json({ patient: patient || null });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/doctor/get-profile", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const doctor = await PsychiatristModel.findOne({ email });
    // return contact as stored (may include country code like +64 22xxxxxxx)
    res.json({ doctor: doctor || null });
  } catch (err) {
    console.error("Get doctor profile error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update doctor profile
app.post("/doctor/profile", async (req, res) => {
  try {
    const {
      email,
      firstName,
      lastName,
      fees,
      licenseNumber,
      experience,
      specialty,
      education,
      about,
      address1,
      contact,
      profileImage,
    } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Email required to update profile" });
    }

    // Normalize contact to keep "+", digits and spaces only, and collapse multiple spaces
    const normalizedContact = String(contact ?? "")
      .replace(/[^\d+ ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Do NOT persist a newly submitted licenseNumber on the Psychiatrist profile until it is approved by an admin.
    // This keeps the authoritative approved license in the LicenseRequest collection and avoids showing unapproved
    // licenses on the public profile. Other fields are safe to update immediately.
    const updatedDoctor = await PsychiatristModel.findOneAndUpdate(
      { email },
      {
        firstName,
        lastName,
        fees,
        experience,
        specialty,
        education,
        about,
        address1,
        // Persist in international format, e.g., "+64 221234567"
        contact: normalizedContact,
        profileImage,
      },
      { new: true, upsert: true }
    );

    // If a licenseNumber was supplied, create or revive a pending LicenseRequest so admins can review it
    let createdLicenseRequest = null;
    try {
      if (licenseNumber && String(licenseNumber || '').trim()) {
        const trimmed = String(licenseNumber).trim();
        const pattern = /^\d{4}-\d{4}-\d{3}$/;
        // Only auto-submit to license requests when format looks valid
        if (pattern.test(trimmed)) {
          try {
            const existing = await LicenseRequestModel.findOne({
              doctorEmail: email,
              licenseNumber: trimmed,
            });
            if (existing) {
              if (existing.status === 'rejected') {
                existing.status = 'pending';
                existing.note = undefined;
                await existing.save();
                createdLicenseRequest = existing;
              } else {
                // pending or approved: return the existing document for client convenience
                createdLicenseRequest = existing;
              }
            } else {
              createdLicenseRequest = await LicenseRequestModel.create({
                doctorEmail: email,
                licenseNumber: trimmed,
                status: 'pending',
              });
            }

            // Broadcast SSE for admins when a new pending request is created or revived
            try {
              if (createdLicenseRequest && createdLicenseRequest.status === 'pending') {
                sseBroadcast('license_request_pending', {
                  id: createdLicenseRequest._id,
                  doctorEmail: email,
                  licenseNumber: createdLicenseRequest.licenseNumber,
                  createdAt: createdLicenseRequest.createdAt,
                });
              }
            } catch (e) {}
          } catch (e) {
            // don't fail the whole profile update if license request handling errors
            console.error('License request create on profile update error:', e?.message || e);
          }
        }
      }
    } catch (e) {}

    res.json({ status: "success", doctor: updatedDoctor, licenseRequest: createdLicenseRequest });
  } catch (err) {
    console.error("Update doctor profile error:", err);
    res
      .status(500)
      .json({
        status: "error",
        message: "Error updating profile",
        details: err.message,
      });
  }
});

// Toggle doctor listed status (Decision post for public doctor lists)
app.post("/doctor/listed", async (req, res) => {
  try {
    const { email, listed } = req.body;
    if (!email) return res.status(400).json({ status: 'bad_request', message: 'email required' });
    // Accept explicit boolean listed; if missing, toggle current value
    const doc = await PsychiatristModel.findOne({ email });
    if (!doc) return res.status(404).json({ status: 'not_found', message: 'Doctor not found' });

    let newListed;
    if (typeof listed === 'boolean') newListed = listed;
    else newListed = !doc.listed;

    doc.listed = newListed;
    await doc.save();

    const safe = doc.toObject();
    delete safe.password;
    return res.json({ status: 'success', doctor: safe });
  } catch (err) {
    console.error('Error toggling doctor listed status:', err);
    return res.status(500).json({ status: 'error', message: 'Server error', details: err.message });
  }
});

// doctors list
app.get("/api/doctors", async (req, res) => {
  try {
    // Only return psychiatrists who opted-in (listed: true)
    const doctors = await PsychiatristModel.find({ listed: true }, { password: 0 }); // exclude passwords
    res.json(doctors);
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Error fetching doctors" });
  }
});

// Simple in-memory cache object (resets on process restart)
const _memoryCache = {
  doctorsWithRatings: {
    data: null,
    expiresAt: 0,
  },
};

// doctors list with average rating and count (computed from Appointment documents)
app.get("/api/doctors/with-ratings", async (req, res) => {
  try {
    const { limit, specialty, minimal = 'false' } = req.query;
    const shouldMinimal = minimal === 'true';

    // Use aggregation for better performance
    // Apply an early $match to only include doctors who opted-in (listed: true).
    // If `specialty` is provided, include it in the same early $match to reduce work.
    const matchStage = { listed: true };
    if (specialty) {
      matchStage.specialty = new RegExp(`^${String(specialty).trim()}$`, 'i');
    }

    const aggregation = [
      { $match: matchStage },
      // Lookup ratings in a single query
      {
        $lookup: {
          from: 'appointments',
          let: { doctorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$doctor', '$$doctorId'] },
                rating: { $exists: true, $ne: null }
              }
            },
            {
              $group: {
                _id: '$doctor',
                avgRating: { $avg: '$rating' },
                ratingCount: { $sum: 1 }
              }
            }
          ],
          as: 'ratings'
        }
      },
      // Unwind and project ratings
      {
        $unwind: {
          path: '$ratings',
          preserveNullAndEmptyArrays: true
        }
      },
      // Project only necessary fields
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          specialty: 1,
          fees: 1,
          profileImage: 1,
          experience: 1,
          about: 1,
          listed: 1,
          avgRating: { $ifNull: ['$ratings.avgRating', null] },
          ratingCount: { $ifNull: ['$ratings.ratingCount', 0] },
          // Only include these if not minimal
          ...(shouldMinimal ? {} : {
            contact: 1,
            education: 1,
            address1: 1
          })
        }
      },
      // Note: specialty already applied in the initial $matchStage when provided
    ];

  // Execute aggregation
  let doctors = await PsychiatristModel.aggregate(aggregation);

  // Filter out doctors who haven't opted-in (listed flag). We used aggregation earlier,
  // and `listed` was projected only if present. To be safe, only include documents where listed === true
  doctors = doctors.filter((d) => d.listed === true);

    // Apply limit after aggregation for better performance
    const lim = Math.max(0, Math.min(parseInt(limit, 10) || 0, 500));
    if (lim > 0) {
      doctors = doctors.slice(0, lim);
    }

    return res.json({ 
      status: "success", 
      doctors,
      count: doctors.length 
    });
  } catch (err) {
    console.error("Error fetching doctors with ratings:", err);
    return res.status(500).json({ 
      status: "error", 
      message: "Server error", 
      details: err.message 
    });
  }
});

// Recent patients for a doctor (from completed appointments)
app.get("/api/patients/recent", async (req, res) => {
  try {
    const { doctorId, limit = "6" } = req.query;
    if (!doctorId) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "doctorId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid doctorId" });
    }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 24);

    const items = await AppointmentModel.aggregate([
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          status: { $in: ["completed", "Completed"] },
        },
      },
      { $sort: { date: -1, updatedAt: -1 } },
      {
        $group: {
          _id: "$patient",
          lastAppointmentDate: { $first: "$date" },
        },
      },
      { $sort: { lastAppointmentDate: -1 } },
      { $limit: lim },
      {
        $lookup: {
          from: "patients",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $project: {
          _id: 0,
          patientId: "$_id",
          firstName: "$patient.firstName",
          lastName: "$patient.lastName",
          email: "$patient.email",
          lastAppointmentDate: 1,
        },
      },
    ]);

    return res.json({ status: "success", patients: items });
  } catch (err) {
    console.error("recent patients error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// List license verification requests (default: pending)
app.get("/api/license-requests", async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const allowed = ["pending", "approved", "rejected"];
    if (!allowed.includes(String(status))) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid status filter" });
    }
    const items = await LicenseRequestModel.find({ status }).sort({
      createdAt: -1,
    });
    return res.json({ status: "success", requests: items });
  } catch (err) {
    console.error("List license requests error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Approve/Reject a request
app.patch("/api/license-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid request id" });
    }
    const allowed = ["approved", "rejected"];
    if (!allowed.includes(String(status))) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid status value" });
    }

    // Load the request we are updating first to know the doctor context
    const reqDoc = await LicenseRequestModel.findById(id);
    if (!reqDoc) {
      return res
        .status(404)
        .json({ status: "not_found", message: "License request not found" });
    }

    let autoRevoked = 0;
    if (status === "approved") {
      // Ensure only ONE approved license per doctorEmail at any time
      const revokeNote = `Auto-revoked on ${new Date().toISOString()} in favor of ${
        reqDoc.licenseNumber
      }`;
      const revokeRes = await LicenseRequestModel.updateMany(
        {
          doctorEmail: reqDoc.doctorEmail,
          status: "approved",
          _id: { $ne: reqDoc._id },
        },
        { $set: { status: "rejected", note: revokeNote } }
      );
      autoRevoked = revokeRes?.modifiedCount || 0;
    }

    const updated = await LicenseRequestModel.findByIdAndUpdate(
      id,
      { status, ...(note !== undefined ? { note } : {}) },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        status: "not_found",
        message: "License request not found",
      });
    }

    // If this request was approved, persist the approved license into the Psychiatrist profile
    try {
      if (String(updated.status) === 'approved' && reqDoc?.doctorEmail) {
        await PsychiatristModel.findOneAndUpdate(
          { email: reqDoc.doctorEmail },
          { licenseNumber: updated.licenseNumber || String(reqDoc.licenseNumber || '') },
          { new: true }
        );
      }
    } catch (e) {
      console.error('Failed to write approved license to psychiatrist profile:', e?.message || e);
    }

    return res.json({
      status: "success",
      request: updated,
      autoRevoked,
    });
  } catch (err) {
    console.error("Update license request error:", err);
    return res.status(500).json({
      status: "error",
      message: "Server error",
      details: err.message,
    });
  }
});

// Delete a license request (admin action)
app.delete('/api/license-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'bad_request', message: 'Invalid request id' });
    }
    const del = await LicenseRequestModel.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ status: 'not_found', message: 'License request not found' });
    return res.json({ status: 'success' });
  } catch (err) {
    console.error('Delete license request error:', err);
    return res.status(500).json({ status: 'error', message: 'Server error', details: err.message });
  }
});

// add or remove a doctor from patient's favorites
app.post("/patient/favorites", async (req, res) => {
  try {
    const { email, doctorId, action } = req.body;

    if (!email || !doctorId) {
      return res
        .status(400)
        .json({ status: "error", message: "email and doctorId are required" });
    }

    const patient = await PatientModel.findOne({ email });
    if (!patient) {
      return res
        .status(404)
        .json({ status: "error", message: "Patient not found" });
    }

    // what to do if favorites is missing
    if (!Array.isArray(patient.favorites)) patient.favorites = [];

    if (action === "add") {
      if (
        !patient.favorites.find((id) => id.toString() === doctorId.toString())
      ) {
        patient.favorites.push(doctorId);
      }
    } else if (action === "remove") {
      patient.favorites = patient.favorites.filter(
        (id) => id.toString() !== doctorId.toString()
      );
    } else {
      return res
        .status(400)
        .json({
          status: "error",
          message: 'Invalid action. Use "add" or "remove"',
        });
    }

    await patient.save();

    return res.json({ status: "success", favorites: patient.favorites });
  } catch (err) {
    console.error("Favorites update error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// -------- Password reset (forgot password) --------
function buildAppBaseUrl(req) {
  const origin = req.headers.origin || "";
  if (origin) return origin; // e.g., http://localhost:5173
  // fallback to localhost client default
  return "http://localhost:5173";
}

function buildAppBaseUrl(req) {
  // Normalize to avoid double slashes when composing links
  const raw =
    process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
  return String(raw).replace(/\/+$/, "");
}

async function getMailerTransport() {
  if (!nodemailer) throw new Error("nodemailer not installed");

  // Preferred in PaaS: SendGrid HTTP API (avoids blocked SMTP ports)
  if (process.env.SENDGRID_API_KEY) {
    if (!sgMail)
      throw new Error(
        "SENDGRID_API_KEY is set but @sendgrid/mail is not installed"
      );
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("[mailer] Using SendGrid via HTTP API");
    // Return a minimal nodemailer-like wrapper so existing code can call sendMail
    return {
      sendMail: async ({ from, to, subject, text, html }) => {
        const msg = {
          to,
          from: from || process.env.MAIL_FROM || process.env.SMTP_USER,
          subject,
          text,
          html,
        };
        const [resp] = await sgMail.send(msg);
        return { messageId: resp?.headers?.["x-message-id"] || "sendgrid" };
      },
    };
  }

  // SMTP path (may be blocked on some hosts)
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const port = Number(SMTP_PORT) || 587;
    const secure = port === 465;
    const user = String(SMTP_USER).trim();
    const pass = String(SMTP_PASS).replace(/\s+/g, "").trim();
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });
    try {
      await transport.verify();
      const masked = user.replace(/(.{2}).+(@.*)/, "$1***$2");
      console.log(
        "[mailer] Using SMTP transport:",
        SMTP_HOST,
        "port",
        port,
        "secure",
        secure,
        "user",
        masked
      );
    } catch (e) {
      console.error("[mailer] SMTP verify failed:", e.response || e.message);
    }
    return transport;
  }

  // Dev fallback: Ethereal
  const test = await nodemailer.createTestAccount();
  console.log("[mailer] Using Ethereal dev inbox");
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: test.user, pass: test.pass },
  });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Request password reset (always respond success to avoid account enumeration)
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const emailRaw = (req.body?.email || "").trim();
    if (!emailRaw) return res.json({ status: "success" });

    // Find user in either collection
    const ci = new RegExp(`^${escapeRegex(emailRaw)}$`, "i");
    let user = await PsychiatristModel.findOne({ email: ci });
    let userType = "psych";
    if (!user) {
      user = await PatientModel.findOne({ email: ci });
      userType = "patient";
    }
    if (!user) return res.json({ status: "success" });

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    user.resetTokenHash = hash;
    user.resetTokenExpires = expires;
    await user.save();

    // Build link now
    const base = buildAppBaseUrl(req);
    const link = `${base}/reset-password?token=${token}`;

    // Respond immediately so UI doesn't hang even if mailer is slow
    res.json({ status: "success" });

    // Fire-and-forget email sending to avoid blocking response
    setImmediate(async () => {
      try {
        const transport = await getMailerTransport();
        const info = await transport.sendMail({
          from:
            process.env.MAIL_FROM ||
            process.env.SMTP_USER ||
            "no-reply@telepsychiatrist.local",
          to: emailRaw,
          subject: "Password reset instructions",
          text: `You requested a password reset. Use the link below within 15 minutes.\n\n${link}\n\nIf you did not request this, ignore this message.`,
          html: `<p>You requested a password reset.</p><p><a href="${link}">Reset your password</a> (valid for 15 minutes)</p><p>If you didn't request this, you can ignore this email.</p>`,
        });
        const preview = nodemailer.getTestMessageUrl
          ? nodemailer.getTestMessageUrl(info)
          : null;
        if (preview) console.log("[mailer] Preview URL:", preview);
      } catch (e) {
        console.error("Mailer error (async):", e.message);
      }
    });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Reset password using token
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Missing token or password" });
    }
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();
    // look in both collections
    let user = await PsychiatristModel.findOne({
      resetTokenHash: hash,
      resetTokenExpires: { $gt: now },
    });
    let userModel = "psych";
    if (!user) {
      user = await PatientModel.findOne({
        resetTokenHash: hash,
        resetTokenExpires: { $gt: now },
      });
      userModel = "patient";
    }
    if (!user)
      return res
        .status(400)
        .json({ status: "invalid_token", message: "Invalid or expired token" });

    const hashed = await bcrypt.hash(String(password), 10);
    user.password = hashed;
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    await user.save();

    return res.json({ status: "success" });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Change password with current password verification
app.post("/change-password", async (req, res) => {
  try {
    const { email, userId, currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.json({
        status: "bad_request",
        message: "Missing current or new password",
      });
    }

    // Find user by email (case-insensitive) or by id across both collections
    let user = null;
    if (email) {
      const ci = new RegExp(`^${escapeRegex(String(email).trim())}$`, "i");
      user =
        (await PsychiatristModel.findOne({ email: ci })) ||
        (await PatientModel.findOne({ email: ci }));
    } else if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user =
          (await PsychiatristModel.findById(userId)) ||
          (await PatientModel.findById(userId));
      }
    }

    if (!user) {
      return res.json({ status: "not_found", message: "User not found" });
    }

    // Verify current password
    const ok = await bcrypt.compare(
      String(currentPassword),
      String(user.password || "")
    );
    if (!ok) {
      return res.json({
        status: "wrong_password",
        message: "Current password is incorrect",
      });
    }

    // Update to new hash
    const hashed = await bcrypt.hash(String(newPassword), 10);
    user.password = hashed;
    await user.save();

    return res.json({ status: "success" });
  } catch (err) {
    console.error("change-password error:", err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

const sseClients = new Set();

function sseBroadcast(event, payload) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(line);
    } catch {}
  }
}

app.get("/api/license-requests/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write("retry: 10000\n\n"); // client auto-reconnect
  sseClients.add(res);

  // heartbeat to keep connection alive
  const timer = setInterval(() => {
    try {
      res.write("event: ping\ndata: {}\n\n");
    } catch {}
  }, 25000);

  req.on("close", () => {
    clearInterval(timer);
    sseClients.delete(res);
  });
});

// Notifications API
app.get("/api/notifications", async (req, res) => {
  try {
    const {
      userType,
      userId,
      email,
      limit = "50",
      view = "visible",
    } = req.query;
    if (!userType || !["doctor", "patient"].includes(String(userType))) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "userType required (doctor|patient)",
        });
    }
    let uid = userId;
    if (!uid && userType === "patient" && email) {
      const pat = await PatientModel.findOne({ email: String(email) }).select(
        "_id"
      );
      if (pat) uid = String(pat._id);
    }
    if (!uid) return res.json({ status: "success", notifications: [] });

    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const findQuery = { userType, userId: uid };
    if (String(view) === "hidden") findQuery.hidden = true;
    else if (String(view) === "visible") findQuery.hidden = false; // default
    // view === 'all' -> no hidden filter

    const items = await NotificationModel.find(findQuery)
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
    return res.json({ status: "success", notifications: items });
  } catch (err) {
    console.error("List notifications error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.patch("/api/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid notification id" });
    const { read, hidden } = req.body || {};
    const update = {};
    if (typeof read === "boolean") update.read = read;
    if (typeof hidden === "boolean") update.hidden = hidden;
    if (!Object.keys(update).length)
      return res
        .status(400)
        .json({ status: "bad_request", message: "Nothing to update" });
    const updated = await NotificationModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
    if (!updated) return res.status(404).json({ status: "not_found" });
    return res.json({ status: "success", notification: updated });
  } catch (err) {
    console.error("Update notification error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid notification id" });
    const del = await NotificationModel.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ status: "not_found" });
    return res.json({ status: "success" });
  } catch (err) {
    console.error("Delete notification error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

app.post("/api/notifications/mark-all-read", async (req, res) => {
  try {
    const { userType, userId, email } = req.body || {};
    if (!userType || !["doctor", "patient"].includes(String(userType))) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "userType required (doctor|patient)",
        });
    }
    let uid = userId;
    if (!uid && userType === "patient" && email) {
      const pat = await PatientModel.findOne({ email: String(email) }).select(
        "_id"
      );
      if (pat) uid = String(pat._id);
    }
    if (!uid) return res.json({ status: "success", updated: 0 });
    const r = await NotificationModel.updateMany(
      { userType, userId: uid, hidden: false, read: false },
      { $set: { read: true } }
    );
    return res.json({ status: "success", updated: r.modifiedCount || 0 });
  } catch (err) {
    console.error("Mark all as read error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Announcements API
// Quick ping to verify routes are registered at runtime
app.get("/api/announcements/ping", (req, res) => {
  res.json({ status: "ok", message: "Announcements routes active" });
});
// Admin: create announcement
app.post("/api/announcements", async (req, res) => {
  try {
    const {
      title,
      message,
      audience = "all",
      pinned = false,
      active = true,
    } = req.body || {};
    if (!title || !message)
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "title and message are required",
        });
    if (!["all", "doctor", "patient"].includes(String(audience))) {
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid audience" });
    }
    const ann = await AnnouncementModel.create({
      title: String(title),
      message: String(message),
      audience,
      pinned: !!pinned,
      active: !!active,
    });
    // Broadcast to SSE consumers (doctor/patient navbars share /api/appointments/stream)
    try {
      sseBroadcast("announcement_created", {
        id: String(ann._id),
        title: ann.title,
        audience: ann.audience,
        createdAt: ann.createdAt,
      });
    } catch {}
    return res.json({ status: "success", announcement: ann });
  } catch (err) {
    console.error("Create announcement error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Admin: list announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const { audience, active = "true", limit = "100" } = req.query || {};
    const query = {};
    if (audience && ["all", "doctor", "patient"].includes(String(audience)))
      query.audience = String(audience);
    if (String(active) === "true") query.active = true;
    else if (String(active) === "false") query.active = false;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const items = await AnnouncementModel.find(query)
      .sort({ pinned: -1, createdAt: -1 })
      .limit(lim)
      .lean();
    return res.json({ status: "success", announcements: items });
  } catch (err) {
    console.error("List announcements error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Admin: delete announcement
app.delete("/api/announcements/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid announcement id" });
    const del = await AnnouncementModel.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ status: "not_found" });
    // also clean receipts
    try {
      await AnnouncementReceiptModel.deleteMany({ announcementId: id });
    } catch {}
    return res.json({ status: "success" });
  } catch (err) {
    console.error("Delete announcement error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Feed for doctor/patient: merge per-user state
app.get("/api/announcements/feed", async (req, res) => {
  try {
    let {
      userType,
      userId,
      email,
      limit = "50",
      view = "visible",
    } = req.query || {};
    if (!userType || !["doctor", "patient"].includes(String(userType))) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "userType required (doctor|patient)",
        });
    }
    userType = String(userType);
    // resolve patient id by email if needed
    if (!userId && userType === "patient" && email) {
      const pat = await PatientModel.findOne({ email: String(email) }).select(
        "_id"
      );
      if (pat) userId = String(pat._id);
    }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const audienceIn =
      userType === "doctor" ? ["all", "doctor"] : ["all", "patient"];
    const anns = await AnnouncementModel.find({
      active: true,
      audience: { $in: audienceIn },
    })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(lim)
      .lean();
    if (anns.length === 0)
      return res.json({ status: "success", announcements: [] });

    const ids = anns.map((a) => a._id);
    const receipts = await AnnouncementReceiptModel.find({
      announcementId: { $in: ids },
      userType,
      ...(userId ? { userId } : {}),
      ...(email ? { email: String(email) } : {}),
    }).lean();
    const map = new Map(receipts.map((r) => [String(r.announcementId), r]));
    const items = anns.map((a) => {
      const r = map.get(String(a._id));
      const merged = {
        _id: a._id,
        title: a.title,
        message: a.message,
        audience: a.audience,
        createdAt: a.createdAt,
        pinned: !!a.pinned,
        read: !!r?.read,
        hidden: !!r?.hidden,
        muted: !!r?.muted,
      };
      return merged;
    });
    // filter by view
    const filtered =
      String(view) === "hidden"
        ? items.filter((i) => i.hidden)
        : String(view) === "visible"
        ? items.filter((i) => !i.hidden)
        : items;
    return res.json({ status: "success", announcements: filtered });
  } catch (err) {
    console.error("Announcements feed error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Update per-user state for an announcement (read/unread, hidden, muted)
app.patch("/api/announcements/:id/state", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid announcement id" });
    const { userType, userId, email, read, hidden, muted } = req.body || {};
    if (!userType || !["doctor", "patient"].includes(String(userType))) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "userType required (doctor|patient)",
        });
    }
    const update = {};
    if (typeof read === "boolean") update.read = read;
    if (typeof hidden === "boolean") update.hidden = hidden;
    if (typeof muted === "boolean") update.muted = muted;
    if (!Object.keys(update).length)
      return res
        .status(400)
        .json({ status: "bad_request", message: "Nothing to update" });
    const query = { announcementId: id, userType: String(userType) };
    if (userId) query.userId = userId;
    if (email) query.email = String(email);
    const rec = await AnnouncementReceiptModel.findOneAndUpdate(
      query,
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ status: "success", receipt: rec });
  } catch (err) {
    console.error("Update announcement state error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

// Mark all announcements as read for this user (for current visible audience)
app.post("/api/announcements/mark-all-read", async (req, res) => {
  try {
    let { userType, userId, email } = req.body || {};
    if (!userType || !["doctor", "patient"].includes(String(userType))) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "userType required (doctor|patient)",
        });
    }
    userType = String(userType);
    if (!userId && userType === "patient" && email) {
      const pat = await PatientModel.findOne({ email: String(email) }).select(
        "_id"
      );
      if (pat) userId = String(pat._id);
    }
    const audienceIn =
      userType === "doctor" ? ["all", "doctor"] : ["all", "patient"];
    const anns = await AnnouncementModel.find({
      active: true,
      audience: { $in: audienceIn },
    })
      .select("_id")
      .lean();
    if (!anns.length) return res.json({ status: "success", updated: 0 });
    const ops = anns.map((a) => ({
      updateOne: {
        filter: {
          announcementId: a._id,
          userType,
          ...(userId ? { userId } : {}),
          ...(email ? { email: String(email) } : {}),
        },
        update: { $set: { read: true } },
        upsert: true,
      },
    }));
    const r = await AnnouncementReceiptModel.bulkWrite(ops);
    return res.json({
      status: "success",
      updated: r.modifiedCount + (r.upsertedCount || 0),
    });
  } catch (err) {
    console.error("Mark all announcements read error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});
// submit a review for an appointment (rating + optional review text)
app.post("/api/appointments/:id/review", async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res
        .status(400)
        .json({ status: "bad_request", message: "Invalid appointment id" });
    // validate rating
    const numericRating = Number(rating);
    if (
      !Number.isFinite(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res
        .status(400)
        .json({
          status: "bad_request",
          message: "Rating must be a number between 1 and 5",
        });
    }

    console.log("Review incoming", {
      appointmentId: id,
      rating: numericRating,
      reviewLength: review ? String(review).length : 0,
      ip: req.ip,
    });

    // atomically update the appointment
    const update = { rating: numericRating };
    if (review !== undefined) update.review = String(review);

    try {
      const updated = await AppointmentModel.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true }
      )
        .populate("patient", "firstName lastName name email")
        .populate("doctor", "firstName lastName email");

      if (!updated)
        return res
          .status(404)
          .json({ status: "not_found", message: "Appointment not found" });

      console.log("Review saved (findByIdAndUpdate)", { appointmentId: id });
      return res.json({ status: "success", appointment: updated });
    } catch (updateErr) {
      console.error("Review update error", updateErr);
      if (updateErr && updateErr.name === "ValidationError") {
        return res
          .status(400)
          .json({
            status: "bad_request",
            message: "Validation error",
            details: updateErr.errors,
          });
      }

      try {
        const raw = await AppointmentModel.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { $set: update }
        );
        if (raw.matchedCount === 0)
          return res
            .status(404)
            .json({ status: "not_found", message: "Appointment not found" });
        console.log("Review saved (raw collection update)", {
          appointmentId: id,
          result: raw.result || raw,
        });
        const reloaded = await AppointmentModel.findById(id)
          .populate("patient", "firstName lastName name email")
          .populate("doctor", "firstName lastName email");
        return res.json({ status: "success", appointment: reloaded });
      } catch (rawErr) {
        console.error("Raw update failed", rawErr);
        return res
          .status(500)
          .json({
            status: "error",
            message: "Server error",
            details: rawErr.message || rawErr,
          });
      }
    }
  } catch (err) {
    console.error("Submit review error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Server error", details: err.message });
  }
});

if (process.env.SERVE_CLIENT === "1") {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Start server (Render uses process.env.PORT)
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});

// -------- OTP System --------
// In-memory store for OTPs (for production, use Redis or database)
const otpStore = new Map(); // Format: { email: { otp: hashedOTP, expires: timestamp, verified: boolean } }

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash OTP for secure storage
function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// Clean expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expires < now) {
      otpStore.delete(email);
    }
  }
}, 60000); // Clean every minute

// Send OTP endpoint
app.post("/auth/send-otp", async (req, res) => {
  try {
    const { email, purpose } = req.body; // purpose: 'registration' or 'login'
    
    if (!email) {
      return res.status(400).json({ 
        status: "bad_request", 
        message: "Email is required" 
      });
    }

    const emailRaw = String(email).trim();
    const ci = new RegExp(`^${escapeRegex(emailRaw)}$`, "i");

    // For login: verify user exists
    if (purpose === 'login') {
      const existingPsych = await PsychiatristModel.findOne({ email: ci });
      const existingPatient = await PatientModel.findOne({ email: ci });
      
      if (!existingPsych && !existingPatient) {
        return res.status(404).json({ 
          status: "not_found", 
          message: "User not registered" 
        });
      }
    }

    // For registration: verify user doesn't exist
    if (purpose === 'registration') {
      const existingPsych = await PsychiatristModel.findOne({ email: ci });
      const existingPatient = await PatientModel.findOne({ email: ci });
      
      if (existingPsych || existingPatient) {
        return res.status(409).json({ 
          status: "already_exists", 
          message: "Email already registered" 
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP
    otpStore.set(emailRaw.toLowerCase(), {
      otp: hashedOTP,
      expires,
      verified: false,
      purpose
    });

    console.log(`[OTP] Generated for ${emailRaw}: ${otp} (expires in 5 min)`);

    // Send email immediately, then respond
    try {
      const transport = await getMailerTransport();
      await transport.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@telepsychiatrist.local",
        to: emailRaw,
        subject: "Your OTP Verification Code",
        text: `Your OTP code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Your OTP verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #666;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `
      });

      return res.json({ 
        status: "success", 
        message: "OTP sent to your email",
        expiresIn: 300 // seconds
      });
    } catch (emailErr) {
      console.error("[OTP] Email send error:", emailErr);
      // Clean up stored OTP if email fails
      otpStore.delete(emailRaw.toLowerCase());
      return res.status(500).json({ 
        status: "email_error", 
        message: "Failed to send OTP email. Please try again.",
        details: process.env.NODE_ENV === 'development' ? emailErr.message : undefined
      });
    }
  } catch (err) {
    console.error("[OTP] Send error:", err);
    return res.status(500).json({ 
      status: "error", 
      message: "Server error", 
      details: err.message 
    });
  }
});

// Verify OTP endpoint
app.post("/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        status: "bad_request", 
        message: "Email and OTP are required" 
      });
    }

    const emailRaw = String(email).trim().toLowerCase();
    const otpData = otpStore.get(emailRaw);

    if (!otpData) {
      return res.status(400).json({ 
        status: "invalid_otp", 
        message: "OTP not found or expired. Please request a new one." 
      });
    }

    // Check if OTP expired
    if (Date.now() > otpData.expires) {
      otpStore.delete(emailRaw);
      return res.status(400).json({ 
        status: "expired_otp", 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // Verify purpose matches
    if (purpose && otpData.purpose !== purpose) {
      return res.status(400).json({ 
        status: "invalid_purpose", 
        message: "OTP purpose mismatch" 
      });
    }

    // Verify OTP
    const hashedInput = hashOTP(String(otp).trim());
    if (hashedInput !== otpData.otp) {
      return res.status(400).json({ 
        status: "invalid_otp", 
        message: "Invalid OTP. Please try again." 
      });
    }

    // Mark as verified
    otpData.verified = true;
    otpStore.set(emailRaw, otpData);

    console.log(`[OTP] Verified successfully for ${emailRaw}`);

    return res.json({ 
      status: "success", 
      message: "OTP verified successfully" 
    });
  } catch (err) {
    console.error("[OTP] Verify error:", err);
    return res.status(500).json({ 
      status: "error", 
      message: "Server error", 
      details: err.message 
    });
  }
});

// Check if OTP is verified (helper endpoint)
app.post("/auth/check-otp-verified", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        status: "bad_request", 
        message: "Email is required" 
      });
    }

    const emailRaw = String(email).trim().toLowerCase();
    const otpData = otpStore.get(emailRaw);

    if (!otpData || !otpData.verified) {
      return res.json({ 
        status: "not_verified", 
        verified: false 
      });
    }

    // Check if still valid (not expired)
    if (Date.now() > otpData.expires) {
      otpStore.delete(emailRaw);
      return res.json({ 
        status: "expired", 
        verified: false 
      });
    }

    return res.json({ 
      status: "verified", 
      verified: true 
    });
  } catch (err) {
    console.error("[OTP] Check verified error:", err);
    return res.status(500).json({ 
      status: "error", 
      message: "Server error", 
      details: err.message 
    });
  }
});y
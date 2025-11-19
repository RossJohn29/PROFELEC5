//Announcement.js
const mongoose = require('mongoose');

// Announcement authored by admin to be shown to patients and/or doctors
// audience: 'all' | 'doctor' | 'patient'
const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  audience: { type: String, enum: ['all', 'doctor', 'patient'], default: 'all', index: true },
  createdBy: { type: String, default: 'admin' }, // simple identifier; no Admin model present
  pinned: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: true } });

AnnouncementSchema.index({ active: 1, audience: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);

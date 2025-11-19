//Notification.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userType: { type: String, enum: ['doctor', 'patient'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String }, 
  type: { type: String, required: true },
  apptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Psychiatrist' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  meta: { type: Object },
}, { timestamps: { createdAt: true, updatedAt: true } });

NotificationSchema.index({ userType: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

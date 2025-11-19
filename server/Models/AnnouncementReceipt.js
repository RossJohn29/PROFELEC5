//AnnouncementReceipt.js
const mongoose = require('mongoose');

// Per-user state for an announcement (read/muted/hidden) without duplicating content per user
const AnnouncementReceiptSchema = new mongoose.Schema({
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
  userType: { type: String, enum: ['doctor', 'patient'], required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
  email: { type: String, required: false, index: true }, // fallback for patient record when id isn't known
  read: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: true } });

AnnouncementReceiptSchema.index({ announcementId: 1, userType: 1, userId: 1, email: 1 }, { unique: true, partialFilterExpression: { announcementId: { $type: 'objectId' }, userType: { $exists: true } } });

module.exports = mongoose.model('AnnouncementReceipt', AnnouncementReceiptSchema);

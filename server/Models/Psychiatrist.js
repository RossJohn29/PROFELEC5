//Psychiatrist.js
const mongoose = require('mongoose');

const PsychiatristSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Psychiatrist'], required: true },

  // profile fields
  fees: { type: Number, default: 0 },
  experience: { type: [String], default: [] },
  specialty: { type: String, default: 'Mental Health' },
  education: { type: [String], default: [] },
  about: { type: String, default: '' },
  address1: { type: String, default: '' },
  contact: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  resetTokenHash: { type: String, default: null },
  resetTokenExpires: { type: Date, default: null }
  ,
  // true or false -> a boolean operation that decides whether the doctor is listed/unlisted
  listed: { type: Boolean, default: false }
});

// index on listed to speed up queries that filter by listed
PsychiatristSchema.index({ listed: 1 });

module.exports = mongoose.model("Psychiatrist", PsychiatristSchema);

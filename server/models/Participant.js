import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  fatherName: {
    type: String,
    required: true,
    trim: true
  },
  regNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  certificateGenerated: {
    type: Boolean,
    default: false
  },
  deliveredStatus: {
    type: String,
    enum: ['pending', 'delivered', 'bounced', 'failed'],
    default: 'pending'
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  emailMessageId: {
    type: String,
    default: null
  },
  emailError: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
participantSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Participant', participantSchema);

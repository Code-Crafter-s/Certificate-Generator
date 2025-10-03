import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Certificate content
  eventName: {
    type: String,
    default: ''
  },
  eventDetails: {
    type: String,
    default: ''
  },
  organizerName: {
    type: String,
    default: ''
  },
  organizerWebsite: {
    type: String,
    default: ''
  },
  authorizedName: {
    type: String,
    default: ''
  },
  certifyText: {
    type: String,
    default: 'This is to certify that'
  },
  fatherPrefix: {
    type: String,
    default: 'S/O'
  },
  completionText: {
    type: String,
    default: 'has successfully completed'
  },
  completionSubText: {
    type: String,
    default: ''
  },
  
  // QR Code settings
  qrEnabled: {
    type: Boolean,
    default: false
  },
  qrBaseUrl: {
    type: String,
    default: ''
  },
  
  // Email settings
  emailSubject: {
    type: String,
    default: 'Your Certificate'
  },
  emailMessage: {
    type: String,
    default: 'Dear Participant,\n\nPlease find your certificate attached.\n\nBest regards,'
  },
  
  // Images (stored as base64)
  logoBase64: {
    type: String,
    default: null
  },
  secondLogoBase64: {
    type: String,
    default: null
  },
  signatureBase64: {
    type: String,
    default: null
  },
  signatureLabel: {
    type: String,
    default: 'Authorized Signatory'
  },
  
  // Metadata
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
settingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure only one settings document exists
settingsSchema.index({}, { unique: true });

export default mongoose.model('Settings', settingsSchema);

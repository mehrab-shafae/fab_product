const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  expiry: { type: Date, required: true },
  maxUsage: { type: Number, required: true },
  usedCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  productIds: [{ type: String }],
  userIds: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Discount', discountSchema);
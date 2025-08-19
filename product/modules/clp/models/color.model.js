// models/color.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const colorSchema = new Schema(
  {
    title: { type: String, required: true, unique: true, trim: true, maxlength: 250, index: true },
    hex: { type: String, required: true, trim: true, match: /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  },
  { timestamps: true, versionKey: false }
);

colorSchema.pre('validate', function (next) {
  if (this.isModified('title') || this.isNew) {
    const s = String(this.title || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    this.slug = s;
  }
  if (this.isModified('hex') && typeof this.hex === 'string') this.hex = this.hex.toUpperCase();
  next();
});

colorSchema.index({ title: 1 }, { unique: true });
colorSchema.index({ hex: 1 }, { unique: true });
colorSchema.index({ slug: 1 }, { unique: true });

const Color = mongoose.models.Color || mongoose.model('Color', colorSchema);
module.exports = Color;

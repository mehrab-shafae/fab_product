// color.controller.js
const mongoose = require('mongoose');
const Color = require('./models/color.model');
const isValidObjectId = id => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function createColor(req, res, next) {
      try {
            const { title, hex } = req.body;
            const exists = await Color.findOne({ $or: [{ title }, { hex: hex.toUpperCase() }] }).lean();
            if (exists) return res.status(409).json({ message: 'Color with same title or hex already exists' });
            const color = await Color.create({ title, hex });
            res.status(201).json(color);
      } catch (err) {
            if (err?.code === 11000) return res.status(409).json({ message: 'Duplicate key error', keyValue: err.keyValue });
            next(err);
      }
}

async function getAllColors(req, res, next) {
      try {
            const page = Math.max(parseInt(req.query.page || '1', 10), 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
            const skip = (page - 1) * limit;
            const [items, total] = await Promise.all([Color.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Color.countDocuments()]);
            res.json({ page, limit, total, pages: Math.ceil(total / limit), items });
      } catch (err) {
            next(err);
      }
}

async function getColorById(req, res, next) {
      try {
            const { id } = req.params;
            if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
            const color = await Color.findById(id).lean();
            if (!color) return res.status(404).json({ message: 'Color not found' });
            res.json(color);
      } catch (err) {
            next(err);
      }
}

async function getColorBySlug(req, res, next) {
      try {
            const { slug } = req.params;
            const color = await Color.findOne({ slug }).lean();
            if (!color) return res.status(404).json({ message: 'Color not found' });
            res.json(color);
      } catch (err) {
            next(err);
      }
}

async function updateColor(req, res, next) {
      try {
            const { id } = req.params;
            if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
            const { title, hex } = req.body;
            if (title || hex) {
                  const dupe = await Color.findOne({
                        _id: { $ne: id },
                        $or: [...(title ? [{ title }] : []), ...(hex ? [{ hex: String(hex).toUpperCase() }] : [])],
                  }).lean();
                  if (dupe) return res.status(409).json({ message: 'Color with same title or hex already exists' });
            }
            const updated = await Color.findByIdAndUpdate(id, { ...(title ? { title } : {}), ...(hex ? { hex } : {}) }, { new: true, runValidators: true }).lean();
            if (!updated) return res.status(404).json({ message: 'Color not found' });
            res.json(updated);
      } catch (err) {
            if (err?.code === 11000) return res.status(409).json({ message: 'Duplicate key error', keyValue: err.keyValue });
            next(err);
      }
}

async function deleteColor(req, res, next) {
      try {
            const { id } = req.params;
            if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
            const deleted = await Color.findByIdAndDelete(id).lean();
            if (!deleted) return res.status(404).json({ message: 'Color not found' });
            res.json({ message: 'Deleted', id });
      } catch (err) {
            next(err);
      }
}

async function searchColors(req, res, next) {
      try {
            const q = (req.query.q || '').trim();
            if (!q) return res.json({ items: [], total: 0 });
            const regex = new RegExp(escapeRegex(q), 'i');
            const items = await Color.find({ $or: [{ title: { $regex: regex } }, { hex: { $regex: regex } }] })
                  .sort({ createdAt: -1 })
                  .limit(50)
                  .lean();
            res.json({ items, total: items.length });
      } catch (err) {
            next(err);
      }
}

module.exports = { createColor, getAllColors, getColorById, getColorBySlug, updateColor, deleteColor, searchColors };

// color.routes.js
const express = require('express');
const router = express.Router();
const yup = require('yup');
const validate = require('./middlewares/validate');

const { createColor, getAllColors, getColorById, getColorBySlug, updateColor, deleteColor, searchColors } = require('./color.controller');

/**
 * @openapi
 * tags:
 *   - name: Colors
 *     description: Colors management API
 *
 * components:
 *   schemas:
 *     Color:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB ObjectId
 *         title:
 *           type: string
 *           maxLength: 250
 *         hex:
 *           type: string
 *           pattern: "^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$"
 *         slug:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateColorRequest:
 *       type: object
 *       required: [title, hex]
 *       properties:
 *         title:
 *           type: string
 *           example: Primary Blue
 *         hex:
 *           type: string
 *           example: "#1E90FF"
 *     UpdateColorRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         hex:
 *           type: string
 *     PaginatedColors:
 *       type: object
 *       properties:
 *         page: { type: integer, example: 1 }
 *         limit: { type: integer, example: 20 }
 *         total: { type: integer, example: 1 }
 *         pages: { type: integer, example: 1 }
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Color'
 *     DeleteResponse:
 *       type: object
 *       properties:
 *         message: { type: string, example: Deleted }
 *         id: { type: string }
 */

/**
 * @openapi
 * /api/v1/colors:
 *   get:
 *     tags: [Colors]
 *     summary: List colors (paginated)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated list of colors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedColors'
 *   post:
 *     tags: [Colors]
 *     summary: Create a new color
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateColorRequest'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       409:
 *         description: Duplicate color
 */

/**
 * @openapi
 * /api/v1/colors/search:
 *   get:
 *     tags: [Colors]
 *     summary: Search colors
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Color'
 *                 total:
 *                   type: integer
 */

/**
 * @openapi
 * /api/v1/colors/slug/{slug}:
 *   get:
 *     tags: [Colors]
 *     summary: Get color by slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Color found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       404: { description: Not found }
 */

/**
 * @openapi
 * /api/v1/colors/{id}:
 *   get:
 *     tags: [Colors]
 *     summary: Get color by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Color found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400: { description: Invalid id }
 *       404: { description: Not found }
 *   put:
 *     tags: [Colors]
 *     summary: Update color
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateColorRequest'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Color'
 *       400: { description: Invalid id }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Colors]
 *     summary: Delete color
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 */

const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const createColorSchema = yup.object({ title: yup.string().max(250).required(), hex: yup.string().matches(hexRegex, 'Invalid hex').required() });
const updateColorSchema = yup.object({ title: yup.string().max(250).optional(), hex: yup.string().matches(hexRegex, 'Invalid hex').optional() }).test('at-least-one', 'Provide at least one field to update', v => v && (typeof v.title === 'string' || typeof v.hex === 'string'));
const idParamSchema = yup.object({ id: yup.string().required() });
const searchQuerySchema = yup.object({ q: yup.string().trim().required() });

router.get('/', getAllColors);
router.get('/search', validate({ query: searchQuerySchema }), searchColors);
router.get('/slug/:slug', getColorBySlug);
router.get('/:id', validate({ params: idParamSchema }), getColorById);
router.post('/', validate({ body: createColorSchema }), createColor);
router.put('/:id', validate({ params: idParamSchema, body: updateColorSchema }), updateColor);
router.delete('/:id', validate({ params: idParamSchema }), deleteColor);

module.exports = router;

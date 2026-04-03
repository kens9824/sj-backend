const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { createForm, getForms, updateForm } = require('../controllers/formController');

// POST /api/forms — submit form with image upload
router.post('/forms', upload.single('image'), createForm);

// GET /api/forms — list all forms
router.get('/forms', getForms);

// PUT /api/forms/:id — update form
router.put('/forms/:id', upload.single('image'), updateForm);

module.exports = router;

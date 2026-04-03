const express = require('express');
const router = express.Router();
const { getMeasurementsByFormId, getAllMeasurements } = require('../controllers/measurementController');

// GET /api/measurements — list all measurements
router.get('/', getAllMeasurements);

// GET /api/measurements/form/:formId — list measurements for a form
router.get('/form/:formId', getMeasurementsByFormId);

module.exports = router;

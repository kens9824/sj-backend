const express = require('express');
const router = express.Router();
const { getMeasurementsByFormId, getAllMeasurements, deleteMeasurement } = require('../controllers/measurementController');

// GET /api/measurements — list all measurements
router.get('/', getAllMeasurements);

// GET /api/measurements/form/:formId — list measurements for a form
router.get('/form/:formId', getMeasurementsByFormId);

// DELETE /api/measurements/:id — delete measurement
router.delete('/:id', deleteMeasurement);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getSlipData, fetchData } = require('../controllers/slipController');

// GET /api/slip-data
router.get('/slip-data', getSlipData);

// POST /api/fetch-data
router.post('/fetch-data', fetchData);

module.exports = router;

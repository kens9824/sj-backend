const express = require('express');
const router = express.Router();
const { getSlipData } = require('../controllers/slipController');

// GET /api/slip-data
router.get('/slip-data', getSlipData);

module.exports = router;

const express = require('express');
const router = express.Router();

const slipRoutes = require('./slipRoutes');
const formRoutes = require('./formRoutes');
const measurementRoutes = require('./measurementRoutes');
const dashboardRoutes = require('./dashboardRoutes');

// Mount route modules — add new route files here
router.use('/', slipRoutes);
router.use('/', formRoutes);
router.use('/measurements', measurementRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;

const pool = require('../config/db');

/**
 * GET /api/measurements/form/:formId
 * Get measurement data linked to a specific form
 */
const getMeasurementsByFormId = async (req, res) => {
    try {
        const { formId } = req.params;
        const [measurements] = await pool.execute(
            'SELECT * FROM measurements WHERE form_id = ?',
            [formId]
        );

        // For each measurement, fetch its results
        const fullData = await Promise.all(measurements.map(async (m) => {
            const [results] = await pool.execute(
                'SELECT * FROM results WHERE measurement_id = ?',
                [m.id]
            );
            return {
                ...m,
                results
            };
        }));

        res.json(fullData);
    } catch (error) {
        console.error('Error fetching measurements:', error);
        res.status(500).json({ error: 'Failed to fetch measurements', details: error.message });
    }
};

/**
 * GET /api/measurements
 * Get all measurement entries across all forms
 */
const getAllMeasurements = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = '', startDate = '', endDate = '' } = req.query;
        const offset = (page - 1) * limit;
        const searchTerm = `%${search}%`;

        let countQuery = `
            SELECT COUNT(m.id) as total 
            FROM measurements m
            JOIN forms f ON m.form_id = f.id
            WHERE (f.name LIKE ? OR m.program_name LIKE ? OR m.excel_name LIKE ?)
        `;
        let dataQuery = `
            SELECT m.*, f.name as form_name 
            FROM measurements m
            JOIN forms f ON m.form_id = f.id
            WHERE (f.name LIKE ? OR m.program_name LIKE ? OR m.excel_name LIKE ?)
        `;
        
        const params = [searchTerm, searchTerm, searchTerm];
        
        if (status) {
            countQuery += ` AND m.overall_result = ?`;
            dataQuery += ` AND m.overall_result = ?`;
            params.push(status);
        }

        if (startDate && endDate) {
            countQuery += ` AND DATE(m.measurement_datetime) BETWEEN ? AND ?`;
            dataQuery += ` AND DATE(m.measurement_datetime) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        dataQuery += ` ORDER BY m.id DESC LIMIT ? OFFSET ?`;
        
        const [countRows] = await pool.execute(countQuery, params);
        const total = countRows[0].total;

        const dataParams = [...params, parseInt(limit), parseInt(offset)];
        const [rows] = await pool.execute(dataQuery, dataParams);

        res.json({
            data: rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error in getAllMeasurements:', error);
        res.status(500).json({ error: 'Failed to fetch measurements' });
    }
};

module.exports = { getMeasurementsByFormId, getAllMeasurements };

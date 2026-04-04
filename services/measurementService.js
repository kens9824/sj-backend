const pool = require('../config/db');
const { parseKeyenceCSV } = require('../utils/csvParser');

/**
 * Process a single CSV file and import its data into measurements and results tables
 * @param {string} filePath Full path to the CSV file
 * @param {string} fileName Name of the file (e.g., 1_3.csv)
 * @returns {object} The created measurement record
 */
async function processCSV(filePath, fileName) {
    try {
        // Extract form_id from filename (e.g., "1_3.csv" -> 1)
        const formIdMatch = fileName.match(/^(\d+)/);
        if (!formIdMatch) {
            throw new Error(`Invalid filename format: ${fileName}. Expected start with digits (form_id).`);
        }
        const formId = parseInt(formIdMatch[1]);

        // Verify form exists
        const [forms] = await pool.execute('SELECT id FROM forms WHERE id = ?', [formId]);
        if (forms.length === 0) {
            throw new Error(`Form with ID ${formId} not found for file ${fileName}`);
        }

        const parsedData = parseKeyenceCSV(filePath);
        const { header, measurements } = parsedData;

        // Calculate overall result based on individual items
        // If all items are OK, overall is OK. If at least one is NG, overall is NG.
        const hasNG = measurements.some(m => m.res === 'NG');
        const calculatedOverallResult = (measurements.length > 0 && hasNG) ? 'NG' : 'OK';

        // Convert date format
        // Handle combined field or separate Measurement Date and Time fields
        let dateStr = header['Measurement Date and Time'];
        if (!dateStr && header['Measurement Date']) {
            dateStr = header['Measurement Date'];
            if (header['Time']) {
                dateStr += ` ${header['Time']}`;
            }
        }

        let mysqlDate = null;
        if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                mysqlDate = date.toISOString().slice(0, 19).replace('T', ' ');
            }
        }

        // Insert into measurements table
        const [mResult] = await pool.execute(
            'INSERT INTO measurements (form_id, excel_name, program_name, measurement_datetime, overall_result) VALUES (?, ?, ?, ?, ?)',
            [formId, fileName, header['Program name'] || null, mysqlDate, calculatedOverallResult]
        );

        const measurementId = mResult.insertId;

        // Insert into results table
        for (const m of measurements) {
            await pool.execute(
                'INSERT INTO results (measurement_id, item_label, mes_value, units, design_val, upper_limit, lower_limit, res) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [measurementId, m.item, m.value, m.units, m.design_val, m.upper_limit, m.lower_limit, m.res]
            );
        }

        return {
            id: measurementId,
            form_id: formId,
            excel_name: fileName,
            overall_result: calculatedOverallResult
        };

    } catch (error) {
        console.error(`Error in processCSV for ${fileName}:`, error);
        throw error;
    }
}

module.exports = { processCSV };

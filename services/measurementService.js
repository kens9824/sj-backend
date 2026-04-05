const pool = require('../config/db');
const { parseKeyenceCSV, parseKeyenceContent } = require('../utils/csvParser');
const XLSX = require('xlsx');
const fs = require('fs');

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
        return await saveToDB(parsedData, formId, fileName);

    } catch (error) {
        console.error(`Error in processCSV for ${fileName}:`, error);
        throw error;
    }
}

/**
 * Handle source file (xlsx/csv) from asset/source directly
 * @param {string} filePath path to the file
 * @param {object} io socket instance
 */
async function processSourceFile(filePath, io) {
    try {
        const isExcel = filePath.endsWith('.xlsx');
        let content = '';
        if (isExcel) {
            const workbook = XLSX.readFile(filePath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            content = XLSX.utils.sheet_to_csv(sheet);
        } else {
            content = fs.readFileSync(filePath, 'utf8');
        }

        // Clean content for parsing
        const lines = content.split(/\r?\n/);
        const filteredLines = lines.filter(line => line.replace(/,/g, '').trim() !== '');
        const cleanContent = filteredLines.join('\n');

        const parsedData = parseKeyenceContent(cleanContent);
        const { header, measurements } = parsedData;
        const programName = header['Program name'];

        if (!programName) {
            console.warn(`[Watcher] No program name found in source file ${filePath}`);
            return;
        }

        // 1. Get form_id
        const [forms] = await pool.execute('SELECT id FROM forms WHERE name = ?', [programName]);
        if (forms.length === 0) {
            console.warn(`[Watcher] Form "${programName}" not found in database.`);
            return;
        }
        const formId = forms[0].id;

        // 2. Parse Date/Time from file
        let dateStr = header['Measurement Date and Time'];
        if (!dateStr && header['Measurement Date']) {
            dateStr = header['Measurement Date'];
            if (header['Time']) {
                dateStr += ` ${header['Time']}`;
            }
        }
        
        if (!dateStr) {
            console.warn(`[Watcher] No Date/Time found in source file content.`);
            return;
        }

        const fileDate = new Date(dateStr);
        if (isNaN(fileDate.getTime())) {
            console.warn(`[Watcher] Invalid Date/Time format: ${dateStr}`);
            return;
        }
        const mysqlDate = fileDate.toISOString().slice(0, 19).replace('T', ' ');

        // 3. Compare with last measurement in DB
        const [lastM] = await pool.execute(
            'SELECT measurement_datetime FROM measurements WHERE form_id = ? ORDER BY measurement_datetime DESC LIMIT 1',
            [formId]
        );

        if (lastM.length > 0) {
            const lastDBDate = new Date(lastM[0].measurement_datetime);
            // If the dates match, it is a duplicate save, skip.
            if (Math.abs(lastDBDate.getTime() - fileDate.getTime()) < 1000) { 
                console.log(`[Watcher] Data for ${programName} already up to date (${mysqlDate}). Skipping.`);
                return;
            }
        }

        // 4. Save to DB
        console.log(`[Watcher] New data detected for ${programName}. Processing...`);
        const result = await saveToDB(parsedData, formId, `source_${Date.now()}.csv`);
        
        if (io) {
            io.emit('new_measurement', result);
        }

        return result;

    } catch (err) {
        console.error(`[Watcher] Error processing source file:`, err.message);
    }
}

/**
 * Common DB save logic
 */
async function saveToDB(parsedData, formId, fileName) {
    const { header, measurements } = parsedData;
    
    // Calculate overall result
    const hasNG = measurements.some(m => m.res === 'NG' || m.res === 'NG'); // Support both NG and NG
    const calculatedOverallResult = (measurements.length > 0 && hasNG) ? 'NG' : 'OK';

    // Date handling
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

    const [mResult] = await pool.execute(
        'INSERT INTO measurements (form_id, excel_name, program_name, measurement_datetime, overall_result) VALUES (?, ?, ?, ?, ?)',
        [formId, fileName, header['Program name'] || null, mysqlDate, calculatedOverallResult]
    );

    const measurementId = mResult.insertId;

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
        overall_result: calculatedOverallResult,
        measurement_datetime: mysqlDate
    };
}

module.exports = { processCSV, processSourceFile };

const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * GET /api/slip-data
 * Returns formatted measurement data for the Slip component
 */
const getSlipData = async (req, res) => {
  try {
    const { id } = req.query;
    
    let measurement, form, results;

    if (id) {
      // Fetch specific measurement
      const [measurements] = await pool.execute(
        'SELECT * FROM measurements WHERE id = ?',
        [id]
      );
      if (measurements.length === 0) {
        return res.status(404).json({ error: 'Measurement not found' });
      }
      measurement = measurements[0];

      // Fetch linked form
      const [forms] = await pool.execute(
        'SELECT * FROM forms WHERE id = ?',
        [measurement.form_id]
      );
      if (forms.length === 0) {
        return res.status(404).json({ error: 'Form linked to measurement not found' });
      }
      form = forms[0];

      // Fetch results
      const [resRows] = await pool.execute(
        'SELECT * FROM results WHERE measurement_id = ?',
        [id]
      );
      results = resRows;
    } else {
      // Fallback: get the latest measurement and form info (original behavior or similar)
      const [latestM] = await pool.execute('SELECT * FROM measurements ORDER BY id DESC LIMIT 1');
      if (latestM.length === 0) {
        return res.status(404).json({ error: 'No measurement data found' });
      }
      measurement = latestM[0];
      
      const [forms] = await pool.execute('SELECT * FROM forms WHERE id = ?', [measurement.form_id]);
      if (forms.length === 0) {
        return res.status(404).json({ error: 'Form linked to latest measurement not found' });
      }
      form = forms[0];

      const [resRows] = await pool.execute('SELECT * FROM results WHERE measurement_id = ?', [measurement.id]);
      results = resRows;
    }

    // Helper to format numbers safely
    const formatN = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0.000' : num.toFixed(3);
    };

    // Helper to format date to dd/mm/yy
    const formatDate = (dateVal) => {
        if (!dateVal) return 'N/A';
        const date = new Date(dateVal);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    };

    // Helper to format time to hh:mm AM/PM
    const formatTime = (dateVal) => {
        const date = new Date(dateVal);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    // Format data for Slip component
    const formattedData = {
      date: formatDate(measurement.measurement_datetime),
      name: form.name || 'N/A',
      designNo: form.lot_no || 'N/A',
      serialCount: form.serial_counter || '0',
      printDate: formatDate(new Date()) + ' ' + formatTime(new Date()),
      measurements: results.map(r => {
        const dVal = parseFloat(r.design_val) || 0;
        const uLim = parseFloat(r.upper_limit) || 0;
        const lLim = parseFloat(r.lower_limit) || 0;
        const mVal = parseFloat(r.mes_value) || 0;

        return {
            id: r.item_label,
            spec: `${formatN(dVal)}(${formatN(dVal + lLim)} - ${formatN(dVal + uLim)})`,
            actual: formatN(mVal),
            diff: formatN(mVal - dVal),
            status: r.res
        };
      })
    };

    // Handle diagram image
    let diagramImage = null;
    let imagePath = null;

    if (form.image_filename) {
      imagePath = path.join(__dirname, '..', 'asset', 'image', form.image_filename);
    } else {
      imagePath = path.join(__dirname, '..', 'asset', 'image', 'dummy_image.jpeg');
    }

    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).replace('.', '');
      diagramImage = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imageBuffer.toString('base64')}`;
    }

    res.json({ ...formattedData, diagramImage });

  } catch (error) {
    console.error('Error fetching slip data:', error);
    res.status(500).json({ error: 'Failed to fetch slip data', details: error.message });
  }
};

/**
 * POST /api/fetch-data
 * Reads source file (xlsx or csv) identified by SOURCE env from asset/source,
 * extracts program name from content, finds form ID, and creates a duplicate .csv in asset/csv.
 */
const fetchData = async (req, res) => {
  try {
    const sourceEnv = process.env.SOURCE;
    if (!sourceEnv) {
      return res.status(400).json({ error: 'SOURCE environment variable not defined' });
    }

    let sourcePath = path.join(__dirname, '..', 'asset', 'source', `${sourceEnv}.xlsx`);
    let isExcel = true;

    if (!fs.existsSync(sourcePath)) {
      sourcePath = path.join(__dirname, '..', 'asset', 'source', `${sourceEnv}.csv`);
      isExcel = false;
    }

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: `Source file ${sourceEnv}.xlsx or .csv not found in asset/source` });
    }

    // 1. Read the content and convert to CSV format if it's an Excel file
    let csvContent = '';
    if (isExcel) {
      const workbook = XLSX.readFile(sourcePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Convert to CSV string while maintaining structure
      csvContent = XLSX.utils.sheet_to_csv(worksheet);
    } else {
      csvContent = fs.readFileSync(sourcePath, 'utf8');
    }
    
    // 2. Extract the Program name from the (now) CSV content
        const lines = csvContent.split(/\r?\n/);
        const filteredLines = lines.filter(line => line.replace(/,/g, '').trim() !== '');
        csvContent = filteredLines.join('\n');
    let programName = null;

    for (const line of lines) {
      if (line.startsWith('Program name,')) {
        programName = line.split(',')[1]?.trim();
        break;
      }
    }

    if (!programName) {
      return res.status(400).json({ 
        error: `Could not find "Program name" in the source content of ${sourceEnv}`,
        contentPreview: lines.slice(0, 5).join('\n')
      });
    }

    // 3. Find form ID from forms table by the extracted programName
    const [forms] = await pool.execute(
      'SELECT id FROM forms WHERE name = ?',
      [programName]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: `Form with program name "${programName}" not found in database` });
    }

    const formId = forms[0].id;

    // 4. Count measurements for this form
    const [counts] = await pool.execute(
      'SELECT COUNT(*) as total FROM measurements WHERE form_id = ?',
      [formId]
    );
    const measurementCount = counts[0].total;
    const nextIndex = measurementCount + 1;

    // 5. Define target folder and filename
    const targetFileName = `${formId}_${nextIndex}.csv`;
    const folderName = programName;
    const csvDir = path.join(__dirname, '..', 'asset', 'csv', folderName);
    const targetPath = path.join(csvDir, targetFileName);

    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }

    // 6. Save as CSV file (using the string content we have)
    fs.writeFileSync(targetPath, csvContent, 'utf8');

    res.json({ 
      success: true, 
      message: `Created duplicate CSV from ${isExcel ? 'Excel' : 'CSV'} in folder "${folderName}": ${targetFileName}`,
      file: targetFileName,
      folder: folderName,
      extractedProgramName: programName,
      formId: formId,
      originalFormat: isExcel ? 'xlsx' : 'csv'
    });

  } catch (error) {
    console.error('Error in fetchData:', error);
    res.status(500).json({ error: 'Failed to fetch and duplicate data', details: error.message });
  }
};

module.exports = { getSlipData, fetchData };

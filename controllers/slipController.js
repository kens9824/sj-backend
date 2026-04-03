const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/slip-data
 * Returns formatted measurement data for the Slip component
 * Query param: id (measurement_id)
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

module.exports = { getSlipData };

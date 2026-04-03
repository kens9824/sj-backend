const pool = require('../config/db');

/**
 * POST /api/forms
 * Create a new form entry with file upload
 */
const createForm = async (req, res) => {
  try {
    const { name, lot_no, serial_counter, no_of_diamond } = req.body;

    // Validate required fields
    if (!name || !lot_no || !serial_counter || !no_of_diamond) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get uploaded file path (relative to asset/image/)
    const image_filename = req.file ? req.file.filename : null;

    const [result] = await pool.execute(
      'INSERT INTO forms (name, lot_no, serial_counter, no_of_diamond, image_filename) VALUES (?, ?, ?, ?, ?)',
      [name, lot_no, serial_counter, parseInt(no_of_diamond), image_filename]
    );

    res.status(201).json({
      message: 'Form submitted successfully',
      id: result.insertId,
    });
  } catch (error) {
    console.log('Error creating form:', error);
    res.status(500).json({ error: 'Failed to submit form', details: error.message });
  }
};

/**
 * GET /api/forms
 * Get all form entries
 */
const getForms = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    let countQuery = `
      SELECT COUNT(*) as total FROM forms 
      WHERE (name LIKE ? OR lot_no LIKE ?)
    `;
    let dataQuery = `
      SELECT f.*, 
      COUNT(m.id) as total_measurement,
      SUM(CASE WHEN m.overall_result = 'OK' THEN 1 ELSE 0 END) as ok_count,
      SUM(CASE WHEN m.overall_result = 'NG' THEN 1 ELSE 0 END) as ng_count
      FROM forms f 
      LEFT JOIN measurements m ON f.id = m.form_id 
      WHERE (f.name LIKE ? OR f.lot_no LIKE ?)
    `;
    
    const params = [searchTerm, searchTerm];
    
    if (startDate && endDate) {
      countQuery += ` AND DATE(created_at) BETWEEN ? AND ?`;
      dataQuery += ` AND DATE(f.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    dataQuery += `
      GROUP BY f.id 
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const [rows] = await pool.execute(dataQuery, [...params, parseInt(limit), parseInt(offset)]);
    
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
    console.error('Error in getForms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
};

const fs = require('fs');
const path = require('path');

const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lot_no, serial_counter, no_of_diamond } = req.body;
    let image_filename = req.body.image_filename; // Keep existing if not changed

    if (req.file) {
      // If a new file is uploaded, delete the old one if it exists
      const [oldForm] = await pool.execute('SELECT image_filename FROM forms WHERE id = ?', [id]);
      if (oldForm[0] && oldForm[0].image_filename) {
        const oldPath = path.join(__dirname, '..', 'asset', 'image', oldForm[0].image_filename);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      image_filename = req.file.filename;
    }

    const query = `
      UPDATE forms 
      SET name = ?, lot_no = ?, serial_counter = ?, no_of_diamond = ?, image_filename = ?
      WHERE id = ?
    `;
    await pool.execute(query, [name, lot_no, serial_counter, parseInt(no_of_diamond), image_filename, id]);

    res.json({ message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error in updateForm:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
};

module.exports = { createForm, getForms, updateForm };

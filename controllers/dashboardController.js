const pool = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    // 1. Overview Stats
    const [statsRows] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM measurements) as total_measurements,
        (SELECT COUNT(*) FROM measurements WHERE overall_result = 'OK') as ok_count,
        (SELECT COUNT(*) FROM measurements WHERE overall_result = 'NG') as ng_count,
        (SELECT COUNT(*) FROM forms) as total_configs
    `);
    
    // 2. Daily Trends (Last 7 Days)
    const [trendRows] = await pool.execute(`
      SELECT 
        DATE_FORMAT(measurement_datetime, '%Y-%m-%d') as date,
        COUNT(*) as count,
        SUM(CASE WHEN overall_result = 'OK' THEN 1 ELSE 0 END) as ok,
        SUM(CASE WHEN overall_result = 'NG' THEN 1 ELSE 0 END) as ng
      FROM measurements
      WHERE measurement_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(measurement_datetime)
      ORDER BY date ASC
    `);

    // 3. Top 5 Configurations
    const [topConfigsRows] = await pool.execute(`
      SELECT f.name, COUNT(m.id) as count
      FROM forms f
      JOIN measurements m ON f.id = m.form_id
      GROUP BY f.id
      ORDER BY count DESC
      LIMIT 5
    `);

    res.json({
      stats: statsRows[0],
      trends: trendRows,
      topConfigs: topConfigsRows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

module.exports = { getDashboardStats };

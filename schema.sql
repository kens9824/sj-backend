-- Create the database
CREATE DATABASE IF NOT EXISTS sjslip;
USE sjslip;

-- Forms table
CREATE TABLE forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lot_no VARCHAR(100) NOT NULL,
  serial_counter VARCHAR(100) NOT NULL,
  no_of_diamond INT NOT NULL,
  image_filename VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- Measurements table
CREATE TABLE IF NOT EXISTS measurements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  excel_name VARCHAR(255) NOT NULL,
  program_name VARCHAR(255),
  measurement_datetime DATETIME,
  overall_result VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);

-- Results table
CREATE TABLE IF NOT EXISTS results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  measurement_id INT NOT NULL,
  item_label VARCHAR(100),
  mes_value DECIMAL(10, 4),
  units VARCHAR(50),
  design_val DECIMAL(10, 4),
  upper_limit DECIMAL(10, 4),
  lower_limit DECIMAL(10, 4),
  res VARCHAR(50),
  FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE
);

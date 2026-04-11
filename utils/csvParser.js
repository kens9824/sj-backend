const fs = require('fs');
const path = require('path');

/**
 * Parses the custom Keyence CSV format
 * @param {string} filePath Absolute path to the CSV file
 * @returns {object} Parsed data containing header info and measurement results
 */
function parseKeyenceCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    const result = {
        header: {},
        measurements: []
    };

    let readingResults = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.includes('Measurement results')) {
            readingResults = true;
            i++; // Skip the header row (No., measurement item...)
            continue;
        }

        if (!readingResults) {
            // Parse header info (Program name, Measurement Date and Time, etc.)
            const parts = line.split(',');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts[1].trim();
                result.header[key] = value;
            }
        } else {
            // Parse measurement results
            const parts = line.split(',');
            if (parts.length >= 8) {
                result.measurements.push({
                    no: parts[0].trim(),
                    item: parts[1].trim(),
                    value: parseFloat(parts[2].trim()),
                    units: parts[3].trim(),
                    design_val: parseFloat(parts[4].trim()),
                    upper_limit: parseFloat(parts[5].trim()),
                    lower_limit: parseFloat(parts[6].trim()),
                    res: parts[7].trim()
                });
            }
        }
    }

    return result;
}

module.exports = { parseKeyenceCSV };

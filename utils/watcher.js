const chokidar = require('chokidar');
const path = require('path');
const { processCSV } = require('../services/measurementService');

/**
 * Initialize file watcher
 * @param {object} io Socket.io instance to emit events
 */
function initCSVWatcher(io) {
    const csvDir = path.join(__dirname, '..', 'asset', 'csv');
    
    console.log(`Watching for new CSV files in: ${csvDir}`);

    const watcher = chokidar.watch(csvDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true // don't trigger for existing files
    });

    watcher.on('add', async (filePath) => {
        const fileName = path.basename(filePath);
        if (!fileName.endsWith('.csv')) return;

        console.log(`New CSV detected: ${fileName}`);
        
        try {
            const measurement = await processCSV(filePath, fileName);
            console.log(`Successfully processed: ${fileName}`);
            
            // Notify UI
            if (io) {
                io.emit('new_measurement', measurement);
            }
        } catch (err) {
            console.error(`Watcher failed to process ${fileName}:`, err.message);
        }
    });

    return watcher;
}

module.exports = { initCSVWatcher };

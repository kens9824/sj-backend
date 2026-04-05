const chokidar = require('chokidar');
const path = require('path');
const { processCSV, processSourceFile } = require('../services/measurementService');

/**
 * Initialize file watcher
 * @param {object} io Socket.io instance to emit events
 */
function initCSVWatcher(io) {
    const csvDir = path.join(__dirname, '..', 'asset', 'csv');
    const sourceDir = path.join(__dirname, '..', 'asset', 'source');
    
    console.log(`Watching for data files...`);
    console.log(`- CSV drops in: ${csvDir}`);
    console.log(`- Source files in: ${sourceDir}`);

    const watcher = chokidar.watch([csvDir, sourceDir], {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000, // Wait 2s for file to finish writing
            pollInterval: 100
        }
    });

    const handleFile = async (filePath) => {
        const fileName = path.basename(filePath);
        
        // CASE 1: Specific source file (from .env)
        const sourceEnv = process.env.SOURCE;
        if (filePath.includes(sourceDir)) {
            if (fileName === `${sourceEnv}.xlsx` || fileName === `${sourceEnv}.csv`) {
                console.log(`[Watcher] Source file updated: ${fileName}`);
                await processSourceFile(filePath, io);
            }
            return;
        }

        // CASE 2: Processed CSV drop
        if (filePath.includes(csvDir) && fileName.endsWith('.csv')) {
            console.log(`[Watcher] New processed CSV detected: ${fileName}`);
            try {
                const measurement = await processCSV(filePath, fileName);
                console.log(`Successfully processed: ${fileName}`);
                if (io) io.emit('new_measurement', measurement);
            } catch (err) {
                console.error(`Watcher failed to process ${fileName}:`, err.message);
            }
        }
    };

    watcher.on('add', handleFile);
    watcher.on('change', handleFile);

    return watcher;
}

module.exports = { initCSVWatcher };

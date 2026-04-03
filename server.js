require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const http = require('http');
const { Server } = require('socket.io');
const { initCSVWatcher } = require('./utils/watcher');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: config.CORS_OPTIONS
});

// Middleware
app.use(cors(config.CORS_OPTIONS));
app.use(express.json());
const path = require('path');
app.use('/asset', express.static(path.join(__dirname, 'asset')));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

// Start CSV Watcher
initCSVWatcher(io);

// Mount all API routes under /api
app.use('/api', routes);

// Error and Start
// Assuming errorHandler is defined elsewhere or will be added by the user
// For now, commenting it out to ensure syntactical correctness if not defined.
// app.use(errorHandler);

const PORT = config.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');

const app = express();
connectDB();

const server = http.createServer(app);
initSocket(server);

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));

app.use((req, res) => res.status(404).json({ message: 'Requested URI endpoint layout map missing' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Automated TaskFlow MERN Core Engine executing cleanly on port ${PORT}`));
const express = require('express');
const router = express.Router();

// Import route files
const taskRoutes = require('./tasks');
const transcriptRoutes = require('./transcript');

// Use routes
router.use('/tasks', taskRoutes);
router.use('/transcript', transcriptRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'Server is healthy' });
});

module.exports = router;

/**
 * Transcript Routes
 * API endpoints to manage transcripts and Jira integration
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const transcriptProcessor = require('../services/transcriptProcessor');
const transcriptWatcher = require('../services/transcriptWatcher');
const jiraService = require('../services/jiraService');
const User = require('../models/User');
const Task = require('../models/Task');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../transcripts'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  }
});

/**
 * POST /api/transcripts/upload
 * Upload a transcript file for processing
 */
router.post('/upload', upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`\n📤 Transcript uploaded: ${req.file.filename}`);
    const result = await transcriptProcessor.processTranscript(req.file.path);

    res.json({
      success: true,
      message: 'Transcript processed successfully',
      filename: req.file.filename,
      results: result
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/transcripts/process
 * Process a transcript from JSON body
 */
router.post('/process', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'No transcript data provided' });
    }

    const tempPath = path.join(__dirname, '../transcripts', `temp-${Date.now()}.json`);
    await fs.writeFile(tempPath, JSON.stringify(transcript, null, 2));
    
    const result = await transcriptProcessor.processTranscript(tempPath);

    res.json({
      success: true,
      message: 'Transcript processed successfully',
      results: result
    });
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/transcripts/process-all
 * Process all pending transcripts in the folder
 */
router.post('/process-all', async (req, res) => {
  try {
    const results = await transcriptProcessor.processAllPending();
    
    res.json({
      success: true,
      message: 'All transcripts processed',
      results: results
    });
  } catch (error) {
    console.error('Process all error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcripts/watcher/status
 * Get watcher status
 */
router.get('/watcher/status', (req, res) => {
  const status = transcriptWatcher.getStatus();
  res.json(status);
});

/**
 * POST /api/transcripts/watcher/start
 * Start the folder watcher
 */
router.post('/watcher/start', (req, res) => {
  transcriptWatcher.start();
  res.json({ success: true, message: 'Watcher started' });
});

/**
 * POST /api/transcripts/watcher/stop
 * Stop the folder watcher
 */
router.post('/watcher/stop', (req, res) => {
  transcriptWatcher.stop();
  res.json({ success: true, message: 'Watcher stopped' });
});

/**
 * GET /api/transcripts/jira/test
 * Test Jira connection
 */
router.get('/jira/test', async (req, res) => {
  try {
    const result = await jiraService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcripts/jira/user/:query
 * Search for a Jira user
 */
router.get('/jira/user/:query', async (req, res) => {
  try {
    const users = await jiraService.findUser(req.params.query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/transcripts/jira/issue
 * Create a Jira issue manually
 */
router.post('/jira/issue', async (req, res) => {
  try {
    const { summary, description, assigneeAccountId, priority } = req.body;
    
    if (!summary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    const result = await jiraService.createIssue({
      summary,
      description,
      assigneeAccountId,
      priority
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcripts/users
 * Get all users with Jira info
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email team jira_account_id');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/transcripts/users/:id/jira
 * Update a user's Jira account ID
 */
router.put('/users/:id/jira', async (req, res) => {
  try {
    const { jira_account_id } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { jira_account_id },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcripts/tasks
 * Get tasks created from transcripts
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ task_id: /^TRANS-/ })
      .populate('allocated_to', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

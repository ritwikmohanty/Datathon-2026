const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { processTranscript, applyEmployeeUpdates } = require('../services/transcriptAnalyzer');

/**
 * POST /api/transcript/analyze
 * Analyze a transcript file and generate meeting documentation
 * 
 * Body: {
 *   transcript_path: string (relative path to transcript file)
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { transcript_path } = req.body;

    if (!transcript_path) {
      return res.status(400).json({
        success: false,
        error: 'transcript_path is required'
      });
    }

    // Resolve path
    const fullPath = path.resolve(__dirname, '../../..', transcript_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: `Transcript file not found: ${transcript_path}`
      });
    }

    console.log(`\n📝 Processing transcript: ${fullPath}`);
    
    const result = await processTranscript(fullPath);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      meeting_documentation: result.meeting_doc,
      employee_updates: result.employee_updates,
      llm_analysis: result.raw_analysis
    });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transcript/apply-updates
 * Apply the generated updates to employee_data.json
 * 
 * Body: {
 *   updates: array of update objects from /analyze
 * }
 */
router.post('/apply-updates', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'updates array is required'
      });
    }

    const employeeDataPath = path.resolve(__dirname, '../../employee_data.json');
    const changesApplied = applyEmployeeUpdates(updates, employeeDataPath);

    res.json({
      success: true,
      changes_applied: changesApplied,
      message: `Applied ${changesApplied} update(s) to employee data`
    });
  } catch (error) {
    console.error('Error applying updates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transcript/list
 * List available transcript files in the Transcript folder
 */
router.get('/list', (req, res) => {
  try {
    const transcriptDir = path.resolve(__dirname, '../../..', 'Transcript');
    
    if (!fs.existsSync(transcriptDir)) {
      return res.json({
        success: true,
        transcripts: [],
        message: 'Transcript folder not found'
      });
    }

    const files = fs.readdirSync(transcriptDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: `Transcript/${f}`,
        size: fs.statSync(path.join(transcriptDir, f)).size
      }));

    res.json({
      success: true,
      transcripts: files
    });
  } catch (error) {
    console.error('Error listing transcripts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

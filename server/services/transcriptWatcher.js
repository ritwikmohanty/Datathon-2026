/**
 * Transcript Folder Watcher
 * Monitors the transcripts folder and auto-processes new files
 */

const fs = require('fs');
const path = require('path');
const transcriptProcessor = require('./transcriptProcessor');

class TranscriptWatcher {
  constructor() {
    this.transcriptsDir = path.join(__dirname, '../transcripts');
    this.watcher = null;
    this.processing = new Set();
    this.debounceTimers = new Map();
  }

  /**
   * Start watching the transcripts folder
   */
  start() {
    if (!fs.existsSync(this.transcriptsDir)) {
      fs.mkdirSync(this.transcriptsDir, { recursive: true });
    }

    console.log(`\n👁️ Starting transcript folder watcher...`);
    console.log(`   📁 Watching: ${this.transcriptsDir}`);

    this.processExistingFiles();

    this.watcher = fs.watch(this.transcriptsDir, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        this.handleFileChange(eventType, filename);
      }
    });

    this.watcher.on('error', (error) => {
      console.error('❌ Watcher error:', error.message);
    });

    console.log(`   ✅ Watcher started successfully\n`);
  }

  /**
   * Stop watching
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('👁️ Transcript watcher stopped');
    }
  }

  /**
   * Handle file changes with debouncing
   */
  handleFileChange(eventType, filename) {
    if (this.debounceTimers.has(filename)) {
      clearTimeout(this.debounceTimers.get(filename));
    }

    const timer = setTimeout(() => {
      this.processFile(filename);
      this.debounceTimers.delete(filename);
    }, 1000);

    this.debounceTimers.set(filename, timer);
  }

  /**
   * Process a single file
   */
  async processFile(filename) {
    const filePath = path.join(this.transcriptsDir, filename);

    if (this.processing.has(filename)) return;
    if (!fs.existsSync(filePath)) return;

    this.processing.add(filename);

    try {
      console.log(`\n🆕 New transcript detected: ${filename}`);
      const result = await transcriptProcessor.processTranscript(filePath);
      
      console.log(`\n📋 Results for ${filename}:`);
      console.log(`   ✅ Processed: ${result.processed?.length || 0}`);
      console.log(`   ❌ Failed: ${result.failed?.length || 0}`);
      console.log(`   ⏭️ Skipped: ${result.skipped?.length || 0}`);

    } catch (error) {
      console.error(`❌ Error processing ${filename}:`, error.message);
    } finally {
      this.processing.delete(filename);
    }
  }

  /**
   * Process any existing files on startup
   */
  async processExistingFiles() {
    try {
      const files = fs.readdirSync(this.transcriptsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length > 0) {
        console.log(`   📄 Found ${jsonFiles.length} existing transcript(s) to process`);
        
        for (const file of jsonFiles) {
          await this.processFile(file);
        }
      } else {
        console.log(`   📭 No pending transcripts`);
      }
    } catch (error) {
      console.error('Error processing existing files:', error.message);
    }
  }

  /**
   * Get watcher status
   */
  getStatus() {
    return {
      running: this.watcher !== null,
      directory: this.transcriptsDir,
      processing: Array.from(this.processing)
    };
  }
}

module.exports = new TranscriptWatcher();

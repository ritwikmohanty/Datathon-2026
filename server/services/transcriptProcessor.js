/**
 * Transcript Processor Service
 * Parses meeting transcripts and extracts tasks for users
 */

const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');
const Task = require('../models/Task');
const jiraService = require('./jiraService');

class TranscriptProcessor {
  constructor() {
    this.transcriptsDir = path.join(__dirname, '../transcripts');
    this.processedDir = path.join(__dirname, '../transcripts/processed');
  }

  /**
   * Find the best matching user in the database by name
   */
  async findUserByName(name) {
    if (!name) return null;
    
    let user = await User.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (user) return user;

    const nameParts = name.split(' ');
    for (const part of nameParts) {
      if (part.length > 2) {
        user = await User.findOne({
          name: { $regex: new RegExp(part, 'i') }
        });
        if (user) return user;
      }
    }

    return user;
  }

  /**
   * Parse a transcript file and extract action items
   */
  async parseTranscript(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const transcript = JSON.parse(content);
      
      console.log(`\n📄 Processing transcript: ${path.basename(filePath)}`);
      console.log(`   Meeting: ${transcript.meeting_title || 'Unknown'}`);
      
      const actionItems = [];

      if (transcript.action_items && Array.isArray(transcript.action_items)) {
        for (const item of transcript.action_items) {
          actionItems.push({
            assignee: item.assignee,
            task: item.task,
            priority: item.priority || 'medium',
            deadline: item.deadline,
            source: 'explicit'
          });
        }
      }

      if (transcript.transcript && Array.isArray(transcript.transcript)) {
        const extractedFromText = this.extractTasksFromText(transcript.transcript);
        actionItems.push(...extractedFromText);
      }

      console.log(`   Found ${actionItems.length} action items`);
      
      return {
        success: true,
        meetingTitle: transcript.meeting_title,
        date: transcript.date,
        participants: transcript.participants || [],
        actionItems: actionItems
      };
    } catch (error) {
      console.error(`❌ Error parsing transcript: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Extract tasks from transcript text using keyword patterns
   */
  extractTasksFromText(transcriptLines) {
    const tasks = [];
    const taskPatterns = [
      /(\w+(?:\s+\w+)?),?\s+(?:please|can you|could you|will you)\s+(.+)/i,
      /I\s+(?:need|want)\s+(\w+(?:\s+\w+)?)\s+to\s+(.+)/i,
      /(\w+(?:\s+\w+)?)\s+(?:will|should|can|must)\s+(?:handle|work on|take care of)\s+(.+)/i,
    ];

    for (const line of transcriptLines) {
      const text = line.text || line;
      
      for (const pattern of taskPatterns) {
        const match = text.match(pattern);
        if (match) {
          let assignee = match[1];
          let task = match[2].replace(/[.!?]$/, '').trim();
          
          if (task.length > 5 && assignee.length > 1) {
            tasks.push({
              assignee: assignee.trim(),
              task: task,
              priority: this.inferPriority(text),
              source: 'extracted'
            });
          }
        }
      }
    }

    return tasks;
  }

  /**
   * Infer priority from text context
   */
  inferPriority(text) {
    const lowText = text.toLowerCase();
    if (lowText.includes('urgent') || lowText.includes('asap') || lowText.includes('critical')) {
      return 'high';
    }
    if (lowText.includes('when you can') || lowText.includes('low priority')) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Determine the role/team for a task based on keywords
   */
  inferRoleFromTask(task) {
    const taskLower = task.toLowerCase();
    
    if (taskLower.match(/frontend|ui|interface|react|css|component|page|dashboard/)) return 'frontend';
    if (taskLower.match(/backend|api|server|database|auth|node|express/)) return 'backend';
    if (taskLower.match(/test|qa|quality|bug|fix/)) return 'qa';
    if (taskLower.match(/deploy|devops|ci|cd|docker|infrastructure|aws/)) return 'devops';
    if (taskLower.match(/market|campaign|social|seo|analytics|advertis/)) return 'marketing';
    if (taskLower.match(/document|write|blog|content|edit|copy/)) return 'editing';
    return 'general';
  }

  /**
   * Process a single transcript and create Jira issues
   */
  async processTranscript(filePath) {
    const results = {
      file: path.basename(filePath),
      processed: [],
      failed: [],
      skipped: []
    };

    const parsed = await this.parseTranscript(filePath);
    if (!parsed.success) {
      results.error = parsed.error;
      return results;
    }

    for (const item of parsed.actionItems) {
      try {
        const user = await this.findUserByName(item.assignee);
        
        if (!user) {
          console.log(`   ⚠️ User not found: ${item.assignee}`);
          results.skipped.push({
            task: item.task,
            assignee: item.assignee,
            reason: 'User not found in database'
          });
          continue;
        }

        console.log(`   👤 Found user: ${user.name} (${user.email})`);

        const role = this.inferRoleFromTask(item.task);
        const taskId = `TRANS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        const newTask = new Task({
          task_id: taskId,
          title: item.task,
          description: `From meeting: ${parsed.meetingTitle || 'Unknown'}\nAssigned to: ${item.assignee}`,
          role_required: role,
          priority: item.priority,
          deadline: item.deadline ? new Date(item.deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
          allocated_to: user._id,
          estimated_hours: 8
        });

        await newTask.save();
        console.log(`   💾 Task saved to DB: ${taskId}`);

        let jiraResult = { success: false, reason: 'No Jira account ID' };
        
        if (user.jira_account_id) {
          jiraResult = await jiraService.createIssue({
            summary: item.task,
            description: `From meeting: ${parsed.meetingTitle || 'Unknown'}\n\nOriginal assignment: ${item.assignee}\nPriority: ${item.priority}`,
            assigneeAccountId: user.jira_account_id,
            priority: item.priority,
            labels: ['transcript-generated', role]
          });

          if (jiraResult.success) {
            newTask.jira_issue_key = jiraResult.key;
            newTask.jira_issue_id = jiraResult.id;
            newTask.synced_to_jira = true;
            await newTask.save();
            console.log(`   🎫 Jira issue created: ${jiraResult.key}`);
          }
        } else {
          console.log(`   ℹ️ No Jira account for user, skipping Jira sync`);
        }

        results.processed.push({
          task: item.task,
          assignee: user.name,
          userId: user._id,
          taskId: taskId,
          jira: jiraResult.success ? jiraResult.key : null
        });

      } catch (error) {
        console.error(`   ❌ Error processing task: ${error.message}`);
        results.failed.push({
          task: item.task,
          assignee: item.assignee,
          error: error.message
        });
      }
    }

    // Move file to processed folder
    try {
      const processedPath = path.join(this.processedDir, `${Date.now()}-${path.basename(filePath)}`);
      await fs.rename(filePath, processedPath);
      console.log(`   📁 Moved to processed folder`);
      results.movedTo = processedPath;
    } catch (error) {
      console.log(`   ⚠️ Could not move file: ${error.message}`);
    }

    return results;
  }

  /**
   * Process all pending transcripts in the folder
   */
  async processAllPending() {
    try {
      const files = await fs.readdir(this.transcriptsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`\n📂 Found ${jsonFiles.length} transcript files to process`);

      const allResults = [];
      
      for (const file of jsonFiles) {
        const filePath = path.join(this.transcriptsDir, file);
        const result = await this.processTranscript(filePath);
        allResults.push(result);
      }

      const totalProcessed = allResults.reduce((sum, r) => sum + r.processed.length, 0);
      const totalFailed = allResults.reduce((sum, r) => sum + r.failed.length, 0);
      const totalSkipped = allResults.reduce((sum, r) => sum + r.skipped.length, 0);

      console.log(`\n📊 Processing Summary:`);
      console.log(`   ✅ Processed: ${totalProcessed} tasks`);
      console.log(`   ❌ Failed: ${totalFailed} tasks`);
      console.log(`   ⏭️ Skipped: ${totalSkipped} tasks`);

      return allResults;
    } catch (error) {
      console.error('Error processing transcripts:', error.message);
      return [];
    }
  }
}

module.exports = new TranscriptProcessor();

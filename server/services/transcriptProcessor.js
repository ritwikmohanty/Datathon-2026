/**
 * Transcript Processor Service
 * Parses meeting transcripts and generates documentation + updates employee data
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Parse transcript JSON and extract full text per participant
 */
function parseTranscript(transcriptData) {
  const participantTexts = {};
  
  for (const entry of transcriptData) {
    const participantName = entry.participant?.name || 'Unknown';
    const participantId = entry.participant?.id;
    
    if (!participantTexts[participantName]) {
      participantTexts[participantName] = {
        id: participantId,
        name: participantName,
        email: entry.participant?.email,
        isHost: entry.participant?.is_host,
        platform: entry.participant?.platform,
        words: [],
        fullText: '',
        timestamps: {
          start: null,
          end: null
        }
      };
    }
    
    // Extract words with timestamps
    if (entry.words && Array.isArray(entry.words)) {
      for (const word of entry.words) {
        participantTexts[participantName].words.push({
          text: word.text,
          startTime: word.start_timestamp?.absolute,
          endTime: word.end_timestamp?.absolute
        });
        
        // Track first and last timestamp
        if (!participantTexts[participantName].timestamps.start) {
          participantTexts[participantName].timestamps.start = word.start_timestamp?.absolute;
        }
        participantTexts[participantName].timestamps.end = word.end_timestamp?.absolute;
      }
      
      // Build full text
      participantTexts[participantName].fullText = participantTexts[participantName].words
        .map(w => w.text)
        .join(' ');
    }
  }
  
  return participantTexts;
}

/**
 * Extract key topics and action items using Gemini AI
 */
async function analyzeTranscriptWithAI(participantData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = `You are analyzing a meeting transcript. Extract key information from the following spoken text.

SPEAKER: ${participantData.name}
TRANSCRIPT TEXT:
"${participantData.fullText}"

Please analyze this transcript and provide a structured JSON response with:

1. **meeting_summary**: A brief 2-3 sentence summary of what was discussed
2. **key_topics**: Array of main topics/keywords mentioned (e.g., "github actions", "jira", "deadlines")
3. **action_items**: Array of tasks or action items mentioned
4. **skills_mentioned**: Array of technical skills or competencies discussed
5. **tools_mentioned**: Array of tools/software mentioned (e.g., "JIRA", "GitHub")
6. **decisions_made**: Array of any decisions or conclusions
7. **assignments**: Array of task assignments with format {task: "", assigned_to: "", deadline: ""}
8. **sentiment**: Overall sentiment (positive/neutral/negative)
9. **meeting_type**: Type of meeting (standup/planning/review/brainstorm/other)

Return ONLY valid JSON, no markdown code blocks.`;

  try {
    console.log(`🧠 Analyzing transcript for ${participantData.name}...`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean and parse JSON
    let cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const analysis = JSON.parse(cleanJson);
    console.log(`✅ AI Analysis complete for ${participantData.name}`);
    return analysis;
  } catch (error) {
    console.error('❌ AI Analysis failed:', error.message);
    // Return basic analysis from keyword extraction
    return extractBasicAnalysis(participantData);
  }
}

/**
 * Fallback: Basic keyword extraction without AI
 */
function extractBasicAnalysis(participantData) {
  const text = participantData.fullText.toLowerCase();
  
  const skillKeywords = ['github', 'jira', 'skill', 'task', 'project', 'code', 'api', 'database', 'frontend', 'backend'];
  const toolKeywords = ['github', 'jira', 'slack', 'notion', 'figma', 'vscode'];
  
  const skills_mentioned = skillKeywords.filter(k => text.includes(k));
  const tools_mentioned = toolKeywords.filter(k => text.includes(k));
  
  return {
    meeting_summary: `Meeting transcript from ${participantData.name}. Topics discussed include: ${skills_mentioned.join(', ') || 'general discussion'}.`,
    key_topics: skills_mentioned,
    action_items: text.includes('deadline') ? ['Review deadlines', 'Update task status'] : [],
    skills_mentioned,
    tools_mentioned,
    decisions_made: [],
    assignments: [],
    sentiment: 'neutral',
    meeting_type: 'other'
  };
}

/**
 * Generate meeting documentation
 */
function generateMeetingDoc(transcriptAnalysis, participantData) {
  const now = new Date().toISOString();
  
  return {
    document_type: 'meeting_notes',
    generated_at: now,
    meeting_info: {
      date: participantData.timestamps.start,
      duration_estimate: calculateDuration(participantData.timestamps),
      host: participantData.isHost ? participantData.name : 'Unknown',
      platform: participantData.platform
    },
    participants: [{
      name: participantData.name,
      id: participantData.id,
      role: participantData.isHost ? 'Host' : 'Participant'
    }],
    summary: transcriptAnalysis.meeting_summary,
    topics_discussed: transcriptAnalysis.key_topics,
    action_items: transcriptAnalysis.action_items,
    decisions: transcriptAnalysis.decisions_made,
    task_assignments: transcriptAnalysis.assignments,
    tools_referenced: transcriptAnalysis.tools_mentioned,
    skills_discussed: transcriptAnalysis.skills_mentioned,
    meeting_type: transcriptAnalysis.meeting_type,
    sentiment: transcriptAnalysis.sentiment,
    raw_word_count: participantData.words.length
  };
}

/**
 * Calculate approximate duration from timestamps
 */
function calculateDuration(timestamps) {
  if (!timestamps.start || !timestamps.end) return 'Unknown';
  
  const start = new Date(timestamps.start);
  const end = new Date(timestamps.end);
  const diffMs = end - start;
  const diffMins = Math.round(diffMs / 60000);
  
  return `${diffMins} minutes`;
}

/**
 * Update employee data based on transcript insights
 */
function generateEmployeeUpdates(transcriptAnalysis, participantName) {
  const updates = {
    participant_name: participantName,
    suggested_updates: {},
    new_data_points: {}
  };
  
  // Skills to potentially add
  if (transcriptAnalysis.skills_mentioned && transcriptAnalysis.skills_mentioned.length > 0) {
    updates.suggested_updates.skills = {
      action: 'add_if_missing',
      values: transcriptAnalysis.skills_mentioned,
      reason: 'Mentioned in meeting transcript'
    };
  }
  
  // Tools expertise
  if (transcriptAnalysis.tools_mentioned && transcriptAnalysis.tools_mentioned.length > 0) {
    updates.suggested_updates.domain_knowledge = {
      action: 'add_if_missing',
      values: transcriptAnalysis.tools_mentioned,
      reason: 'Demonstrated knowledge in meeting'
    };
  }
  
  // Action items become tasks
  if (transcriptAnalysis.action_items && transcriptAnalysis.action_items.length > 0) {
    updates.new_data_points.pending_tasks = transcriptAnalysis.action_items.map(item => ({
      task: item,
      source: 'meeting_transcript',
      created_at: new Date().toISOString(),
      status: 'pending'
    }));
  }
  
  // Assignments
  if (transcriptAnalysis.assignments && transcriptAnalysis.assignments.length > 0) {
    updates.new_data_points.assignments = transcriptAnalysis.assignments;
  }
  
  return updates;
}

/**
 * Main function: Process transcript and generate outputs
 */
async function processTranscript(transcriptPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 TRANSCRIPT PROCESSOR`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Read transcript file
  let transcriptData;
  if (typeof transcriptPath === 'string') {
    const fullPath = path.resolve(transcriptPath);
    console.log(`📂 Reading transcript from: ${fullPath}`);
    const rawData = fs.readFileSync(fullPath, 'utf8');
    transcriptData = JSON.parse(rawData);
  } else {
    transcriptData = transcriptPath; // Already parsed JSON
  }
  
  // Parse transcript
  const participantTexts = parseTranscript(transcriptData);
  console.log(`👥 Found ${Object.keys(participantTexts).length} participant(s)`);
  
  const results = {
    success: true,
    processed_at: new Date().toISOString(),
    participants: [],
    documents: [],
    employee_updates: []
  };
  
  // Process each participant
  for (const [name, data] of Object.entries(participantTexts)) {
    console.log(`\n🎤 Processing: ${name} (${data.words.length} words)`);
    
    // AI Analysis
    const analysis = await analyzeTranscriptWithAI(data);
    
    // Generate meeting doc
    const meetingDoc = generateMeetingDoc(analysis, data);
    results.documents.push(meetingDoc);
    
    // Generate employee updates
    const employeeUpdates = generateEmployeeUpdates(analysis, name);
    results.employee_updates.push(employeeUpdates);
    
    results.participants.push({
      name: name,
      word_count: data.words.length,
      analysis: analysis
    });
  }
  
  console.log(`\n✅ Transcript processing complete!`);
  console.log(`   - ${results.documents.length} meeting document(s) generated`);
  console.log(`   - ${results.employee_updates.length} employee update suggestion(s)`);
  
  return results;
}

/**
 * Apply updates to employee_data.json
 */
function applyEmployeeUpdates(updates, employeeDataPath) {
  const fullPath = path.resolve(employeeDataPath);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  let appliedCount = 0;
  
  for (const update of updates) {
    const participantName = update.participant_name;
    
    // Find matching team member
    for (const [teamKey, team] of Object.entries(data.teams || {})) {
      for (const member of team.members || []) {
        if (member.name.toLowerCase().includes(participantName.toLowerCase().split(' ')[0])) {
          // Apply skill updates
          if (update.suggested_updates.skills) {
            const newSkills = update.suggested_updates.skills.values;
            for (const skill of newSkills) {
              if (!member.skills.includes(skill)) {
                member.skills.push(skill);
                appliedCount++;
              }
            }
          }
          
          // Apply domain knowledge
          if (update.suggested_updates.domain_knowledge) {
            const newKnowledge = update.suggested_updates.domain_knowledge.values;
            if (!member.domain_knowledge) member.domain_knowledge = [];
            for (const knowledge of newKnowledge) {
              if (!member.domain_knowledge.includes(knowledge)) {
                member.domain_knowledge.push(knowledge);
                appliedCount++;
              }
            }
          }
          
          // Add meeting notes reference
          if (!member.meeting_insights) member.meeting_insights = [];
          member.meeting_insights.push({
            date: new Date().toISOString(),
            topics: update.new_data_points.pending_tasks?.map(t => t.task) || [],
            source: 'transcript_analysis'
          });
        }
      }
    }
  }
  
  // Save updated data
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  console.log(`💾 Applied ${appliedCount} updates to employee_data.json`);
  
  return { applied_updates: appliedCount, updated_file: fullPath };
}

module.exports = {
  parseTranscript,
  analyzeTranscriptWithAI,
  generateMeetingDoc,
  generateEmployeeUpdates,
  processTranscript,
  applyEmployeeUpdates
};

/**
 * Transcript Analyzer Service
 * Parses meeting transcripts and extracts actionable data per person
 * Updates employee JSON based on meeting outputs/assignments
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Parse raw transcript JSON and extract text per participant
 */
function parseTranscript(transcriptData) {
  const participantData = {};

  for (const entry of transcriptData) {
    const participant = entry.participant;
    const participantId = participant.id;
    const participantName = participant.name;

    if (!participantData[participantId]) {
      participantData[participantId] = {
        id: participantId,
        name: participantName,
        email: participant.email,
        is_host: participant.is_host,
        platform: participant.platform,
        words: [],
        fullText: '',
        timestamps: {
          start: null,
          end: null
        }
      };
    }

    // Collect all words
    for (const word of entry.words) {
      participantData[participantId].words.push({
        text: word.text,
        start: word.start_timestamp.relative,
        end: word.end_timestamp.relative,
        absoluteStart: word.start_timestamp.absolute
      });

      // Track first and last timestamp
      if (!participantData[participantId].timestamps.start || 
          word.start_timestamp.relative < participantData[participantId].timestamps.start) {
        participantData[participantId].timestamps.start = word.start_timestamp.relative;
      }
      if (!participantData[participantId].timestamps.end || 
          word.end_timestamp.relative > participantData[participantId].timestamps.end) {
        participantData[participantId].timestamps.end = word.end_timestamp.relative;
      }
    }

    // Build full text
    participantData[participantId].fullText = participantData[participantId].words
      .map(w => w.text)
      .join(' ');
  }

  return participantData;
}

/**
 * Use LLM to analyze transcript and extract structured meeting data
 */
async function analyzeTranscriptWithLLM(participantData) {
  const participants = Object.values(participantData);
  
  // Build context for LLM
  const transcriptContext = participants.map(p => 
    `**${p.name}** (${p.is_host ? 'Host' : 'Participant'}):\n"${p.fullText}"`
  ).join('\n\n');

  const prompt = `You are analyzing a meeting transcript to extract actionable information.

## Meeting Transcript:
${transcriptContext}

## Your Task:
Analyze this transcript and extract:

1. **Meeting Summary**: Brief overview of what was discussed
2. **Key Topics**: Main subjects covered (e.g., "task allocation", "deadlines", "GitHub actions", "JIRA")
3. **Action Items**: Tasks or commitments mentioned
4. **Skills Discussed**: Any technical skills or tools mentioned (e.g., "GitHub", "JIRA", "chart concepts")
5. **Participants' Contributions**: What each person discussed or was assigned
6. **Deadlines Mentioned**: Any timelines or due dates
7. **Decisions Made**: Any conclusions or agreements reached

## Output Format (JSON):
{
  "meeting_summary": "Brief 2-3 sentence summary",
  "date": "ISO date from transcript",
  "duration_seconds": number,
  "key_topics": ["topic1", "topic2"],
  "action_items": [
    {
      "task": "description",
      "assigned_to": "person name or null",
      "deadline": "date or null",
      "priority": "high/medium/low"
    }
  ],
  "skills_discussed": ["skill1", "skill2"],
  "participant_outputs": [
    {
      "name": "participant name",
      "contributions": ["what they discussed"],
      "assignments": ["tasks assigned to them"],
      "mentioned_skills": ["skills they mentioned or need"]
    }
  ],
  "decisions": ["decision1", "decision2"],
  "follow_ups_needed": ["follow-up item"]
}

Respond ONLY with valid JSON.`;

  try {
    console.log('🧠 Analyzing transcript with Gemini...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Could not parse LLM response as JSON');
  } catch (error) {
    console.error('❌ LLM Analysis failed:', error.message);
    return null;
  }
}

/**
 * Generate documentation from transcript analysis
 */
function generateMeetingDoc(analysis, participantData) {
  const participants = Object.values(participantData);
  const hostName = participants.find(p => p.is_host)?.name || 'Unknown';
  
  const doc = {
    document_type: 'meeting_transcript_analysis',
    generated_at: new Date().toISOString(),
    meeting_info: {
      host: hostName,
      participants: participants.map(p => p.name),
      date: analysis?.date || new Date().toISOString(),
      duration_seconds: analysis?.duration_seconds || 
        Math.max(...participants.map(p => p.timestamps.end || 0))
    },
    summary: analysis?.meeting_summary || 'Meeting transcript analyzed',
    key_topics: analysis?.key_topics || [],
    action_items: analysis?.action_items || [],
    skills_referenced: analysis?.skills_discussed || [],
    participant_outputs: analysis?.participant_outputs || participants.map(p => ({
      name: p.name,
      contributions: [p.fullText.substring(0, 200) + '...'],
      assignments: [],
      mentioned_skills: []
    })),
    decisions: analysis?.decisions || [],
    follow_ups: analysis?.follow_ups_needed || [],
    raw_word_counts: participants.reduce((acc, p) => {
      acc[p.name] = p.words.length;
      return acc;
    }, {})
  };

  return doc;
}

/**
 * Update employee JSON based on transcript outputs
 * Maps meeting assignments to employee data
 */
function generateEmployeeUpdates(analysis, employeeData) {
  if (!analysis || !analysis.participant_outputs) {
    return { updates: [], no_changes: true };
  }

  const updates = [];
  const allMembers = [];
  
  // Collect all employees
  if (employeeData.product_manager) {
    allMembers.push({ ...employeeData.product_manager, _source: 'product_manager' });
  }
  
  for (const [teamKey, team] of Object.entries(employeeData.teams || {})) {
    for (const member of team.members || []) {
      allMembers.push({ ...member, _source: `teams.${teamKey}` });
    }
  }

  // Match participants to employees
  for (const output of analysis.participant_outputs) {
    const participantName = output.name.toLowerCase();
    
    // Try to find matching employee
    const matchedEmployee = allMembers.find(m => 
      m.name.toLowerCase().includes(participantName) ||
      participantName.includes(m.name.toLowerCase())
    );

    const updateEntry = {
      participant_name: output.name,
      matched_employee: matchedEmployee ? {
        id: matchedEmployee.id,
        name: matchedEmployee.name,
        role: matchedEmployee.role
      } : null,
      meeting_contributions: output.contributions,
      new_assignments: output.assignments.map(task => ({
        task: task,
        source: 'meeting_transcript',
        assigned_date: new Date().toISOString()
      })),
      skills_to_add: output.mentioned_skills.filter(skill => {
        if (!matchedEmployee) return true;
        return !matchedEmployee.skills?.some(s => 
          s.toLowerCase() === skill.toLowerCase()
        );
      }),
      suggested_updates: {}
    };

    // Generate suggested employee JSON updates
    if (matchedEmployee && output.assignments.length > 0) {
      updateEntry.suggested_updates = {
        current_assignments: output.assignments,
        availability: output.assignments.length > 2 ? 'Busy' : 'Partially Free'
      };
    }

    if (output.mentioned_skills.length > 0) {
      updateEntry.suggested_updates.new_skills = output.mentioned_skills;
    }

    updates.push(updateEntry);
  }

  return {
    updates,
    no_changes: updates.length === 0,
    summary: `Found ${updates.length} participant(s) with potential updates`
  };
}

/**
 * Main function: Process transcript and generate outputs
 */
async function processTranscript(transcriptPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📝 TRANSCRIPT ANALYZER');
  console.log(`${'='.repeat(60)}\n`);

  // Read transcript
  let transcriptData;
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    transcriptData = JSON.parse(raw);
    console.log(`✅ Loaded transcript: ${transcriptPath}`);
  } catch (error) {
    console.error('❌ Failed to read transcript:', error.message);
    return { success: false, error: 'Failed to read transcript file' };
  }

  // Parse transcript
  console.log('\n📊 Parsing transcript...');
  const participantData = parseTranscript(transcriptData);
  console.log(`   Found ${Object.keys(participantData).length} participant(s)`);

  for (const [id, data] of Object.entries(participantData)) {
    console.log(`   - ${data.name}: ${data.words.length} words`);
  }

  // Analyze with LLM
  console.log('\n🤖 Running LLM analysis...');
  const analysis = await analyzeTranscriptWithLLM(participantData);
  
  if (analysis) {
    console.log('✅ LLM analysis complete');
    console.log(`   Summary: ${analysis.meeting_summary?.substring(0, 100)}...`);
    console.log(`   Topics: ${analysis.key_topics?.join(', ')}`);
    console.log(`   Action Items: ${analysis.action_items?.length || 0}`);
  } else {
    console.log('⚠️ LLM analysis failed, using basic extraction');
  }

  // Generate meeting doc
  console.log('\n📄 Generating meeting documentation...');
  const meetingDoc = generateMeetingDoc(analysis, participantData);

  // Load employee data
  const employeeDataPath = path.join(__dirname, '../../employee_data.json');
  let employeeData = {};
  try {
    employeeData = JSON.parse(fs.readFileSync(employeeDataPath, 'utf-8'));
  } catch (e) {
    console.log('⚠️ Could not load employee_data.json');
  }

  // Generate employee updates
  console.log('\n👥 Generating employee updates...');
  const employeeUpdates = generateEmployeeUpdates(analysis, employeeData);
  console.log(`   ${employeeUpdates.summary}`);

  return {
    success: true,
    meeting_doc: meetingDoc,
    employee_updates: employeeUpdates,
    raw_analysis: analysis
  };
}

/**
 * Apply updates to employee JSON (optional)
 */
function applyEmployeeUpdates(updates, employeeDataPath) {
  const data = JSON.parse(fs.readFileSync(employeeDataPath, 'utf-8'));
  let changesApplied = 0;

  for (const update of updates) {
    if (!update.matched_employee) continue;

    // Find and update the employee
    // ... implementation depends on structure
    changesApplied++;
  }

  if (changesApplied > 0) {
    fs.writeFileSync(employeeDataPath, JSON.stringify(data, null, 2));
  }

  return changesApplied;
}

module.exports = {
  parseTranscript,
  analyzeTranscriptWithLLM,
  generateMeetingDoc,
  generateEmployeeUpdates,
  processTranscript,
  applyEmployeeUpdates
};

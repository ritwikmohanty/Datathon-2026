/**
 * Process Transcript Script
 * Reads one.json transcript and generates meeting documentation
 * Run with: node processOneTranscript.js
 */

const fs = require('fs');
const path = require('path');

// Read the transcript
const transcriptPath = path.join(__dirname, '../Transcript/one.json');
const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

// Parse transcript
function parseTranscript(data) {
  const participantData = {};
  
  for (const entry of data) {
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
        fullText: ''
      };
    }
    
    for (const word of entry.words) {
      participantData[participantId].words.push(word.text);
    }
    
    participantData[participantId].fullText = participantData[participantId].words.join(' ');
  }
  
  return participantData;
}

// Extract key information
function extractKeyInfo(text) {
  const lowerText = text.toLowerCase();
  
  // Keywords to look for
  const topics = [];
  const skills = [];
  const tools = [];
  const actions = [];
  
  // Topic extraction
  if (lowerText.includes('github') || lowerText.includes('action')) {
    topics.push('GitHub Actions');
    tools.push('GitHub');
    skills.push('CI/CD', 'DevOps');
  }
  if (lowerText.includes('jira')) {
    topics.push('JIRA Task Management');
    tools.push('JIRA');
    skills.push('Project Management');
  }
  if (lowerText.includes('deadline')) {
    topics.push('Deadline Management');
    actions.push('Review and track deadlines');
  }
  if (lowerText.includes('task')) {
    topics.push('Task Allocation');
    actions.push('Assign tasks to team members');
  }
  if (lowerText.includes('skill') || lowerText.includes('match')) {
    topics.push('Skill Matching');
    actions.push('Match team skills to tasks');
  }
  if (lowerText.includes('transcript')) {
    topics.push('Meeting Transcripts');
    actions.push('Process meeting transcripts');
  }
  if (lowerText.includes('chart') || lowerText.includes('concepts')) {
    topics.push('Data Visualization');
    skills.push('Charts', 'Data Analysis');
  }
  if (lowerText.includes('project')) {
    topics.push('Project Planning');
  }
  if (lowerText.includes('commitment')) {
    topics.push('Team Commitment');
  }
  if (lowerText.includes('deep') && lowerText.includes('thinking')) {
    topics.push('Deep Analysis');
    skills.push('Critical Thinking');
  }
  if (lowerText.includes('knowledge')) {
    topics.push('Knowledge Management');
  }
  if (lowerText.includes('organization') || lowerText.includes('compatibility')) {
    topics.push('Organization & Compatibility');
  }
  
  return {
    topics: [...new Set(topics)],
    skills: [...new Set(skills)],
    tools: [...new Set(tools)],
    actions: [...new Set(actions)]
  };
}

// Generate meeting document
function generateMeetingDoc(participants) {
  const meetingDate = '2026-02-07';
  const allExtracted = { topics: [], skills: [], tools: [], actions: [] };
  
  const participantSummaries = [];
  
  for (const [id, data] of Object.entries(participants)) {
    const extracted = extractKeyInfo(data.fullText);
    
    allExtracted.topics.push(...extracted.topics);
    allExtracted.skills.push(...extracted.skills);
    allExtracted.tools.push(...extracted.tools);
    allExtracted.actions.push(...extracted.actions);
    
    participantSummaries.push({
      name: data.name,
      role: data.is_host ? 'Host' : 'Participant',
      word_count: data.words.length,
      topics_discussed: extracted.topics,
      skills_mentioned: extracted.skills
    });
  }
  
  return {
    document_type: 'meeting_notes',
    generated_at: new Date().toISOString(),
    meeting_info: {
      date: meetingDate,
      time: '18:24:47 UTC',
      duration: '~6 minutes'
    },
    summary: `Meeting discussed task allocation system with focus on GitHub Actions integration, JIRA deadline management, skill-based task matching, and meeting transcript processing. Key emphasis on organizational compatibility and deep thinking for project planning.`,
    participants: participantSummaries,
    key_topics: [...new Set(allExtracted.topics)],
    skills_covered: [...new Set(allExtracted.skills)],
    tools_mentioned: [...new Set(allExtracted.tools)],
    action_items: [...new Set(allExtracted.actions)],
    decisions: [
      'Use GitHub Actions for automation',
      'Integrate JIRA for deadline tracking',
      'Implement skill-based task matching',
      'Process meeting transcripts automatically'
    ]
  };
}

// Generate employee update suggestions
function generateEmployeeUpdates(participants) {
  const updates = [];
  
  for (const [id, data] of Object.entries(participants)) {
    const extracted = extractKeyInfo(data.fullText);
    
    updates.push({
      participant_name: data.name,
      participant_id: id,
      suggested_updates: {
        skills_to_add: extracted.skills,
        domain_knowledge_to_add: extracted.tools,
        reason: 'Demonstrated knowledge in meeting transcript'
      },
      pending_tasks: extracted.actions.map(action => ({
        task: action,
        source: 'meeting_transcript',
        date_assigned: new Date().toISOString(),
        status: 'pending'
      }))
    });
  }
  
  return updates;
}

// Main execution
console.log('📝 Processing transcript: one.json\n');

const participants = parseTranscript(transcriptData);
console.log(`Found ${Object.keys(participants).length} participant(s):\n`);

for (const [id, data] of Object.entries(participants)) {
  console.log(`  👤 ${data.name} (${data.is_host ? 'Host' : 'Participant'})`);
  console.log(`     Words spoken: ${data.words.length}`);
}

// Generate meeting document
const meetingDoc = generateMeetingDoc(participants);
console.log('\n' + '='.repeat(60));
console.log('📄 MEETING DOCUMENTATION');
console.log('='.repeat(60) + '\n');
console.log(JSON.stringify(meetingDoc, null, 2));

// Generate employee updates
const employeeUpdates = generateEmployeeUpdates(participants);
console.log('\n' + '='.repeat(60));
console.log('👥 EMPLOYEE UPDATE SUGGESTIONS');
console.log('='.repeat(60) + '\n');
console.log(JSON.stringify(employeeUpdates, null, 2));

// Save outputs
const outputDir = path.join(__dirname, '../Transcript');

// Save meeting doc
const meetingDocPath = path.join(outputDir, 'one_meeting_doc.json');
fs.writeFileSync(meetingDocPath, JSON.stringify(meetingDoc, null, 2));
console.log(`\n✅ Meeting document saved to: ${meetingDocPath}`);

// Save employee updates
const updatesPath = path.join(outputDir, 'one_employee_updates.json');
fs.writeFileSync(updatesPath, JSON.stringify(employeeUpdates, null, 2));
console.log(`✅ Employee updates saved to: ${updatesPath}`);

console.log('\n🎉 Transcript processing complete!');

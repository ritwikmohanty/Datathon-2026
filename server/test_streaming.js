/**
 * Test the streaming allocation endpoint
 * Run with: node test_streaming.js
 */

const http = require('http');

const task = process.argv[2] || "Build a real-time analytics dashboard for tracking user engagement";

console.log('='.repeat(70));
console.log('🧪 TESTING STREAMING ALLOCATION');
console.log('='.repeat(70));
console.log(`\n📋 Task: "${task}"\n`);
console.log('Connecting to streaming endpoint...\n');

const encodedTask = encodeURIComponent(task);
const url = `http://localhost:8000/api/tasks/allocate/stream?task_description=${encodedTask}`;

http.get(url, (res) => {
  console.log('✅ Connected! Receiving events:\n');
  console.log('-'.repeat(70));

  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();
    
    // Parse SSE format
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    let currentEvent = null;
    let currentData = null;

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.substring(7);
      } else if (line.startsWith('data: ')) {
        currentData = line.substring(6);
        
        if (currentEvent && currentData) {
          try {
            const data = JSON.parse(currentData);
            displayEvent(currentEvent, data);
          } catch (e) {
            console.log(`[${currentEvent}] ${currentData}`);
          }
          currentEvent = null;
          currentData = null;
        }
      }
    }
  });

  res.on('end', () => {
    console.log('-'.repeat(70));
    console.log('\n✅ Stream ended');
  });

  res.on('error', (err) => {
    console.error('❌ Error:', err.message);
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err.message);
  console.log('\nMake sure the server is running: cd server && node index.js');
});

function displayEvent(eventType, data) {
  const icons = {
    'allocation_start': '🚀',
    'pm_node_start': '👔',
    'pm_node_complete': '✅',
    'team_node_start': '🏢',
    'team_node_complete': '✅',
    'team_skipped': '⏭️',
    'member_assigned': '👤',
    'allocation_complete': '🎉',
    'allocation_error': '❌'
  };

  const icon = icons[eventType] || '📌';

  switch (eventType) {
    case 'allocation_start':
      console.log(`\n${icon} ALLOCATION STARTED`);
      console.log(`   Task: ${data.task}`);
      break;

    case 'pm_node_start':
      console.log(`\n${icon} PM NODE - Processing...`);
      console.log(`   ${data.message}`);
      break;

    case 'pm_node_complete':
      console.log(`\n${icon} PM NODE - Complete!`);
      console.log(`   Analysis: ${data.data?.analysis?.substring(0, 80)}...`);
      console.log(`   Departments: ${data.data?.departments_involved?.join(', ')}`);
      if (data.data?.tech_requirements) console.log(`   ✓ Tech: ${data.data.tech_requirements.substring(0, 50)}...`);
      if (data.data?.marketing_requirements) console.log(`   ✓ Marketing: ${data.data.marketing_requirements.substring(0, 50)}...`);
      if (data.data?.editing_requirements) console.log(`   ✓ Editing: ${data.data.editing_requirements.substring(0, 50)}...`);
      break;

    case 'team_node_start':
      console.log(`\n${icon} ${data.team_name?.toUpperCase()} NODE - Processing...`);
      console.log(`   ${data.message}`);
      break;

    case 'team_node_complete':
      console.log(`\n${icon} ${data.team_name?.toUpperCase()} NODE - Complete!`);
      console.log(`   Strategy: ${data.data?.team_analysis?.substring(0, 60)}...`);
      console.log(`   Assignments: ${data.data?.member_count} members`);
      break;

    case 'team_skipped':
      console.log(`\n${icon} ${data.team_name?.toUpperCase()} - Skipped`);
      console.log(`   Reason: ${data.reason}`);
      break;

    case 'member_assigned':
      console.log(`\n   ${icon} MEMBER: ${data.data?.member_name} (${data.data?.member_role})`);
      console.log(`      Task: ${data.data?.work_item}`);
      console.log(`      Reason: ${data.data?.reasoning?.substring(0, 80)}...`);
      break;

    case 'allocation_complete':
      console.log(`\n${icon} ALLOCATION COMPLETE!`);
      console.log(`   Departments used: ${data.departments_involved?.join(', ')}`);
      break;

    case 'allocation_error':
      console.log(`\n${icon} ERROR: ${data.error}`);
      break;

    default:
      console.log(`\n${icon} ${eventType}:`, JSON.stringify(data, null, 2).substring(0, 100));
  }
}

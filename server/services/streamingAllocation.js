const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = 'gemini-3-pro-preview';

// Helper function to add delay between LLM calls (to avoid rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Streaming Hierarchical LLM Allocation
 * 
 * This service generates the graph NODE BY NODE, sending each node
 * to the client as it's generated so they can see the graph building in real-time.
 * 
 * Events sent:
 * 1. 'pm_node_start' - PM node begins processing
 * 2. 'pm_node_complete' - PM node done, shows which teams are needed
 * 3. 'team_node_start' - Team node begins (for each team)
 * 4. 'team_node_complete' - Team node done with member assignments
 * 5. 'member_assigned' - Each member assignment (one by one)
 * 6. 'complete' - All done
 */

/**
 * PM Node - Identifies which departments are needed
 */
async function processPMNode(taskDescription, teamData, sendEvent) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // Send start event
  sendEvent('pm_node_start', {
    node_id: 'pm',
    node_type: 'pm',
    status: 'processing',
    message: 'Analyzing task and identifying department requirements...'
  });

  const teamContext = Object.entries(teamData).map(([key, team]) => {
    return `  • ${team.team_name} (${key}): ${team.description}`;
  }).join('\n');

  const prompt = `You are a Product Manager analyzing this task:

TASK: "${taskDescription}"

AVAILABLE DEPARTMENTS:
${teamContext}

Analyze this task and identify what each department needs to do.

Respond with ONLY valid JSON:
{
  "analysis": "Brief analysis of what this task involves",
  "departments_involved": ["tech", "marketing", "editing"],
  "tech_requirements": "Technical work needed (empty string if not needed)",
  "marketing_requirements": "Marketing work needed (empty string if not needed)",
  "editing_requirements": "Content/editing work needed (empty string if not needed)"
}`;

  try {
    console.log(`   📡 PM Node: Sending prompt to Gemini (${MODEL_NAME})...`);
    const result = await model.generateContent(prompt);
    console.log(`   ✅ PM Node: LLM response received`);
    let text = result.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    const parsed = JSON.parse(text);

    // Send complete event with results
    sendEvent('pm_node_complete', {
      node_id: 'pm',
      node_type: 'pm',
      status: 'complete',
      data: {
        analysis: parsed.analysis,
        departments_involved: parsed.departments_involved || [],
        tech_requirements: parsed.tech_requirements || '',
        marketing_requirements: parsed.marketing_requirements || '',
        editing_requirements: parsed.editing_requirements || ''
      }
    });

    return { success: true, ...parsed };
  } catch (error) {
    sendEvent('pm_node_error', {
      node_id: 'pm',
      node_type: 'pm',
      status: 'error',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Team Node - Assigns work to team members
 */
async function processTeamNode(teamKey, teamName, requirements, teamMembers, sendEvent) {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  // Send start event
  sendEvent('team_node_start', {
    node_id: teamKey,
    node_type: 'team',
    team_name: teamName,
    status: 'processing',
    message: `Analyzing ${teamName} requirements and assigning to members...`
  });

  const memberProfiles = teamMembers.map((member, idx) => {
    const expertiseStr = Object.entries(member.expertise || {})
      .map(([area, score]) => `${area}: ${Math.round(score * 100)}%`)
      .join(', ');

    return `${idx + 1}. ${member.name} (${member.id})
   Role: ${member.role}
   Experience: ${member.years_of_experience} years
   Skills: ${member.skills.join(', ')}
   Expertise: ${expertiseStr}
   Availability: ${member.availability} (${member.free_slots_per_week} hrs/week)
   Performance: ${Math.round((member.past_performance_score || 0) * 100)}%`;
  }).join('\n\n');

  const prompt = `You are allocating work within the ${teamName}.

REQUIREMENTS:
${requirements}

TEAM MEMBERS:
${memberProfiles}

Break down the requirements into specific work items and assign each to the best member.

Respond with ONLY valid JSON:
{
  "team_analysis": "Brief strategy for this allocation",
  "work_assignments": [
    {
      "work_item": "Specific task description",
      "assigned_to_name": "Exact member name",
      "assigned_to_id": "Member ID like TECH001",
      "reasoning": "Why this person is best for this task"
    }
  ]
}`;

  try {
    console.log(`   📡 ${teamName}: Sending prompt to Gemini (${MODEL_NAME})...`);
    const result = await model.generateContent(prompt);
    console.log(`   ✅ ${teamName}: LLM response received`);
    let text = result.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    const parsed = JSON.parse(text);

    // Send team complete event
    sendEvent('team_node_complete', {
      node_id: teamKey,
      node_type: 'team',
      team_name: teamName,
      status: 'complete',
      data: {
        team_analysis: parsed.team_analysis,
        requirements: requirements,
        member_count: parsed.work_assignments?.length || 0
      }
    });

    // Now send each member assignment one by one with a small delay
    for (const assignment of (parsed.work_assignments || [])) {
      // Find member details
      const member = teamMembers.find(m => 
        m.name.toLowerCase() === assignment.assigned_to_name?.toLowerCase() ||
        m.id === assignment.assigned_to_id
      );

      if (member) {
        sendEvent('member_assigned', {
          node_id: member.id,
          node_type: 'member',
          parent_team: teamKey,
          status: 'assigned',
          data: {
            member_id: member.id,
            member_name: member.name,
            member_role: member.role,
            work_item: assignment.work_item,
            reasoning: assignment.reasoning,
            member_details: {
              years_of_experience: member.years_of_experience,
              skills: member.skills,
              availability: member.availability,
              free_slots_per_week: member.free_slots_per_week
            }
          }
        });
      }
    }

    return { success: true, ...parsed };
  } catch (error) {
    sendEvent('team_node_error', {
      node_id: teamKey,
      node_type: 'team',
      team_name: teamName,
      status: 'error',
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Main streaming allocation function
 * Calls LLM at each node and streams results
 */
async function runStreamingAllocation(taskDescription, teamData, sendEvent) {
  // Initial event
  sendEvent('allocation_start', {
    task: taskDescription,
    message: 'Starting hierarchical task allocation...'
  });

  // STEP 1: Process PM Node
  console.log('🔵 Calling LLM for PM Node...');
  const pmResult = await processPMNode(taskDescription, teamData, sendEvent);
  
  if (!pmResult.success) {
    sendEvent('allocation_error', { error: 'PM node failed', details: pmResult.error });
    return { success: false, error: pmResult.error };
  }

  // Add delay before next LLM call to avoid rate limiting
  console.log('⏳ Waiting 1 second before next LLM call...');
  await delay(1000);

  const allocations = {};

  // STEP 2: Process each team node sequentially
  const departmentMapping = {
    tech: { 
      requirements: pmResult.tech_requirements, 
      data: teamData.tech,
      name: 'Tech Team'
    },
    marketing: { 
      requirements: pmResult.marketing_requirements, 
      data: teamData.marketing,
      name: 'Marketing Team'
    },
    editing: { 
      requirements: pmResult.editing_requirements, 
      data: teamData.editing,
      name: 'Editing Team'
    }
  };

  for (const [deptKey, deptInfo] of Object.entries(departmentMapping)) {
    // Skip if no requirements for this department
    if (!deptInfo.requirements || deptInfo.requirements.trim() === '') {
      sendEvent('team_skipped', {
        node_id: deptKey,
        node_type: 'team',
        team_name: deptInfo.name,
        reason: 'No requirements identified for this team'
      });
      continue;
    }

    // Process this team node with LLM
    console.log(`🔵 Calling LLM for ${deptInfo.name} Node...`);
    const teamResult = await processTeamNode(
      deptKey,
      deptInfo.name,
      deptInfo.requirements,
      deptInfo.data.members,
      sendEvent
    );

    if (teamResult.success) {
      allocations[deptKey] = {
        team_name: deptInfo.name,
        requirements: deptInfo.requirements,
        team_analysis: teamResult.team_analysis,
        work_assignments: teamResult.work_assignments
      };
    }

    // Add delay between team node LLM calls
    console.log('⏳ Waiting 1 second before next LLM call...');
    await delay(1000);
  }

  // Final complete event
  sendEvent('allocation_complete', {
    success: true,
    pm_analysis: pmResult.analysis,
    departments_involved: pmResult.departments_involved,
    allocations: allocations
  });

  return {
    success: true,
    pm_analysis: pmResult.analysis,
    departments_involved: pmResult.departments_involved,
    allocations
  };
}

module.exports = {
  runStreamingAllocation,
  processPMNode,
  processTeamNode
};

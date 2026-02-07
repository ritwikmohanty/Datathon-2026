const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Hierarchical LLM Task Allocation - FULLY DYNAMIC
 * 
 * NO static templates, NO hardcoded scoring - pure LLM decision making at each node
 * 
 * Flow:
 * 1. PM Node: LLM analyzes task → identifies department requirements
 * 2. Tech Node: LLM gets tech requirements + team data → assigns work to members
 * 3. Marketing Node: LLM gets marketing requirements + team data → assigns work to members  
 * 4. Editing Node: LLM gets editing requirements + team data → assigns work to members
 */

/**
 * STEP 1: PM Node - Identify department requirements
 * LLM decides: What does each department need to do?
 */
async function pmNode_IdentifyRequirements(taskDescription, teamData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const teamContext = Object.entries(teamData).map(([key, team]) => {
    return `  • ${team.team_name}: ${team.description} (${team.members.length} members available)`;
  }).join('\n');

  const prompt = `You are a Product Manager analyzing this task:

TASK: "${taskDescription}"

AVAILABLE DEPARTMENTS:
${teamContext}

Analyze this task and identify what each department needs to do. Be specific about requirements.

Respond with ONLY valid JSON (no markdown):

{
  "analysis": "Brief analysis of what this task involves",
  "departments_involved": ["tech", "marketing", "editing"],
  "tech_requirements": "Specific description of technical work needed. If no tech work needed, leave empty.",
  "marketing_requirements": "Specific description of marketing work needed. If no marketing work needed, leave empty.",
  "editing_requirements": "Specific description of content/editing work needed. If no editing work needed, leave empty."
}

IMPORTANT:
- Only include departments that are ACTUALLY needed
- Be specific about WHAT needs to be done, not WHO should do it
- Empty string "" means that department is not needed`;

  console.log('\n' + '='.repeat(70));
  console.log('🎯 PM NODE: Identifying Department Requirements');
  console.log('='.repeat(70));
  console.log(`📋 Task: "${taskDescription}"`);
  console.log('🤖 Calling LLM...\n');

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();
    const elapsed = Date.now() - startTime;

    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);

    console.log(`✅ PM Node Complete (${elapsed}ms)`);
    console.log(`   Analysis: ${parsed.analysis?.substring(0, 80)}...`);
    console.log(`   Departments: ${(parsed.departments_involved || []).join(', ')}`);
    
    if (parsed.tech_requirements) console.log(`   ✓ Tech requirements identified`);
    if (parsed.marketing_requirements) console.log(`   ✓ Marketing requirements identified`);
    if (parsed.editing_requirements) console.log(`   ✓ Editing requirements identified`);

    return {
      success: true,
      analysis: parsed.analysis || '',
      departments_involved: parsed.departments_involved || [],
      tech_requirements: parsed.tech_requirements || '',
      marketing_requirements: parsed.marketing_requirements || '',
      editing_requirements: parsed.editing_requirements || ''
    };
  } catch (error) {
    console.error('❌ PM Node Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * STEP 2: Team Node - Allocate work to specific team members
 * LLM decides: Who should do what based on their profiles?
 */
async function teamNode_AllocateWork(teamName, requirements, teamMembers) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Build detailed member profiles with ALL their information
  const memberProfiles = teamMembers.map((member, idx) => {
    const expertiseStr = Object.entries(member.expertise || {})
      .map(([area, score]) => `${area}: ${Math.round(score * 100)}%`)
      .join(', ');

    return `${idx + 1}. ${member.name}
   Role: ${member.role}
   Experience: ${member.years_of_experience} years
   Skills: ${member.skills.join(', ')}
   Expertise Areas: ${expertiseStr}
   Availability: ${member.availability} (${member.free_slots_per_week} hours/week free)
   Past Performance: ${Math.round((member.past_performance_score || 0) * 100)}%
   Working Style: ${member.working_style}
   Domain Knowledge: ${(member.domain_knowledge || []).join(', ')}`;
  }).join('\n\n');

  const prompt = `You are allocating work within the ${teamName}. 

REQUIREMENTS FOR THIS TEAM:
${requirements}

AVAILABLE TEAM MEMBERS:
${memberProfiles}

YOUR TASK:
1. Break down the requirements into specific work items/tasks
2. Assign each work item to the MOST SUITABLE team member
3. Consider: skills, experience, expertise, availability, past performance, working style
4. Provide detailed reasoning for each assignment

Respond with ONLY valid JSON (no markdown):

{
  "team_analysis": "1-2 sentences on how you're approaching this allocation",
  "work_assignments": [
    {
      "work_item": "Specific work item or task to be done",
      "assigned_to_name": "Exact member name from list above",
      "reasoning": "Detailed explanation of why this person is the best fit, considering their specific skills, experience, expertise level, availability, and how these match the work requirements"
    }
  ]
}

IMPORTANT:
- Break down requirements into 2-5 specific work items
- Use EXACT member names from the list above
- Provide detailed, specific reasoning for EACH assignment
- Consider workload - try to distribute fairly based on availability
- Match work to member strengths and expertise`;

  console.log('\n' + '-'.repeat(70));
  console.log(`🏢 ${teamName.toUpperCase()} NODE: Allocating Work to Members`);
  console.log('-'.repeat(70));
  console.log(`📋 Requirements: ${requirements.substring(0, 100)}...`);
  console.log(`👥 Team Size: ${teamMembers.length} members`);
  console.log('🤖 Calling LLM...\n');

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();
    const elapsed = Date.now() - startTime;

    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);

    console.log(`✅ ${teamName} Node Complete (${elapsed}ms)`);
    console.log(`   Analysis: ${parsed.team_analysis?.substring(0, 80)}...`);
    console.log(`   Work Items: ${(parsed.work_assignments || []).length}`);
    
    (parsed.work_assignments || []).forEach((assignment, idx) => {
      console.log(`   ${idx + 1}. ${assignment.work_item} → ${assignment.assigned_to_name}`);
    });

    return {
      success: true,
      team_analysis: parsed.team_analysis || '',
      work_assignments: parsed.work_assignments || []
    };
  } catch (error) {
    console.error(`❌ ${teamName} Node Error:`, error.message);
    return { success: false, error: error.message, work_assignments: [] };
  }
}

/**
 * Main Orchestrator - Runs hierarchical allocation through all nodes
 */
async function runHierarchicalAllocation(taskDescription, teamData) {
  console.log('\n' + '█'.repeat(70));
  console.log('🚀 HIERARCHICAL LLM ALLOCATION - FULLY DYNAMIC');
  console.log('█'.repeat(70));
  console.log(`📋 Task: "${taskDescription}"`);
  console.log('');

  const steps = [];

  // STEP 1: PM Node - Identify department requirements
  const pmResult = await pmNode_IdentifyRequirements(taskDescription, teamData);
  steps.push({
    step: 'pm_node',
    success: pmResult.success,
    data: pmResult
  });

  if (!pmResult.success) {
    console.error('❌ PM Node failed. Aborting.');
    return { success: false, steps, error: 'PM node failed' };
  }

  const allocations = {};

  // STEP 2: For each department with requirements, run team node
  const departmentMapping = {
    tech: { requirements: pmResult.tech_requirements, data: teamData.tech },
    marketing: { requirements: pmResult.marketing_requirements, data: teamData.marketing },
    editing: { requirements: pmResult.editing_requirements, data: teamData.editing }
  };

  for (const [deptKey, deptInfo] of Object.entries(departmentMapping)) {
    // Skip if no requirements
    if (!deptInfo.requirements || deptInfo.requirements.trim() === '') {
      console.log(`\n⏭️  Skipping ${deptKey} - no requirements identified`);
      continue;
    }

    // Run team node
    const teamResult = await teamNode_AllocateWork(
      deptInfo.data.team_name,
      deptInfo.requirements,
      deptInfo.data.members
    );

    steps.push({
      step: `${deptKey}_node`,
      success: teamResult.success,
      data: teamResult
    });

    if (teamResult.success) {
      allocations[deptKey] = {
        team_name: deptInfo.data.team_name,
        description: deptInfo.data.description,
        requirements: deptInfo.requirements,
        team_analysis: teamResult.team_analysis,
        work_assignments: teamResult.work_assignments
      };
    }
  }

  console.log('\n' + '█'.repeat(70));
  console.log('✅ HIERARCHICAL ALLOCATION COMPLETE');
  console.log('█'.repeat(70));
  console.log(`📊 Total LLM Calls: ${steps.length}`);
  console.log(`✓ Successful: ${steps.filter(s => s.success).length}`);
  console.log('');

  return {
    success: true,
    pm_analysis: pmResult.analysis,
    departments_involved: pmResult.departments_involved,
    allocations,
    steps
  };
}

module.exports = {
  runHierarchicalAllocation,
  pmNode_IdentifyRequirements,
  teamNode_AllocateWork
};

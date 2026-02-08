const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Sequential LLM Task Allocation
 * 
 * This service makes SEPARATE LLM calls at each node:
 * 1. PM Node: Analyze task → Break into team-specific work
 * 2. Tech Node: Look at tech work + tech members → Assign tasks
 * 3. Marketing Node: Look at marketing work + marketing members → Assign tasks
 * 4. Editing Node: Look at editing work + editing members → Assign tasks
 */

/**
 * STEP 1: PM Analysis - Break down task into team work
 */
async function analyzeAndDecompose(taskDescription) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  const prompt = `You are a Product Manager analyzing a project task.

TASK: "${taskDescription}"

Your job is to break this task into work for 3 teams:
1. **Tech Team** - Technical implementation, coding, infrastructure
2. **Marketing Team** - Promotion, campaigns, analytics, market research  
3. **Editing Team** - Documentation, content writing, UX copy

Analyze what specific work each team needs to do for THIS task.

Respond with ONLY valid JSON (no markdown):
{
  "analysis": "Your 2-3 sentence analysis of the overall task and its key requirements",
  "tech_work": {
    "summary": "What the tech team needs to accomplish",
    "tasks": ["specific task 1", "specific task 2", "specific task 3"]
  },
  "marketing_work": {
    "summary": "What the marketing team needs to accomplish", 
    "tasks": ["specific task 1", "specific task 2"]
  },
  "editing_work": {
    "summary": "What the editing team needs to accomplish",
    "tasks": ["specific task 1", "specific task 2"]
  }
}

Be specific to THIS task: "${taskDescription}"`;

  console.log('\n' + '='.repeat(60));
  console.log('🎯 STEP 1: PM Analyzing Task...');
  console.log('='.repeat(60));
  console.log(`📝 Task: "${taskDescription}"`);

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    const elapsed = Date.now() - startTime;

    console.log(`⏱️  Response in ${elapsed}ms`);

    // Clean and parse JSON
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);
    console.log('✅ PM decomposition complete');
    console.log(`   Tech tasks: ${parsed.tech_work?.tasks?.length || 0}`);
    console.log(`   Marketing tasks: ${parsed.marketing_work?.tasks?.length || 0}`);
    console.log(`   Editing tasks: ${parsed.editing_work?.tasks?.length || 0}`);

    return {
      success: true,
      step: 'pm_analysis',
      data: parsed
    };
  } catch (error) {
    console.error('❌ PM Analysis failed:', error.message);
    return {
      success: false,
      step: 'pm_analysis',
      error: error.message,
      data: null
    };
  }
}

/**
 * STEP 2/3/4: Team Allocation - Assign tasks to specific members
 */
async function allocateTeamTasks(teamName, teamKey, tasks, members) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Format member info
  const memberInfo = members.map(m => `
  - **${m.name}** (${m.role})
    Skills: ${m.skills.join(', ')}
    Experience: ${m.years_of_experience} years
    Availability: ${m.availability} (${m.free_slots_per_week} free slots/week)
    Past Performance: ${Math.round(m.past_performance_score * 100)}%
    Top Expertise: ${Object.entries(m.expertise).sort((a,b) => b[1]-a[1]).slice(0,2).map(([k,v]) => `${k} (${Math.round(v*100)}%)`).join(', ')}`
  ).join('\n');

  const taskList = tasks.map((t, i) => `${i+1}. ${t}`).join('\n');

  const prompt = `You are a ${teamName} Team Lead assigning tasks to your team members.

TASKS TO ASSIGN:
${taskList}

YOUR TEAM MEMBERS:
${memberInfo}

Analyze each team member's skills, experience, availability, and expertise to decide who should do each task.

Respond with ONLY valid JSON (no markdown):
{
  "team_thinking": "Your reasoning about how you're matching tasks to people based on their qualities",
  "assignments": [
    {
      "task": "exact task name from the list",
      "assigned_to": "Member Name",
      "member_id": "member's id from the list",
      "reasoning": "Why this person is the best fit based on their specific qualities",
      "required_skills": ["skill1", "skill2"],
      "complexity": "low|medium|high",
      "estimated_hours": 8
    }
  ]
}

Consider:
- Skill match with the task requirements
- Years of experience for complex tasks
- Availability (free slots) for time-sensitive tasks
- Past performance for critical tasks
- Don't overload one person with too many tasks`;

  console.log('\n' + '-'.repeat(50));
  console.log(`🔹 STEP: ${teamName} Team Allocation...`);
  console.log('-'.repeat(50));
  console.log(`📋 Tasks to assign: ${tasks.length}`);
  console.log(`👥 Team members: ${members.length}`);

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    const elapsed = Date.now() - startTime;

    console.log(`⏱️  Response in ${elapsed}ms`);

    // Clean and parse JSON
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    const parsed = JSON.parse(text);
    console.log(`✅ ${teamName} allocation complete`);
    
    if (parsed.assignments) {
      parsed.assignments.forEach(a => {
        console.log(`   ✓ "${a.task}" → ${a.assigned_to}`);
      });
    }

    return {
      success: true,
      step: `${teamKey}_allocation`,
      data: parsed
    };
  } catch (error) {
    console.error(`❌ ${teamName} allocation failed:`, error.message);
    return {
      success: false,
      step: `${teamKey}_allocation`,
      error: error.message,
      data: null
    };
  }
}

/**
 * Main orchestration function - runs all steps sequentially
 */
async function runSequentialAllocation(taskDescription, teamsData) {
  const steps = [];
  
  // STEP 1: PM Analysis
  const pmResult = await analyzeAndDecompose(taskDescription);
  steps.push(pmResult);

  if (!pmResult.success || !pmResult.data) {
    return { success: false, steps, error: 'PM analysis failed' };
  }

  const decomposition = pmResult.data;

  // STEP 2: Tech Team Allocation
  if (decomposition.tech_work?.tasks?.length > 0 && teamsData.tech) {
    const techResult = await allocateTeamTasks(
      'Tech',
      'tech',
      decomposition.tech_work.tasks,
      teamsData.tech.members
    );
    steps.push(techResult);
  }

  // STEP 3: Marketing Team Allocation
  if (decomposition.marketing_work?.tasks?.length > 0 && teamsData.marketing) {
    const marketingResult = await allocateTeamTasks(
      'Marketing',
      'marketing',
      decomposition.marketing_work.tasks,
      teamsData.marketing.members
    );
    steps.push(marketingResult);
  }

  // STEP 4: Editing Team Allocation
  if (decomposition.editing_work?.tasks?.length > 0 && teamsData.editing) {
    const editingResult = await allocateTeamTasks(
      'Editing',
      'editing',
      decomposition.editing_work.tasks,
      teamsData.editing.members
    );
    steps.push(editingResult);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Sequential allocation complete!');
  console.log(`   Total LLM calls: ${steps.length}`);
  console.log('='.repeat(60) + '\n');

  return {
    success: true,
    steps
  };
}

module.exports = {
  analyzeAndDecompose,
  allocateTeamTasks,
  runSequentialAllocation
};

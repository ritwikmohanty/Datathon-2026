const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Chain-of-Thought Task Allocation with Gemini AI
 * 
 * This service uses Gemini to:
 * 1. Analyze the PM's task and understand requirements
 * 2. Break down into team-specific sub-tasks with reasoning
 * 3. Suggest which skills are needed for each sub-task
 * 4. Provide step-by-step thinking process
 */

/**
 * Generate a detailed task breakdown with chain-of-thought reasoning
 */
async function generateTaskBreakdown(taskDescription, teamData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  // Build context about available teams and their members
  const teamContext = Object.entries(teamData).map(([key, team]) => {
    const memberSummary = team.members.map(m =>
      `    • ${m.name} (${m.role}): skills=[${m.skills.slice(0, 4).join(', ')}], ${m.years_of_experience}yr exp, ${m.availability}`
    ).join('\n');
    return `  **${team.team_name}** (key: "${key}"):\n    Purpose: ${team.description}\n    Members:\n${memberSummary}`;
  }).join('\n\n');

  const prompt = `You are an intelligent task allocation system. A Product Manager needs the following work done:

"${taskDescription}"

Here are the available teams and their members:
${teamContext}

Your job is to:
1. THINK through what this task requires step by step
2. Break it down into specific sub-tasks for EACH team (tech, marketing, editing)
3. For each sub-task, identify the required skills based on what team members actually have

IMPORTANT: Respond with ONLY valid JSON (no markdown, no code fences). Use this exact structure:

{
  "thinking": {
    "task_analysis": "Your 2-3 sentence analysis of what this task involves and the key deliverables",
    "tech_thinking": "Your reasoning about what technical work is needed and why",
    "marketing_thinking": "Your reasoning about what marketing work is needed and why", 
    "editing_thinking": "Your reasoning about what content/documentation work is needed and why"
  },
  "tech": [
    {
      "title": "Specific task title",
      "description": "Brief description of what needs to be done",
      "required_skills": ["skill1", "skill2"],
      "complexity": "low|medium|high",
      "estimated_hours": 8,
      "reasoning": "Why this task is critical for the overall goal"
    }
  ],
  "marketing": [
    {
      "title": "Specific task title",
      "description": "Brief description of what needs to be done",
      "required_skills": ["skill1", "skill2"],
      "complexity": "low|medium|high",
      "estimated_hours": 8,
      "reasoning": "Why this task is critical for the overall goal"
    }
  ],
  "editing": [
    {
      "title": "Specific task title",
      "description": "Brief description of what needs to be done",
      "required_skills": ["skill1", "skill2"],
      "complexity": "low|medium|high",
      "estimated_hours": 8,
      "reasoning": "Why this task is critical for the overall goal"
    }
  ]
}

Generate 2-4 UNIQUE and SPECIFIC tasks per team that are tailored to THIS particular task: "${taskDescription}"

Be creative and specific - these tasks should be different from generic templates. Use realistic skills from the team members' actual skill sets.`;

  console.log('\n🤖 [Gemini] Sending request to generate task breakdown...');
  console.log(`📝 [Gemini] Task: "${taskDescription.substring(0, 100)}..."`);

  try {
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();
    const elapsed = Date.now() - startTime;

    console.log(`⏱️  [Gemini] Response received in ${elapsed}ms`);
    console.log(`📄 [Gemini] Raw response length: ${text.length} chars`);

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    
    // Try to extract JSON if there's other text around it
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    const parsed = JSON.parse(text);

    // Validate and normalize structure
    const validTeams = ['tech', 'marketing', 'editing'];
    for (const team of validTeams) {
      if (!parsed[team] || !Array.isArray(parsed[team])) {
        console.warn(`⚠️  [Gemini] Missing or invalid team: ${team}, using empty array`);
        parsed[team] = [];
      }
      parsed[team] = parsed[team].map(task => ({
        title: task.title || 'Untitled Task',
        description: task.description || '',
        required_skills: Array.isArray(task.required_skills) ? task.required_skills : [],
        complexity: ['low', 'medium', 'high'].includes(task.complexity) ? task.complexity : 'medium',
        estimated_hours: typeof task.estimated_hours === 'number' ? task.estimated_hours : 12,
        reasoning: task.reasoning || ''
      }));
    }

    // Extract thinking
    const thinking = parsed.thinking || {
      task_analysis: 'Analysis generated by AI',
      tech_thinking: 'Technical requirements identified',
      marketing_thinking: 'Marketing needs assessed',
      editing_thinking: 'Content requirements determined'
    };

    console.log('✅ [Gemini] Successfully parsed response');
    console.log(`   📊 Tasks generated: Tech=${parsed.tech.length}, Marketing=${parsed.marketing.length}, Editing=${parsed.editing.length}`);

    // Return in format expected by taskAllocator
    return {
      thinking,
      tech: parsed.tech,
      marketing: parsed.marketing,
      editing: parsed.editing
    };
  } catch (error) {
    console.error('❌ [Gemini] Error:', error.message);
    if (error.message.includes('API key')) {
      console.error('   🔑 Check that GEMINI_API_KEY is set correctly in .env');
    }
    // Return null to signal fallback to templates
    return null;
  }
}

/**
 * Generate reasoning for why a specific member was chosen for a task
 */
function generateMemberSelectionReasoning(task, member, score, allCandidates) {
  const reasons = [];
  
  if (score.breakdown.skill_match >= 0.7) {
    const matchingSkills = task.required_skills.filter(skill => 
      member.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()) || 
                          skill.toLowerCase().includes(s.toLowerCase()))
    );
    if (matchingSkills.length > 0) {
      reasons.push(`Strong skill match: ${matchingSkills.slice(0, 2).join(', ')}`);
    } else {
      reasons.push(`High skill compatibility with task requirements`);
    }
  } else if (score.breakdown.skill_match >= 0.4) {
    reasons.push(`Partial skill overlap with task requirements`);
  }

  if (member.years_of_experience >= 7) {
    reasons.push(`Senior expertise (${member.years_of_experience} years)`);
  } else if (member.years_of_experience >= 4) {
    reasons.push(`Solid experience (${member.years_of_experience} years)`);
  } else {
    reasons.push(`Growing talent (${member.years_of_experience} years)`);
  }

  if (member.availability === 'Free') {
    reasons.push(`Fully available (${member.free_slots_per_week} slots/week)`);
  } else if (member.availability === 'Partially Free') {
    reasons.push(`Available (${member.free_slots_per_week} slots/week)`);
  } else {
    reasons.push(`Limited availability but high expertise`);
  }

  if (score.breakdown.past_performance >= 0.9) {
    reasons.push(`Outstanding track record (${Math.round(score.breakdown.past_performance * 100)}%)`);
  } else if (score.breakdown.past_performance >= 0.8) {
    reasons.push(`Strong performance history`);
  }

  // Add comparison context
  if (allCandidates && allCandidates.length > 1) {
    const scoreDiff = score.total - allCandidates[1].total_score;
    if (scoreDiff > 0.1) {
      reasons.push(`Clear best fit (+${Math.round(scoreDiff * 100)} pts over runner-up)`);
    }
  }

  // Add top expertise
  const topExpertise = Object.entries(member.expertise).sort((a, b) => b[1] - a[1])[0];
  if (topExpertise) {
    reasons.push(`Top expertise: ${topExpertise[0]} (${Math.round(topExpertise[1] * 100)}%)`);
  }

  return reasons;
}

module.exports = { 
  generateTaskBreakdown,
  generateMemberSelectionReasoning
};

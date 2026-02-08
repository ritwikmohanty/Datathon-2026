const fs = require('fs');
const path = require('path');
const User = require('../models/User'); // Import User for MongoDB
const { generateTaskBreakdown, generateMemberSelectionReasoning } = require('./geminiService');
const { runSequentialAllocation } = require('./sequentialLLM');
const { runHierarchicalAllocation } = require('./hierarchicalLLM');

/**
 * Task Allocation Engine
 * 
 * Scores employees based on:
 *  1. Skill Match (40%) - How well the member's skills match the task requirements
 *  2. Experience (20%) - Years of experience normalized 
 *  3. Availability (20%) - Free slots per week
 *  4. Past Performance (10%) - Historical performance score
 *  5. Expertise Match (10%) - Domain expertise relevance
 */

// Load employee data (ASYNC from MongoDB)
async function loadEmployeeData() {
  const users = await User.find({});
  
  const mapUser = u => {
      // flattenMaps: true converts Mongoose Maps to POJOs
      const obj = u.toObject({ getters: true, virtuals: false, flattenMaps: true });
      obj.id = obj.employee_id;
      // Ensure expertise is a plain object if flattenMaps didn't catch it for some reason
      if (obj.expertise && typeof obj.expertise.toJSON === 'function') {
           obj.expertise = obj.expertise.toJSON();
      }
      return obj;
  };

  const productManager = users.find(u => u.team === 'product_management');

  console.log(`Loaded ${users.length} users from MongoDB`);

  const data = {
    product_manager: productManager ? mapUser(productManager) : null,
    teams: {
      tech: {
        team_name: "Tech Team",
        description: "Handles all technical development, architecture, and infrastructure tasks",
        members: users.filter(u => u.team === 'tech').map(mapUser)
      },
      marketing: {
        team_name: "Marketing Team",
        description: "Handles strategic marketing, user acquisition, and growth campaigns",
        members: users.filter(u => u.team === 'marketing').map(mapUser)
      },
      editing: {
        team_name: "Editing Team",
        description: "Responsible for all content creation, documentation, and quality assurance of text",
        members: users.filter(u => u.team === 'editing').map(mapUser)
      }
    }
  };
  return data;
}

// Predefined task breakdown templates based on common product tasks
const TASK_TEMPLATES = {
  'product_launch': {
    tech: [
      { title: 'Build Landing Page', required_skills: ['React', 'CSS', 'TypeScript', 'Frontend Development'], complexity: 'medium', estimated_hours: 16 },
      { title: 'Set Up Backend APIs', required_skills: ['Node.js', 'Express', 'API Design', 'Backend Architecture'], complexity: 'high', estimated_hours: 24 },
      { title: 'Configure CI/CD Pipeline', required_skills: ['Docker', 'CI/CD', 'Kubernetes', 'DevOps'], complexity: 'medium', estimated_hours: 12 },
      { title: 'Performance Testing & Optimization', required_skills: ['Performance Optimization', 'Testing', 'Monitoring & Logging'], complexity: 'medium', estimated_hours: 10 }
    ],
    marketing: [
      { title: 'Create Launch Campaign', required_skills: ['Campaign Strategy', 'Brand Management', 'Campaign Management'], complexity: 'high', estimated_hours: 20 },
      { title: 'Run Paid Ad Campaigns', required_skills: ['Google Ads', 'Social Media', 'Paid Advertising', 'A/B Testing'], complexity: 'medium', estimated_hours: 15 },
      { title: 'Analyze Market & Competitors', required_skills: ['Google Analytics', 'Market Research', 'Competitive Analysis', 'Data Analytics'], complexity: 'medium', estimated_hours: 12 }
    ],
    editing: [
      { title: 'Write Product Documentation', required_skills: ['Technical Writing', 'Documentation', 'Style Guides', 'Technical Documentation'], complexity: 'high', estimated_hours: 18 },
      { title: 'Create Blog & Social Content', required_skills: ['Blog Writing', 'SEO Writing', 'Social Media Content', 'Creative Writing'], complexity: 'medium', estimated_hours: 14 },
      { title: 'Write UI Microcopy & UX Text', required_skills: ['UX Writing', 'Microcopy', 'Product Copy', 'Accessibility Writing'], complexity: 'medium', estimated_hours: 10 }
    ]
  },
  'feature_release': {
    tech: [
      { title: 'Develop Feature Frontend', required_skills: ['React', 'TypeScript', 'CSS', 'Frontend Development'], complexity: 'high', estimated_hours: 20 },
      { title: 'Build Feature Backend', required_skills: ['Node.js', 'Python', 'Database Design', 'Backend Architecture'], complexity: 'high', estimated_hours: 24 },
      { title: 'Deploy & Monitor', required_skills: ['Docker', 'Kubernetes', 'CI/CD', 'Monitoring & Logging'], complexity: 'medium', estimated_hours: 8 }
    ],
    marketing: [
      { title: 'Feature Announcement Campaign', required_skills: ['Campaign Strategy', 'Email Marketing', 'Content Strategy'], complexity: 'medium', estimated_hours: 12 },
      { title: 'Track Feature Adoption Metrics', required_skills: ['Google Analytics', 'Data Analytics', 'Reporting'], complexity: 'medium', estimated_hours: 8 }
    ],
    editing: [
      { title: 'Update Product Documentation', required_skills: ['Technical Writing', 'Documentation', 'Proofreading'], complexity: 'medium', estimated_hours: 10 },
      { title: 'Write Release Notes & Announcements', required_skills: ['Blog Writing', 'UX Writing', 'Content Editing'], complexity: 'low', estimated_hours: 6 }
    ]
  },
  'general': {
    tech: [
      { title: 'Technical Implementation', required_skills: ['React', 'Node.js', 'TypeScript', 'Full Stack Development'], complexity: 'high', estimated_hours: 20 },
      { title: 'Infrastructure & Deployment', required_skills: ['Docker', 'CI/CD', 'AWS', 'DevOps'], complexity: 'medium', estimated_hours: 12 }
    ],
    marketing: [
      { title: 'Marketing Strategy & Campaigns', required_skills: ['Campaign Strategy', 'SEO/SEM', 'Analytics', 'Growth Strategy'], complexity: 'medium', estimated_hours: 15 },
      { title: 'Market Analysis & Reporting', required_skills: ['Google Analytics', 'Market Research', 'Data Analytics'], complexity: 'medium', estimated_hours: 10 }
    ],
    editing: [
      { title: 'Content Creation & Documentation', required_skills: ['Technical Writing', 'Blog Writing', 'Content Editing'], complexity: 'medium', estimated_hours: 12 },
      { title: 'UX Copy & Review', required_skills: ['UX Writing', 'Microcopy', 'Proofreading'], complexity: 'low', estimated_hours: 8 }
    ]
  }
};

/**
 * Calculate how well a member's skills match the required skills
 */
function calculateSkillMatch(memberSkills, memberExpertise, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return 0;

  let matchScore = 0;
  const allMemberCapabilities = [
    ...memberSkills.map(s => s.toLowerCase()),
    ...Object.keys(memberExpertise).map(e => e.toLowerCase())
  ];

  for (const reqSkill of requiredSkills) {
    const reqLower = reqSkill.toLowerCase();
    // Exact match
    if (allMemberCapabilities.includes(reqLower)) {
      matchScore += 1;
      continue;
    }
    // Partial/fuzzy match
    const partialMatch = allMemberCapabilities.some(
      cap => cap.includes(reqLower) || reqLower.includes(cap)
    );
    if (partialMatch) {
      matchScore += 0.6;
      continue;
    }
    // Check expertise values for related areas
    for (const [area, score] of Object.entries(memberExpertise)) {
      if (area.toLowerCase().includes(reqLower) || reqLower.includes(area.toLowerCase())) {
        matchScore += score * 0.8;
        break;
      }
    }
  }

  return matchScore / requiredSkills.length;
}

/**
 * Calculate experience score (normalized, with diminishing returns)
 */
function calculateExperienceScore(years) {
  // Logarithmic scaling: 1yr=0.3, 3yr=0.55, 5yr=0.7, 8yr=0.82, 10yr=0.87, 15yr=0.95
  return Math.min(1, Math.log(years + 1) / Math.log(16));
}

/**
 * Calculate availability score
 */
function calculateAvailabilityScore(freeSlots, estimatedHours) {
  if (freeSlots <= 0) return 0;
  // Can they absorb the task within 2 weeks?
  const capacityRatio = (freeSlots * 2) / estimatedHours;
  return Math.min(1, capacityRatio);
}

/**
 * Main scoring function for a member against a task
 */
function scoreMemberForTask(member, task) {
  const weights = {
    skill_match: 0.40,
    experience: 0.20,
    availability: 0.20,
    past_performance: 0.10,
    expertise_depth: 0.10
  };

  const skillMatch = calculateSkillMatch(member.skills, member.expertise, task.required_skills);
  const experience = calculateExperienceScore(member.years_of_experience);
  const availability = calculateAvailabilityScore(member.free_slots_per_week, task.estimated_hours);
  const pastPerformance = member.past_performance_score || 0.5;

  // Expertise depth: average of all expertise scores
  const expertiseValues = Object.values(member.expertise);
  const expertiseDepth = expertiseValues.length > 0
    ? expertiseValues.reduce((a, b) => a + b, 0) / expertiseValues.length
    : 0.5;

  const totalScore =
    weights.skill_match * skillMatch +
    weights.experience * experience +
    weights.availability * availability +
    weights.past_performance * pastPerformance +
    weights.expertise_depth * expertiseDepth;

  return {
    total: Math.round(totalScore * 100) / 100,
    breakdown: {
      skill_match: Math.round(skillMatch * 100) / 100,
      experience: Math.round(experience * 100) / 100,
      availability: Math.round(availability * 100) / 100,
      past_performance: Math.round(pastPerformance * 100) / 100,
      expertise_depth: Math.round(expertiseDepth * 100) / 100
    },
    weights
  };
}

/**
 * Detect which template to use based on the task description
 */
function detectTaskType(taskDescription) {
  const desc = taskDescription.toLowerCase();
  if (desc.includes('launch') || desc.includes('new product') || desc.includes('release new') || desc.includes('go to market')) {
    return 'product_launch';
  }
  if (desc.includes('feature') || desc.includes('update') || desc.includes('release') || desc.includes('upgrade')) {
    return 'feature_release';
  }
  return 'general';
}

/**
 * Dynamically generate task breakdown based on task description keywords
 * This creates unique tasks based on what the task actually asks for
 */
function generateDynamicTaskBreakdown(taskDescription) {
  const desc = taskDescription.toLowerCase();
  const tasks = { tech: [], marketing: [], editing: [] };
  
  // Extract key concepts from the task
  const concepts = {
    // Tech concepts
    frontend: desc.includes('frontend') || desc.includes('ui') || desc.includes('interface') || desc.includes('react') || desc.includes('page') || desc.includes('dashboard'),
    backend: desc.includes('backend') || desc.includes('api') || desc.includes('server') || desc.includes('database') || desc.includes('auth'),
    mobile: desc.includes('mobile') || desc.includes('app') || desc.includes('ios') || desc.includes('android'),
    devops: desc.includes('deploy') || desc.includes('ci/cd') || desc.includes('docker') || desc.includes('kubernetes') || desc.includes('infrastructure'),
    testing: desc.includes('test') || desc.includes('qa') || desc.includes('quality'),
    security: desc.includes('security') || desc.includes('auth') || desc.includes('login') || desc.includes('permission'),
    performance: desc.includes('performance') || desc.includes('optimize') || desc.includes('speed') || desc.includes('fast'),
    
    // Marketing concepts
    campaign: desc.includes('campaign') || desc.includes('launch') || desc.includes('promote'),
    social: desc.includes('social') || desc.includes('twitter') || desc.includes('linkedin') || desc.includes('facebook'),
    seo: desc.includes('seo') || desc.includes('search') || desc.includes('ranking'),
    analytics: desc.includes('analytics') || desc.includes('metrics') || desc.includes('tracking') || desc.includes('measure'),
    email: desc.includes('email') || desc.includes('newsletter') || desc.includes('notification'),
    
    // Content concepts
    documentation: desc.includes('document') || desc.includes('docs') || desc.includes('guide') || desc.includes('manual'),
    blog: desc.includes('blog') || desc.includes('article') || desc.includes('post') || desc.includes('content'),
    copy: desc.includes('copy') || desc.includes('text') || desc.includes('writing') || desc.includes('ux'),
  };

  // Generate tech tasks based on detected concepts
  if (concepts.frontend) {
    tasks.tech.push({
      title: `Build ${extractKeyword(taskDescription, ['dashboard', 'page', 'interface', 'ui', 'component'])} Frontend`,
      required_skills: ['React', 'TypeScript', 'CSS', 'Frontend Development'],
      complexity: 'high',
      estimated_hours: 16 + Math.floor(Math.random() * 8),
      reasoning: `Frontend development needed for: ${taskDescription.substring(0, 50)}...`
    });
  }
  
  if (concepts.backend) {
    tasks.tech.push({
      title: `Develop ${extractKeyword(taskDescription, ['api', 'service', 'backend', 'server'])} Backend Services`,
      required_skills: ['Node.js', 'Express', 'MongoDB', 'Backend Architecture'],
      complexity: 'high',
      estimated_hours: 20 + Math.floor(Math.random() * 10),
      reasoning: `Backend/API work required for the task`
    });
  }
  
  if (concepts.security) {
    tasks.tech.push({
      title: 'Implement Security & Authentication',
      required_skills: ['Security', 'Authentication', 'Node.js', 'Backend Architecture'],
      complexity: 'high',
      estimated_hours: 12 + Math.floor(Math.random() * 6),
      reasoning: `Security implementation detected in task requirements`
    });
  }
  
  if (concepts.devops) {
    tasks.tech.push({
      title: 'Setup Deployment & Infrastructure',
      required_skills: ['Docker', 'CI/CD', 'AWS', 'DevOps'],
      complexity: 'medium',
      estimated_hours: 8 + Math.floor(Math.random() * 8),
      reasoning: `DevOps/deployment work needed`
    });
  }
  
  if (concepts.testing) {
    tasks.tech.push({
      title: 'Quality Assurance & Testing',
      required_skills: ['Testing', 'QA', 'Jest', 'Cypress'],
      complexity: 'medium',
      estimated_hours: 10 + Math.floor(Math.random() * 6),
      reasoning: `Testing requirements identified`
    });
  }
  
  if (concepts.performance) {
    tasks.tech.push({
      title: 'Performance Optimization',
      required_skills: ['Performance Optimization', 'Monitoring', 'Profiling'],
      complexity: 'medium',
      estimated_hours: 8 + Math.floor(Math.random() * 4),
      reasoning: `Performance optimization requested`
    });
  }

  // Generate marketing tasks
  if (concepts.campaign) {
    tasks.marketing.push({
      title: `Create ${extractKeyword(taskDescription, ['launch', 'product', 'feature'])} Marketing Campaign`,
      required_skills: ['Campaign Strategy', 'Marketing', 'Brand Management'],
      complexity: 'high',
      estimated_hours: 14 + Math.floor(Math.random() * 6),
      reasoning: `Marketing campaign needed for launch/promotion`
    });
  }
  
  if (concepts.social) {
    tasks.marketing.push({
      title: 'Social Media Strategy & Content',
      required_skills: ['Social Media', 'Content Strategy', 'Copywriting'],
      complexity: 'medium',
      estimated_hours: 10 + Math.floor(Math.random() * 5),
      reasoning: `Social media presence required`
    });
  }
  
  if (concepts.analytics) {
    tasks.marketing.push({
      title: 'Setup Analytics & Tracking',
      required_skills: ['Google Analytics', 'Data Analytics', 'Reporting'],
      complexity: 'medium',
      estimated_hours: 8 + Math.floor(Math.random() * 4),
      reasoning: `Analytics and metrics tracking needed`
    });
  }
  
  if (concepts.email) {
    tasks.marketing.push({
      title: 'Email Marketing & Notifications',
      required_skills: ['Email Marketing', 'Copywriting', 'Campaign Management'],
      complexity: 'medium',
      estimated_hours: 8 + Math.floor(Math.random() * 4),
      reasoning: `Email communication strategy needed`
    });
  }

  // Generate editing/content tasks
  if (concepts.documentation) {
    tasks.editing.push({
      title: `Write ${extractKeyword(taskDescription, ['user', 'technical', 'api', 'product'])} Documentation`,
      required_skills: ['Technical Writing', 'Documentation', 'Content Strategy'],
      complexity: 'high',
      estimated_hours: 12 + Math.floor(Math.random() * 8),
      reasoning: `Documentation required for the project`
    });
  }
  
  if (concepts.blog) {
    tasks.editing.push({
      title: 'Create Blog Posts & Articles',
      required_skills: ['Blog Writing', 'SEO Writing', 'Content Creation'],
      complexity: 'medium',
      estimated_hours: 8 + Math.floor(Math.random() * 6),
      reasoning: `Blog/article content needed`
    });
  }
  
  if (concepts.copy) {
    tasks.editing.push({
      title: 'Write UX Copy & Microcopy',
      required_skills: ['UX Writing', 'Copywriting', 'Microcopy'],
      complexity: 'medium',
      estimated_hours: 6 + Math.floor(Math.random() * 4),
      reasoning: `UX copy and interface text needed`
    });
  }

  // If no specific tasks were generated, create general ones based on the task
  if (tasks.tech.length === 0) {
    tasks.tech.push({
      title: `Technical Implementation: ${taskDescription.substring(0, 40)}`,
      required_skills: ['Full Stack Development', 'React', 'Node.js'],
      complexity: 'medium',
      estimated_hours: 16,
      reasoning: `General technical work for the task`
    });
  }
  
  if (tasks.marketing.length === 0) {
    tasks.marketing.push({
      title: `Marketing Support: ${taskDescription.substring(0, 40)}`,
      required_skills: ['Marketing Strategy', 'Campaign Management'],
      complexity: 'medium',
      estimated_hours: 10,
      reasoning: `Marketing support for the initiative`
    });
  }
  
  if (tasks.editing.length === 0) {
    tasks.editing.push({
      title: `Content & Documentation: ${taskDescription.substring(0, 40)}`,
      required_skills: ['Content Writing', 'Documentation'],
      complexity: 'medium',
      estimated_hours: 8,
      reasoning: `Content creation for the task`
    });
  }

  return tasks;
}

/**
 * Extract a keyword from the task description for task titles
 */
function extractKeyword(taskDescription, keywords) {
  const desc = taskDescription.toLowerCase();
  for (const keyword of keywords) {
    if (desc.includes(keyword)) {
      return keyword.charAt(0).toUpperCase() + keyword.slice(1);
    }
  }
  return '';
}

/**
 * Main allocation function
 * Takes a PM task and returns the full allocation graph
 * Uses Gemini AI for smart breakdown, falls back to templates
 */
async function allocateTask(taskDescription, taskType = null) {
  const data = await loadEmployeeData();
  const detectedType = taskType || detectTaskType(taskDescription);

  // Try Gemini AI first for intelligent task breakdown
  let taskBreakdown = null;
  let aiGenerated = false;
  let thinking = null;

  try {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 Asking Gemini AI to break down the task...');
    console.log('='.repeat(60));
    const aiResult = await generateTaskBreakdown(taskDescription, data.teams);
    if (aiResult) {
      // Extract thinking and tasks
      thinking = aiResult.thinking || null;
      taskBreakdown = {
        tech: aiResult.tech || [],
        marketing: aiResult.marketing || [],
        editing: aiResult.editing || []
      };
      aiGenerated = true;
      console.log('✅ Gemini AI generated task breakdown successfully');
      if (thinking) {
        console.log('\n💭 AI Thinking Process:');
        console.log(`   📋 Task Analysis: ${thinking.task_analysis?.substring(0, 100)}...`);
      }
    }
  } catch (err) {
    console.log('⚠️ Gemini AI failed, falling back to templates:', err.message);
  }

  // Fallback to dynamic task generation if AI didn't work
  if (!taskBreakdown || Object.values(taskBreakdown).every(t => t.length === 0)) {
    console.log('📋 Using dynamic task breakdown based on task description keywords');
    taskBreakdown = generateDynamicTaskBreakdown(taskDescription);
    thinking = {
      task_analysis: `Dynamically generated tasks based on keywords in: "${taskDescription.substring(0, 100)}..."`,
      tech_thinking: 'Technical tasks extracted from task requirements',
      marketing_thinking: 'Marketing tasks extracted from task requirements',
      editing_thinking: 'Content tasks extracted from task requirements'
    };
  }

  const result = {
    product_manager: data.product_manager,
    task_description: taskDescription,
    task_type: detectedType,
    ai_generated: aiGenerated,
    thinking: thinking,
    teams: {}
  };

  // Process each team
  console.log('\n📊 Allocating tasks to team members...');
  for (const [teamKey, teamTasks] of Object.entries(taskBreakdown)) {
    const team = data.teams[teamKey];
    if (!team) continue;
    if (!Array.isArray(teamTasks) || teamTasks.length === 0) continue;

    console.log(`\n🔹 ${team.team_name}:`);

    const teamResult = {
      team_name: team.team_name,
      description: team.description,
      thinking: thinking ? thinking[`${teamKey}_thinking`] : null,
      tasks: []
    };

    // For each task in this team, score all members and find the best fit
    const assignedMembers = new Set(); // Track to avoid over-allocating one person

    for (const task of teamTasks) {
      const memberScores = team.members.map(member => {
        const score = scoreMemberForTask(member, task);
        // Penalize if already assigned to another task
        const overloadPenalty = assignedMembers.has(member.id) ? 0.85 : 1.0;
        return {
          member,
          score: {
            ...score,
            total: Math.round(score.total * overloadPenalty * 100) / 100
          },
          already_assigned: assignedMembers.has(member.id)
        };
      });

      // Sort by total score descending
      memberScores.sort((a, b) => b.score.total - a.score.total);

      const bestMatch = memberScores[0];
      assignedMembers.add(bestMatch.member.id);

      // Generate detailed reasoning using the new function
      const allCandidateScores = memberScores.map(ms => ({
        id: ms.member.id,
        name: ms.member.name,
        total_score: ms.score.total,
        breakdown: ms.score.breakdown
      }));

      const reasoning = generateMemberSelectionReasoning(
        task,
        bestMatch.member,
        bestMatch.score,
        allCandidateScores
      );

      teamResult.tasks.push({
        title: task.title,
        description: task.description || '',
        required_skills: task.required_skills,
        complexity: task.complexity,
        estimated_hours: task.estimated_hours,
        task_reasoning: task.reasoning || '',
        assigned_to: {
          id: bestMatch.member.id,
          name: bestMatch.member.name,
          role: bestMatch.member.role,
          years_of_experience: bestMatch.member.years_of_experience,
          availability: bestMatch.member.availability,
          free_slots_per_week: bestMatch.member.free_slots_per_week
        },
        score: bestMatch.score,
        reasoning: reasoning,
        all_candidates: allCandidateScores
      });

      console.log(`   ✓ ${task.title} → ${bestMatch.member.name} (Score: ${Math.round(bestMatch.score.total * 100)})`);
    }

    result.teams[teamKey] = teamResult;
  }

  return result;
}

/**
 * Generate human-readable reasoning for why a member was selected
 */
function generateReasoning(memberScore, task) {
  const { member, score } = memberScore;
  const reasons = [];

  if (score.breakdown.skill_match >= 0.7) {
    reasons.push(`Strong skill match with ${task.required_skills.slice(0, 2).join(', ')}`);
  } else if (score.breakdown.skill_match >= 0.4) {
    reasons.push(`Moderate skill overlap with task requirements`);
  }

  if (member.years_of_experience >= 7) {
    reasons.push(`Highly experienced (${member.years_of_experience} years)`);
  } else if (member.years_of_experience >= 4) {
    reasons.push(`Solid experience (${member.years_of_experience} years)`);
  }

  if (member.free_slots_per_week >= 15) {
    reasons.push(`High availability (${member.free_slots_per_week} free slots/week)`);
  } else if (member.free_slots_per_week >= 8) {
    reasons.push(`Moderate availability (${member.free_slots_per_week} free slots/week)`);
  }

  if (score.breakdown.past_performance >= 0.9) {
    reasons.push(`Excellent past performance record`);
  }

  const topExpertise = Object.entries(member.expertise)
    .sort((a, b) => b[1] - a[1])[0];
  if (topExpertise) {
    reasons.push(`Top expertise: ${topExpertise[0]} (${Math.round(topExpertise[1] * 100)}%)`);
  }

  return reasons;
}

/**
 * NEW: Sequential LLM Allocation
 * Makes separate LLM calls at each node in the graph
 */
async function allocateTaskSequential(taskDescription) {
  const data = await loadEmployeeData();

  // Run the sequential LLM allocation
  const llmResult = await runSequentialAllocation(taskDescription, data.teams);

  if (!llmResult.success) {
    // Fallback to template-based allocation
    console.log('⚠️ Sequential LLM failed, using template fallback');
    return allocateTask(taskDescription);
  }

  // Extract results from each step
  const steps = llmResult.steps;
  const pmStep = steps.find(s => s.step === 'pm_analysis');
  const techStep = steps.find(s => s.step === 'tech_allocation');
  const marketingStep = steps.find(s => s.step === 'marketing_allocation');
  const editingStep = steps.find(s => s.step === 'editing_allocation');

  // Build the result with step-by-step LLM reasoning
  const result = {
    product_manager: data.product_manager,
    task_description: taskDescription,
    task_type: 'ai_sequential',
    ai_generated: true,
    llm_steps: steps.map(s => ({
      step: s.step,
      success: s.success,
      thinking: s.data?.team_thinking || s.data?.analysis || null
    })),
    thinking: {
      task_analysis: pmStep?.data?.analysis || 'Task analyzed by AI',
      tech_thinking: pmStep?.data?.tech_work?.summary || 'Tech work identified',
      marketing_thinking: pmStep?.data?.marketing_work?.summary || 'Marketing work identified',
      editing_thinking: pmStep?.data?.editing_work?.summary || 'Editing work identified'
    },
    teams: {}
  };

  // Process Tech Team
  if (techStep?.success && techStep.data?.assignments) {
    result.teams.tech = buildTeamResult(
      data.teams.tech,
      techStep.data,
      pmStep?.data?.tech_work?.summary
    );
  }

  // Process Marketing Team
  if (marketingStep?.success && marketingStep.data?.assignments) {
    result.teams.marketing = buildTeamResult(
      data.teams.marketing,
      marketingStep.data,
      pmStep?.data?.marketing_work?.summary
    );
  }

  // Process Editing Team
  if (editingStep?.success && editingStep.data?.assignments) {
    result.teams.editing = buildTeamResult(
      data.teams.editing,
      editingStep.data,
      pmStep?.data?.editing_work?.summary
    );
  }

  return result;
}

/**
 * Helper: Build team result from LLM allocation
 */
function buildTeamResult(teamData, allocationData, teamThinking) {
  const tasks = [];

  for (const assignment of allocationData.assignments) {
    // Find the member
    const member = teamData.members.find(m => 
      m.name.toLowerCase() === assignment.assigned_to?.toLowerCase() ||
      m.id === assignment.member_id
    ) || teamData.members[0]; // Fallback to first member

    // Calculate score for this member
    const task = {
      title: assignment.task,
      required_skills: assignment.required_skills || [],
      complexity: assignment.complexity || 'medium',
      estimated_hours: assignment.estimated_hours || 12
    };
    const score = scoreMemberForTask(member, task);

    // Build all candidates with scores
    const allCandidates = teamData.members.map(m => {
      const s = scoreMemberForTask(m, task);
      return {
        id: m.id,
        name: m.name,
        total_score: s.total,
        breakdown: s.breakdown
      };
    }).sort((a, b) => b.total_score - a.total_score);

    tasks.push({
      title: assignment.task,
      description: '',
      required_skills: assignment.required_skills || [],
      complexity: assignment.complexity || 'medium',
      estimated_hours: assignment.estimated_hours || 12,
      task_reasoning: assignment.reasoning || '',
      assigned_to: {
        id: member.id,
        name: member.name,
        role: member.role,
        years_of_experience: member.years_of_experience,
        availability: member.availability,
        free_slots_per_week: member.free_slots_per_week
      },
      score: score,
      reasoning: [assignment.reasoning || 'Selected by AI based on skills and availability'],
      all_candidates: allCandidates
    });
  }

  return {
    team_name: teamData.team_name,
    description: teamData.description,
    thinking: allocationData.team_thinking || teamThinking,
    tasks
  };
}

/**
 * NEW: Hierarchical LLM Allocation - FULLY DYNAMIC
 * Two-level LLM approach where LLM makes ALL decisions:
 * 1. PM Node: LLM identifies what each department needs to do
 * 2. Team Nodes: LLM assigns work to specific members based on profiles
 */
async function allocateTaskHierarchical(taskDescription) {
  const data = await loadEmployeeData();

  // Run the hierarchical LLM allocation
  const hierarchicalResult = await runHierarchicalAllocation(taskDescription, data.teams);

  if (!hierarchicalResult.success) {
    // Fallback to template-based allocation
    console.log('⚠️ Hierarchical LLM failed, using template fallback');
    return allocateTask(taskDescription);
  }

  // Build the final result structure
  const result = {
    product_manager: data.product_manager,
    task_description: taskDescription,
    task_type: 'hierarchical_ai_dynamic',
    ai_generated: true,
    pm_analysis: hierarchicalResult.pm_analysis,
    departments_involved: hierarchicalResult.departments_involved,
    llm_steps: hierarchicalResult.steps.map(s => ({
      step: s.step,
      success: s.success,
      thinking: s.data?.team_analysis || s.data?.analysis || null
    })),
    thinking: {
      task_analysis: hierarchicalResult.pm_analysis,
      tech_thinking: hierarchicalResult.allocations?.tech?.team_analysis || 'No tech work assigned',
      marketing_thinking: hierarchicalResult.allocations?.marketing?.team_analysis || 'No marketing work assigned',
      editing_thinking: hierarchicalResult.allocations?.editing?.team_analysis || 'No editing work assigned'
    },
    teams: {}
  };

  // Process each team's allocations from LLM
  for (const [teamKey, allocation] of Object.entries(hierarchicalResult.allocations)) {
    const teamData = data.teams[teamKey];
    const teamTasks = [];

    // Process each work assignment from the LLM
    for (const assignment of allocation.work_assignments) {
      // Find the assigned member by name
      const member = teamData.members.find(m => 
        m.name.toLowerCase() === assignment.assigned_to_name.toLowerCase()
      );

      if (!member) {
        console.warn(`⚠️ Could not find member: ${assignment.assigned_to_name}`);
        continue;
      }

      // Create a minimal task object for scoring (just for reference scores)
      const taskForScoring = {
        title: assignment.work_item,
        required_skills: [], // No predefined skills - LLM decided
        complexity: 'medium',
        estimated_hours: 12
      };
      const score = scoreMemberForTask(member, taskForScoring);

      // Build all candidates with scores (for comparison)
      const allCandidates = teamData.members.map(m => {
        const s = scoreMemberForTask(m, taskForScoring);
        return {
          id: m.id,
          name: m.name,
          total_score: s.total,
          breakdown: s.breakdown
        };
      }).sort((a, b) => b.total_score - a.total_score);

      teamTasks.push({
        title: assignment.work_item,
        description: '',
        required_skills: [], // LLM-based, no predefined skills
        complexity: 'llm_determined',
        estimated_hours: 0, // LLM decides scope
        task_reasoning: 'Determined by LLM based on department requirements',
        assigned_to: {
          id: member.id,
          name: member.name,
          role: member.role,
          years_of_experience: member.years_of_experience,
          availability: member.availability,
          free_slots_per_week: member.free_slots_per_week
        },
        score: score,
        reasoning: [assignment.reasoning], // LLM's reasoning
        all_candidates: allCandidates
      });
    }

    result.teams[teamKey] = {
      team_name: allocation.team_name,
      description: allocation.description,
      requirements: allocation.requirements, // What the PM node determined this team needs to do
      thinking: allocation.team_analysis, // LLM's allocation strategy
      tasks: teamTasks
    };
  }

  return result;
}

module.exports = {
  allocateTask,
  allocateTaskSequential,
  allocateTaskHierarchical,
  loadEmployeeData,
  scoreMemberForTask,
  TASK_TEMPLATES
};

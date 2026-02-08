const express = require('express');
const router = express.Router();
const { allocateTask, allocateTaskSequential, allocateTaskHierarchical, loadEmployeeData, TASK_TEMPLATES } = require('../services/taskAllocator');
const { runStreamingAllocation } = require('../services/streamingAllocation');

/**
 * GET /api/tasks/employees
 * Returns all employee data with team structure
 */
router.get('/employees', async (req, res) => {
  try {
    const data = await loadEmployeeData();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error loading employee data:', error);
    res.status(500).json({ success: false, error: 'Failed to load employee data' });
  }
});

/**
 * GET /api/tasks/teams
 * Returns just the team structure overview
 */
router.get('/teams', async (req, res) => {
  try {
    const data = await loadEmployeeData();
    const teamsOverview = {};

    for (const [key, team] of Object.entries(data.teams)) {
      teamsOverview[key] = {
        team_name: team.team_name,
        description: team.description,
        member_count: team.members.length,
        members: team.members.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          years_of_experience: m.years_of_experience,
          availability: m.availability
        }))
      };
    }

    res.json({
      success: true,
      product_manager: data.product_manager,
      teams: teamsOverview
    });
  } catch (error) {
    console.error('Error loading teams:', error);
    res.status(500).json({ success: false, error: 'Failed to load team data' });
  }
});

/**
 * GET /api/tasks/templates
 * Returns available task type templates
 */
router.get('/templates', (req, res) => {
  const templateNames = Object.keys(TASK_TEMPLATES).map(key => ({
    id: key,
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    teams: Object.keys(TASK_TEMPLATES[key]),
    total_subtasks: Object.values(TASK_TEMPLATES[key]).reduce((sum, tasks) => sum + tasks.length, 0)
  }));

  res.json({ success: true, templates: templateNames });
});

/**
 * POST /api/tasks/allocate
 * Main endpoint: takes a task description and returns the full allocation graph
 * 
 * Body: {
 *   task_description: string,
 *   task_type?: 'product_launch' | 'feature_release' | 'general',
 *   use_sequential?: boolean (default: false) - use step-by-step LLM calls (old method)
 *   use_hierarchical?: boolean (default: true) - use hierarchical LLM approach (new method)
 * }
 */
router.post('/allocate', async (req, res) => {
  try {
    const { task_description, task_type, use_sequential = false, use_hierarchical = false } = req.body;

    if (!task_description || task_description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'task_description is required'
      });
    }

    // Default to template-based allocation (more reliable, no API quota issues)
    let mode = 'Template-based';
    if (use_hierarchical) {
      mode = 'Hierarchical LLM (PM→Teams→Members)';
    } else if (use_sequential) {
      mode = 'Sequential LLM (node-by-node)';
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 NEW ALLOCATION REQUEST`);
    console.log(`Task: "${task_description.trim()}"`);
    console.log(`Mode: ${mode}`);
    console.log(`${'='.repeat(60)}\n`);

    let allocation;
    
    // Always use template-based allocation first (it's reliable and fast)
    // LLM-based methods can be enabled via flags if needed
    if (use_hierarchical) {
      try {
        allocation = await allocateTaskHierarchical(task_description.trim());
        // Transform hierarchical format to frontend format
        if (allocation && allocation.allocations) {
          allocation = transformHierarchicalToFrontend(allocation, task_description.trim());
        }
      } catch (llmError) {
        console.log('⚠️ Hierarchical LLM failed, falling back to template:', llmError.message);
        allocation = await allocateTask(task_description.trim(), task_type);
      }
    } else if (use_sequential) {
      try {
        allocation = await allocateTaskSequential(task_description.trim());
      } catch (llmError) {
        console.log('⚠️ Sequential LLM failed, falling back to template:', llmError.message);
        allocation = await allocateTask(task_description.trim(), task_type);
      }
    } else {
      // Default: use template-based allocation (no LLM calls, always works)
      allocation = await allocateTask(task_description.trim(), task_type);
    }

    // Save generated subtasks to MongoDB
    try {
      if (allocation && allocation.teams) {
        const Task = require('../models/Task');
        const User = require('../models/User');
        
        const users = await User.find({});
        
        for (const [teamKey, team] of Object.entries(allocation.teams)) {
          if (!team.tasks) continue;
          
          for (const task of team.tasks) {
            const assignedUserId = task.assigned_to?.id;
            const user = users.find(u => u.employee_id === assignedUserId);
            
            // Map team to role_required
            let roleRequired = 'general';
            if (teamKey === 'tech') {
              const skills = task.required_skills || [];
              if (skills.some(s => s.toLowerCase().includes('backend') || s.toLowerCase().includes('node') || s.toLowerCase().includes('express'))) {
                roleRequired = 'backend';
              } else if (skills.some(s => s.toLowerCase().includes('devops') || s.toLowerCase().includes('docker') || s.toLowerCase().includes('ci/cd'))) {
                roleRequired = 'devops';
              } else {
                roleRequired = 'frontend';
              }
            } else if (teamKey === 'marketing') {
              roleRequired = 'marketing';
            } else if (teamKey === 'editing') {
              roleRequired = 'editing';
            }
            
            const newTask = new Task({
              task_id: `TASK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              title: task.title.substring(0, 100),
              description: task.description || task.title,
              role_required: roleRequired,
              priority: 'medium',
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              estimated_hours: task.estimated_hours || 8,
              status: 'allocated',
              allocated_to: user ? user._id : null,
              sprint_name: `Sprint ${new Date().getMonth() + 1}`
            });
            await newTask.save();
          }
        }
        console.log('✅ Allocation results saved to MongoDB Tasks');
      }
    } catch (dbError) {
      console.error('Error saving tasks to MongoDB:', dbError);
    }

    res.json(allocation);
  } catch (error) {
    console.error('Error allocating task:', error);
    res.status(500).json({ success: false, error: 'Failed to allocate task' });
  }
});

/**
 * Transform hierarchical LLM allocation format to frontend-expected format
 */
function transformHierarchicalToFrontend(hierarchicalResult, taskDescription) {
  const { loadEmployeeData } = require('../services/taskAllocator');
  
  return (async () => {
    const data = await loadEmployeeData();
    
    const teams = {};
    
    for (const [teamKey, teamAlloc] of Object.entries(hierarchicalResult.allocations || {})) {
      const teamData = data.teams[teamKey];
      if (!teamData) continue;
      
      const tasks = (teamAlloc.work_assignments || []).map(assignment => {
        // Find the member in the team
        const member = teamData.members.find(m => 
          m.name.toLowerCase() === assignment.assigned_to_name?.toLowerCase()
        );
        
        return {
          title: assignment.work_item,
          description: assignment.work_item,
          required_skills: member?.skills?.slice(0, 3) || [],
          complexity: 'medium',
          estimated_hours: 8,
          task_reasoning: '',
          assigned_to: member ? {
            id: member.id,
            name: member.name,
            role: member.role,
            years_of_experience: member.years_of_experience,
            availability: member.availability,
            free_slots_per_week: member.free_slots_per_week
          } : null,
          score: {
            total: 0.85,
            breakdown: { skill_match: 0.8, experience: 0.8, availability: 0.9, past_performance: 0.85, expertise_depth: 0.8 },
            weights: { skill_match: 0.4, experience: 0.2, availability: 0.2, past_performance: 0.1, expertise_depth: 0.1 }
          },
          reasoning: [assignment.reasoning],
          all_candidates: []
        };
      });
      
      teams[teamKey] = {
        team_name: teamData.team_name,
        description: teamData.description,
        thinking: teamAlloc.team_analysis,
        tasks
      };
    }
    
    return {
      product_manager: data.product_manager,
      task_description: taskDescription,
      task_type: 'general',
      ai_generated: true,
      thinking: {
        task_analysis: hierarchicalResult.pm_analysis || '',
        tech_thinking: hierarchicalResult.allocations?.tech?.team_analysis || '',
        marketing_thinking: hierarchicalResult.allocations?.marketing?.team_analysis || '',
        editing_thinking: hierarchicalResult.allocations?.editing?.team_analysis || ''
      },
      teams
    };
  })();
}

/**
 * GET /api/tasks/allocate/stream
 * Streaming endpoint: generates graph node by node using Server-Sent Events
 * 
 * Query params:
 *   task_description: string - the task to allocate
 * 
 * Events sent:
 *   - allocation_start: Initial event when processing begins
 *   - pm_node_start: PM node begins processing
 *   - pm_node_complete: PM node done with department requirements
 *   - team_node_start: Team node begins (tech/marketing/editing)
 *   - team_node_complete: Team node done
 *   - member_assigned: Each member assignment
 *   - team_skipped: Team not needed for this task
 *   - allocation_complete: All done
 *   - allocation_error: Error occurred
 */
router.get('/allocate/stream', async (req, res) => {
  const { task_description } = req.query;

  if (!task_description || task_description.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'task_description query parameter is required'
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 STREAMING ALLOCATION REQUEST`);
  console.log(`Task: "${task_description.trim()}"`);
  console.log(`Mode: Streaming (node-by-node)`);
  console.log(`${'='.repeat(60)}\n`);

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Function to send SSE events
  const sendEvent = (eventType, data) => {
    console.log(`📤 Sending event: ${eventType}`);
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const employeeData = await loadEmployeeData();
    
    // Run streaming allocation
    await runStreamingAllocation(
      task_description.trim(),
      employeeData.teams,
      sendEvent
    );

    // End the stream
    res.end();

  } catch (error) {
    console.error('Streaming allocation error:', error);
    sendEvent('allocation_error', { error: error.message });
    res.end();
  }
});

module.exports = router;

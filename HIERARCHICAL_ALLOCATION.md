# Hierarchical LLM Task Allocation System

## Overview

This system implements a **two-level hierarchical LLM approach** for intelligent task allocation. Instead of making one large LLM call, we break down the decision-making process into two distinct stages, each with its own LLM prompt focused on a specific decision point.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PM's Task Description                        │
│         "Launch a new AI-powered chatbot feature"                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEVEL 1: PM Analysis                          │
│                  (First LLM Call)                                │
│                                                                   │
│  Input: Task description + Available teams                       │
│  Output: Tasks categorized by department                         │
│                                                                   │
│  Questions answered:                                             │
│  • Which departments need to be involved?                        │
│  • What specific tasks does each department need to do?          │
│  • What skills are required for each task?                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────┴───────────────────┐
        │                                        │
        ▼                                        ▼
┌──────────────────┐              ┌──────────────────────┐
│   Tech Tasks     │              │  Marketing Tasks     │ ...
│   • Build API    │              │  • Create campaign   │
│   • Design UI    │              │  • Run ads          │
└────────┬─────────┘              └──────────┬───────────┘
         │                                   │
         ▼                                   ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│ LEVEL 2: Tech Team          │  │ LEVEL 2: Marketing Team      │
│ (Second LLM Call)           │  │ (Third LLM Call)             │
│                             │  │                              │
│ Input:                      │  │ Input:                       │
│ • Tech tasks from Level 1   │  │ • Marketing tasks from L1    │
│ • Tech team member profiles │  │ • Marketing team profiles    │
│                             │  │                              │
│ Output:                     │  │ Output:                      │
│ • Task → Member assignments │  │ • Task → Member assignments  │
│                             │  │                              │
│ Questions answered:         │  │ Questions answered:          │
│ • Who is best suited?       │  │ • Who has the right skills?  │
│ • Based on what criteria?   │  │ • Why this person?           │
└─────────────────────────────┘  └──────────────────────────────┘
```

## Two-Level Approach

### Level 1: PM-Level Categorization

**Purpose:** Break down the main task into department-specific sub-tasks

**LLM Prompt Focus:**
- Understand the overall task requirements
- Identify which departments should be involved
- Create specific, actionable tasks for each department
- Determine required skills for each task

**Input:**
```json
{
  "task_description": "Launch a new AI-powered chatbot feature",
  "available_departments": [
    {
      "name": "Tech Team",
      "description": "Handles technical development and infrastructure"
    },
    {
      "name": "Marketing Team", 
      "description": "Handles marketing campaigns and analytics"
    },
    {
      "name": "Editing Team",
      "description": "Handles content creation and documentation"
    }
  ]
}
```

**Output:**
```json
{
  "analysis": "This task requires building AI infrastructure, creating user interfaces, and marketing the feature to users.",
  "departments_involved": ["tech", "marketing", "editing"],
  "tech_tasks": [
    {
      "task_title": "Build Chatbot Backend API",
      "required_skills": ["Python", "AI/ML", "API Design"],
      "complexity": "high",
      "estimated_hours": 24
    },
    {
      "task_title": "Integrate AI Model",
      "required_skills": ["Machine Learning", "NLP", "Model Deployment"],
      "complexity": "high",
      "estimated_hours": 20
    }
  ],
  "marketing_tasks": [...],
  "editing_tasks": [...]
}
```

### Level 2: Team-Level Allocation

**Purpose:** Assign each task to the most suitable team member

**LLM Prompt Focus:**
- Analyze team member profiles (skills, experience, availability)
- Match tasks to members based on multiple criteria
- Provide detailed reasoning for each assignment

**Input (for each department):**
```json
{
  "team_name": "Tech Team",
  "tasks": [
    {
      "task_title": "Build Chatbot Backend API",
      "required_skills": ["Python", "AI/ML", "API Design"],
      "complexity": "high",
      "estimated_hours": 24
    }
  ],
  "team_members": [
    {
      "name": "Bob Smith",
      "role": "Backend Engineer",
      "years_of_experience": 8,
      "skills": ["Python", "Neo4j", "AWS", "Docker", "Microservices"],
      "expertise": {
        "Backend Architecture": 0.98,
        "Database Design": 0.93
      },
      "availability": "Partially Free",
      "free_slots_per_week": 10,
      "past_performance_score": 0.95
    }
  ]
}
```

**Output:**
```json
{
  "team_thinking": "Bob Smith is the best fit for backend API work given his Python expertise and backend architecture skills",
  "assignments": [
    {
      "task_title": "Build Chatbot Backend API",
      "assigned_to": "Bob Smith",
      "reasoning": "Bob has 8 years of backend experience with strong Python skills (98% backend architecture expertise). His track record of 95% past performance and experience with microservices make him ideal for building scalable chatbot APIs. He has 10 free slots/week which is sufficient for this 24-hour task."
    }
  ]
}
```

## Why This Approach?

### ✅ Advantages

1. **Better Context Management**
   - Each LLM call has a focused, specific task
   - Less cognitive overload per decision
   - Clearer prompts = better responses

2. **More Detailed Reasoning**
   - PM level: Focus on "what needs to be done"
   - Team level: Focus on "who should do it"
   - Each decision point gets dedicated attention

3. **Improved Accuracy**
   - Decisions are made with relevant context only
   - Team member details only provided when needed
   - Reduces hallucination and improves quality

4. **Flexible & Extensible**
   - Easy to add new departments
   - Can customize prompts per team type
   - Can add more decision levels if needed

5. **Transparent Decision Making**
   - Each LLM step is logged
   - Clear reasoning at each level
   - Easy to debug and improve

### ⚠️ Compared to Single-Pass Approach

**Single Pass (Old):**
```
PM Task → [Single LLM Call] → All assignments
```
- ❌ One giant prompt with everything
- ❌ LLM must juggle all decisions at once
- ❌ Less detailed reasoning
- ✅ Faster (1 API call)

**Hierarchical (New):**
```
PM Task → [LLM 1: Categorize] → [LLM 2: Tech] → [LLM 3: Marketing] → [LLM 4: Editing] → All assignments
```
- ✅ Focused prompts at each stage
- ✅ Detailed reasoning for each decision
- ✅ Better quality assignments
- ❌ Slower (multiple API calls)

## Usage

### API Endpoint

```bash
curl -X POST http://localhost:8000/api/tasks/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Launch a new AI-powered chatbot feature for our mobile app",
    "use_hierarchical": true
  }'
```

### Programmatic Usage

```javascript
const { allocateTaskHierarchical } = require('./services/taskAllocator');

const result = await allocateTaskHierarchical(
  "Launch a new AI-powered chatbot feature for our mobile app"
);

console.log(result.pm_analysis); // PM's analysis
console.log(result.departments_involved); // ["tech", "marketing", "editing"]
console.log(result.teams.tech.tasks); // Tech team task assignments
```

### Test Script

```bash
cd server
node test_hierarchical.js
```

## Implementation Files

1. **`services/hierarchicalLLM.js`** - Core hierarchical allocation logic
   - `pmLevelTaskCategorization()` - Level 1: PM analysis
   - `teamLevelTaskAllocation()` - Level 2: Team member assignment
   - `runHierarchicalAllocation()` - Orchestrates both levels

2. **`services/taskAllocator.js`** - Main allocator with multiple strategies
   - `allocateTask()` - Template-based fallback
   - `allocateTaskSequential()` - Old sequential approach
   - `allocateTaskHierarchical()` - **NEW** hierarchical approach

3. **`routes/tasks.js`** - API endpoints
   - `POST /api/tasks/allocate` with `use_hierarchical: true`

## Response Structure

```javascript
{
  "success": true,
  "allocation": {
    "product_manager": { ... },
    "task_description": "...",
    "task_type": "hierarchical_ai",
    "ai_generated": true,
    "pm_analysis": "Overall task analysis from PM level",
    "departments_involved": ["tech", "marketing", "editing"],
    "llm_steps": [
      {
        "step": "pm_categorization",
        "success": true,
        "thinking": "..."
      },
      {
        "step": "tech_allocation",
        "success": true,
        "thinking": "..."
      }
    ],
    "teams": {
      "tech": {
        "team_name": "Tech Team",
        "description": "...",
        "thinking": "Team-level allocation strategy",
        "tasks": [
          {
            "title": "Build Chatbot Backend API",
            "description": "...",
            "required_skills": ["Python", "AI/ML"],
            "complexity": "high",
            "estimated_hours": 24,
            "assigned_to": {
              "id": "TECH002",
              "name": "Bob Smith",
              "role": "Backend Engineer",
              "years_of_experience": 8,
              "availability": "Partially Free"
            },
            "score": {
              "total": 0.89,
              "breakdown": { ... }
            },
            "reasoning": [
              "Detailed explanation of why Bob was chosen..."
            ]
          }
        ]
      }
    }
  }
}
```

## Best Practices

1. **Use for Complex Tasks**
   - Best for tasks requiring multiple departments
   - Optimal when member selection is nuanced

2. **Monitor LLM Steps**
   - Check `llm_steps` in response for debugging
   - Each step shows success/failure and reasoning

3. **Fallback Handling**
   - System falls back to template-based if LLM fails
   - Graceful degradation ensures reliability

4. **Customize Prompts**
   - Modify prompts in `hierarchicalLLM.js` for your domain
   - Add domain-specific criteria or constraints

## Future Enhancements

- [ ] Add caching for similar tasks
- [ ] Implement parallel team allocations
- [ ] Add confidence scores for assignments
- [ ] Support custom allocation criteria
- [ ] Add A/B testing between methods
- [ ] Implement learning from feedback

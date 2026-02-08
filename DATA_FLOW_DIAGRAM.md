# Data Flow in Fully Dynamic Hierarchical LLM Allocation

## Complete Flow Visualization

```
USER REQUEST
"Launch AI chatbot feature"
         │
         │ API Call
         ▼
┌────────────────────────────────────────────────────────────┐
│              SERVER: /api/tasks/allocate                   │
│                  use_hierarchical: true                    │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           STEP 1: PM NODE (First LLM Call)                  │
│                                                             │
│  INPUT:                                                     │
│  ├─ Task: "Launch AI chatbot feature"                      │
│  └─ Teams: tech (4 members), marketing (3), editing (3)    │
│                                                             │
│  LLM PROMPT:                                                │
│  "Analyze this task and identify what each                 │
│   department needs to do"                                  │
│                                                             │
│  LLM OUTPUT:                                                │
│  {                                                          │
│    "analysis": "Requires AI backend, UI, and marketing",   │
│    "tech_requirements": "Build NLP chatbot, create         │
│                          React UI, deploy infrastructure",  │
│    "marketing_requirements": "Launch campaign, track       │
│                               adoption metrics",            │
│    "editing_requirements": ""                              │
│  }                                                          │
└───────────────┬────────────────────┬────────────────────────┘
                │                    │
         ┌──────┴──────┐      ┌──────┴──────┐
         │             │      │             │
         ▼             ▼      ▼             ▼
    ┌────────┐   ┌─────────┐   ┌──────────────┐
    │  Tech  │   │Marketing│   │   Editing    │
    │  Reqs  │   │  Reqs   │   │ (Skipped -   │
    │        │   │         │   │  no reqs)    │
    └───┬────┘   └────┬────┘   └──────────────┘
        │             │
        ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 2: TECH TEAM NODE (Second LLM Call)            │
│                                                             │
│  INPUT:                                                     │
│  ├─ Requirements: "Build NLP chatbot, create React UI..."  │
│  └─ Team Members (FULL PROFILES):                          │
│     1. Alice Johnson                                        │
│        - Role: Senior Frontend Developer                   │
│        - Skills: React, TypeScript, Node.js, CSS           │
│        - Expertise: Frontend Dev 95%, UI/UX 90%            │
│        - Experience: 5 years                                │
│        - Availability: 8 hours/week                         │
│        - Performance: 92%                                   │
│     2. Bob Smith                                            │
│        - Role: Backend Engineer                             │
│        - Skills: Python, Neo4j, AWS, Docker                 │
│        - Expertise: Backend 98%, Database 93%               │
│        - Experience: 8 years                                │
│        - Availability: 10 hours/week                        │
│        - Performance: 95%                                   │
│     3. Charlie Davis ... (similar detail)                  │
│     4. Diana Prince ... (similar detail)                   │
│                                                             │
│  LLM PROMPT:                                                │
│  "Break down requirements into work items.                 │
│   Assign each to the MOST SUITABLE member.                 │
│   Consider: skills, experience, expertise,                 │
│   availability, performance, working style"                │
│                                                             │
│  LLM OUTPUT:                                                │
│  {                                                          │
│    "team_analysis": "Bob for backend AI work, Alice        │
│                      for React UI, Diana for deploy",      │
│    "work_assignments": [                                    │
│      {                                                      │
│        "work_item": "Build chatbot NLP engine with         │
│                      Python and integrate AI models",      │
│        "assigned_to_name": "Bob Smith",                    │
│        "reasoning": "Bob has 8 years backend exp with      │
│                      Python expertise (98% backend arch).   │
│                      His microservices knowledge and 95%   │
│                      performance make him ideal for        │
│                      scalable AI APIs. 10 hrs/week avail." │
│      },                                                     │
│      {                                                      │
│        "work_item": "Create React chat UI components       │
│                      with real-time messaging",            │
│        "assigned_to_name": "Alice Johnson",                │
│        "reasoning": "Alice's 95% frontend expertise and    │
│                      React specialization perfect for      │
│                      chat interface. Strong UI/UX skills   │
│                      (90%). 8 hrs/week available."         │
│      },                                                     │
│      {                                                      │
│        "work_item": "Deploy chatbot to production with     │
│                      monitoring and scaling",              │
│        "assigned_to_name": "Diana Prince",                 │
│        "reasoning": "Diana's DevOps expertise (97%) and    │
│                      10 years experience make her perfect  │
│                      for production deployment. AWS and    │
│                      monitoring skills critical."          │
│      }                                                      │
│    ]                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│      STEP 3: MARKETING TEAM NODE (Third LLM Call)           │
│                                                             │
│  INPUT:                                                     │
│  ├─ Requirements: "Launch campaign, track adoption..."     │
│  └─ Team Members (FULL PROFILES):                          │
│     1. Elena Rodriguez                                      │
│        - Role: Marketing Lead                               │
│        - Skills: Campaign Strategy, SEO/SEM, Analytics      │
│        - Expertise: Campaign Mgmt 94%, Growth 91%           │
│        - Experience: 7 years                                │
│        - Availability: 12 hours/week                        │
│        - Performance: 93%                                   │
│     2. Frank Morrison ... (similar)                        │
│     3. Grace Kim ... (similar)                             │
│                                                             │
│  LLM PROMPT: (same structure as tech)                      │
│                                                             │
│  LLM OUTPUT:                                                │
│  {                                                          │
│    "team_analysis": "Elena leads campaign, Grace           │
│                      handles analytics",                   │
│    "work_assignments": [                                    │
│      {                                                      │
│        "work_item": "Design and execute AI chatbot         │
│                      launch campaign across channels",     │
│        "assigned_to_name": "Elena Rodriguez",              │
│        "reasoning": "Elena's 7 years marketing lead exp    │
│                      and 94% campaign mgmt expertise.      │
│                      Her B2B SaaS and product launch       │
│                      domain knowledge directly applicable. │
│                      12 hrs/week available."               │
│      },                                                     │
│      {                                                      │
│        "work_item": "Set up analytics to track chatbot     │
│                      adoption and engagement metrics",     │
│        "reasoning": "Grace's 96% data analytics expertise  │
│                      and Google Analytics/SQL skills       │
│                      perfect for metrics tracking. Her     │
│                      product analytics knowledge key."     │
│      }                                                      │
│    ]                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              FINAL RESULT ASSEMBLY                          │
│                                                             │
│  {                                                          │
│    "task_type": "hierarchical_ai_dynamic",                 │
│    "pm_analysis": "Requires AI backend, UI, marketing",    │
│    "departments_involved": ["tech", "marketing"],          │
│    "llm_steps": [                                           │
│      { "step": "pm_node", "success": true },               │
│      { "step": "tech_node", "success": true },             │
│      { "step": "marketing_node", "success": true }         │
│    ],                                                       │
│    "teams": {                                               │
│      "tech": {                                              │
│        "requirements": "Build NLP chatbot...",             │
│        "thinking": "Bob for backend AI work...",           │
│        "tasks": [                                           │
│          {                                                  │
│            "title": "Build chatbot NLP engine...",         │
│            "assigned_to": { "name": "Bob Smith", ... },    │
│            "reasoning": ["Bob has 8 years..."]             │
│          },                                                 │
│          {                                                  │
│            "title": "Create React chat UI...",             │
│            "assigned_to": { "name": "Alice Johnson" },     │
│            "reasoning": ["Alice's 95% frontend..."]        │
│          },                                                 │
│          ...                                                │
│        ]                                                    │
│      },                                                     │
│      "marketing": { ... }                                   │
│    }                                                        │
│  }                                                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  API RESPONSE │
                    │   TO CLIENT   │
                    └───────────────┘
```

## Key Points

### 🎯 PM Node
- **Input**: Just the task + department descriptions
- **Decision**: What does each dept need to do?
- **Output**: Requirements for each department
- **No**: Member details, skills, or assignments yet

### 🏢 Team Nodes (One per Department)
- **Input**: Department requirements + FULL member profiles
- **Decision**: Who should do what?
- **Output**: Work items assigned to specific people
- **Considers**: All employee qualities from JSON

### 💡 What's Different
- ❌ NO "Create task with skills [React, Python]"
- ❌ NO scoring algorithm picking people
- ✅ LLM breaks down work organically
- ✅ LLM picks people based on profiles
- ✅ LLM explains reasoning in detail

### 🔄 Data Flow
```
Task → PM Node → Tech Reqs → Tech Node → Assignments
                → Mkt Reqs → Mkt Node → Assignments
                → Edt Reqs → Edt Node → Assignments
```

Each arrow is an LLM call with specific context!

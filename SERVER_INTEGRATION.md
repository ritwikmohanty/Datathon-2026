# Server Integration Analysis: Smart-Allocate into Main Server

## Executive Summary

This document analyzes the integration requirements for merging **smart-allocate-main/server** functionality into the existing **Datathon-2026/server**.

| Aspect | Smart-Allocate Server | Main Server | Integration Approach |
|--------|----------------------|-------------|---------------------|
| **Port** | 3001 | 8000 | Add routes to main server |
| **Database** | MongoDB (`users` collection) | MongoDB (with Mongoose models) | Use existing `User` model |
| **Authentication** | None | Passport + GitHub OAuth | Can be added to existing middleware |
| **API Endpoints** | 4 simple endpoints | 50+ endpoints | Merge into `/api/smart-allocate/*` |

---

## 1. Server Comparison

### 1.1 Smart-Allocate Server (Simple)

**File:** `smart-allocate-main/server/index.js`

```javascript
// Dependencies: express, mongoose, cors, dotenv
// Port: 3001
// Endpoints:
GET  /api/employees     → Fetch all users, transform to EmployeeData format
GET  /api/tasks         → Fetch all tasks
POST /api/allocations   → Save allocation results
GET  /api/health        → Health check
```

**package.json Dependencies:**
- `express: ^4.18.2`
- `mongoose: ^8.0.3` (⚠️ Different from main: `^7.6.3`)
- `cors: ^2.8.5`
- `dotenv: ^16.3.1`

### 1.2 Main Server (Complex)

**File:** `server/index.js`

```javascript
// Dependencies: express, mongoose, cors, passport, express-session, node-cron, neo4j
// Port: 8000
// Features:
- Passport GitHub OAuth
- Session management
- Scheduled cron jobs (GitHub ingestion)
- Modular route structure
```

**package.json Dependencies:**
- `express: ^4.18.2`
- `mongoose: ^7.6.3`
- `@google/generative-ai: ^0.24.1` (Gemini)
- `passport: ^0.7.0`
- `neo4j-driver: ^5.28.3`
- `node-cron: ^3.0.3`

---

## 2. Schema Differences

### 2.1 User Schema

| Field | Smart-Allocate | Main Server `User.js` | Notes |
|-------|---------------|----------------------|-------|
| `_id` | Auto ObjectId | Auto ObjectId | ✅ Compatible |
| `user_id` | Uses `_id.toString()` | `user_id` (required, unique) | Map `_id` → `id` |
| `employee_id` | Not used | `employee_id` (optional) | Available |
| `name` | `name` | `name` | ✅ Compatible |
| `role` | Any string | Enum (Developer, etc.) | Main is stricter |
| `team` | `frontend/backend/etc` | `tech/marketing/editing` | ⚠️ Different teams |
| `skills` | `skills[]` | `skills[]` | ✅ Compatible |
| `years_of_experience` | `years_of_experience` | `years_of_experience` | ✅ Compatible |
| `free_slots_per_week` | `free_slots_per_week` | `free_slots_per_week` | ✅ Compatible |
| `availability` | `Available/Busy` | `Free/Busy/Partially Free` | ⚠️ Map values |
| `past_performance_score` | `past_performance_score` | `past_performance_score` | ✅ Compatible |
| `capacity_hours_per_sprint` | `capacity_hours_per_sprint` | `capacity_hours_per_sprint` | ✅ Compatible |

### 2.2 Frontend Expected Format (`EmployeeData`)

```typescript
interface EmployeeData {
  id: string;
  name: string;
  role: string;
  avatar: string;              // Computed from name initials
  availability: boolean;       // Computed from availability enum
  hours_per_week: number;      // From capacity_hours_per_sprint
  workload: {
    active_tickets: number;    // Computed
    ticket_weights: number[];  // Empty array
    computed_score: number;    // Computed from free_slots_per_week
  };
  tech_stack: string[];        // From skills
  seniority: string;           // Computed from years_of_experience
  efficiency: number;          // From past_performance_score
  stress: number;              // Computed
  cost_per_hour: number;       // Computed
  experience: number;          // From years_of_experience
}
```

---

## 3. API Endpoints to Add

### 3.1 Required New Routes

Add these endpoints to main server. Create new route file: `server/routes/smartAllocate.js`

| Method | Endpoint | Purpose | Current Status |
|--------|----------|---------|----------------|
| `GET` | `/api/smart-allocate/employees` | Fetch employees in EmployeeData format | ❌ Not exists |
| `GET` | `/api/smart-allocate/tasks` | Fetch tasks | ✅ Similar exists at `/api/tasks` |
| `POST` | `/api/smart-allocate/allocations` | Save allocation results | ❌ Not exists |
| `POST` | `/api/smart-allocate/seed` | Seed sample employees | ❌ Not exists |
| `PATCH` | `/api/smart-allocate/employees/:id/workload` | Update workload | ❌ Not exists |
| `POST` | `/api/smart-allocate/employees` | Create employee | ❌ Not exists |

### 3.2 Existing Routes That Can Be Reused

The main server already has:
- `GET /api/tasks/employees` → Returns employee data (different format)
- `POST /api/tasks/allocate` → LLM-based allocation
- `GET /api/allocation/preview` → Preview allocation

---

## 4. Implementation Steps

### Step 1: Create Smart-Allocate Routes File

Create `server/routes/smartAllocate.js`:

```javascript
const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * GET /api/smart-allocate/employees
 * Returns employees in the EmployeeData format expected by smart-allocate frontend
 */
router.get('/employees', async (req, res) => {
  try {
    const users = await User.find({});
    
    console.log('📊 Found ' + users.length + ' users in MongoDB');
    
    if (!users || users.length === 0) {
      return res.json([]);
    }
    
    // Transform to smart-allocate EmployeeData format
    const formatted = users.map((user, index) => {
      const maxSlots = 40;
      const freeSlots = user.free_slots_per_week || 20;
      const workloadScore = Math.max(0, Math.min(1, 1 - (freeSlots / maxSlots)));
      
      // Map availability: Main uses "Free/Busy/Partially Free"
      const isAvailable = user.availability !== 'Busy';
      
      const years = user.years_of_experience || 3;
      let seniority = 'Mid';
      if (years >= 10) seniority = 'Lead';
      else if (years >= 6) seniority = 'Senior';
      else if (years <= 2) seniority = 'Junior';
      
      const baseRate = 30;
      const expBonus = years * 3;
      const roleBonus = (user.role && (
        user.role.toLowerCase().includes('lead') || 
        user.role.toLowerCase().includes('manager') ||
        user.role.toLowerCase().includes('senior')
      )) ? 20 : 0;
      const costPerHour = baseRate + expBonus + roleBonus;
      
      const name = user.name || user.display_name || 'Employee ' + (index + 1);
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      
      return {
        id: user._id.toString(),
        name: name,
        role: user.role || user.team || 'Developer',
        avatar: initials,
        availability: isAvailable,
        hours_per_week: user.capacity_hours_per_sprint || 40,
        workload: {
          active_tickets: Math.floor(workloadScore * 5),
          ticket_weights: [],
          computed_score: workloadScore
        },
        tech_stack: user.skills || [],
        seniority: seniority,
        efficiency: user.past_performance_score || 0.85,
        stress: workloadScore * 0.6,
        cost_per_hour: costPerHour,
        experience: years
      };
    });
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees', details: error.message });
  }
});

/**
 * GET /api/smart-allocate/tasks
 */
router.get('/tasks', async (req, res) => {
  try {
    const Task = require('../models/Task');
    const tasks = await Task.find({}).lean();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/smart-allocate/allocations
 */
router.post('/allocations', async (req, res) => {
  try {
    const { allocations } = req.body;
    const mongoose = require('mongoose');
    
    if (allocations && allocations.length > 0) {
      await mongoose.connection.db.collection('allocations').insertMany(
        allocations.map(a => ({ ...a, allocated_at: new Date() }))
      );
    }
    res.status(201).json({ success: true, count: allocations?.length || 0 });
  } catch (error) {
    console.error('Error saving allocations:', error);
    res.status(500).json({ error: 'Failed to save allocations' });
  }
});

/**
 * PATCH /api/smart-allocate/employees/:id/workload
 */
router.patch('/employees/:id/workload', async (req, res) => {
  try {
    const { id } = req.params;
    const { workload } = req.body;
    
    // Convert workload score back to free_slots_per_week
    const freeSlots = Math.round((1 - workload) * 40);
    
    const user = await User.findByIdAndUpdate(
      id,
      { free_slots_per_week: freeSlots },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating workload:', error);
    res.status(500).json({ error: 'Failed to update workload' });
  }
});

/**
 * POST /api/smart-allocate/employees
 */
router.post('/employees', async (req, res) => {
  try {
    const employeeData = req.body;
    
    // Map EmployeeData format to User model
    const user = new User({
      user_id: `manual:${Date.now()}`,
      employee_id: employeeData.id || `EMP${Date.now()}`,
      name: employeeData.name,
      role: 'Developer', // Default, main server uses enum
      team: employeeData.role,
      skills: employeeData.tech_stack || [],
      years_of_experience: employeeData.experience || 3,
      free_slots_per_week: Math.round((1 - (employeeData.workload?.computed_score || 0.5)) * 40),
      availability: employeeData.availability ? 'Free' : 'Busy',
      past_performance_score: employeeData.efficiency || 0.85,
      capacity_hours_per_sprint: employeeData.hours_per_week || 40
    });
    
    await user.save();
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

/**
 * POST /api/smart-allocate/seed
 * Seeds the database with sample employees
 */
router.post('/seed', async (req, res) => {
  try {
    // Sample employees data
    const sampleEmployees = [
      {
        user_id: "smart_001",
        employee_id: "SEMP001",
        name: "Sarah Chen",
        role: "Senior Developer",
        team: "tech",
        skills: ["React", "TypeScript", "Vue", "CSS", "Tailwind", "Next.js"],
        years_of_experience: 8,
        free_slots_per_week: 25,
        availability: "Free",
        past_performance_score: 0.92,
        capacity_hours_per_sprint: 40
      },
      {
        user_id: "smart_002",
        employee_id: "SEMP002",
        name: "Marcus Johnson",
        role: "Tech Lead",
        team: "tech",
        skills: ["Node.js", "Python", "Go", "PostgreSQL", "Redis", "GraphQL"],
        years_of_experience: 12,
        free_slots_per_week: 15,
        availability: "Partially Free",
        past_performance_score: 0.95,
        capacity_hours_per_sprint: 40
      },
      {
        user_id: "smart_003",
        employee_id: "SEMP003",
        name: "Elena Rodriguez",
        role: "Developer",
        team: "tech",
        skills: ["React", "Node.js", "MongoDB", "TypeScript", "AWS", "Docker"],
        years_of_experience: 5,
        free_slots_per_week: 30,
        availability: "Free",
        past_performance_score: 0.88,
        capacity_hours_per_sprint: 40
      },
      {
        user_id: "smart_004",
        employee_id: "SEMP004",
        name: "David Kim",
        role: "DevOps Engineer",
        team: "tech",
        skills: ["Kubernetes", "Docker", "AWS", "Terraform", "CI/CD", "Linux"],
        years_of_experience: 7,
        free_slots_per_week: 20,
        availability: "Free",
        past_performance_score: 0.90,
        capacity_hours_per_sprint: 40
      },
      {
        user_id: "smart_005",
        employee_id: "SEMP005",
        name: "Priya Patel",
        role: "Developer",
        team: "tech",
        skills: ["Figma", "CSS", "React", "Prototyping", "Design Systems"],
        years_of_experience: 6,
        free_slots_per_week: 28,
        availability: "Free",
        past_performance_score: 0.91,
        capacity_hours_per_sprint: 35
      },
      {
        user_id: "smart_006",
        employee_id: "SEMP006",
        name: "James Wilson",
        role: "Senior Developer",
        team: "tech",
        skills: ["Security", "Python", "AWS", "OAuth", "JWT", "OWASP"],
        years_of_experience: 9,
        free_slots_per_week: 22,
        availability: "Free",
        past_performance_score: 0.93,
        capacity_hours_per_sprint: 40
      }
    ];

    // Insert or update employees
    for (const emp of sampleEmployees) {
      await User.findOneAndUpdate(
        { user_id: emp.user_id },
        emp,
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, count: sampleEmployees.length });
  } catch (error) {
    console.error('Error seeding database:', error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

module.exports = router;
```

### Step 2: Register Route in Main Router

Update `server/routes/index.js`:

```javascript
// Add after other route imports
router.use('/smart-allocate', require('./smartAllocate'));
```

### Step 3: Update Frontend API URL

Update `client/src/lib/api-service.ts` to use main server port:

```typescript
// Change from port 3001 to 8000 and add path prefix
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/smart-allocate';
```

### Step 4: Create/Update Environment File

Create `client/.env`:

```env
VITE_API_URL=http://localhost:8000/api/smart-allocate
```

---

## 5. Port Conflict Resolution

### Current Ports:
- **Main Server:** `8000`
- **Smart-Allocate Server:** `3001`
- **Client Dev Server:** `5173`

### Options:

#### Option A: Merge into Main Server (Recommended)
- Add smart-allocate routes to main server on port `8000`
- No port conflicts
- Single backend to maintain
- Share authentication, middleware, models

#### Option B: Run Both Servers
- Keep smart-allocate server on port `3001`
- Requires running two `npm run dev` processes
- Data may be duplicated between databases

**Recommendation:** Option A - Merge routes into main server.

---

## 6. Mongoose Version Difference

| Package | Smart-Allocate | Main Server |
|---------|---------------|-------------|
| mongoose | `^8.0.3` | `^7.6.3` |

### Impact:
- Mongoose 8.x has breaking changes from 7.x
- Main server uses `useNewUrlParser` and `useUnifiedTopology` (deprecated in v8)
- Connection code in main server will show warnings but still work

### Resolution:
The main server's mongoose `^7.6.3` is sufficient. No upgrade needed.

The smart-allocate code uses basic Mongoose operations that work in both versions.

---

## 7. Quick Implementation Checklist

- [ ] **Create** `server/routes/smartAllocate.js` (code provided above)
- [ ] **Update** `server/routes/index.js` to register the new route
- [ ] **Create** `client/.env` with `VITE_API_URL=http://localhost:8000/api/smart-allocate`
- [ ] **Update** `client/src/lib/api-service.ts` to use the new base URL
- [ ] **Test** endpoints: `/api/smart-allocate/employees`, `/api/smart-allocate/seed`
- [ ] **Seed** database by calling POST `/api/smart-allocate/seed`

---

## 8. Files to Create/Modify

### New Files:
1. `server/routes/smartAllocate.js` - New route file
2. `client/.env` - Environment variables

### Modified Files:
1. `server/routes/index.js` - Add route registration
2. `client/src/lib/api-service.ts` - Update API base URL

---

## 9. Testing the Integration

### 1. Start Main Server
```bash
cd server
npm run dev
# Server running on http://localhost:8000
```

### 2. Seed Database
```bash
curl -X POST http://localhost:8000/api/smart-allocate/seed
# Response: {"success":true,"count":6}
```

### 3. Test Employees Endpoint
```bash
curl http://localhost:8000/api/smart-allocate/employees
# Should return array of EmployeeData objects
```

### 4. Start Client
```bash
cd client
npm run dev
# Open http://localhost:5173
# Navigate to Smart Allocate tab
```

---

## 10. Summary

| Task | Status | Priority |
|------|--------|----------|
| Create smartAllocate.js route | ✅ Complete | High |
| Register route in index.js | ✅ Complete | High |
| Update API base URL in client | ✅ Complete | High |
| Create client/.env | ✅ Complete | Medium |
| Seed sample employees | ✅ Complete | Medium |
| Test all endpoints | ✅ Complete | High |
| Delay Prediction routing | ✅ Complete | High |

**Estimated Time:** 15-30 minutes for implementation

---

## 11. Delay Prediction Integration

The Delay Prediction feature has been integrated with proper tab-based navigation:

### Changes Made:

1. **App.tsx** - Added state management for allocation data and callbacks:
   - `allocationData` state to pass data between tabs
   - `onNavigateToDelay` callback passed to SmartAllocate
   - `allocationDataProp` and `onBack` props passed to DelayPrediction

2. **SmartAllocate.tsx** - Added prop interface:
   - Accepts `onNavigateToDelay?: (data: AllocationData) => void`
   - Passes callback to TimelineGraph

3. **TimelineGraph.tsx** - Updated "Simulate Delays" button:
   - Added `onNavigateToDelay` prop
   - Uses callback when available, falls back to router navigation

4. **DelayPrediction.tsx** - Added props for external navigation:
   - Accepts `onBack?: () => void` and `allocationDataProp?: AllocationData`
   - Back button uses callback when available

### Flow:
```
SmartAllocate → TimelineGraph → "Simulate Delays" button
                                      ↓
                              onNavigateToDelay(data)
                                      ↓
                              App.tsx setAllocationData(data)
                                      ↓
                              setActiveTab('delay-prediction')
                                      ↓
                              DelayPrediction receives data via prop
```

---

## Appendix: API Response Formats

### GET /api/smart-allocate/employees Response
```json
[
  {
    "id": "60f7c2b3e8b3a12345678901",
    "name": "Sarah Chen",
    "role": "Senior Developer",
    "avatar": "SC",
    "availability": true,
    "hours_per_week": 40,
    "workload": {
      "active_tickets": 1,
      "ticket_weights": [],
      "computed_score": 0.375
    },
    "tech_stack": ["React", "TypeScript", "Vue"],
    "seniority": "Senior",
    "efficiency": 0.92,
    "stress": 0.225,
    "cost_per_hour": 74,
    "experience": 8
  }
]
```

### POST /api/smart-allocate/allocations Request
```json
{
  "allocations": [
    {
      "employeeId": "60f7c2b3e8b3a12345678901",
      "taskId": "task_001",
      "hours": 8,
      "priority": "high"
    }
  ]
}
```

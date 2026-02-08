const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI
console.log('🔄 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Get all employees from your existing 'users' collection
app.get('/api/employees', async (req, res) => {
  try {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    
    console.log('📊 Found ' + users.length + ' users in MongoDB');
    
    // Return empty array if no users (no constraint on minimum)
    if (!users || users.length === 0) {
      console.log('⚠️ No employees in database');
      return res.json([]);
    }
    
    // Transform YOUR schema to the frontend EmployeeData format
    const formatted = users.map((user, index) => {
      const maxSlots = 40;
      const freeSlots = user.free_slots_per_week || 20;
      const workloadScore = Math.max(0, Math.min(1, 1 - (freeSlots / maxSlots)));
      
      const isAvailable = user.availability !== 'Busy' && user.availability !== 'Unavailable';
      
      const years = user.years_of_experience || 3;
      let seniority = 'Mid';
      if (years >= 10) seniority = 'Lead';
      else if (years >= 6) seniority = 'Senior';
      else if (years <= 2) seniority = 'Junior';
      
      const baseRate = 30;
      const expBonus = years * 3;
      const roleBonus = (user.role && (user.role.toLowerCase().includes('lead') || user.role.toLowerCase().includes('manager'))) ? 20 : 0;
      const costPerHour = baseRate + expBonus + roleBonus;
      
      const name = user.name || 'Employee ' + (index + 1);
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
    
    console.log('✅ Returning formatted employees:', formatted.map(e => e.name).join(', '));
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees', details: error.message });
  }
});

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await mongoose.connection.db.collection('tasks').find({}).toArray();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Save allocation results
app.post('/api/allocations', async (req, res) => {
  try {
    const { allocations } = req.body;
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
});

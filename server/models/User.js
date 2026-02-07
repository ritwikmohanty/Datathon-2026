const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    employee_id: { type: String, required: true, unique: true }, // e.g., 'TECH001'
    name: { type: String, required: true },
    email: { type: String, unique: true },
    team: { type: String, required: true }, // 'tech', 'marketing', 'editing', 'product_management' (for PM)
    
    // Fields from original json
    years_of_experience: { type: Number },
    skills: [{ type: String }],
    expertise: { type: Map, of: Number }, // Map of skill name to score (0-1)
    working_style: { type: String },
    availability: { type: String }, // 'Free', 'Busy', 'Partially Free'
    free_slots_per_week: { type: Number },
    past_performance_score: { type: Number },

    // Added by request
    role: { type: String }, // 'frontend', 'backend', 'qa', 'devops', 'Senior Frontend Developer' etc
    jira_account_id: { type: String }, // Jira Cloud accountId for assignment
    capacity_hours_per_sprint: { type: Number, default: 40 }
}, { collection: 'mohak_test_user' });

module.exports = mongoose.model('User', UserSchema);

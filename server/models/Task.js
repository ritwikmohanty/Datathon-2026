const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    task_id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    role_required: { type: String, required: true }, // e.g., 'frontend', 'backend', 'qa'
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    deadline: { type: Date, required: true },
    estimated_hours: { type: Number },
    status: { type: String, default: 'pending' }, // pending, allocated, in_progress, done
    allocated_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    jira_issue_key: { type: String }, // Set after Jira sync
    sprint_name: { type: String },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);

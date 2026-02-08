/**
 * JiraUser Model
 * Stores JIRA user data with their tickets from MongoDB
 * Collection: jira_all_data_Datathon
 */

const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    ticket_id: { type: String },
    key: { type: String },
    summary: { type: String },
    status: { type: String },
    priority: { type: String },
    created: { type: Date },
    updated: { type: Date }
}, { _id: true, strict: false });

const JiraUserSchema = new mongoose.Schema({
    user_id: { type: String },
    name: { type: String },
    email: { type: String },
    tickets: [TicketSchema],
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'jira_all_data_Datathon',
    strict: false  // Allow fields not in schema
});

// Indexes for efficient queries
JiraUserSchema.index({ email: 1 });
JiraUserSchema.index({ name: 1 });
JiraUserSchema.index({ 'tickets.status': 1 });
JiraUserSchema.index({ 'tickets.priority': 1 });

module.exports = mongoose.model('JiraUser', JiraUserSchema);

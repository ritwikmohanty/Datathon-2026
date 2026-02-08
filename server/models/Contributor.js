/**
 * Contributor Model (GitHub Data)
 * Stores GitHub contributor data with their commits from MongoDB
 * Collection: github_all_data_Datathon
 */

const mongoose = require('mongoose');

const CommitDetailSchema = new mongoose.Schema({
    sha: { type: String },
    message: { type: String },
    date: { type: Date },
    author_name: { type: String },
    author_email: { type: String },
    committer_name: { type: String },
    committer_email: { type: String },
    files_changed: { type: Number, default: 0 },
    lines_added: { type: Number, default: 0 },
    lines_deleted: { type: Number, default: 0 }
}, { _id: true, strict: false });

const ContributorSchema = new mongoose.Schema({
    contributor_id: { type: String },
    name: { type: String },
    email: { type: String },
    github_username: { type: String },
    commits: [CommitDetailSchema],
    total_commits: { type: Number, default: 0 },
    total_lines_added: { type: Number, default: 0 },
    total_lines_deleted: { type: Number, default: 0 },
    total_lines_changed: { type: Number, default: 0 },
    first_commit_date: { type: Date },
    last_commit_date: { type: Date },
    timestamp: { type: Date, default: Date.now }
}, {
    timestamps: true,
    collection: 'github_all_data_Datathon',
    strict: false  // Allow fields not in schema
});

// Indexes for efficient queries
ContributorSchema.index({ email: 1 });
ContributorSchema.index({ name: 1 });
ContributorSchema.index({ github_username: 1 });
ContributorSchema.index({ 'commits.date': -1 });
ContributorSchema.index({ total_commits: -1 });

// Virtual for calculating commit frequency (commits per day)
ContributorSchema.virtual('commit_frequency').get(function() {
    if (!this.first_commit_date || !this.last_commit_date) return 0;
    const daysDiff = (this.last_commit_date - this.first_commit_date) / (1000 * 60 * 60 * 24);
    if (daysDiff <= 0) return this.total_commits;
    return this.total_commits / daysDiff;
});

// Virtual for average lines per commit
ContributorSchema.virtual('avg_lines_per_commit').get(function() {
    if (this.total_commits === 0) return 0;
    return Math.round(this.total_lines_changed / this.total_commits);
});

module.exports = mongoose.model('Contributor', ContributorSchema);

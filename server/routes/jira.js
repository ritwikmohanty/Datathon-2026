/**
 * JIRA Routes
 * API endpoints for real JIRA data from MongoDB
 */

const express = require('express');
const router = express.Router();
const JiraUser = require('../models/JiraUser');
const Contributor = require('../models/Contributor');

/**
 * GET /api/jira/users
 * Get all JIRA users with their tickets
 */
router.get('/users', async (req, res) => {
    try {
        const users = await JiraUser.find({}).lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/users/:userId
 * Get a specific JIRA user with their tickets
 */
router.get('/users/:userId', async (req, res) => {
    try {
        const user = await JiraUser.findOne({ user_id: req.params.userId }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/tickets
 * Get all tickets across all users with optional filters
 */
router.get('/tickets', async (req, res) => {
    try {
        const { status, priority, assignee } = req.query;
        
        const users = await JiraUser.find({}).lean();
        
        let allTickets = [];
        for (const user of users) {
            const userTickets = (user.tickets || []).map(ticket => ({
                ...ticket,
                assignee_id: user.user_id,
                assignee_name: user.name,
                assignee_email: user.email
            }));
            allTickets = allTickets.concat(userTickets);
        }
        
        // Apply filters
        if (status) {
            allTickets = allTickets.filter(t => t.status.toLowerCase() === status.toLowerCase());
        }
        if (priority) {
            allTickets = allTickets.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
        }
        if (assignee) {
            allTickets = allTickets.filter(t => 
                t.assignee_name.toLowerCase().includes(assignee.toLowerCase()) ||
                t.assignee_email.toLowerCase().includes(assignee.toLowerCase())
            );
        }
        
        // Sort by updated date (newest first)
        allTickets.sort((a, b) => new Date(b.updated) - new Date(a.updated));
        
        res.json({
            total: allTickets.length,
            tickets: allTickets
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/stats
 * Get aggregated JIRA statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const users = await JiraUser.find({}).lean();
        
        let totalTickets = 0;
        const statusCounts = {};
        const priorityCounts = {};
        const userStats = [];
        
        for (const user of users) {
            const tickets = user.tickets || [];
            totalTickets += tickets.length;
            
            // Count by status
            for (const ticket of tickets) {
                const status = ticket.status || 'Unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
                
                const priority = ticket.priority || 'Unknown';
                priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
            }
            
            // Calculate user stats
            const completed = tickets.filter(t => 
                t.status.toLowerCase() === 'done' || 
                t.status.toLowerCase() === 'closed' ||
                t.status.toLowerCase() === 'resolved'
            ).length;
            
            const inProgress = tickets.filter(t => 
                t.status.toLowerCase() === 'in progress' ||
                t.status.toLowerCase() === 'in review'
            ).length;
            
            userStats.push({
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                total_tickets: tickets.length,
                completed,
                in_progress: inProgress,
                pending: tickets.length - completed - inProgress,
                completion_rate: tickets.length > 0 ? Math.round((completed / tickets.length) * 100) : 0
            });
        }
        
        res.json({
            total_users: users.length,
            total_tickets: totalTickets,
            by_status: statusCounts,
            by_priority: priorityCounts,
            user_breakdown: userStats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/combined
 * Get JIRA users combined with GitHub contributor data
 * Matches by email address
 */
router.get('/combined', async (req, res) => {
    try {
        const jiraUsers = await JiraUser.find({}).lean();
        const contributors = await Contributor.find({}).lean();
        
        // Create email lookup for contributors
        const contributorByEmail = {};
        for (const c of contributors) {
            contributorByEmail[c.email.toLowerCase()] = c;
        }
        
        const combined = jiraUsers.map(user => {
            const contributor = contributorByEmail[user.email.toLowerCase()];
            
            // Calculate JIRA metrics
            const tickets = user.tickets || [];
            const completed = tickets.filter(t => 
                ['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
            ).length;
            const inProgress = tickets.filter(t => 
                ['in progress', 'in review'].includes(t.status.toLowerCase())
            ).length;
            
            // Calculate commit metrics if contributor data exists
            let commitMetrics = null;
            if (contributor) {
                const commits = contributor.commits || [];
                const recentCommits = commits.filter(c => {
                    const commitDate = new Date(c.date);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return commitDate >= thirtyDaysAgo;
                });
                
                // Calculate commit frequency (commits per week over the last 30 days)
                const weeksInPeriod = 4.3; // ~30 days
                const commitsPerWeek = recentCommits.length / weeksInPeriod;
                
                // Calculate average lines per commit
                const totalLines = contributor.total_lines_changed || 0;
                const avgLinesPerCommit = contributor.total_commits > 0 
                    ? Math.round(totalLines / contributor.total_commits) 
                    : 0;
                
                // Calculate velocity score (0-100)
                // Based on: commit frequency, lines changed, recent activity
                const frequencyScore = Math.min(100, commitsPerWeek * 20); // 5 commits/week = 100
                const linesScore = Math.min(100, avgLinesPerCommit / 5); // 500 lines avg = 100
                const recencyScore = recentCommits.length > 0 ? 100 : 50;
                const velocityScore = Math.round((frequencyScore + linesScore + recencyScore) / 3);
                
                commitMetrics = {
                    github_username: contributor.github_username,
                    total_commits: contributor.total_commits,
                    total_lines_added: contributor.total_lines_added,
                    total_lines_deleted: contributor.total_lines_deleted,
                    total_lines_changed: contributor.total_lines_changed,
                    first_commit_date: contributor.first_commit_date,
                    last_commit_date: contributor.last_commit_date,
                    recent_commits_30d: recentCommits.length,
                    commits_per_week: Math.round(commitsPerWeek * 10) / 10,
                    avg_lines_per_commit: avgLinesPerCommit,
                    velocity_score: velocityScore
                };
            }
            
            return {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                jira: {
                    total_tickets: tickets.length,
                    completed,
                    in_progress: inProgress,
                    pending: tickets.length - completed - inProgress,
                    completion_rate: tickets.length > 0 ? Math.round((completed / tickets.length) * 100) : 0,
                    tickets: tickets
                },
                github: commitMetrics,
                has_github_data: !!contributor
            };
        });
        
        res.json(combined);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/delay-factors/:userId
 * Calculate delay prediction factors for a specific user
 * Uses both JIRA ticket data and GitHub commit history
 */
router.get('/delay-factors/:userId', async (req, res) => {
    try {
        const jiraUser = await JiraUser.findOne({ user_id: req.params.userId }).lean();
        if (!jiraUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Find matching contributor by email
        const contributor = await Contributor.findOne({ 
            email: { $regex: new RegExp(jiraUser.email, 'i') } 
        }).lean();
        
        const tickets = jiraUser.tickets || [];
        const commits = contributor?.commits || [];
        
        // Calculate workload metrics
        const openTickets = tickets.filter(t => 
            !['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
        );
        const highPriorityOpen = openTickets.filter(t => 
            ['highest', 'high', 'critical'].includes(t.priority.toLowerCase())
        ).length;
        
        // Calculate commit frequency (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
        const commitsPerWeek = recentCommits.length / 4.3;
        
        // Calculate average time between commits
        let avgDaysBetweenCommits = 0;
        if (commits.length > 1) {
            const sortedCommits = [...commits].sort((a, b) => new Date(a.date) - new Date(b.date));
            let totalDays = 0;
            for (let i = 1; i < sortedCommits.length; i++) {
                const diff = new Date(sortedCommits[i].date) - new Date(sortedCommits[i-1].date);
                totalDays += diff / (1000 * 60 * 60 * 24);
            }
            avgDaysBetweenCommits = totalDays / (sortedCommits.length - 1);
        }
        
        // Calculate productivity score
        const commitFrequencyScore = Math.min(100, commitsPerWeek * 20);
        const workloadScore = Math.max(0, 100 - (openTickets.length * 10));
        const priorityPenalty = highPriorityOpen * 15;
        const productivityScore = Math.max(0, Math.min(100, 
            (commitFrequencyScore + workloadScore) / 2 - priorityPenalty
        ));
        
        // Calculate estimated delay impact if removed
        // Based on: number of open tickets, priority, commit frequency
        const baseDelay = openTickets.length * 0.5; // 0.5 days per open ticket
        const priorityDelay = highPriorityOpen * 1.5; // 1.5 days per high priority ticket
        const frequencyBonus = commitsPerWeek > 3 ? -1 : 0; // Frequent committers are easier to replace
        const estimatedDelayIfRemoved = Math.max(0, baseDelay + priorityDelay + frequencyBonus);
        
        res.json({
            user_id: jiraUser.user_id,
            name: jiraUser.name,
            email: jiraUser.email,
            workload: {
                total_tickets: tickets.length,
                open_tickets: openTickets.length,
                high_priority_open: highPriorityOpen,
                workload_score: Math.min(100, openTickets.length * 15)
            },
            commit_activity: {
                total_commits: contributor?.total_commits || 0,
                recent_commits_30d: recentCommits.length,
                commits_per_week: Math.round(commitsPerWeek * 10) / 10,
                avg_days_between_commits: Math.round(avgDaysBetweenCommits * 10) / 10,
                last_commit_date: contributor?.last_commit_date || null
            },
            productivity_score: Math.round(productivityScore),
            delay_prediction: {
                estimated_delay_if_removed_days: Math.round(estimatedDelayIfRemoved * 10) / 10,
                replacement_difficulty: estimatedDelayIfRemoved > 5 ? 'hard' : 
                    estimatedDelayIfRemoved > 2 ? 'medium' : 'easy',
                single_point_of_failure: highPriorityOpen > 2 && commitsPerWeek > 5
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/jira/recent-activity
 * Get recent JIRA ticket activity for the dashboard
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const users = await JiraUser.find({}).lean();
        
        let allTickets = [];
        for (const user of users) {
            const userTickets = (user.tickets || []).map(ticket => ({
                ...ticket,
                assignee_name: user.name,
                assignee_email: user.email
            }));
            allTickets = allTickets.concat(userTickets);
        }
        
        // Sort by updated date (newest first)
        allTickets.sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));
        
        // Get the most recent tickets
        const recentTickets = allTickets.slice(0, limit).map(ticket => ({
            id: ticket.ticket_id || ticket.key || ticket._id,
            key: ticket.key,
            summary: ticket.summary,
            status: ticket.status,
            priority: ticket.priority,
            assignee: ticket.assignee_name,
            updated: ticket.updated || ticket.created,
            created: ticket.created
        }));
        
        res.json({
            total: allTickets.length,
            recent: recentTickets
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

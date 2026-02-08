const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Sprint = require('../models/Sprint');
const AllocationRun = require('../models/AllocationRun');
const JiraUser = require('../models/JiraUser');
const Contributor = require('../models/Contributor');

/**
 * GET /api/finance/overview
 * Get high-level financial metrics (combines mock data + real JIRA data)
 */
router.get('/overview', async (req, res) => {
    try {
        // Get all users with hourly rates
        const users = await User.find({ hourly_rate: { $exists: true, $gt: 0 } }).lean();
        const avgHourlyRate = users.length > 0 
            ? users.reduce((sum, u) => sum + u.hourly_rate, 0) / users.length 
            : 75;

        // Get mock task statistics
        const tasks = await Task.find({}).lean();
        
        // Get real JIRA ticket statistics
        const jiraUsers = await JiraUser.find({}).lean();
        let jiraTickets = [];
        for (const user of jiraUsers) {
            jiraTickets = jiraTickets.concat(user.tickets || []);
        }
        
        // Combine mock tasks + JIRA tickets
        const mockCompleted = tasks.filter(t => t.status === 'done').length;
        const mockInProgress = tasks.filter(t => t.status === 'in_progress').length;
        const mockPending = tasks.filter(t => t.status === 'pending').length;
        
        const jiraCompleted = jiraTickets.filter(t => 
            ['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
        ).length;
        const jiraInProgress = jiraTickets.filter(t => 
            ['in progress', 'in review'].includes(t.status.toLowerCase())
        ).length;
        const jiraPending = jiraTickets.filter(t => 
            !['done', 'closed', 'resolved', 'in progress', 'in review'].includes(t.status.toLowerCase())
        ).length;
        
        // Combined totals
        const totalTasks = tasks.length + jiraTickets.length;
        const completedTasks = mockCompleted + jiraCompleted;
        const inProgressTasks = mockInProgress + jiraInProgress;
        const pendingTasks = mockPending + jiraPending;
        
        // Calculate hours (estimate JIRA tickets at 8hrs each)
        const mockEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const jiraEstimatedHours = jiraTickets.length * 8; // Default 8hrs per JIRA ticket
        const totalEstimatedHours = mockEstimatedHours + jiraEstimatedHours;
        
        const mockCompletedHours = tasks.filter(t => t.status === 'done')
            .reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const jiraCompletedHours = jiraCompleted * 8;
        const completedHours = mockCompletedHours + jiraCompletedHours;

        // Calculate costs
        const totalBudgetedCost = totalEstimatedHours * avgHourlyRate;
        const actualSpentCost = completedHours * avgHourlyRate;

        // Get issues with cost data
        const issues = await Issue.find({ 'cost.estimated_cost': { $exists: true } }).lean();
        const totalTrackedCost = issues.reduce((sum, i) => sum + (i.cost?.actual_cost || i.cost?.estimated_cost || 0), 0);

        // Calculate ROI (savings vs market rate $150/hr)
        const marketRate = 150;
        const marketCost = totalEstimatedHours * marketRate;
        const savings = marketCost - totalBudgetedCost;
        const roi = totalBudgetedCost > 0 ? (savings / totalBudgetedCost * 100) : 0;

        // Allocation runs for historical data
        const allocationRuns = await AllocationRun.find({}).sort({ created_at: -1 }).limit(30).lean();

        res.json({
            summary: {
                total_budgeted_cost: Math.round(totalBudgetedCost),
                actual_spent_cost: Math.round(actualSpentCost),
                remaining_budget: Math.round(totalBudgetedCost - actualSpentCost),
                market_rate_cost: Math.round(marketCost),
                projected_savings: Math.round(savings),
                roi_percentage: Math.round(roi * 10) / 10,
                avg_hourly_rate: Math.round(avgHourlyRate),
                currency: 'USD'
            },
            tasks: {
                total: totalTasks,
                completed: completedTasks,
                in_progress: inProgressTasks,
                pending: pendingTasks,
                completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
            },
            hours: {
                total_estimated: Math.round(totalEstimatedHours),
                completed: Math.round(completedHours),
                remaining: Math.round(totalEstimatedHours - completedHours)
            },
            data_sources: {
                mock_tasks: tasks.length,
                jira_tickets: jiraTickets.length,
                jira_users: jiraUsers.length
            },
            allocation_history: allocationRuns.slice(0, 10)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/daily-progress
 * Get daily/weekly progress analysis for features (MOCK DATA)
 */
router.get('/daily-progress', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const numDays = parseInt(days);
        const today = new Date();
        
        // Generate mock daily data
        const sortedDays = [];
        let cumulativeCompleted = 0;
        let cumulativeCost = 0;
        let cumulativeHours = 0;
        
        for (let i = numDays - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            const seed = (i * 17 + 11) % 100;
            
            // Less activity on weekends
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const multiplier = isWeekend ? 0.2 : 1;
            
            const completed = Math.floor((3 + (seed % 5)) * multiplier);
            const started = Math.floor((2 + (seed % 4)) * multiplier);
            const delayed = Math.floor((seed % 3) * multiplier);
            const on_track = Math.floor((4 + (seed % 3)) * multiplier);
            const hours_logged = Math.floor((40 + (seed % 30)) * multiplier);
            const cost_incurred = hours_logged * 80; // avg $80/hr
            
            cumulativeCompleted += completed;
            cumulativeCost += cost_incurred;
            cumulativeHours += hours_logged;
            
            sortedDays.push({
                date: dateStr,
                completed,
                started,
                delayed,
                on_track,
                cost_incurred,
                hours_logged,
                cumulative_completed: cumulativeCompleted,
                cumulative_cost: Math.round(cumulativeCost),
                cumulative_hours: Math.round(cumulativeHours)
            });
        }

        res.json({
            period: `${days} days`,
            daily_breakdown: sortedDays,
            totals: {
                total_completed: cumulativeCompleted,
                total_cost: Math.round(cumulativeCost),
                total_hours: Math.round(cumulativeHours),
                avg_daily_completion: Math.round((cumulativeCompleted / numDays) * 10) / 10
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/sprint-analysis
 * Analyze sprint performance and ROI (MOCK DATA)
 */
router.get('/sprint-analysis', async (req, res) => {
    try {
        const avgHourlyRate = 80;
        const now = new Date();
        
        // Generate 6 sprints of mock data
        const sprintAnalysis = [];
        for (let i = 5; i >= 0; i--) {
            const sprintStart = new Date(now.getTime() - (i + 1) * 14 * 24 * 60 * 60 * 1000);
            const sprintEnd = new Date(sprintStart.getTime() + 13 * 24 * 60 * 60 * 1000);
            const seed = (i * 17 + 23) % 100;
            
            const totalTasks = 20 + (seed % 15);
            const completedTasks = Math.floor(totalTasks * (0.7 + (seed % 20) / 100));
            const delayedTasks = Math.floor((100 - seed) % 5);
            
            const totalHours = totalTasks * 8;
            const completedHours = completedTasks * 8;
            
            const plannedCost = totalHours * avgHourlyRate;
            const actualCost = completedHours * avgHourlyRate;
            const delayCost = delayedTasks * avgHourlyRate * 4;
            
            const marketCost = totalHours * 150;
            const savings = marketCost - plannedCost;
            const roi = plannedCost > 0 ? ((savings - delayCost) / plannedCost * 100) : 0;
            
            sprintAnalysis.push({
                sprint_id: `sprint_${6 - i}`,
                name: `Sprint ${6 - i}`,
                state: i === 0 ? 'active' : 'completed',
                start_date: sprintStart.toISOString(),
                end_date: sprintEnd.toISOString(),
                goal: `Deliver feature set ${6 - i}`,
                metrics: {
                    total_tasks: totalTasks,
                    completed_tasks: completedTasks,
                    delayed_tasks: delayedTasks,
                    completion_rate: Math.round((completedTasks / totalTasks) * 100),
                    velocity: Math.round(completedTasks / 14 * 10) / 10
                },
                financials: {
                    planned_cost: Math.round(plannedCost),
                    actual_cost: Math.round(actualCost),
                    delay_cost: Math.round(delayCost),
                    total_cost: Math.round(actualCost + delayCost),
                    savings: Math.round(savings),
                    roi_percentage: Math.round(roi * 10) / 10,
                    currency: 'USD'
                },
                hours: {
                    planned: Math.round(totalHours),
                    completed: Math.round(completedHours),
                    remaining: Math.round(totalHours - completedHours)
                }
            });
        }

        // Calculate overall metrics
        const totalPlannedCost = sprintAnalysis.reduce((sum, s) => sum + s.financials.planned_cost, 0);
        const totalActualCost = sprintAnalysis.reduce((sum, s) => sum + s.financials.total_cost, 0);
        const totalSavings = sprintAnalysis.reduce((sum, s) => sum + s.financials.savings, 0);
        const avgRoi = sprintAnalysis.length > 0 
            ? sprintAnalysis.reduce((sum, s) => sum + s.financials.roi_percentage, 0) / sprintAnalysis.length
            : 0;

        res.json({
            sprints: sprintAnalysis,
            overall: {
                total_planned_cost: Math.round(totalPlannedCost),
                total_actual_cost: Math.round(totalActualCost),
                total_savings: Math.round(totalSavings),
                average_roi: Math.round(avgRoi * 10) / 10,
                sprints_analyzed: sprintAnalysis.length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/feature-costs
 * Break down costs by feature/epic
 */
router.get('/feature-costs', async (req, res) => {
    try {
        // Get issues grouped by epic
        const issues = await Issue.find({}).lean();
        const users = await User.find({ hourly_rate: { $exists: true, $gt: 0 } }).lean();
        const avgHourlyRate = users.length > 0 
            ? users.reduce((sum, u) => sum + u.hourly_rate, 0) / users.length 
            : 75;

        // Group by epic
        const epicGroups = {};
        
        issues.forEach(issue => {
            const epicKey = issue.epic_key || 'No Epic';
            if (!epicGroups[epicKey]) {
                epicGroups[epicKey] = {
                    epic_key: epicKey,
                    issues: [],
                    total_story_points: 0,
                    completed_story_points: 0,
                    estimated_cost: 0,
                    actual_cost: 0,
                    time_spent_hours: 0
                };
            }
            
            epicGroups[epicKey].issues.push(issue);
            epicGroups[epicKey].total_story_points += issue.story_points || 0;
            
            if (issue.status === 'Done' || issue.resolution === 'Done') {
                epicGroups[epicKey].completed_story_points += issue.story_points || 0;
            }
            
            epicGroups[epicKey].estimated_cost += issue.cost?.estimated_cost || 
                (issue.original_estimate_hours || 0) * avgHourlyRate;
            epicGroups[epicKey].actual_cost += issue.cost?.actual_cost || 
                (issue.time_spent_hours || 0) * avgHourlyRate;
            epicGroups[epicKey].time_spent_hours += issue.time_spent_hours || 0;
        });

        // Calculate metrics for each epic
        const features = Object.values(epicGroups).map(epic => {
            const completionRate = epic.total_story_points > 0 
                ? (epic.completed_story_points / epic.total_story_points) * 100 
                : 0;
            
            const costVariance = epic.estimated_cost > 0 
                ? ((epic.actual_cost - epic.estimated_cost) / epic.estimated_cost) * 100 
                : 0;

            // Determine status
            let status = 'on_track';
            if (costVariance > 20) status = 'over_budget';
            else if (completionRate < 50 && costVariance > 10) status = 'at_risk';
            else if (completionRate >= 100) status = 'completed';

            return {
                ...epic,
                issues: epic.issues.length,
                completion_rate: Math.round(completionRate),
                estimated_cost: Math.round(epic.estimated_cost),
                actual_cost: Math.round(epic.actual_cost),
                cost_variance_percent: Math.round(costVariance * 10) / 10,
                status,
                currency: 'USD'
            };
        });

        // Sort by cost (highest first)
        features.sort((a, b) => b.actual_cost - a.actual_cost);

        res.json({
            features: features.slice(0, 20),
            summary: {
                total_features: features.length,
                total_estimated_cost: Math.round(features.reduce((sum, f) => sum + f.estimated_cost, 0)),
                total_actual_cost: Math.round(features.reduce((sum, f) => sum + f.actual_cost, 0)),
                features_at_risk: features.filter(f => f.status === 'at_risk' || f.status === 'over_budget').length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/risk-assessment
 * Get cost risk assessment
 */
router.get('/risk-assessment', async (req, res) => {
    try {
        const tasks = await Task.find({}).lean();
        const users = await User.find({ hourly_rate: { $exists: true, $gt: 0 } }).lean();
        const avgHourlyRate = users.length > 0 
            ? users.reduce((sum, u) => sum + u.hourly_rate, 0) / users.length 
            : 75;

        const now = new Date();
        
        // Analyze risks
        const risks = [];
        
        // 1. Delayed tasks risk
        const delayedTasks = tasks.filter(t => 
            t.deadline && new Date(t.deadline) < now && t.status !== 'done'
        );
        if (delayedTasks.length > 0) {
            const delayedHours = delayedTasks.reduce((sum, t) => sum + (t.estimated_hours || 8), 0);
            const delayCost = delayedHours * avgHourlyRate * 0.3; // 30% overhead
            risks.push({
                type: 'delayed_tasks',
                severity: delayedTasks.length > 5 ? 'high' : delayedTasks.length > 2 ? 'medium' : 'low',
                count: delayedTasks.length,
                potential_cost_impact: Math.round(delayCost),
                description: `${delayedTasks.length} tasks are past their deadline`,
                recommendation: 'Prioritize completing delayed tasks or adjust timelines'
            });
        }

        // 2. Resource overallocation risk
        const allocatedTasks = tasks.filter(t => t.allocated_to && t.status !== 'done');
        const userWorkload = {};
        allocatedTasks.forEach(t => {
            const userId = t.allocated_to.toString();
            userWorkload[userId] = (userWorkload[userId] || 0) + (t.estimated_hours || 8);
        });
        
        const overloadedUsers = Object.entries(userWorkload).filter(([_, hours]) => hours > 40);
        if (overloadedUsers.length > 0) {
            risks.push({
                type: 'resource_overload',
                severity: overloadedUsers.length > 3 ? 'high' : 'medium',
                count: overloadedUsers.length,
                potential_cost_impact: Math.round(overloadedUsers.length * avgHourlyRate * 8), // 8h overtime per person
                description: `${overloadedUsers.length} team members are overallocated`,
                recommendation: 'Redistribute tasks or adjust timelines'
            });
        }

        // 3. High-priority unassigned tasks
        const unassignedHighPriority = tasks.filter(t => 
            t.priority === 'high' && !t.allocated_to && t.status === 'pending'
        );
        if (unassignedHighPriority.length > 0) {
            risks.push({
                type: 'unassigned_priority',
                severity: unassignedHighPriority.length > 3 ? 'high' : 'medium',
                count: unassignedHighPriority.length,
                potential_cost_impact: Math.round(unassignedHighPriority.length * avgHourlyRate * 16), // 2 days delay
                description: `${unassignedHighPriority.length} high-priority tasks are not assigned`,
                recommendation: 'Immediately assign resources to high-priority tasks'
            });
        }

        // 4. Sprint scope creep risk (if many pending tasks)
        const pendingCount = tasks.filter(t => t.status === 'pending').length;
        const totalCount = tasks.length;
        if (totalCount > 0 && (pendingCount / totalCount) > 0.6) {
            risks.push({
                type: 'scope_creep',
                severity: 'medium',
                count: pendingCount,
                potential_cost_impact: Math.round(pendingCount * avgHourlyRate * 4),
                description: `${Math.round((pendingCount / totalCount) * 100)}% of tasks are still pending`,
                recommendation: 'Review sprint scope and prioritize essential tasks'
            });
        }

        // Calculate total risk exposure
        const totalRiskCost = risks.reduce((sum, r) => sum + r.potential_cost_impact, 0);
        const highRisks = risks.filter(r => r.severity === 'high').length;
        const mediumRisks = risks.filter(r => r.severity === 'medium').length;

        res.json({
            overall_risk_level: highRisks > 0 ? 'high' : mediumRisks > 2 ? 'medium' : 'low',
            total_risk_exposure: Math.round(totalRiskCost),
            risks: risks.sort((a, b) => {
                const severityOrder = { high: 0, medium: 1, low: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            }),
            summary: {
                high_risks: highRisks,
                medium_risks: mediumRisks,
                low_risks: risks.filter(r => r.severity === 'low').length,
                total_risks: risks.length
            },
            currency: 'USD'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/team-costs
 * Get cost breakdown by team member
 */
router.get('/team-costs', async (req, res) => {
    try {
        const users = await User.find({}).lean();
        const tasks = await Task.find({}).populate('allocated_to').lean();

        const teamCosts = users.map(user => {
            const userTasks = tasks.filter(t => 
                t.allocated_to && t.allocated_to._id.toString() === user._id.toString()
            );
            
            const completedTasks = userTasks.filter(t => t.status === 'done');
            const inProgressTasks = userTasks.filter(t => t.status === 'in_progress');
            
            const totalHours = userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
            const completedHours = completedTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
            
            const hourlyRate = user.hourly_rate || 75;
            const totalCost = totalHours * hourlyRate;
            const costIncurred = completedHours * hourlyRate;

            return {
                user_id: user.user_id,
                name: user.display_name || user.name,
                email: user.email,
                role: user.role,
                team: user.team,
                hourly_rate: hourlyRate,
                metrics: {
                    total_tasks: userTasks.length,
                    completed_tasks: completedTasks.length,
                    in_progress_tasks: inProgressTasks.length,
                    completion_rate: userTasks.length > 0 
                        ? Math.round((completedTasks.length / userTasks.length) * 100) 
                        : 0
                },
                hours: {
                    allocated: Math.round(totalHours),
                    completed: Math.round(completedHours),
                    capacity: user.capacity_hours_per_sprint || 40,
                    utilization: Math.round((totalHours / (user.capacity_hours_per_sprint || 40)) * 100)
                },
                cost: {
                    total_allocated: Math.round(totalCost),
                    incurred: Math.round(costIncurred),
                    remaining: Math.round(totalCost - costIncurred),
                    currency: 'USD'
                }
            };
        });

        // Sort by cost incurred (highest first)
        teamCosts.sort((a, b) => b.cost.incurred - a.cost.incurred);

        const totalAllocated = teamCosts.reduce((sum, t) => sum + t.cost.total_allocated, 0);
        const totalIncurred = teamCosts.reduce((sum, t) => sum + t.cost.incurred, 0);

        res.json({
            team: teamCosts.filter(t => t.metrics.total_tasks > 0),
            summary: {
                total_team_members: teamCosts.filter(t => t.metrics.total_tasks > 0).length,
                total_allocated_cost: Math.round(totalAllocated),
                total_incurred_cost: Math.round(totalIncurred),
                avg_utilization: Math.round(
                    teamCosts.reduce((sum, t) => sum + t.hours.utilization, 0) / (teamCosts.length || 1)
                )
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/finance/dashboard-combined
 * Get comprehensive dashboard data combining mock + real JIRA + GitHub data
 */
router.get('/dashboard-combined', async (req, res) => {
    try {
        // Get all data sources
        const users = await User.find({}).lean();
        const tasks = await Task.find({}).lean();
        const jiraUsers = await JiraUser.find({}).lean();
        const contributors = await Contributor.find({}).lean();
        
        // Process JIRA tickets
        let allJiraTickets = [];
        const jiraUserStats = [];
        for (const jiraUser of jiraUsers) {
            const tickets = jiraUser.tickets || [];
            allJiraTickets = allJiraTickets.concat(tickets.map(t => ({
                ...t,
                assignee: jiraUser.name,
                assignee_email: jiraUser.email
            })));
            
            const completed = tickets.filter(t => 
                ['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
            ).length;
            const inProgress = tickets.filter(t => 
                ['in progress', 'in review'].includes(t.status.toLowerCase())
            ).length;
            
            jiraUserStats.push({
                user_id: jiraUser.user_id,
                name: jiraUser.name,
                email: jiraUser.email,
                total_tickets: tickets.length,
                completed,
                in_progress: inProgress,
                pending: tickets.length - completed - inProgress,
                completion_rate: tickets.length > 0 ? Math.round((completed / tickets.length) * 100) : 0
            });
        }
        
        // Process GitHub contributors
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const contributorStats = contributors.map(c => {
            const commits = c.commits || [];
            const recentCommits = commits.filter(commit => 
                new Date(commit.date) >= thirtyDaysAgo
            );
            const commitsPerWeek = recentCommits.length / 4.3;
            
            return {
                contributor_id: c.contributor_id,
                name: c.name,
                email: c.email,
                github_username: c.github_username,
                total_commits: c.total_commits,
                recent_commits_30d: recentCommits.length,
                commits_per_week: Math.round(commitsPerWeek * 10) / 10,
                total_lines_changed: c.total_lines_changed,
                velocity_score: Math.min(100, Math.round(commitsPerWeek * 20))
            };
        });
        
        // Calculate aggregated stats
        const mockStats = {
            total_tasks: tasks.length,
            completed: tasks.filter(t => t.status === 'done').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            pending: tasks.filter(t => t.status === 'pending').length
        };
        
        const jiraStats = {
            total_tickets: allJiraTickets.length,
            completed: allJiraTickets.filter(t => 
                ['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
            ).length,
            in_progress: allJiraTickets.filter(t => 
                ['in progress', 'in review'].includes(t.status.toLowerCase())
            ).length,
            pending: allJiraTickets.filter(t => 
                !['done', 'closed', 'resolved', 'in progress', 'in review'].includes(t.status.toLowerCase())
            ).length
        };
        
        const githubStats = {
            total_contributors: contributors.length,
            total_commits: contributors.reduce((sum, c) => sum + (c.total_commits || 0), 0),
            recent_commits_30d: contributorStats.reduce((sum, c) => sum + c.recent_commits_30d, 0),
            total_lines_changed: contributors.reduce((sum, c) => sum + (c.total_lines_changed || 0), 0),
            avg_commits_per_week: Math.round(
                (contributorStats.reduce((sum, c) => sum + c.commits_per_week, 0) / (contributors.length || 1)) * 10
            ) / 10
        };
        
        // Combined metrics
        const combinedStats = {
            total_items: mockStats.total_tasks + jiraStats.total_tickets,
            completed: mockStats.completed + jiraStats.completed,
            in_progress: mockStats.in_progress + jiraStats.in_progress,
            pending: mockStats.pending + jiraStats.pending,
            completion_rate: (mockStats.total_tasks + jiraStats.total_tickets) > 0 
                ? Math.round(((mockStats.completed + jiraStats.completed) / 
                    (mockStats.total_tasks + jiraStats.total_tickets)) * 100)
                : 0
        };
        
        // Calculate costs
        const avgHourlyRate = users.length > 0 
            ? users.reduce((sum, u) => sum + (u.hourly_rate || 75), 0) / users.length 
            : 75;
        const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0) +
                                   (allJiraTickets.length * 8);
        const completedHours = tasks.filter(t => t.status === 'done')
            .reduce((sum, t) => sum + (t.estimated_hours || 0), 0) +
            (jiraStats.completed * 8);
        
        res.json({
            summary: {
                mock_data: mockStats,
                jira_data: jiraStats,
                github_data: githubStats,
                combined: combinedStats
            },
            financial: {
                avg_hourly_rate: Math.round(avgHourlyRate),
                total_estimated_hours: Math.round(totalEstimatedHours),
                completed_hours: Math.round(completedHours),
                total_budgeted_cost: Math.round(totalEstimatedHours * avgHourlyRate),
                actual_spent_cost: Math.round(completedHours * avgHourlyRate)
            },
            team: {
                mock_users: users.length,
                jira_users: jiraUsers.length,
                github_contributors: contributors.length,
                jira_user_breakdown: jiraUserStats,
                github_contributor_breakdown: contributorStats.slice(0, 10)
            },
            recent_activity: {
                recent_commits: contributorStats
                    .filter(c => c.recent_commits_30d > 0)
                    .sort((a, b) => b.recent_commits_30d - a.recent_commits_30d)
                    .slice(0, 5),
                top_performers: jiraUserStats
                    .filter(u => u.completion_rate > 0)
                    .sort((a, b) => b.completion_rate - a.completion_rate)
                    .slice(0, 5)
            }
        });
    } catch (err) {
        console.error('Error in dashboard-combined:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

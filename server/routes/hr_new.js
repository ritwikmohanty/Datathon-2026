const express = require('express');
const router = express.Router();
const featherlessService = require('../services/featherlessService');

// Mock team members (16 people) with realistic data
const MOCK_TEAM_MEMBERS = [
    { name: 'Aryan Sanganti', email: 'aryan.sanganti@company.com', role: 'Tech Lead', skills: ['React', 'Node.js', 'MongoDB', 'AWS'], seniority: 4 },
    { name: 'Ritwik Mohanty', email: 'ritwik.mohanty@company.com', role: 'Senior Developer', skills: ['TypeScript', 'React', 'GraphQL', 'PostgreSQL'], seniority: 4 },
    { name: 'Mohak Jaiswal', email: 'mohak.jaiswal@company.com', role: 'Senior Developer', skills: ['Python', 'Django', 'React', 'Docker'], seniority: 3 },
    { name: 'Manu Bhavsar', email: 'manu.bhavsar@company.com', role: 'Developer', skills: ['JavaScript', 'Vue.js', 'Node.js', 'MySQL'], seniority: 2 },
    { name: 'Alex Thompson', email: 'alex.thompson@company.com', role: 'Senior Developer', skills: ['Java', 'Spring Boot', 'Kubernetes', 'React'], seniority: 4 },
    { name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'QA Engineer', skills: ['Selenium', 'Jest', 'Cypress', 'Python'], seniority: 3 },
    { name: 'Michael Rodriguez', email: 'michael.rodriguez@company.com', role: 'DevOps Engineer', skills: ['AWS', 'Terraform', 'Docker', 'CI/CD'], seniority: 3 },
    { name: 'Emily Davis', email: 'emily.davis@company.com', role: 'Developer', skills: ['React', 'TypeScript', 'Tailwind', 'Next.js'], seniority: 2 },
    { name: 'James Wilson', email: 'james.wilson@company.com', role: 'Backend Developer', skills: ['Node.js', 'Express', 'MongoDB', 'Redis'], seniority: 3 },
    { name: 'Priya Sharma', email: 'priya.sharma@company.com', role: 'Full Stack Developer', skills: ['React', 'Python', 'FastAPI', 'PostgreSQL'], seniority: 3 },
    { name: 'David Kim', email: 'david.kim@company.com', role: 'Junior Developer', skills: ['JavaScript', 'React', 'CSS', 'HTML'], seniority: 1 },
    { name: 'Jessica Martinez', email: 'jessica.martinez@company.com', role: 'UI/UX Developer', skills: ['Figma', 'React', 'CSS', 'Animation'], seniority: 2 },
    { name: 'Ryan O\'Connor', email: 'ryan.oconnor@company.com', role: 'Senior Developer', skills: ['Go', 'Rust', 'Microservices', 'gRPC'], seniority: 4 },
    { name: 'Amanda Lee', email: 'amanda.lee@company.com', role: 'Data Engineer', skills: ['Python', 'Spark', 'SQL', 'Airflow'], seniority: 3 },
    { name: 'Chris Brown', email: 'chris.brown@company.com', role: 'Developer', skills: ['Angular', 'TypeScript', '.NET', 'C#'], seniority: 2 },
    { name: 'Natasha Patel', email: 'natasha.patel@company.com', role: 'Project Manager', skills: ['Agile', 'Scrum', 'JIRA', 'Confluence'], seniority: 3 }
];

// Generate random metrics for mock users (seeded by index for consistency)
const generateMockMetrics = (seniority, index) => {
    // Use index to create pseudo-random but consistent values
    const seed = (index * 7 + 13) % 100;
    const baseCommits = 15 + seniority * 12 + (seed % 25);
    const baseTickets = 8 + seniority * 4 + (seed % 10);
    const completionRate = 55 + seniority * 8 + (seed % 15);
    
    return {
        commits: {
            total: baseCommits,
            additions: baseCommits * (600 + (seed * 10)),
            deletions: baseCommits * (150 + (seed * 3)),
            avg_size: 250 + (seed * 5),
            last_commit: new Date(Date.now() - ((seed % 7) + 1) * 24 * 60 * 60 * 1000).toISOString()
        },
        tasks: {
            total: baseTickets,
            completed: Math.floor(baseTickets * completionRate / 100),
            in_progress: Math.max(1, Math.floor(baseTickets * 0.2)),
            pending: Math.max(0, Math.ceil(baseTickets * (1 - completionRate / 100) * 0.5)),
            overdue: seed % 4,
            completion_rate: completionRate
        },
        hours: {
            total_estimated: baseTickets * 8,
            completed: Math.floor(baseTickets * completionRate / 100) * 8
        },
        performance: {
            workload_score: 25 + (seed % 45),
            stress_level: 15 + (seed % 35),
            efficiency: completionRate,
            productivity_score: 50 + seniority * 10 + (seed % 20)
        }
    };
};

/**
 * GET /api/hr/employees
 * Get all employees (mock team with random metrics)
 */
router.get('/employees', async (req, res) => {
    try {
        const employees = MOCK_TEAM_MEMBERS.map((member, index) => {
            const metrics = generateMockMetrics(member.seniority, index);
            const hourlyRates = { 1: 55, 2: 70, 3: 85, 4: 100 };
            
            return {
                _id: `emp_${index + 1}`,
                user_id: `user_${index + 1}`,
                employee_id: `EMP${String(index + 1).padStart(3, '0')}`,
                name: member.name,
                email: member.email,
                role: member.role,
                department: 'Engineering',
                team: 'Core Team',
                skills: member.skills,
                seniority_level: member.seniority,
                hourly_rate: hourlyRates[member.seniority] || 75,
                years_of_experience: member.seniority + ((index * 3) % 4),
                availability: 'full-time',
                jira_linked: true,
                github_linked: true,
                source: 'mock',
                metrics
            };
        });
        
        console.log(`HR /employees: Returning ${employees.length} mock team members`);
        res.json(employees);
    } catch (err) {
        console.error('HR employees error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/employee/:id
 */
router.get('/employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const index = parseInt(id.replace('emp_', '')) - 1;
        
        if (index >= 0 && index < MOCK_TEAM_MEMBERS.length) {
            const member = MOCK_TEAM_MEMBERS[index];
            const metrics = generateMockMetrics(member.seniority, index);
            
            return res.json({
                employee: {
                    _id: `emp_${index + 1}`,
                    name: member.name,
                    email: member.email,
                    role: member.role,
                    team: 'Core Team',
                    skills: member.skills
                },
                commits: {
                    total: metrics.commits.total,
                    recent_30_days: Math.floor(metrics.commits.total * 0.3),
                    by_week: [],
                    tech_distribution: {}
                },
                tasks: metrics.tasks,
                issues: { total: metrics.tasks.total, linked_to_commits: metrics.tasks.completed }
            });
        }
        
        return res.status(404).json({ error: 'Employee not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/retention-analysis
 */
router.get('/retention-analysis', async (req, res) => {
    try {
        const retentionAnalysis = MOCK_TEAM_MEMBERS.map((member, index) => {
            const metrics = generateMockMetrics(member.seniority, index);
            const seed = (index * 7 + 13) % 100;
            
            const workloadFactor = metrics.performance.workload_score / 100;
            const activityTrend = 0.5 + (seed % 40) / 100;
            const overdueStress = metrics.tasks.overdue / Math.max(1, metrics.tasks.total);
            
            const riskScore = Math.round(
                (workloadFactor * 40) + 
                ((1 - activityTrend) * 30) + 
                (overdueStress * 30)
            );
            
            let riskLevel = 'low';
            if (riskScore >= 70) riskLevel = 'critical';
            else if (riskScore >= 50) riskLevel = 'high';
            else if (riskScore >= 30) riskLevel = 'medium';
            
            const recommendations = [];
            if (workloadFactor > 0.6) {
                recommendations.push({ type: 'workload', message: 'Consider redistributing tasks to reduce workload', priority: 'high' });
            }
            if (overdueStress > 0.2) {
                recommendations.push({ type: 'deadline', message: 'Review and extend deadlines for overdue tasks', priority: 'high' });
            }
            if (riskScore < 30) {
                recommendations.push({ type: 'positive', message: 'Employee shows healthy engagement levels', priority: 'info' });
            }
            
            return {
                employee: {
                    _id: `emp_${index + 1}`,
                    name: member.name,
                    email: member.email,
                    role: member.role,
                    team: 'Core Team',
                    department: 'Engineering'
                },
                metrics: {
                    workload_factor: Math.round(workloadFactor * 100),
                    activity_trend: Math.round(activityTrend * 100),
                    overdue_stress: Math.round(overdueStress * 100),
                    recent_commits: Math.floor(metrics.commits.total * 0.3),
                    active_tasks: metrics.tasks.in_progress + metrics.tasks.pending,
                    overdue_tasks: metrics.tasks.overdue,
                    completed_tasks: metrics.tasks.completed
                },
                risk: { score: riskScore, level: riskLevel },
                recommendations,
                jira_linked: true,
                github_linked: true
            };
        });
        
        retentionAnalysis.sort((a, b) => b.risk.score - a.risk.score);
        
        const summary = {
            total_employees: MOCK_TEAM_MEMBERS.length,
            critical_risk: retentionAnalysis.filter(e => e.risk.level === 'critical').length,
            high_risk: retentionAnalysis.filter(e => e.risk.level === 'high').length,
            medium_risk: retentionAnalysis.filter(e => e.risk.level === 'medium').length,
            low_risk: retentionAnalysis.filter(e => e.risk.level === 'low').length,
            avg_risk_score: Math.round(retentionAnalysis.reduce((sum, e) => sum + e.risk.score, 0) / MOCK_TEAM_MEMBERS.length)
        };
        
        console.log(`HR /retention-analysis: Returning ${retentionAnalysis.length} employees`);
        res.json({ summary, employees: retentionAnalysis });
    } catch (err) {
        console.error('HR retention-analysis error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/team-stats
 */
router.get('/team-stats', async (req, res) => {
    try {
        let totalCommits = 0;
        let totalTasks = 0;
        let completedTasks = 0;
        let totalHours = 0;
        let totalCost = 0;
        
        const hourlyRates = { 1: 55, 2: 70, 3: 85, 4: 100 };
        
        MOCK_TEAM_MEMBERS.forEach((member, index) => {
            const metrics = generateMockMetrics(member.seniority, index);
            totalCommits += metrics.commits.total;
            totalTasks += metrics.tasks.total;
            completedTasks += metrics.tasks.completed;
            totalHours += metrics.hours.completed;
            totalCost += metrics.hours.completed * (hourlyRates[member.seniority] || 75);
        });
        
        const teamStats = {
            'Core Team': {
                name: 'Core Team',
                member_count: MOCK_TEAM_MEMBERS.length,
                total_commits: totalCommits,
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                completion_rate: Math.round((completedTasks / totalTasks) * 100),
                total_hours: totalHours,
                total_cost: totalCost,
                avg_commits_per_member: Math.round(totalCommits / MOCK_TEAM_MEMBERS.length),
                avg_tasks_per_member: Math.round(totalTasks / MOCK_TEAM_MEMBERS.length)
            }
        };
        
        res.json({
            teams: Object.values(teamStats),
            summary: {
                total_teams: 1,
                total_members: MOCK_TEAM_MEMBERS.length,
                total_commits: totalCommits,
                total_tasks: totalTasks,
                overall_completion_rate: Math.round((completedTasks / totalTasks) * 100)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/sprint-analysis
 */
router.get('/sprint-analysis', async (req, res) => {
    try {
        const sprints = [];
        const now = new Date();
        
        // Generate 6 sprints of mock data
        for (let i = 5; i >= 0; i--) {
            const sprintStart = new Date(now.getTime() - (i + 1) * 14 * 24 * 60 * 60 * 1000);
            const sprintEnd = new Date(sprintStart.getTime() + 13 * 24 * 60 * 60 * 1000);
            const seed = (i * 17 + 23) % 100;
            
            const planned = 25 + (seed % 15);
            const completed = Math.floor(planned * (0.7 + (seed % 20) / 100));
            const carried = planned - completed;
            
            sprints.push({
                sprint_id: `sprint_${6 - i}`,
                name: `Sprint ${6 - i}`,
                start_date: sprintStart.toISOString(),
                end_date: sprintEnd.toISOString(),
                status: i === 0 ? 'active' : 'completed',
                planned_points: planned,
                completed_points: completed,
                carried_over: carried,
                velocity: completed,
                completion_rate: Math.round((completed / planned) * 100),
                team_capacity: MOCK_TEAM_MEMBERS.length * 40,
                utilized_capacity: Math.floor(MOCK_TEAM_MEMBERS.length * 40 * (0.75 + (seed % 15) / 100)),
                blockers: (seed % 4),
                bugs_found: 2 + (seed % 5),
                bugs_fixed: 1 + (seed % 4)
            });
        }
        
        const avgVelocity = Math.round(sprints.reduce((sum, s) => sum + s.velocity, 0) / sprints.length);
        const avgCompletion = Math.round(sprints.reduce((sum, s) => sum + s.completion_rate, 0) / sprints.length);
        
        res.json({
            sprints,
            summary: {
                total_sprints: sprints.length,
                avg_velocity: avgVelocity,
                avg_completion_rate: avgCompletion,
                total_points_completed: sprints.reduce((sum, s) => sum + s.completed_points, 0),
                velocity_trend: 'stable'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/daily-progress
 */
router.get('/daily-progress', async (req, res) => {
    try {
        const dailyProgress = [];
        const now = new Date();
        
        // Generate 14 days of mock data
        for (let i = 13; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayOfWeek = day.getDay();
            const seed = (i * 11 + 7) % 100;
            
            // Less activity on weekends
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const multiplier = isWeekend ? 0.3 : 1;
            
            dailyProgress.push({
                date: day.toISOString().split('T')[0],
                day_name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
                commits: Math.floor((12 + (seed % 20)) * multiplier),
                tasks_completed: Math.floor((4 + (seed % 6)) * multiplier),
                tasks_started: Math.floor((3 + (seed % 5)) * multiplier),
                code_reviews: Math.floor((2 + (seed % 4)) * multiplier),
                bugs_fixed: Math.floor((1 + (seed % 3)) * multiplier),
                hours_logged: Math.floor((MOCK_TEAM_MEMBERS.length * 7 + (seed % 20)) * multiplier),
                active_developers: Math.floor(MOCK_TEAM_MEMBERS.length * (isWeekend ? 0.2 : 0.9))
            });
        }
        
        const totalCommits = dailyProgress.reduce((sum, d) => sum + d.commits, 0);
        const totalTasksCompleted = dailyProgress.reduce((sum, d) => sum + d.tasks_completed, 0);
        const avgDailyCommits = Math.round(totalCommits / 14);
        
        res.json({
            daily_progress: dailyProgress,
            summary: {
                total_commits: totalCommits,
                total_tasks_completed: totalTasksCompleted,
                avg_daily_commits: avgDailyCommits,
                avg_daily_tasks: Math.round(totalTasksCompleted / 14),
                most_active_day: 'Wednesday',
                least_active_day: 'Sunday'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/delay-prediction-data
 */
router.get('/delay-prediction-data', async (req, res) => {
    try {
        const delayPredictionData = MOCK_TEAM_MEMBERS.map((member, index) => {
            const metrics = generateMockMetrics(member.seniority, index);
            const seed = (index * 7 + 13) % 100;
            
            const velocityScore = 50 + member.seniority * 10 + (seed % 20);
            const workloadScore = metrics.performance.workload_score;
            const productivityScore = metrics.performance.productivity_score;
            
            const delayImpact = Math.round((metrics.tasks.in_progress * 0.5 + metrics.tasks.pending * 0.3) * 10) / 10;
            
            return {
                id: `emp_${index + 1}`,
                name: member.name,
                email: member.email,
                role: member.role,
                source: 'mock',
                skills: member.skills,
                hourly_rate: { 1: 55, 2: 70, 3: 85, 4: 100 }[member.seniority] || 75,
                commit_metrics: {
                    total_commits: metrics.commits.total,
                    recent_commits_30d: Math.floor(metrics.commits.total * 0.3),
                    commits_per_week: Math.round(metrics.commits.total / 4 * 10) / 10,
                    avg_lines_per_commit: metrics.commits.avg_size,
                    velocity_score: velocityScore
                },
                jira_metrics: {
                    total_tickets: metrics.tasks.total,
                    open_tickets: metrics.tasks.in_progress + metrics.tasks.pending,
                    completed_tickets: metrics.tasks.completed,
                    in_progress_tickets: metrics.tasks.in_progress,
                    high_priority_open: seed % 3,
                    completion_rate: metrics.tasks.completion_rate
                },
                task_metrics: {
                    assigned_tasks: metrics.tasks.total,
                    completed_tasks: metrics.tasks.completed,
                    in_progress_tasks: metrics.tasks.in_progress,
                    overdue_tasks: metrics.tasks.overdue
                },
                scores: {
                    workload: workloadScore,
                    productivity: productivityScore,
                    velocity: velocityScore
                },
                delay_prediction: {
                    impact_if_removed_days: delayImpact,
                    replacement_difficulty: delayImpact > 3 ? 'hard' : delayImpact > 1.5 ? 'medium' : 'easy',
                    burnout_risk: workloadScore > 60 ? 'high' : workloadScore > 35 ? 'medium' : 'low',
                    single_point_of_failure: member.seniority >= 4 && delayImpact > 2
                },
                jira_linked: true,
                github_linked: true
            };
        });
        
        delayPredictionData.sort((a, b) => b.scores.productivity - a.scores.productivity);
        
        console.log(`HR /delay-prediction-data: Returning ${delayPredictionData.length} employees`);
        res.json({
            total: delayPredictionData.length,
            employees: delayPredictionData
        });
    } catch (err) {
        console.error('Error in delay-prediction-data:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/hr/burnout-analysis
 */
router.post('/burnout-analysis', async (req, res) => {
    try {
        const { employee_ids } = req.body;
        
        const analyses = (employee_ids || MOCK_TEAM_MEMBERS.map((_, i) => `emp_${i + 1}`)).map((id) => {
            const index = parseInt(id.replace('emp_', '')) - 1;
            if (index < 0 || index >= MOCK_TEAM_MEMBERS.length) return null;
            
            const member = MOCK_TEAM_MEMBERS[index];
            const metrics = generateMockMetrics(member.seniority, index);
            const seed = (index * 7 + 13) % 100;
            
            const burnoutScore = Math.min(100, metrics.performance.workload_score + (seed % 20));
            
            return {
                employee_id: id,
                name: member.name,
                role: member.role,
                burnout_score: burnoutScore,
                risk_level: burnoutScore > 70 ? 'high' : burnoutScore > 40 ? 'medium' : 'low',
                factors: {
                    workload: metrics.performance.workload_score,
                    overtime_hours: seed % 15,
                    consecutive_work_days: 5 + (seed % 8),
                    vacation_days_remaining: 10 - (seed % 6)
                },
                recommendations: burnoutScore > 50 ? [
                    'Consider taking time off',
                    'Redistribute some tasks to other team members'
                ] : ['Maintain current work-life balance']
            };
        }).filter(Boolean);
        
        res.json({
            analyses,
            team_avg_burnout: Math.round(analyses.reduce((sum, a) => sum + a.burnout_score, 0) / analyses.length)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper function
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

module.exports = router;

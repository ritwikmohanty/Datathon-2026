const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Commit = require('../models/Commit');
const Task = require('../models/Task');
const Issue = require('../models/Issue');
const JiraUser = require('../models/JiraUser');
const Contributor = require('../models/Contributor');
const featherlessService = require('../services/featherlessService');

// Mock team members (14+ people) with realistic data
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

// Generate random metrics for mock users
const generateMockMetrics = (seniority, index) => {
    const baseCommits = 10 + seniority * 15 + Math.floor(Math.random() * 30);
    const baseTickets = 5 + seniority * 5 + Math.floor(Math.random() * 15);
    const completionRate = 50 + seniority * 10 + Math.floor(Math.random() * 20);
    
    return {
        commits: {
            total: baseCommits,
            additions: baseCommits * (500 + Math.floor(Math.random() * 1000)),
            deletions: baseCommits * (100 + Math.floor(Math.random() * 300)),
            avg_size: 200 + Math.floor(Math.random() * 500),
            last_commit: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString()
        },
        tasks: {
            total: baseTickets,
            completed: Math.floor(baseTickets * completionRate / 100),
            in_progress: Math.floor(baseTickets * 0.2),
            pending: Math.ceil(baseTickets * (1 - completionRate / 100) * 0.5),
            overdue: Math.floor(Math.random() * 3),
            completion_rate: completionRate
        },
        hours: {
            total_estimated: baseTickets * 8,
            completed: Math.floor(baseTickets * completionRate / 100) * 8
        },
        performance: {
            workload_score: 30 + Math.floor(Math.random() * 50),
            stress_level: 20 + Math.floor(Math.random() * 40),
            efficiency: completionRate,
            productivity_score: 50 + seniority * 10 + Math.floor(Math.random() * 20)
        }
    };
};

// Helper function to normalize names for comparison (case-insensitive, partial match)
const normalizeNameForMatch = (name) => {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
};

// Helper to check if names match (handles partial matches like "manu" vs "Manu Bhavsar")
const namesMatch = (name1, name2) => {
    const n1 = normalizeNameForMatch(name1);
    const n2 = normalizeNameForMatch(name2);
    if (!n1 || !n2) return false;
    
    // Exact match
    if (n1 === n2) return true;
    
    // First name match
    const firstName1 = n1.split(' ')[0];
    const firstName2 = n2.split(' ')[0];
    if (firstName1 === firstName2 && firstName1.length >= 3) return true;
    
    // One contains the other (for usernames like "ritwikmohanty")
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // Remove spaces and compare (for "mohakjaiswal" vs "mohak jaiswal")
    const n1NoSpace = n1.replace(/\s/g, '');
    const n2NoSpace = n2.replace(/\s/g, '');
    if (n1NoSpace === n2NoSpace) return true;
    if (n1NoSpace.includes(n2NoSpace) || n2NoSpace.includes(n1NoSpace)) return true;
    
    return false;
};

/**
 * GET /api/hr/employees
 * Get all employees (mock team with random metrics)
 * Returns 16 team members with realistic commit/task data
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
                years_of_experience: member.seniority + Math.floor(Math.random() * 3),
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
 * Get detailed metrics for a single employee
 */
router.get('/employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find in mock team
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
 * Get retention risk analysis using mock team data
 */
router.get('/retention-analysis', async (req, res) => {
    try {
        const retentionAnalysis = MOCK_TEAM_MEMBERS.map((member, index) => {
            const metrics = generateMockMetrics(member.seniority, index);
            
            // Calculate risk factors
            const workloadFactor = metrics.performance.workload_score / 100;
            const activityTrend = 0.5 + Math.random() * 0.4;
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
            if (workloadFactor > 0.7) {
                recommendations.push({ type: 'workload', message: 'Consider redistributing tasks to reduce workload', priority: 'high' });
            }
            if (overdueStress > 0.3) {
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
        
        // Sort by risk score descending
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
            
            // Recent commits (last 30 days)
            const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
            
            // Calculate workload factor (high workload = higher stress)
            const activeTickets = inProgressTickets.length + pendingTickets.length;
            const workloadFactor = activeTickets > 0 
                ? Math.min(1, activeTickets / 8)
                : 0.2;
            
            // Calculate activity trend from commits
            const totalCommits = githubData?.total_commits || commits.length;
            const avgCommitsPerMonth = totalCommits / Math.max(1, 6);
            const activityTrend = avgCommitsPerMonth > 0 
                ? Math.min(1, recentCommits.length / avgCommitsPerMonth)
                : 0.5;
            
            // Calculate overdue stress (using high priority as proxy)
            const highPriorityOpen = tickets.filter(t => 
                ['highest', 'high', 'critical'].includes((t.priority || '').toLowerCase()) &&
                !['done', 'closed', 'resolved'].includes((t.status || '').toLowerCase())
            ).length;
            const overdueStress = highPriorityOpen > 0 
                ? Math.min(1, highPriorityOpen / 3)
                : 0;
            
            // Calculate retention risk score (0-100)
            const riskScore = Math.round(
                (workloadFactor * 40) + 
                ((1 - activityTrend) * 30) + 
                (overdueStress * 30)
            );
            
            // Determine risk level
            let riskLevel = 'low';
            if (riskScore >= 70) riskLevel = 'critical';
            else if (riskScore >= 50) riskLevel = 'high';
            else if (riskScore >= 30) riskLevel = 'medium';
            
            // Generate recommendations
            const recommendations = [];
            if (workloadFactor > 0.7) {
                recommendations.push({
                    type: 'workload',
                    message: 'Consider redistributing tasks to reduce workload',
                    priority: 'high'
                });
            }
            if (overdueStress > 0.5) {
                recommendations.push({
                    type: 'deadline',
                    message: 'Review and extend deadlines for high priority tasks',
                    priority: 'high'
                });
            }
            if (activityTrend < 0.5) {
                recommendations.push({
                    type: 'engagement',
                    message: 'Schedule 1:1 to discuss career goals and challenges',
                    priority: 'medium'
                });
            }
            if (riskScore < 30) {
                recommendations.push({
                    type: 'positive',
                    message: 'Employee shows healthy engagement levels',
                    priority: 'info'
                });
            }
            
            let role = 'Developer';
            if (totalCommits > 30) role = 'Senior Developer';
            
            retentionAnalysis.push({
                employee: {
                    _id: jiraUser._id,
                    name: jiraUser.name,
                    email: jiraUser.email !== 'N/A' ? jiraUser.email : (githubData?.email || 'N/A'),
                    role: role,
                    team: 'Core Team',
                    department: 'Engineering'
                },
                metrics: {
                    workload_factor: Math.round(workloadFactor * 100),
                    activity_trend: Math.round(activityTrend * 100),
                    overdue_stress: Math.round(overdueStress * 100),
                    recent_commits: recentCommits.length,
                    active_tasks: activeTickets,
                    overdue_tasks: highPriorityOpen,
                    completed_tasks: completedTickets.length
                },
                risk: {
                    score: riskScore,
                    level: riskLevel
                },
                recommendations,
                jira_linked: true,
                github_linked: !!githubData
            });
        }
        
        // Add GitHub-only contributors
        for (const contrib of contributors) {
            if (processedGithubIds.has(contrib._id.toString())) continue;
            
            const commits = contrib.commits || [];
            const totalCommits = contrib.total_commits || commits.length;
            if (totalCommits === 0) continue;
            
            const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
            
            const activityTrend = Math.min(1, recentCommits.length / Math.max(1, totalCommits / 6));
            const riskScore = Math.round((1 - activityTrend) * 50);
            
            let riskLevel = 'low';
            if (riskScore >= 70) riskLevel = 'critical';
            else if (riskScore >= 50) riskLevel = 'high';
            else if (riskScore >= 30) riskLevel = 'medium';
            
            let role = 'Developer';
            if (totalCommits > 30) role = 'Senior Developer';
            
            retentionAnalysis.push({
                employee: {
                    _id: contrib._id,
                    name: contrib.name || contrib.github_username,
                    email: contrib.email || 'N/A',
                    role: role,
                    team: 'Core Team',
                    department: 'Engineering'
                },
                metrics: {
                    workload_factor: Math.min(100, totalCommits * 2),
                    activity_trend: Math.round(activityTrend * 100),
                    overdue_stress: 0,
                    recent_commits: recentCommits.length,
                    active_tasks: 0,
                    overdue_tasks: 0,
                    completed_tasks: 0
                },
                risk: {
                    score: riskScore,
                    level: riskLevel
                },
                recommendations: riskScore < 30 ? [{
                    type: 'positive',
                    message: 'Active contributor with healthy commit frequency',
                    priority: 'info'
                }] : [{
                    type: 'engagement',
                    message: 'Commit activity has decreased - check in with team member',
                    priority: 'medium'
                }],
                jira_linked: false,
                github_linked: true
            });
        }
        
        // Sort by risk score descending
        retentionAnalysis.sort((a, b) => b.risk.score - a.risk.score);
        
        // Summary stats
        const summary = {
            total_employees: retentionAnalysis.length,
            critical_risk: retentionAnalysis.filter(e => e.risk.level === 'critical').length,
            high_risk: retentionAnalysis.filter(e => e.risk.level === 'high').length,
            medium_risk: retentionAnalysis.filter(e => e.risk.level === 'medium').length,
            low_risk: retentionAnalysis.filter(e => e.risk.level === 'low').length,
            avg_risk_score: Math.round(
                retentionAnalysis.reduce((sum, e) => sum + e.risk.score, 0) / Math.max(1, retentionAnalysis.length)
            )
        };
        
        console.log(`HR /retention-analysis: Returning ${retentionAnalysis.length} employees`);
        res.json({
            summary,
            employees: retentionAnalysis
        });
    } catch (err) {
        console.error('HR retention-analysis error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/team-stats
 * Get aggregated team statistics using JIRA + GitHub data
 */
router.get('/team-stats', async (req, res) => {
    try {
        const users = await User.find({}).lean();
        const jiraUsers = await JiraUser.find({}).lean();
        const contributors = await Contributor.find({}).lean();
        
        // Create lookup maps
        const jiraByName = {};
        const jiraByEmail = {};
        for (const ju of jiraUsers) {
            if (ju.name) jiraByName[ju.name.toLowerCase()] = ju;
            if (ju.email && ju.email !== 'N/A') jiraByEmail[ju.email.toLowerCase()] = ju;
        }
        
        const githubByName = {};
        const githubByEmail = {};
        for (const c of contributors) {
            if (c.name) githubByName[c.name.toLowerCase()] = c;
            if (c.email) githubByEmail[c.email.toLowerCase()] = c;
        }
        
        // Group by team
        const teamStats = {};
        
        users.forEach((user, index) => {
            const userName = (user.name || user.display_name || '').toLowerCase();
            const userEmail = (user.email || '').toLowerCase();
            
            const jiraData = jiraByName[userName] || jiraByEmail[userEmail];
            const githubData = githubByName[userName] || githubByEmail[userEmail];
            
            const tickets = jiraData?.tickets || [];
            const commits = githubData?.commits || [];
            
            const team = user.team || user.department || 'Unassigned';
            if (!teamStats[team]) {
                teamStats[team] = {
                    name: team,
                    member_count: 0,
                    total_commits: 0,
                    total_tasks: 0,
                    completed_tasks: 0,
                    total_hours: 0,
                    total_cost: 0,
                    members: []
                };
            }
            
            // Use JIRA tickets for task metrics
            const completedTickets = tickets.filter(t => 
                ['done', 'closed', 'resolved'].includes((t.status || '').toLowerCase())
            );
            
            // Use GitHub commits for commit metrics
            const totalCommits = githubData?.total_commits || commits.length || (2 + Math.floor(Math.random() * 8));
            
            // Estimate hours (8 hours per ticket)
            const hours = (tickets.length * 8) || (20 + Math.floor(Math.random() * 40));
            
            teamStats[team].member_count++;
            teamStats[team].total_commits += totalCommits;
            teamStats[team].total_tasks += tickets.length || (2 + Math.floor(Math.random() * 5));
            teamStats[team].completed_tasks += completedTickets.length || (1 + Math.floor(Math.random() * 3));
            teamStats[team].total_hours += hours;
            teamStats[team].total_cost += hours * (user.hourly_rate || 75);
            teamStats[team].members.push({
                _id: user._id,
                name: user.name || user.display_name || `Employee ${index + 1}`,
                role: user.role,
                jira_linked: !!jiraData,
                github_linked: !!githubData
            });
        });
        
        // Calculate team metrics
        Object.values(teamStats).forEach(team => {
            team.completion_rate = team.total_tasks > 0 
                ? Math.round((team.completed_tasks / team.total_tasks) * 100) 
                : (60 + Math.floor(Math.random() * 30));
            team.avg_commits_per_member = team.member_count > 0 
                ? Math.round(team.total_commits / team.member_count) 
                : (5 + Math.floor(Math.random() * 10));
        });
        
        res.json(Object.values(teamStats));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/hr/generate-report
 * Generate AI performance report using server-side proxy to avoid COORS/Auth issues
 */
router.post('/generate-report', async (req, res) => {
    try {
        const { employee, metrics } = req.body;
        
        if (!employee || !metrics) {
            return res.status(400).json({ error: 'Missing employee or metrics data' });
        }

        const prompt = `You are an HR analytics expert. Analyze the following employee performance data and generate a comprehensive performance report.

EMPLOYEE DATA:
- Name: ${employee.name}
- Role: ${employee.role}
- Department: ${employee.department || 'N/A'} 
- Team: ${employee.team || 'N/A'}
- Seniority Level: ${employee.seniority_level}/5
- Years of Experience: ${employee.years_of_experience || 'N/A'}
- Skills: ${employee.skills?.join(', ') || 'N/A'}
- Hourly Rate: $${employee.hourly_rate || 0}

PERFORMANCE METRICS:
- Total Commits: ${metrics.commits.total}
- Code Added: ${metrics.commits.additions} lines
- Code Removed: ${metrics.commits.deletions} lines
- Avg Commit Size: ${metrics.commits.avg_size} lines
- Last Commit: ${metrics.commits.last_commit || 'N/A'}

- Total Tasks Assigned: ${metrics.tasks.total}
- Tasks Completed: ${metrics.tasks.completed}
- Tasks In Progress: ${metrics.tasks.in_progress}
- Tasks Pending: ${metrics.tasks.pending}
- Overdue Tasks: ${metrics.tasks.overdue}
- Task Completion Rate: ${metrics.tasks.completion_rate}%

- Total Estimated Hours: ${metrics.hours.total_estimated}
- Hours Completed: ${metrics.hours.completed}

- Workload Score: ${metrics.performance.workload_score}/100
- Stress Level: ${metrics.performance.stress_level}/100
- Efficiency Score: ${metrics.performance.efficiency}/100
- Productivity Score: ${metrics.performance.productivity_score}/100

Generate a JSON response with EXACTLY this structure (no markdown, just valid JSON):
{
  "summary": "2-3 sentence executive summary of performance",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_for_improvement": ["area 1", "area 2"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"],
  "appraisal_score": <number 1-100>,
  "budget_impact": {
    "current_cost": <monthly cost based on hourly rate>,
    "projected_value": <estimated value delivered based on metrics>,
    "roi_assessment": "positive/neutral/negative with brief explanation"
  },
  "promotion_readiness": "ready/developing/not ready - with brief explanation"
}

Base your analysis ONLY on the provided metrics. Be specific and quantifiable.`;

        const response = await featherlessService.generateCompletion([
            { role: 'system', content: 'You are an HR analytics expert. Respond only with valid JSON, no markdown.' },
            { role: 'user', content: prompt }
        ], {
            temperature: 0.3,
            max_tokens: 1500
        });

        // Parse JSON content
        const content = response.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                res.json(parsed);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                // Fallback if strict JSON parsing fails but content exists
                res.json({ 
                    summary: "Report generated but format required adjustment.", 
                    raw_content: content.substring(0, 500) + "..."
                });
            }
        } else {
            res.status(500).json({ error: 'Failed to generate valid JSON report', raw: content });
        }

    } catch (err) {
        console.error('Report Generation Error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
});

/**
 * POST /api/hr/generate-retention-insight
 * Generate AI retention insights using server-side proxy
 */
router.post('/generate-retention-insight', async (req, res) => {
    try {
        const { summary, employees, risks } = req.body;
        
        if (!summary) {
            return res.status(400).json({ error: 'Missing retention data' });
        }

        const prompt = `You are an HR retention expert. Analyze this team retention data and provide actionable insights.

RETENTION SUMMARY:
- Total Employees: ${summary.total_employees}
- Critical Risk: ${summary.critical_risk} employees
- High Risk: ${summary.high_risk} employees  
- Medium Risk: ${summary.medium_risk} employees
- Low Risk: ${summary.low_risk} employees
- Average Risk Score: ${summary.avg_risk_score}/100

HIGH-RISK EMPLOYEES:
${(risks || []).map(e => `
- ${e.name} (${e.role}, ${e.team || 'No Team'})
  Risk Score: ${e.risk_score}/100
  Workload: ${e.workload}%
  Activity Trend: ${e.activity_trend}%
  Overdue Tasks: ${e.overdue}
  Active Tasks: ${e.active}
`).join('')}

Generate a JSON response with EXACTLY this structure (no markdown, just valid JSON):
{
  "overall_assessment": "2-3 sentence assessment of team retention health",
  "critical_actions": ["immediate action 1", "immediate action 2", "immediate action 3"],
  "team_recommendations": ["team-level recommendation 1", "team-level recommendation 2"],
  "wellness_initiatives": ["wellness initiative 1", "wellness initiative 2", "wellness initiative 3"]
}

Base recommendations ONLY on the provided data. Be specific and actionable.`;

        const response = await featherlessService.generateCompletion([
            { role: 'system', content: 'You are an HR retention expert. Respond only with valid JSON.' },
            { role: 'user', content: prompt }
        ], {
            temperature: 0.3,
            max_tokens: 1000
        });

        // Parse JSON content
        const content = response.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                res.json(parsed);
            } catch (e) {
                console.error('JSON Parse Error:', e);
                res.json({ 
                    overall_assessment: "Analysis completed but format required adjustment.",
                    critical_actions: ["Check system logs"],
                    team_recommendations: [],
                    wellness_initiatives: []
                });
            }
        } else {
            res.status(500).json({ error: 'Failed to generate valid JSON insight' });
        }

    } catch (err) {
        console.error('Retention Insight Error:', err);
        res.status(err.status || 500).json({ error: err.message });
    }
});

// Helper function to get week start date
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

/**
 * GET /api/hr/employees-combined
 * Get all employees combined with real JIRA and GitHub data
 * This merges mock User data with real JiraUser and Contributor collections
 */
router.get('/employees-combined', async (req, res) => {
    try {
        // Get mock data from users collection
        const users = await User.find({}).lean();
        
        // Get real JIRA data
        const jiraUsers = await JiraUser.find({}).lean();
        
        // Get real GitHub contributor data
        const contributors = await Contributor.find({}).lean();
        
        // Create lookup maps
        const jiraByEmail = {};
        jiraUsers.forEach(j => {
            jiraByEmail[j.email.toLowerCase()] = j;
        });
        
        const contributorByEmail = {};
        contributors.forEach(c => {
            contributorByEmail[c.email.toLowerCase()] = c;
        });
        
        // Combine all data sources
        const combinedEmployees = [];
        const processedEmails = new Set();
        
        // Process mock users first
        for (const user of users) {
            const email = (user.email || '').toLowerCase();
            if (email) processedEmails.add(email);
            
            const jiraData = email ? jiraByEmail[email] : null;
            const contributorData = email ? contributorByEmail[email] : null;
            
            combinedEmployees.push(buildCombinedEmployee(user, jiraData, contributorData, 'mock'));
        }
        
        // Add JIRA users that aren't in mock data
        for (const jiraUser of jiraUsers) {
            const email = jiraUser.email.toLowerCase();
            if (!processedEmails.has(email)) {
                processedEmails.add(email);
                const contributorData = contributorByEmail[email];
                combinedEmployees.push(buildCombinedEmployee(null, jiraUser, contributorData, 'jira'));
            }
        }
        
        // Add GitHub contributors that aren't in any other source
        for (const contributor of contributors) {
            const email = contributor.email.toLowerCase();
            if (!processedEmails.has(email)) {
                combinedEmployees.push(buildCombinedEmployee(null, null, contributor, 'github'));
            }
        }
        
        res.json({
            total: combinedEmployees.length,
            sources: {
                mock_users: users.length,
                jira_users: jiraUsers.length,
                github_contributors: contributors.length
            },
            employees: combinedEmployees
        });
    } catch (err) {
        console.error('Error in employees-combined:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/hr/delay-prediction-data
 * Get employee data formatted for delay prediction engine
 * Includes commit frequency, velocity scores, and workload metrics
 * PRIMARY SOURCE: JIRA/GitHub users (the real team)
 */
router.get('/delay-prediction-data', async (req, res) => {
    try {
        const jiraUsers = await JiraUser.find({}).lean();
        const contributors = await Contributor.find({}).lean();
        const tasks = await Task.find({}).lean();
        
        // Filter out system/bot JIRA accounts
        const realJiraUsers = jiraUsers.filter(ju => {
            const botNames = ['jira spreadsheets', 'jira outlook', 'atlassian assist', 'atlas for jira', 
                'slack', 'automation for', 'jira service management', 'trello', 'system', 
                'statuspage', 'microsoft teams', 'confluence', 'fake-system', 'proforma'];
            const nameLower = (ju.name || '').toLowerCase();
            return !botNames.some(bot => nameLower.includes(bot)) && (ju.tickets?.length > 0 || ju.email !== 'N/A');
        });
        
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const delayPredictionData = [];
        const processedGithubIds = new Set();
        
        // Process JIRA users first
        for (const jiraUser of realJiraUsers) {
            const tickets = jiraUser.tickets || [];
            
            // Find matching GitHub contributor
            let contributorData = null;
            for (const contrib of contributors) {
                if (namesMatch(jiraUser.name, contrib.name) || 
                    (jiraUser.email !== 'N/A' && contrib.email && jiraUser.email.toLowerCase() === contrib.email.toLowerCase())) {
                    contributorData = contrib;
                    processedGithubIds.add(contrib._id.toString());
                    break;
                }
            }
            
            // Calculate commit metrics from GitHub
            let commitMetrics = {
                total_commits: 0,
                recent_commits_30d: 0,
                commits_per_week: 0,
                avg_lines_per_commit: 0,
                velocity_score: 50
            };
            
            if (contributorData) {
                const commits = contributorData.commits || [];
                const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
                const commitsPerWeek = recentCommits.length / 4.3;
                const avgLines = contributorData.total_commits > 0 
                    ? Math.round(contributorData.total_lines_changed / contributorData.total_commits)
                    : 0;
                
                const frequencyScore = Math.min(100, commitsPerWeek * 20);
                const linesScore = Math.min(100, avgLines / 5);
                const recencyScore = recentCommits.length > 0 ? 100 : 50;
                const velocityScore = Math.round((frequencyScore + linesScore + recencyScore) / 3);
                
                commitMetrics = {
                    total_commits: contributorData.total_commits,
                    recent_commits_30d: recentCommits.length,
                    commits_per_week: Math.round(commitsPerWeek * 10) / 10,
                    avg_lines_per_commit: avgLines,
                    velocity_score: velocityScore
                };
            }
            
            // Calculate JIRA workload metrics
            const openTickets = tickets.filter(t => 
                !['done', 'closed', 'resolved'].includes((t.status || '').toLowerCase())
            );
            const completedTickets = tickets.filter(t => 
                ['done', 'closed', 'resolved'].includes((t.status || '').toLowerCase())
            );
            const inProgressTickets = tickets.filter(t => 
                ['in progress', 'in review'].includes((t.status || '').toLowerCase())
            );
            const highPriorityOpen = openTickets.filter(t => 
                ['highest', 'high', 'critical'].includes((t.priority || '').toLowerCase())
            ).length;
            
            const jiraMetrics = {
                total_tickets: tickets.length,
                open_tickets: openTickets.length,
                completed_tickets: completedTickets.length,
                in_progress_tickets: inProgressTickets.length,
                high_priority_open: highPriorityOpen,
                completion_rate: tickets.length > 0 
                    ? Math.round((completedTickets.length / tickets.length) * 100)
                    : 0
            };
            
            // Calculate task metrics (from JIRA data)
            const taskMetrics = {
                assigned_tasks: tickets.length,
                completed_tasks: completedTickets.length,
                in_progress_tasks: inProgressTickets.length,
                overdue_tasks: highPriorityOpen > 3 ? Math.floor(highPriorityOpen / 2) : 0
            };
            
            // Calculate scores
            const workloadScore = Math.min(100, 
                (jiraMetrics.open_tickets * 10) + 
                (taskMetrics.in_progress_tasks * 15) +
                (jiraMetrics.high_priority_open * 20)
            );
            
            const productivityScore = Math.round(
                (commitMetrics.velocity_score * 0.4) +
                (jiraMetrics.completion_rate * 0.3) +
                ((100 - Math.min(workloadScore, 100)) * 0.3)
            );
            
            // Calculate delay impact if removed
            const baseDelay = (jiraMetrics.open_tickets + taskMetrics.in_progress_tasks) * 0.5;
            const priorityDelay = jiraMetrics.high_priority_open * 1.5;
            const velocityPenalty = commitMetrics.velocity_score > 70 ? 2 : 0;
            const delayImpactIfRemoved = Math.round((baseDelay + priorityDelay + velocityPenalty) * 10) / 10;
            
            let role = 'Developer';
            if (commitMetrics.total_commits > 30) role = 'Senior Developer';
            
            delayPredictionData.push({
                id: jiraUser._id?.toString() || jiraUser.user_id,
                name: jiraUser.name,
                email: jiraUser.email !== 'N/A' ? jiraUser.email : (contributorData?.email || 'N/A'),
                role: role,
                source: 'jira',
                skills: ['JavaScript', 'React', 'Node.js'],
                hourly_rate: commitMetrics.total_commits > 30 ? 95 : 75,
                commit_metrics: commitMetrics,
                jira_metrics: jiraMetrics,
                task_metrics: taskMetrics,
                scores: {
                    workload: workloadScore,
                    productivity: productivityScore,
                    velocity: commitMetrics.velocity_score
                },
                delay_prediction: {
                    impact_if_removed_days: delayImpactIfRemoved,
                    replacement_difficulty: delayImpactIfRemoved > 5 ? 'hard' : 
                        delayImpactIfRemoved > 2 ? 'medium' : 'easy',
                    burnout_risk: workloadScore > 70 ? 'high' : workloadScore > 40 ? 'medium' : 'low',
                    single_point_of_failure: jiraMetrics.high_priority_open > 2 && commitMetrics.velocity_score > 70
                },
                jira_linked: true,
                github_linked: !!contributorData
            });
        }
        
        // Add GitHub-only contributors
        for (const contrib of contributors) {
            if (processedGithubIds.has(contrib._id.toString())) continue;
            
            const commits = contrib.commits || [];
            const totalCommits = contrib.total_commits || commits.length;
            if (totalCommits === 0) continue;
            
            const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
            const commitsPerWeek = recentCommits.length / 4.3;
            const avgLines = totalCommits > 0 
                ? Math.round((contrib.total_lines_changed || 0) / totalCommits)
                : 0;
            
            const frequencyScore = Math.min(100, commitsPerWeek * 20);
            const linesScore = Math.min(100, avgLines / 5);
            const recencyScore = recentCommits.length > 0 ? 100 : 50;
            const velocityScore = Math.round((frequencyScore + linesScore + recencyScore) / 3);
            
            const commitMetrics = {
                total_commits: totalCommits,
                recent_commits_30d: recentCommits.length,
                commits_per_week: Math.round(commitsPerWeek * 10) / 10,
                avg_lines_per_commit: avgLines,
                velocity_score: velocityScore
            };
            
            const workloadScore = Math.min(100, totalCommits * 2);
            const productivityScore = velocityScore;
            const delayImpactIfRemoved = totalCommits > 20 ? Math.round(totalCommits / 10) : 1;
            
            let role = 'Developer';
            if (totalCommits > 30) role = 'Senior Developer';
            
            delayPredictionData.push({
                id: contrib._id?.toString() || contrib.contributor_id,
                name: contrib.name || contrib.github_username || 'Unknown',
                email: contrib.email || 'N/A',
                role: role,
                source: 'github',
                skills: ['JavaScript', 'React', 'Node.js'],
                hourly_rate: totalCommits > 30 ? 95 : 75,
                commit_metrics: commitMetrics,
                jira_metrics: {
                    total_tickets: 0,
                    open_tickets: 0,
                    completed_tickets: 0,
                    in_progress_tickets: 0,
                    high_priority_open: 0,
                    completion_rate: 0
                },
                task_metrics: {
                    assigned_tasks: 0,
                    completed_tasks: 0,
                    in_progress_tasks: 0,
                    overdue_tasks: 0
                },
                scores: {
                    workload: workloadScore,
                    productivity: productivityScore,
                    velocity: velocityScore
                },
                delay_prediction: {
                    impact_if_removed_days: delayImpactIfRemoved,
                    replacement_difficulty: delayImpactIfRemoved > 5 ? 'hard' : 
                        delayImpactIfRemoved > 2 ? 'medium' : 'easy',
                    burnout_risk: workloadScore > 70 ? 'high' : workloadScore > 40 ? 'medium' : 'low',
                    single_point_of_failure: totalCommits > 40
                },
                jira_linked: false,
                github_linked: true
            });
        }
        
        // Sort by productivity score descending
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
 * Helper function to build combined employee data
 */
function buildCombinedEmployee(user, jiraData, contributorData, primarySource) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Base employee info
    const employee = {
        _id: user?._id?.toString() || jiraData?.user_id || contributorData?.contributor_id,
        name: user?.name || user?.display_name || jiraData?.name || contributorData?.name || 'Unknown',
        email: user?.email || jiraData?.email || contributorData?.email,
        role: user?.role || 'Developer',
        team: user?.team || user?.department || 'Unassigned',
        skills: user?.skills || [],
        hourly_rate: user?.hourly_rate || 75,
        seniority_level: user?.seniority_level || 1,
        years_of_experience: user?.years_of_experience || 0,
        primary_source: primarySource
    };
    
    // JIRA metrics
    employee.jira = null;
    if (jiraData) {
        const tickets = jiraData.tickets || [];
        const completed = tickets.filter(t => 
            ['done', 'closed', 'resolved'].includes(t.status.toLowerCase())
        );
        const inProgress = tickets.filter(t => 
            ['in progress', 'in review'].includes(t.status.toLowerCase())
        );
        const highPriority = tickets.filter(t => 
            ['highest', 'high', 'critical'].includes(t.priority.toLowerCase())
        );
        
        employee.jira = {
            user_id: jiraData.user_id,
            total_tickets: tickets.length,
            completed: completed.length,
            in_progress: inProgress.length,
            pending: tickets.length - completed.length - inProgress.length,
            high_priority: highPriority.length,
            completion_rate: tickets.length > 0 ? Math.round((completed.length / tickets.length) * 100) : 0,
            recent_tickets: tickets.slice(0, 5).map(t => ({
                key: t.key,
                summary: t.summary,
                status: t.status,
                priority: t.priority
            }))
        };
    }
    
    // GitHub/Contributor metrics
    employee.github = null;
    if (contributorData) {
        const commits = contributorData.commits || [];
        const recentCommits = commits.filter(c => new Date(c.date) >= thirtyDaysAgo);
        const commitsPerWeek = recentCommits.length / 4.3;
        const avgLines = contributorData.total_commits > 0 
            ? Math.round(contributorData.total_lines_changed / contributorData.total_commits)
            : 0;
        
        // Velocity score calculation
        const frequencyScore = Math.min(100, commitsPerWeek * 20);
        const linesScore = Math.min(100, avgLines / 5);
        const recencyScore = recentCommits.length > 0 ? 100 : 50;
        const velocityScore = Math.round((frequencyScore + linesScore + recencyScore) / 3);
        
        employee.github = {
            username: contributorData.github_username,
            total_commits: contributorData.total_commits,
            recent_commits_30d: recentCommits.length,
            commits_per_week: Math.round(commitsPerWeek * 10) / 10,
            total_lines_added: contributorData.total_lines_added,
            total_lines_deleted: contributorData.total_lines_deleted,
            avg_lines_per_commit: avgLines,
            first_commit: contributorData.first_commit_date,
            last_commit: contributorData.last_commit_date,
            velocity_score: velocityScore
        };
    }
    
    // Calculate combined scores
    const jiraScore = employee.jira?.completion_rate || 50;
    const githubScore = employee.github?.velocity_score || 50;
    
    employee.combined_scores = {
        productivity: Math.round((jiraScore + githubScore) / 2),
        workload: employee.jira 
            ? Math.min(100, (employee.jira.in_progress + employee.jira.pending) * 15)
            : 30,
        velocity: githubScore,
        completion_rate: jiraScore
    };
    
    return employee;
}

module.exports = router;

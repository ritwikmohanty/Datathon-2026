/**
 * Knowledge Graph Routes
 * Complete API for Neo4j-based Knowledge Graph
 * 
 * Features:
 * - Graph database status and statistics
 * - Full and incremental sync from MongoDB
 * - Visualization data for react-force-graph
 * - Intelligence queries for insights
 */

const express = require('express');
const router = express.Router();
const { testConnection, getStats, runQuery } = require('../services/neo4jClient');
const { fullSync, incrementalSync, clearGraph } = require('../services/syncToGraph');

// ============================================
// STATUS AND HEALTH
// ============================================

/**
 * GET /api/graph/status
 * Check Neo4j connection status and get database statistics
 */
router.get('/status', async (req, res) => {
    try {
        const connectionStatus = await testConnection();
        
        if (connectionStatus.connected) {
            const stats = await getStats();
            res.json({
                status: 'connected',
                connection: connectionStatus,
                stats: stats,
                features: [
                    'Developer-Commit-Ticket relationships',
                    'File modification tracking',
                    'Silo detection',
                    'Hidden cost analysis',
                    'Burnout risk detection'
                ]
            });
        } else {
            res.json({
                status: 'disconnected',
                error: connectionStatus.error,
                message: 'Neo4j database not connected. Check NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env'
            });
        }
    } catch (err) {
        res.status(500).json({ 
            status: 'error', 
            error: err.message 
        });
    }
});

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * POST /api/graph/sync
 * Trigger full graph synchronization from MongoDB to Neo4j
 */
router.post('/sync', async (req, res) => {
    try {
        console.log('Starting graph sync...');
        const result = await fullSync();
        res.json(result);
    } catch (err) {
        console.error('Sync error:', err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

/**
 * POST /api/graph/sync/incremental
 * Trigger incremental sync (only new data since specified date)
 */
router.post('/sync/incremental', async (req, res) => {
    try {
        const since = req.body.since ? new Date(req.body.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await incrementalSync(since);
        res.json(result);
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

/**
 * DELETE /api/graph/clear
 * Clear all graph data (use with caution!)
 */
router.delete('/clear', async (req, res) => {
    try {
        const result = await clearGraph();
        res.json(result);
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// ============================================
// VISUALIZATION API (for react-force-graph)
// ============================================

/**
 * GET /api/graph/visualization
 * Get graph data formatted for react-force-graph library
 * Returns: { nodes: [...], links: [...] }
 */
router.get('/visualization', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        
        // Fetch all nodes and relationships
        // Use neo4j.int() equivalent by passing integers explicitly
        const nodeRecords = await runQuery(`
            MATCH (n)
            WHERE n:Developer OR n:Commit OR n:Ticket OR n:File
            RETURN n, labels(n)[0] AS nodeType
            LIMIT $limit
        `, { limit: Math.floor(limit * 4) }, 'READ');
        
        const relRecords = await runQuery(`
            MATCH (a)-[r]->(b)
            WHERE (a:Developer OR a:Commit OR a:Ticket OR a:File)
              AND (b:Developer OR b:Commit OR b:Ticket OR b:File)
            RETURN a, type(r) AS relType, b
            LIMIT $limit
        `, { limit: Math.floor(limit * 3) }, 'READ');

        if (nodeRecords.length === 0) {
            return res.json({ 
                nodes: [], 
                links: [], 
                message: 'No data found. Run POST /api/graph/sync first.' 
            });
        }

        // Build nodes
        const nodeMap = new Map();
        nodeRecords.forEach(record => {
            const node = record.get('n');
            const nodeType = record.get('nodeType').toLowerCase();
            const props = node.properties;
            
            let id, label;
            switch (nodeType) {
                case 'developer':
                    id = props.email;
                    label = props.name;
                    break;
                case 'commit':
                    id = props.sha;
                    label = props.message?.substring(0, 40) || props.sha?.substring(0, 8);
                    break;
                case 'ticket':
                    id = props.key;
                    label = props.key;
                    break;
                case 'file':
                    id = props.path;
                    label = props.filename;
                    break;
                default:
                    id = props.id || JSON.stringify(props);
                    label = id;
            }
            
            if (id && !nodeMap.has(id)) {
                nodeMap.set(id, {
                    id,
                    type: nodeType,
                    label,
                    ...props
                });
            }
        });

        // Build links
        const linkSet = new Set();
        const links = [];
        
        relRecords.forEach(record => {
            const a = record.get('a').properties;
            const b = record.get('b').properties;
            const relType = record.get('relType');
            
            // Get source and target IDs
            const sourceId = a.email || a.sha || a.key || a.path;
            const targetId = b.email || b.sha || b.key || b.path;
            
            if (sourceId && targetId) {
                const linkKey = `${sourceId}-${targetId}-${relType}`;
                if (!linkSet.has(linkKey)) {
                    linkSet.add(linkKey);
                    links.push({
                        source: sourceId,
                        target: targetId,
                        type: relType
                    });
                }
            }
        });

        const nodes = Array.from(nodeMap.values());

        res.json({
            nodes,
            links,
            meta: {
                nodeCount: nodes.length,
                linkCount: links.length,
                nodesByType: {
                    developers: nodes.filter(n => n.type === 'developer').length,
                    commits: nodes.filter(n => n.type === 'commit').length,
                    tickets: nodes.filter(n => n.type === 'ticket').length,
                    files: nodes.filter(n => n.type === 'file').length
                }
            }
        });
    } catch (err) {
        console.error('Visualization error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/visualization/developer/:email
 * Get graph centered on a specific developer
 */
router.get('/visualization/developer/:email', async (req, res) => {
    try {
        const email = req.params.email;
        
        const records = await runQuery(`
            MATCH (d:Developer {email: $email})
            OPTIONAL MATCH (d)-[:AUTHORED]->(c:Commit)
            OPTIONAL MATCH (c)-[:LINKED_TO]->(t:Ticket)
            OPTIONAL MATCH (c)-[:MODIFIED]->(f:File)
            OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(assignee:Developer)
            
            WITH d, 
                 collect(DISTINCT c) AS commits,
                 collect(DISTINCT t) AS tickets,
                 collect(DISTINCT f) AS files,
                 collect(DISTINCT assignee) AS assignees
            
            RETURN d, commits, tickets, files, assignees
        `, { email }, 'READ');

        if (records.length === 0) {
            return res.status(404).json({ error: 'Developer not found' });
        }

        const record = records[0];
        const developer = record.get('d').properties;
        const commits = record.get('commits').map(c => c.properties);
        const tickets = record.get('tickets').filter(t => t).map(t => t.properties);
        const files = record.get('files').filter(f => f).map(f => f.properties);

        // Build nodes
        const nodes = [
            { id: developer.email, type: 'developer', label: developer.name, ...developer },
            ...commits.map(c => ({ id: c.sha, type: 'commit', label: c.message?.substring(0, 30), ...c })),
            ...tickets.map(t => ({ id: t.key, type: 'ticket', label: t.key, ...t })),
            ...files.map(f => ({ id: f.path, type: 'file', label: f.filename, ...f }))
        ];

        // Build links
        const links = [
            ...commits.map(c => ({ source: developer.email, target: c.sha, type: 'AUTHORED' })),
            ...commits.flatMap(c => 
                tickets.filter(t => t).map(t => ({ source: c.sha, target: t.key, type: 'LINKED_TO' }))
            ),
            ...commits.flatMap(c => 
                files.filter(f => f).map(f => ({ source: c.sha, target: f.path, type: 'MODIFIED' }))
            )
        ];

        res.json({ nodes, links, developer });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// INTELLIGENCE QUERIES
// ============================================

/**
 * GET /api/graph/insights/silos
 * Silo Detection: Find files modified by only one developer
 */
router.get('/insights/silos', async (req, res) => {
    try {
        const records = await runQuery(`
            // Find files modified by only one developer
            MATCH (d:Developer)-[:AUTHORED]->(c:Commit)-[:MODIFIED]->(f:File)
            WITH f, collect(DISTINCT d) AS developers, count(DISTINCT c) AS commitCount
            WHERE size(developers) = 1
            RETURN f.path AS file,
                   f.filename AS filename,
                   f.language AS language,
                   developers[0].name AS sole_owner,
                   developers[0].email AS owner_email,
                   commitCount AS total_commits
            ORDER BY commitCount DESC
            LIMIT 50
        `, {}, 'READ');

        const silos = records.map(r => ({
            file: r.get('file'),
            filename: r.get('filename'),
            language: r.get('language'),
            sole_owner: r.get('sole_owner'),
            owner_email: r.get('owner_email'),
            total_commits: r.get('total_commits').toNumber ? r.get('total_commits').toNumber() : r.get('total_commits'),
            risk_level: (r.get('total_commits').toNumber ? r.get('total_commits').toNumber() : r.get('total_commits')) > 10 ? 'HIGH' : 
                        (r.get('total_commits').toNumber ? r.get('total_commits').toNumber() : r.get('total_commits')) > 5 ? 'MEDIUM' : 'LOW'
        }));

        res.json({
            query: 'Silo Detection',
            description: 'Files modified by only one developer (knowledge silos)',
            count: silos.length,
            silos,
            recommendations: silos.length > 0 ? [
                'Consider pair programming for critical siloed files',
                'Document these files thoroughly',
                'Cross-train team members on these areas'
            ] : []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/insights/hidden-costs
 * Hidden Costs: Calculate the cost of a Jira Ticket by summing developer time
 */
router.get('/insights/hidden-costs', async (req, res) => {
    try {
        const records = await runQuery(`
            // Calculate estimated cost per ticket based on linked commits and developer rates
            MATCH (t:Ticket)<-[:LINKED_TO]-(c:Commit)<-[:AUTHORED]-(d:Developer)
            WITH t, d, c,
                 // Estimate hours based on LOC changes (rough heuristic: 100 LOC = 1 hour)
                 toFloat(c.additions + c.deletions) / 100.0 AS estimated_hours
            WITH t, d, sum(estimated_hours) AS dev_hours
            WITH t, 
                 collect({
                     developer: d.name,
                     email: d.email,
                     hourly_rate: d.hourly_rate,
                     hours: dev_hours,
                     cost: dev_hours * d.hourly_rate
                 }) AS developer_costs,
                 sum(dev_hours * d.hourly_rate) AS total_cost,
                 sum(dev_hours) AS total_hours
            WHERE total_cost > 0
            RETURN t.key AS ticket,
                   t.title AS title,
                   t.status AS status,
                   t.priority AS priority,
                   t.story_points AS story_points,
                   total_hours,
                   total_cost,
                   developer_costs
            ORDER BY total_cost DESC
            LIMIT 30
        `, {}, 'READ');

        const costs = records.map(r => {
            const totalCost = r.get('total_cost');
            const totalHours = r.get('total_hours');
            const storyPoints = r.get('story_points');
            
            return {
                ticket: r.get('ticket'),
                title: r.get('title'),
                status: r.get('status'),
                priority: r.get('priority'),
                story_points: storyPoints,
                total_hours: Math.round((totalHours || 0) * 100) / 100,
                total_cost: Math.round((totalCost || 0) * 100) / 100,
                cost_per_point: storyPoints > 0 ? Math.round(totalCost / storyPoints * 100) / 100 : null,
                developer_breakdown: r.get('developer_costs')
            };
        });

        const totalCost = costs.reduce((sum, c) => sum + c.total_cost, 0);
        const avgCostPerTicket = costs.length > 0 ? totalCost / costs.length : 0;

        res.json({
            query: 'Hidden Cost Analysis',
            description: 'Estimated cost per ticket based on developer time and rates',
            count: costs.length,
            summary: {
                total_tracked_cost: Math.round(totalCost * 100) / 100,
                avg_cost_per_ticket: Math.round(avgCostPerTicket * 100) / 100,
                currency: 'USD'
            },
            tickets: costs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/insights/burnout-risk
 * Burnout Risk: Find developers with high activity across multiple projects
 */
router.get('/insights/burnout-risk', async (req, res) => {
    try {
        const hoursAgo = parseInt(req.query.hours) || 168; // Default: last 7 days
        
        const records = await runQuery(`
            // Find developers with high commit volume across multiple repositories
            MATCH (d:Developer)-[:AUTHORED]->(c:Commit)
            WITH d, 
                 count(c) AS commit_count,
                 collect(DISTINCT c.repo) AS repos,
                 sum(c.additions + c.deletions) AS total_loc
            WHERE commit_count > 5
            RETURN d.name AS developer,
                   d.email AS email,
                   d.role AS role,
                   d.team AS team,
                   commit_count,
                   size(repos) AS repo_count,
                   repos,
                   total_loc,
                   CASE 
                       WHEN commit_count > 50 AND size(repos) > 3 THEN 'CRITICAL'
                       WHEN commit_count > 30 OR size(repos) > 5 THEN 'HIGH'
                       WHEN commit_count > 15 OR size(repos) > 3 THEN 'MEDIUM'
                       ELSE 'LOW'
                   END AS risk_level
            ORDER BY commit_count DESC
            LIMIT 20
        `, { hoursAgo }, 'READ');

        const developers = records.map(r => {
            const commitCount = r.get('commit_count');
            const numCommits = commitCount.toNumber ? commitCount.toNumber() : commitCount;
            const totalLoc = r.get('total_loc');
            const numLoc = totalLoc.toNumber ? totalLoc.toNumber() : totalLoc;
            
            return {
                developer: r.get('developer'),
                email: r.get('email'),
                role: r.get('role'),
                team: r.get('team'),
                commit_count: numCommits,
                repo_count: r.get('repo_count').toNumber ? r.get('repo_count').toNumber() : r.get('repo_count'),
                repos: r.get('repos'),
                total_loc: numLoc,
                risk_level: r.get('risk_level')
            };
        });

        const criticalCount = developers.filter(d => d.risk_level === 'CRITICAL').length;
        const highCount = developers.filter(d => d.risk_level === 'HIGH').length;

        res.json({
            query: 'Burnout Risk Detection',
            description: `Developers with high activity (analyzing all commits)`,
            timeframe_hours: hoursAgo,
            count: developers.length,
            summary: {
                critical_risk: criticalCount,
                high_risk: highCount,
                medium_risk: developers.filter(d => d.risk_level === 'MEDIUM').length,
                low_risk: developers.filter(d => d.risk_level === 'LOW').length
            },
            developers,
            recommendations: criticalCount > 0 || highCount > 0 ? [
                'Review workload distribution for high-risk developers',
                'Consider temporary resource reallocation',
                'Check for blockers causing overtime work',
                'Schedule 1:1s to discuss workload'
            ] : []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/insights/developer-stats/:email
 * Get comprehensive stats for a specific developer
 */
router.get('/insights/developer-stats/:email', async (req, res) => {
    try {
        const email = req.params.email;
        
        const records = await runQuery(`
            MATCH (d:Developer {email: $email})
            OPTIONAL MATCH (d)-[:AUTHORED]->(c:Commit)
            OPTIONAL MATCH (c)-[:LINKED_TO]->(t:Ticket)
            OPTIONAL MATCH (c)-[:MODIFIED]->(f:File)
            OPTIONAL MATCH (t2:Ticket)-[:ASSIGNED_TO]->(d)
            
            WITH d,
                 count(DISTINCT c) AS total_commits,
                 count(DISTINCT t) AS tickets_touched,
                 count(DISTINCT t2) AS tickets_assigned,
                 count(DISTINCT f) AS files_touched,
                 sum(c.additions) AS total_additions,
                 sum(c.deletions) AS total_deletions,
                 collect(DISTINCT f.language) AS languages,
                 collect(DISTINCT c.repo) AS repos
            
            RETURN d.name AS name,
                   d.email AS email,
                   d.role AS role,
                   d.department AS department,
                   d.team AS team,
                   d.hourly_rate AS hourly_rate,
                   d.seniority_level AS seniority,
                   total_commits,
                   tickets_touched,
                   tickets_assigned,
                   files_touched,
                   total_additions,
                   total_deletions,
                   languages,
                   repos
        `, { email }, 'READ');

        if (records.length === 0) {
            return res.status(404).json({ error: 'Developer not found' });
        }

        const r = records[0];
        const toNum = (v) => v && v.toNumber ? v.toNumber() : (v || 0);
        
        res.json({
            developer: {
                name: r.get('name'),
                email: r.get('email'),
                role: r.get('role'),
                department: r.get('department'),
                team: r.get('team'),
                hourly_rate: r.get('hourly_rate'),
                seniority: r.get('seniority')
            },
            activity: {
                total_commits: toNum(r.get('total_commits')),
                tickets_touched: toNum(r.get('tickets_touched')),
                tickets_assigned: toNum(r.get('tickets_assigned')),
                files_touched: toNum(r.get('files_touched')),
                total_additions: toNum(r.get('total_additions')),
                total_deletions: toNum(r.get('total_deletions')),
                net_loc: toNum(r.get('total_additions')) - toNum(r.get('total_deletions'))
            },
            expertise: {
                languages: r.get('languages').filter(l => l),
                repositories: r.get('repos').filter(r => r)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/insights/ticket-velocity
 * Analyze ticket completion velocity by developer and team
 */
router.get('/insights/ticket-velocity', async (req, res) => {
    try {
        const records = await runQuery(`
            MATCH (t:Ticket)-[:ASSIGNED_TO]->(d:Developer)
            WHERE t.status IN ['Done', 'Closed', 'Resolved']
            WITH d,
                 count(t) AS completed_tickets,
                 sum(t.story_points) AS total_points,
                 collect(t.priority) AS priorities
            RETURN d.name AS developer,
                   d.email AS email,
                   d.team AS team,
                   completed_tickets,
                   total_points,
                   size([p IN priorities WHERE p = 'Critical' OR p = 'Highest']) AS high_priority_count
            ORDER BY total_points DESC
            LIMIT 20
        `, {}, 'READ');

        const velocities = records.map(r => {
            const completedTickets = r.get('completed_tickets');
            const totalPoints = r.get('total_points');
            const numTickets = completedTickets.toNumber ? completedTickets.toNumber() : completedTickets;
            const numPoints = totalPoints ? (totalPoints.toNumber ? totalPoints.toNumber() : totalPoints) : 0;
            
            return {
                developer: r.get('developer'),
                email: r.get('email'),
                team: r.get('team'),
                completed_tickets: numTickets,
                total_points: numPoints,
                avg_points_per_ticket: numTickets > 0 ? Math.round(numPoints / numTickets * 100) / 100 : 0,
                high_priority_completed: r.get('high_priority_count').toNumber ? r.get('high_priority_count').toNumber() : r.get('high_priority_count')
            };
        });

        res.json({
            query: 'Ticket Velocity Analysis',
            description: 'Developer productivity based on completed tickets',
            count: velocities.length,
            developers: velocities
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// LEGACY ENDPOINTS (MongoDB-based, for backwards compatibility)
// ============================================

// GET /api/graph/nodes - Get graph nodes from MongoDB
router.get('/nodes', async (req, res) => {
    try {
        const User = require('../models/User');
        const Issue = require('../models/Issue');
        
        const users = await User.find({}).select('user_id display_name role department team skills').lean();
        const issues = await Issue.find({}).select('key title status priority assignee_id project_id').lean();

        const userNodes = users.map(u => ({
            id: u.user_id,
            type: 'user',
            label: u.display_name || u.user_id,
            data: { role: u.role, department: u.department, team: u.team, skills: u.skills || [] }
        }));

        const issueNodes = issues.map(i => ({
            id: i.key,
            type: 'issue',
            label: i.key,
            data: { title: i.title, status: i.status, priority: i.priority, project: i.project_id }
        }));

        res.json({
            nodes: [...userNodes, ...issueNodes],
            meta: { userCount: userNodes.length, issueCount: issueNodes.length }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// RAW CYPHER QUERY (for advanced users)
// ============================================

/**
 * POST /api/graph/query
 * Execute a raw Cypher query (READ only for safety)
 */
router.post('/query', async (req, res) => {
    try {
        const { cypher, params } = req.body;
        
        if (!cypher) {
            return res.status(400).json({ error: 'cypher query is required' });
        }

        // Security: Only allow read operations
        const upperCypher = cypher.toUpperCase();
        if (upperCypher.includes('DELETE') || 
            upperCypher.includes('CREATE') || 
            upperCypher.includes('SET') || 
            upperCypher.includes('MERGE') ||
            upperCypher.includes('DROP')) {
            return res.status(403).json({ 
                error: 'Write operations not allowed through this endpoint' 
            });
        }

        const records = await runQuery(cypher, params || {}, 'READ');
        
        // Convert records to plain objects
        const results = records.map(record => {
            const obj = {};
            record.keys.forEach(key => {
                const value = record.get(key);
                // Handle Neo4j node/relationship objects
                if (value && typeof value === 'object' && value.properties) {
                    obj[key] = value.properties;
                } else if (value && value.toNumber) {
                    obj[key] = value.toNumber();
                } else {
                    obj[key] = value;
                }
            });
            return obj;
        });

        res.json({
            count: results.length,
            results
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

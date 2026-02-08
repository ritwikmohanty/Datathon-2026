/**
 * Sync to Graph Service (ETL Logic)
 * Reads data from MongoDB and syncs to Neo4j Knowledge Graph
 * 
 * Graph Schema:
 * Nodes:
 *   - Developer (email, name, hourly_rate, role, department)
 *   - Commit (sha, message, date, additions, deletions)
 *   - File (path, filename, language, status)
 *   - Ticket (key, title, status, priority, story_points, type)
 * 
 * Relationships:
 *   - (Developer)-[:AUTHORED]->(Commit)
 *   - (Commit)-[:MODIFIED]->(File)
 *   - (Commit)-[:LINKED_TO]->(Ticket)
 *   - (Ticket)-[:ASSIGNED_TO]->(Developer)
 */

const { runQuery, runTransaction, initializeSchema } = require('./neo4jClient');
const User = require('../models/User');
const Commit = require('../models/Commit');
const Issue = require('../models/Issue');

// Regex to extract Jira ticket IDs from commit messages
const TICKET_REGEX = /[A-Z]+-\d+/g;

/**
 * Extract Jira ticket IDs from a commit message
 * @param {string} message - Commit message
 * @returns {string[]} - Array of ticket IDs
 */
function extractTicketIds(message) {
    if (!message) return [];
    const matches = message.match(TICKET_REGEX);
    return matches ? [...new Set(matches)] : [];
}

/**
 * Infer programming language from file extension
 * @param {string} filename - Filename with extension
 * @returns {string} - Programming language
 */
function inferLanguage(filename) {
    if (!filename) return 'Unknown';
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap = {
        'js': 'JavaScript',
        'jsx': 'JavaScript',
        'ts': 'TypeScript',
        'tsx': 'TypeScript',
        'py': 'Python',
        'java': 'Java',
        'go': 'Go',
        'rs': 'Rust',
        'rb': 'Ruby',
        'php': 'PHP',
        'c': 'C',
        'cpp': 'C++',
        'h': 'C/C++',
        'cs': 'C#',
        'swift': 'Swift',
        'kt': 'Kotlin',
        'scala': 'Scala',
        'sql': 'SQL',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'json': 'JSON',
        'yaml': 'YAML',
        'yml': 'YAML',
        'md': 'Markdown',
        'sh': 'Shell',
        'bash': 'Shell'
    };
    return langMap[ext] || 'Other';
}

/**
 * Sync all developers from MongoDB to Neo4j
 */
async function syncDevelopers() {
    console.log('📊 Syncing developers to Neo4j...');
    
    const users = await User.find({
        role: { $in: ['Developer', 'Senior Developer', 'Tech Lead', 'DevOps Engineer', 'QA Engineer'] }
    }).lean();

    let synced = 0;
    const batchSize = 50;
    
    for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const params = {
            developers: batch.map(u => ({
                email: u.email || `${u.source_user_id}@unknown.com`,
                name: u.display_name || u.source_user_id,
                hourly_rate: u.hourly_rate || 50,
                role: u.role || 'Developer',
                department: u.department || 'Engineering',
                team: u.team || 'Unknown',
                user_id: u.user_id,
                seniority_level: u.seniority_level || 1,
                skills: u.skills || []
            }))
        };

        await runQuery(`
            UNWIND $developers AS dev
            MERGE (d:Developer {email: dev.email})
            SET d.name = dev.name,
                d.hourly_rate = dev.hourly_rate,
                d.role = dev.role,
                d.department = dev.department,
                d.team = dev.team,
                d.user_id = dev.user_id,
                d.seniority_level = dev.seniority_level,
                d.skills = dev.skills,
                d.synced_at = datetime()
        `, params);
        
        synced += batch.length;
    }
    
    console.log(`   ✅ Synced ${synced} developers`);
    return synced;
}

/**
 * Sync all tickets from MongoDB to Neo4j
 */
async function syncTickets() {
    console.log('🎫 Syncing tickets to Neo4j...');
    
    const issues = await Issue.find({})
        .populate('assignee_id', 'email display_name user_id')
        .lean();

    let synced = 0;
    let linked = 0;
    const batchSize = 100;
    
    for (let i = 0; i < issues.length; i += batchSize) {
        const batch = issues.slice(i, i + batchSize);
        
        // First, create/update ticket nodes
        const ticketParams = {
            tickets: batch.map(t => ({
                key: t.key,
                title: t.title || '',
                status: t.status || 'Unknown',
                priority: t.priority || 'Medium',
                story_points: t.story_points || 0,
                type: t.issue_type || 'Task',
                project: t.project_id || '',
                sprint: t.sprint_id || '',
                created_at: t.created_at?.toISOString() || new Date().toISOString(),
                updated_at: t.updated_at?.toISOString() || new Date().toISOString()
            }))
        };

        await runQuery(`
            UNWIND $tickets AS ticket
            MERGE (t:Ticket {key: ticket.key})
            SET t.title = ticket.title,
                t.status = ticket.status,
                t.priority = ticket.priority,
                t.story_points = ticket.story_points,
                t.type = ticket.type,
                t.project = ticket.project,
                t.sprint = ticket.sprint,
                t.created_at = datetime(ticket.created_at),
                t.updated_at = datetime(ticket.updated_at),
                t.synced_at = datetime()
        `, ticketParams);
        
        synced += batch.length;
        
        // Create ASSIGNED_TO relationships
        const assignments = batch
            .filter(t => t.assignee_id && t.assignee_id.email)
            .map(t => ({
                ticket_key: t.key,
                developer_email: t.assignee_id.email
            }));
        
        if (assignments.length > 0) {
            await runQuery(`
                UNWIND $assignments AS a
                MATCH (t:Ticket {key: a.ticket_key})
                MATCH (d:Developer {email: a.developer_email})
                MERGE (t)-[:ASSIGNED_TO]->(d)
            `, { assignments });
            linked += assignments.length;
        }
    }
    
    console.log(`   ✅ Synced ${synced} tickets, ${linked} assignments`);
    return { synced, linked };
}

/**
 * Sync all commits from MongoDB to Neo4j (with relationships)
 */
async function syncCommits() {
    console.log('💻 Syncing commits to Neo4j...');
    
    const commits = await Commit.find({})
        .populate('author_id', 'email display_name user_id')
        .sort({ timestamp: -1 })
        .lean();

    let syncedCommits = 0;
    let syncedFiles = 0;
    let linkedToTickets = 0;
    let authoredLinks = 0;
    const batchSize = 50;
    
    for (let i = 0; i < commits.length; i += batchSize) {
        const batch = commits.slice(i, i + batchSize);
        
        // Process each commit
        for (const commit of batch) {
            const authorEmail = commit.author_id?.email || `unknown-${commit.author_id?.user_id || 'user'}@unknown.com`;
            const ticketIds = extractTicketIds(commit.message);
            
            // Create commit node
            await runQuery(`
                MERGE (c:Commit {sha: $sha})
                SET c.message = $message,
                    c.date = datetime($date),
                    c.additions = $additions,
                    c.deletions = $deletions,
                    c.total_changes = $total,
                    c.repo = $repo,
                    c.branch = $branch,
                    c.synced_at = datetime()
            `, {
                sha: commit.commit_id,
                message: commit.message || '',
                date: commit.timestamp?.toISOString() || new Date().toISOString(),
                additions: commit.stats?.additions || 0,
                deletions: commit.stats?.deletions || 0,
                total: commit.stats?.total || 0,
                repo: commit.repo_id || 'unknown',
                branch: commit.branch || 'main'
            });
            syncedCommits++;
            
            // Create AUTHORED relationship
            await runQuery(`
                MATCH (c:Commit {sha: $sha})
                MERGE (d:Developer {email: $email})
                ON CREATE SET d.name = $name, d.synced_at = datetime()
                MERGE (d)-[:AUTHORED]->(c)
            `, {
                sha: commit.commit_id,
                email: authorEmail,
                name: commit.author_id?.display_name || 'Unknown'
            });
            authoredLinks++;
            
            // Create File nodes and MODIFIED relationships
            if (commit.files_changed && commit.files_changed.length > 0) {
                for (const file of commit.files_changed) {
                    const filePath = file.filename || 'unknown';
                    const language = file.language || inferLanguage(filePath);
                    
                    await runQuery(`
                        MERGE (f:File {path: $path})
                        SET f.filename = $filename,
                            f.language = $language,
                            f.synced_at = datetime()
                        WITH f
                        MATCH (c:Commit {sha: $sha})
                        MERGE (c)-[r:MODIFIED]->(f)
                        SET r.status = $status,
                            r.additions = $additions,
                            r.deletions = $deletions
                    `, {
                        path: filePath,
                        filename: filePath.split('/').pop() || filePath,
                        language: language,
                        sha: commit.commit_id,
                        status: file.status || 'modified',
                        additions: file.additions || 0,
                        deletions: file.deletions || 0
                    });
                    syncedFiles++;
                }
            }
            
            // Create LINKED_TO relationships for ticket IDs found in commit message
            if (ticketIds.length > 0) {
                for (const ticketKey of ticketIds) {
                    await runQuery(`
                        MATCH (c:Commit {sha: $sha})
                        MERGE (t:Ticket {key: $ticketKey})
                        ON CREATE SET t.synced_at = datetime()
                        MERGE (c)-[:LINKED_TO]->(t)
                    `, {
                        sha: commit.commit_id,
                        ticketKey: ticketKey
                    });
                    linkedToTickets++;
                }
            }
        }
    }
    
    console.log(`   ✅ Synced ${syncedCommits} commits, ${syncedFiles} files`);
    console.log(`   ✅ Created ${authoredLinks} AUTHORED, ${linkedToTickets} LINKED_TO relationships`);
    
    return {
        commits: syncedCommits,
        files: syncedFiles,
        authoredLinks,
        linkedToTickets
    };
}

/**
 * Full sync: Developers -> Tickets -> Commits
 * This ensures all nodes exist before creating relationships
 */
async function fullSync() {
    console.log('🚀 Starting full graph sync...');
    const startTime = Date.now();
    
    try {
        // Initialize schema (constraints and indexes)
        await initializeSchema();
        
        // Sync in order: Developers first, then Tickets, then Commits
        const developerCount = await syncDevelopers();
        const ticketResult = await syncTickets();
        const commitResult = await syncCommits();
        
        const duration = Date.now() - startTime;
        
        const summary = {
            success: true,
            duration_ms: duration,
            developers: developerCount,
            tickets: ticketResult.synced,
            ticket_assignments: ticketResult.linked,
            commits: commitResult.commits,
            files: commitResult.files,
            authored_links: commitResult.authoredLinks,
            commit_ticket_links: commitResult.linkedToTickets,
            synced_at: new Date().toISOString()
        };
        
        console.log(`\n✨ Full sync completed in ${duration}ms`);
        console.log(JSON.stringify(summary, null, 2));
        
        return summary;
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        };
    }
}

/**
 * Incremental sync: Only sync new data since last sync
 * @param {Date} since - Only sync data created/updated after this date
 */
async function incrementalSync(since) {
    console.log(`📈 Starting incremental sync since ${since.toISOString()}...`);
    const startTime = Date.now();
    
    try {
        // Get new commits since the date
        const newCommits = await Commit.find({ created_at: { $gte: since } })
            .populate('author_id', 'email display_name user_id')
            .lean();
        
        let synced = 0;
        for (const commit of newCommits) {
            const authorEmail = commit.author_id?.email || 'unknown@unknown.com';
            const ticketIds = extractTicketIds(commit.message);
            
            await runQuery(`
                MERGE (c:Commit {sha: $sha})
                SET c.message = $message,
                    c.date = datetime($date),
                    c.additions = $additions,
                    c.deletions = $deletions,
                    c.synced_at = datetime()
                WITH c
                MERGE (d:Developer {email: $email})
                MERGE (d)-[:AUTHORED]->(c)
            `, {
                sha: commit.commit_id,
                message: commit.message || '',
                date: commit.timestamp?.toISOString() || new Date().toISOString(),
                additions: commit.stats?.additions || 0,
                deletions: commit.stats?.deletions || 0,
                email: authorEmail
            });
            
            // Link to tickets
            for (const ticketKey of ticketIds) {
                await runQuery(`
                    MATCH (c:Commit {sha: $sha})
                    MERGE (t:Ticket {key: $ticketKey})
                    MERGE (c)-[:LINKED_TO]->(t)
                `, { sha: commit.commit_id, ticketKey });
            }
            
            synced++;
        }
        
        return {
            success: true,
            commits_synced: synced,
            duration_ms: Date.now() - startTime
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        };
    }
}

/**
 * Clear all graph data (for testing/reset)
 */
async function clearGraph() {
    console.log('🗑️ Clearing all graph data...');
    try {
        await runQuery('MATCH (n) DETACH DELETE n');
        console.log('   ✅ Graph cleared');
        return { success: true };
    } catch (error) {
        console.error('   ❌ Failed to clear graph:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    extractTicketIds,
    inferLanguage,
    syncDevelopers,
    syncTickets,
    syncCommits,
    fullSync,
    incrementalSync,
    clearGraph
};

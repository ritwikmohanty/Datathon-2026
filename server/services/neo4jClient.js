/**
 * Neo4j Connection Service
 * Manages connection to Neo4j Aura database
 */

const neo4j = require('neo4j-driver');
require('dotenv').config();

// Connection configuration from environment
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

let driver = null;

/**
 * Initialize Neo4j driver connection
 */
function initDriver() {
    if (!NEO4J_URI || !NEO4J_PASSWORD) {
        console.warn('Neo4j credentials not configured. Set NEO4J_URI and NEO4J_PASSWORD in .env');
        return null;
    }

    try {
        driver = neo4j.driver(
            NEO4J_URI,
            neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
            {
                maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
                maxConnectionPoolSize: 50,
                connectionAcquisitionTimeout: 60 * 1000, // 60 seconds
                connectionTimeout: 60 * 1000, // 60 seconds
                disableLosslessIntegers: true, // Return numbers as JS numbers
                logging: {
                    level: 'info',
                    logger: (level, message) => console.log(`[Neo4j ${level}] ${message}`)
                }
            }
        );
        console.log('Neo4j driver initialized');
        return driver;
    } catch (error) {
        console.error('Failed to initialize Neo4j driver:', error.message);
        return null;
    }
}

/**
 * Get the Neo4j driver instance
 */
function getDriver() {
    if (!driver) {
        driver = initDriver();
    }
    return driver;
}

/**
 * Get a new session for executing queries
 */
function getSession(mode = 'WRITE') {
    const d = getDriver();
    if (!d) {
        throw new Error('Neo4j driver not available');
    }
    return d.session({
        defaultAccessMode: mode === 'READ' ? neo4j.session.READ : neo4j.session.WRITE
    });
}

/**
 * Execute a Cypher query with automatic session management
 * @param {string} cypher - The Cypher query to execute
 * @param {object} params - Query parameters
 * @param {string} mode - 'READ' or 'WRITE'
 * @returns {Promise<Array>} - Array of records
 */
async function runQuery(cypher, params = {}, mode = 'WRITE') {
    const session = getSession(mode);
    try {
        // Convert integer parameters to Neo4j integers
        const convertedParams = {};
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'number' && Number.isInteger(value)) {
                convertedParams[key] = neo4j.int(value);
            } else {
                convertedParams[key] = value;
            }
        }
        const result = await session.run(cypher, convertedParams);
        return result.records;
    } finally {
        await session.close();
    }
}

/**
 * Execute multiple queries in a transaction
 * @param {Array<{cypher: string, params: object}>} queries
 * @returns {Promise<Array>} - Results for each query
 */
async function runTransaction(queries) {
    const session = getSession('WRITE');
    const results = [];
    
    try {
        await session.executeWrite(async (tx) => {
            for (const { cypher, params } of queries) {
                const result = await tx.run(cypher, params || {});
                results.push(result.records);
            }
        });
        return results;
    } finally {
        await session.close();
    }
}

/**
 * Promise with timeout wrapper
 */
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        )
    ]);
}

/**
 * Test the Neo4j connection
 */
async function testConnection() {
    try {
        const d = getDriver();
        if (!d) {
            return { connected: false, error: 'Driver not initialized' };
        }
        
        // Add timeout to connection verification
        await withTimeout(d.verifyConnectivity(), 15000);
        
        // Get server info
        const session = getSession('READ');
        try {
            const result = await withTimeout(session.run('RETURN 1 AS test'), 10000);
            return {
                connected: true,
                server: NEO4J_URI,
                test: result.records[0].get('test')
            };
        } finally {
            await session.close();
        }
    } catch (error) {
        return {
            connected: false,
            error: error.message
        };
    }
}

/**
 * Get database statistics
 */
async function getStats() {
    try {
        const records = await runQuery(`
            CALL apoc.meta.stats() YIELD nodeCount, relCount, labels, relTypes
            RETURN nodeCount, relCount, labels, relTypes
        `, {}, 'READ');
        
        if (records.length > 0) {
            const record = records[0];
            return {
                nodeCount: record.get('nodeCount'),
                relCount: record.get('relCount'),
                labels: record.get('labels'),
                relTypes: record.get('relTypes')
            };
        }
        return null;
    } catch (error) {
        // APOC might not be available, try basic stats
        try {
            const nodeResult = await runQuery('MATCH (n) RETURN count(n) AS count', {}, 'READ');
            const relResult = await runQuery('MATCH ()-[r]->() RETURN count(r) AS count', {}, 'READ');
            
            return {
                nodeCount: nodeResult[0]?.get('count') || 0,
                relCount: relResult[0]?.get('count') || 0
            };
        } catch (e) {
            return { error: e.message };
        }
    }
}

/**
 * Close the driver connection
 */
async function closeDriver() {
    if (driver) {
        await driver.close();
        driver = null;
        console.log('Neo4j driver closed');
    }
}

// Initialize constraints for the graph schema
async function initializeSchema() {
    const constraints = [
        // Unique constraints for node identifiers
        'CREATE CONSTRAINT developer_email IF NOT EXISTS FOR (d:Developer) REQUIRE d.email IS UNIQUE',
        'CREATE CONSTRAINT commit_sha IF NOT EXISTS FOR (c:Commit) REQUIRE c.sha IS UNIQUE',
        'CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE f.path IS UNIQUE',
        'CREATE CONSTRAINT ticket_key IF NOT EXISTS FOR (t:Ticket) REQUIRE t.key IS UNIQUE',
        // Indexes for faster lookups
        'CREATE INDEX developer_name IF NOT EXISTS FOR (d:Developer) ON (d.name)',
        'CREATE INDEX commit_date IF NOT EXISTS FOR (c:Commit) ON (c.date)',
        'CREATE INDEX ticket_status IF NOT EXISTS FOR (t:Ticket) ON (t.status)',
        'CREATE INDEX file_language IF NOT EXISTS FOR (f:File) ON (f.language)'
    ];

    const session = getSession('WRITE');
    try {
        for (const constraint of constraints) {
            try {
                await session.run(constraint);
            } catch (e) {
                // Constraint might already exist or syntax differs by version
                if (!e.message.includes('already exists')) {
                    console.warn('Schema warning:', e.message);
                }
            }
        }
        console.log('Neo4j schema initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize schema:', error.message);
        return false;
    } finally {
        await session.close();
    }
}

module.exports = {
    initDriver,
    getDriver,
    getSession,
    runQuery,
    runTransaction,
    testConnection,
    getStats,
    closeDriver,
    initializeSchema
};

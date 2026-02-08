/**
 * Jira Service
 * Handles creating and updating Jira issues for users
 */

const axios = require('axios');

class JiraService {
  constructor() {
    this.baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, ''); // Remove trailing slash
    this.email = process.env.JIRA_EMAIL;
    this.apiToken = process.env.JIRA_API_TOKEN;
    this.projectKey = process.env.JIRA_PROJECT_KEY || 'SCRUM';
    
    // Create auth header
    this.authHeader = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
  }

  /**
   * Get axios config with auth headers
   */
  getConfig() {
    return {
      headers: {
        'Authorization': `Basic ${this.authHeader}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Test Jira connection
   */
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rest/api/3/myself`,
        this.getConfig()
      );
      console.log('✅ Jira connection successful:', response.data.displayName);
      return { success: true, user: response.data };
    } catch (error) {
      console.error('❌ Jira connection failed:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for a user by email or name
   */
  async findUser(query) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/rest/api/3/user/search?query=${encodeURIComponent(query)}`,
        this.getConfig()
      );
      return response.data;
    } catch (error) {
      console.error('Error finding Jira user:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Create a new Jira issue (task)
   */
  async createIssue({ summary, description, assigneeAccountId, priority = 'Medium', issueType = 'Task', labels = [] }) {
    try {
      const priorityMap = {
        'high': 'High',
        'medium': 'Medium', 
        'low': 'Low',
        'High': 'High',
        'Medium': 'Medium',
        'Low': 'Low'
      };

      const issueData = {
        fields: {
          project: { key: this.projectKey },
          summary: summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: description || summary }]
            }]
          },
          issuetype: { name: issueType },
          priority: { name: priorityMap[priority] || 'Medium' }
        }
      };

      if (assigneeAccountId) {
        issueData.fields.assignee = { accountId: assigneeAccountId };
      }

      if (labels && labels.length > 0) {
        issueData.fields.labels = labels;
      }

      console.log('📝 Creating Jira issue:', summary);
      
      const response = await axios.post(
        `${this.baseUrl}/rest/api/3/issue`,
        issueData,
        this.getConfig()
      );

      console.log(`✅ Jira issue created: ${response.data.key}`);
      return {
        success: true,
        key: response.data.key,
        id: response.data.id,
        self: response.data.self
      };
    } catch (error) {
      console.error('❌ Error creating Jira issue:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors || error.message
      };
    }
  }

  /**
   * Update an existing Jira issue
   */
  async updateIssue(issueKey, updates) {
    try {
      const updateData = { fields: {} };

      if (updates.summary) updateData.fields.summary = updates.summary;
      if (updates.assigneeAccountId) {
        updateData.fields.assignee = { accountId: updates.assigneeAccountId };
      }
      if (updates.priority) updateData.fields.priority = { name: updates.priority };
      if (updates.labels) updateData.fields.labels = updates.labels;

      await axios.put(
        `${this.baseUrl}/rest/api/3/issue/${issueKey}`,
        updateData,
        this.getConfig()
      );

      console.log(`✅ Jira issue updated: ${issueKey}`);
      return { success: true, key: issueKey };
    } catch (error) {
      console.error('❌ Error updating Jira issue:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.errors || error.message };
    }
  }

  /**
   * Add a comment to a Jira issue
   */
  async addComment(issueKey, comment) {
    try {
      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: comment }]
          }]
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/rest/api/3/issue/${issueKey}/comment`,
        commentData,
        this.getConfig()
      );

      console.log(`✅ Comment added to ${issueKey}`);
      return { success: true, commentId: response.data.id };
    } catch (error) {
      console.error('❌ Error adding comment:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new JiraService();

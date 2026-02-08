#!/bin/bash

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo "=========================================================================="
echo "🚀 HIERARCHICAL LLM TASK ALLOCATION - Quick Test"
echo "=========================================================================="
echo ""
echo "This will test the new two-level LLM approach:"
echo ""
echo "  ${BLUE}Level 1:${NC} PM categorizes tasks by department (Tech, Marketing, Editing)"
echo "  ${BLUE}Level 2:${NC} Each team assigns tasks to members based on skills"
echo ""
echo "=========================================================================="
echo ""

# Check if server is running
echo -n "Checking server status... "
if curl -s http://localhost:8000/api/tasks/teams > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
    echo ""
    echo "Please start the server first:"
    echo "  cd server && node index.js"
    exit 1
fi

echo ""
echo "=========================================================================="
echo "📋 Test Task: ${YELLOW}Launch a new AI-powered chatbot feature${NC}"
echo "=========================================================================="
echo ""

# Make the API call
echo "Sending request to hierarchical allocation endpoint..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8000/api/tasks/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "task_description": "Launch a new AI-powered chatbot feature for our mobile app",
    "use_hierarchical": true
  }')

# Check if successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)

if [ "$SUCCESS" != "true" ]; then
    echo -e "${RED}✗ Request failed${NC}"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Extract and display results
echo "=========================================================================="
echo "📊 RESULTS"
echo "=========================================================================="
echo ""

PM_ANALYSIS=$(echo "$RESPONSE" | jq -r '.allocation.pm_analysis' 2>/dev/null)
TASK_TYPE=$(echo "$RESPONSE" | jq -r '.allocation.task_type' 2>/dev/null)
DEPARTMENTS=$(echo "$RESPONSE" | jq -r '.allocation.departments_involved | join(", ")' 2>/dev/null)

echo -e "${BOLD}Task Type:${NC} $TASK_TYPE"
echo -e "${BOLD}PM Analysis:${NC} $PM_ANALYSIS"
echo -e "${BOLD}Departments:${NC} $DEPARTMENTS"
echo ""

# Show team allocations
echo "=========================================================================="
echo "🏢 TEAM ALLOCATIONS"
echo "=========================================================================="
echo ""

# Tech Team
TECH_TASKS=$(echo "$RESPONSE" | jq -r '.allocation.teams.tech.tasks | length' 2>/dev/null)
if [ "$TECH_TASKS" != "null" ] && [ "$TECH_TASKS" != "0" ]; then
    echo -e "${BLUE}━━━ TECH TEAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    TECH_THINKING=$(echo "$RESPONSE" | jq -r '.allocation.teams.tech.thinking' 2>/dev/null)
    echo -e "${BOLD}Strategy:${NC} $TECH_THINKING"
    echo ""
    
    for i in $(seq 0 $(($TECH_TASKS - 1))); do
        TASK_TITLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.tech.tasks[$i].title" 2>/dev/null)
        ASSIGNED_TO=$(echo "$RESPONSE" | jq -r ".allocation.teams.tech.tasks[$i].assigned_to.name" 2>/dev/null)
        ROLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.tech.tasks[$i].assigned_to.role" 2>/dev/null)
        SCORE=$(echo "$RESPONSE" | jq -r ".allocation.teams.tech.tasks[$i].score.total * 100 | round" 2>/dev/null)
        
        echo -e "  ${GREEN}✓${NC} $TASK_TITLE"
        echo -e "    ${BOLD}→${NC} $ASSIGNED_TO ($ROLE) - Score: ${SCORE}%"
    done
    echo ""
fi

# Marketing Team
MKT_TASKS=$(echo "$RESPONSE" | jq -r '.allocation.teams.marketing.tasks | length' 2>/dev/null)
if [ "$MKT_TASKS" != "null" ] && [ "$MKT_TASKS" != "0" ]; then
    echo -e "${BLUE}━━━ MARKETING TEAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    MKT_THINKING=$(echo "$RESPONSE" | jq -r '.allocation.teams.marketing.thinking' 2>/dev/null)
    echo -e "${BOLD}Strategy:${NC} $MKT_THINKING"
    echo ""
    
    for i in $(seq 0 $(($MKT_TASKS - 1))); do
        TASK_TITLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.marketing.tasks[$i].title" 2>/dev/null)
        ASSIGNED_TO=$(echo "$RESPONSE" | jq -r ".allocation.teams.marketing.tasks[$i].assigned_to.name" 2>/dev/null)
        ROLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.marketing.tasks[$i].assigned_to.role" 2>/dev/null)
        SCORE=$(echo "$RESPONSE" | jq -r ".allocation.teams.marketing.tasks[$i].score.total * 100 | round" 2>/dev/null)
        
        echo -e "  ${GREEN}✓${NC} $TASK_TITLE"
        echo -e "    ${BOLD}→${NC} $ASSIGNED_TO ($ROLE) - Score: ${SCORE}%"
    done
    echo ""
fi

# Editing Team
EDT_TASKS=$(echo "$RESPONSE" | jq -r '.allocation.teams.editing.tasks | length' 2>/dev/null)
if [ "$EDT_TASKS" != "null" ] && [ "$EDT_TASKS" != "0" ]; then
    echo -e "${BLUE}━━━ EDITING TEAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    EDT_THINKING=$(echo "$RESPONSE" | jq -r '.allocation.teams.editing.thinking' 2>/dev/null)
    echo -e "${BOLD}Strategy:${NC} $EDT_THINKING"
    echo ""
    
    for i in $(seq 0 $(($EDT_TASKS - 1))); do
        TASK_TITLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.editing.tasks[$i].title" 2>/dev/null)
        ASSIGNED_TO=$(echo "$RESPONSE" | jq -r ".allocation.teams.editing.tasks[$i].assigned_to.name" 2>/dev/null)
        ROLE=$(echo "$RESPONSE" | jq -r ".allocation.teams.editing.tasks[$i].assigned_to.role" 2>/dev/null)
        SCORE=$(echo "$RESPONSE" | jq -r ".allocation.teams.editing.tasks[$i].score.total * 100 | round" 2>/dev/null)
        
        echo -e "  ${GREEN}✓${NC} $TASK_TITLE"
        echo -e "    ${BOLD}→${NC} $ASSIGNED_TO ($ROLE) - Score: ${SCORE}%"
    done
    echo ""
fi

echo "=========================================================================="
echo -e "${GREEN}✅ HIERARCHICAL ALLOCATION COMPLETE${NC}"
echo "=========================================================================="
echo ""

# Save full response
echo "$RESPONSE" | jq '.' > /tmp/hierarchical_result.json
echo "Full response saved to: /tmp/hierarchical_result.json"
echo ""

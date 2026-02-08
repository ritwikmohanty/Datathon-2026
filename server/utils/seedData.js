const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');

const seedData = async () => {
    try {
        let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mern-app';
        
        console.log('Connecting to MongoDB:', mongoUri);
        await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

        console.log('Connected. Clearing collection...');
        try { await User.collection.drop(); } catch(e) { console.log('User collection not found or dropped'); }
        try { await Task.collection.drop(); } catch(e) { console.log('Task collection not found or dropped'); }

        const users = [
            // PM
            {
                user_id: "manual:PM001",
                employee_id: "PM001",
                name: "Sarah Chen",
                email: "sarah.chen@company.com",
                role: "Product Manager",
                department: "Product",
                team: "product_management",
                years_of_experience: 12,
                skills: ["Product Strategy", "Roadmap Planning", "Cross-team Coordination", "Agile"],
                expertise: { "Product Strategy": 1.0, "Agile": 0.9 },
                working_style: "Strategic, Visionary",
                availability: "Busy",
                free_slots_per_week: 5,
                past_performance_score: 0.95,
                jira_account_id: "jira-pm-001",
                source: "Manual"
            },
            // Tech Team (4 members)
            {
                user_id: "manual:TECH001",
                employee_id: "TECH001",
                name: "Alice Johnson",
                email: "alice.j@company.com",
                role: "Senior Developer",
                department: "Engineering",
                team: "tech",
                years_of_experience: 5,
                skills: ["React", "TypeScript", "Node.js", "CSS", "Frontend Development"],
                expertise: { "Frontend Development": 0.95, "UI/UX Implementation": 0.90 },
                availability: "Partially Free",
                free_slots_per_week: 15,
                past_performance_score: 0.92,
                jira_account_id: "jira-tech-001",
                source: "Manual"
            },
            {
                user_id: "manual:TECH002",
                employee_id: "TECH002",
                name: "Bob Smith",
                email: "bob.s@company.com",
                role: "Backend Developer",
                department: "Engineering",
                team: "tech",
                years_of_experience: 4,
                skills: ["Node.js", "Express", "MongoDB", "AWS", "Backend Architecture"],
                expertise: { "Backend Architecture": 0.85, "Database Design": 0.90 },
                availability: "Free",
                free_slots_per_week: 25,
                past_performance_score: 0.88,
                jira_account_id: "jira-tech-002",
                source: "Manual"
            },
            {
                user_id: "manual:TECH003",
                employee_id: "TECH003",
                name: "Charlie Davis",
                email: "charlie.d@company.com",
                role: "Developer",
                department: "Engineering",
                team: "tech",
                years_of_experience: 3,
                skills: ["React", "Node.js", "GraphQL", "PostgreSQL", "Full Stack Development"],
                expertise: { "Full Stack Development": 0.80, "API Design": 0.85 },
                availability: "Partially Free",
                free_slots_per_week: 10,
                past_performance_score: 0.85,
                jira_account_id: "jira-tech-003",
                source: "Manual"
            },
             {
                user_id: "manual:TECH004",
                employee_id: "TECH004",
                name: "Diana Prince",
                email: "diana.p@company.com",
                role: "DevOps Engineer",
                department: "Engineering",
                team: "tech",
                years_of_experience: 6,
                skills: ["Docker", "Kubernetes", "CI/CD", "AWS", "DevOps"],
                expertise: { "DevOps": 0.95, "Cloud Infrastructure": 0.90 },
                availability: "Busy",
                free_slots_per_week: 5,
                past_performance_score: 0.94,
                jira_account_id: "jira-tech-004",
                source: "Manual"
            },
            // Marketing Team (3 members)
            {
                user_id: "manual:MKT001",
                employee_id: "MKT001",
                name: "Elena Rodriguez",
                email: "elena.r@company.com",
                role: "Project Manager",
                department: "Marketing",
                team: "marketing",
                years_of_experience: 8,
                skills: ["Campaign Strategy", "SEO", "Content Marketing", "Social Media"],
                expertise: { "Campaign Strategy": 0.95, "SEO": 0.85 },
                availability: "Free",
                free_slots_per_week: 20,
                past_performance_score: 0.91,
                jira_account_id: "jira-mkt-001",
                source: "Manual"
            },
            {
                user_id: "manual:MKT002",
                employee_id: "MKT002",
                name: "Frank Morrison",
                email: "frank.m@company.com",
                role: "Developer",
                department: "Marketing",
                team: "marketing",
                years_of_experience: 4,
                skills: ["Google Ads", "Analytics", "Email Marketing", "Paid Advertising"],
                expertise: { "Paid Advertising": 0.90, "Data Analytics": 0.85 },
                availability: "Partially Free",
                free_slots_per_week: 12,
                past_performance_score: 0.87,
                jira_account_id: "jira-mkt-002",
                source: "Manual"
            },
            {
                user_id: "manual:MKT003",
                employee_id: "MKT003",
                name: "Grace Kim",
                email: "grace.k@company.com",
                role: "Developer",
                department: "Marketing",
                team: "marketing",
                years_of_experience: 2,
                skills: ["Social Media Management", "Copywriting", "Trends Analysis"],
                expertise: { "Social Media": 0.88, "Brand Voice": 0.85 },
                availability: "Free",
                free_slots_per_week: 30,
                past_performance_score: 0.84,
                jira_account_id: "jira-mkt-003",
                source: "Manual"
            },
            // Editing Team (2 members to make 10 total with PM)
            {
                user_id: "manual:EDT001",
                employee_id: "EDT001",
                name: "Henry Wallace",
                email: "henry.w@company.com",
                role: "Tech Lead",
                department: "Content",
                team: "editing",
                years_of_experience: 10,
                skills: ["Editing", "Technical Writing", "Proofreading", "Content Strategy"],
                expertise: { "Technical Editing": 0.95, "Content Strategy": 0.90 },
                availability: "Partially Free",
                free_slots_per_week: 15,
                past_performance_score: 0.93,
                jira_account_id: "jira-edt-001",
                source: "Manual"
            },
            {
                user_id: "manual:EDT002",
                employee_id: "EDT002",
                name: "Ivy Zhang",
                email: "ivy.z@company.com",
                role: "Developer",
                department: "Content",
                team: "editing",
                years_of_experience: 3,
                skills: ["Creative Writing", "SEO Optimization", "Research", "Content Creation"],
                expertise: { "Creative Writing": 0.88, "Research": 0.85 },
                availability: "Free",
                free_slots_per_week: 25,
                past_performance_score: 0.89,
                jira_account_id: "jira-edt-002",
                source: "Manual"
            }
        ];

        await User.insertMany(users);
        console.log(`Seeded ${users.length} users successfully.`);

        // Seed Tasks
        const tasks = [
            {
                task_id: "TASK-001",
                title: "Setup React Project",
                description: "Initialize the frontend repo with React, Typescript and Vite",
                role_required: "frontend",
                priority: "high",
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
                estimated_hours: 8,
                status: "pending",
                jira_issue_key: "PROJ-1"
            },
            {
                task_id: "TASK-002",
                title: "Design Database Schema",
                description: "Create MongoDB schemas for Users and Tasks",
                role_required: "backend",
                priority: "high",
                deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                estimated_hours: 6,
                status: "pending",
                jira_issue_key: "PROJ-2"
            },
             {
                task_id: "TASK-003",
                title: "Marketing Campaign Q1",
                description: "Plan Q1 marketing strategy",
                role_required: "marketing",
                priority: "medium",
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                estimated_hours: 16,
                status: "pending",
                jira_issue_key: "PROJ-3"
            },
            {
                task_id: "TASK-004",
                title: "Optimize API Performance",
                description: "Identify bottlenecks in the legacy API and improve response times by 30%",
                role_required: "backend",
                priority: "medium",
                deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                estimated_hours: 12,
                status: "pending",
                jira_issue_key: "PROJ-4"
            },
            {
                task_id: "TASK-005",
                title: "Social Media content for launch",
                description: "Create 10 tweets and 5 LinkedIn posts for the upcoming product launch.",
                role_required: "marketing",
                priority: "low",
                deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                estimated_hours: 4,
                status: "pending",
                jira_issue_key: "PROJ-5"
            },
            {
                task_id: "TASK-006",
                title: "Write User Manual",
                description: "Document the new features for end users including screenshots.",
                role_required: "editing",
                priority: "medium",
                deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                estimated_hours: 24,
                status: "pending",
                jira_issue_key: "PROJ-6"
            },
            {
                task_id: "TASK-007",
                title: "Security Audit",
                description: "Review current infrastructure for security vulnerabilities.",
                role_required: "devops",
                priority: "high",
                deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                estimated_hours: 16,
                status: "pending",
                jira_issue_key: "PROJ-7"
            },
             {
                task_id: "TASK-008",
                title: "Competitor Analysis",
                description: "Research top 3 competitors and analyze their pricing models.",
                role_required: "marketing",
                priority: "low",
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                estimated_hours: 8,
                status: "pending",
                jira_issue_key: "PROJ-8"
            }
        ];

        await Task.insertMany(tasks);
        console.log(`Seeded ${tasks.length} tasks successfully.`);

        mongoose.disconnect();
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedData();

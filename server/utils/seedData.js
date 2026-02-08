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
                employee_id: "PM001",
                name: "Sarah Chen",
                email: "sarah.chen@company.com",
                role: "Product Manager",
                team: "product_management",
                years_of_experience: 12,
                skills: ["Product Strategy", "Roadmap Planning", "Cross-team Coordination", "Agile"],
                expertise: { "Product Strategy": 1.0, "Agile": 0.9 },
                working_style: "Strategic, Visionary",
                availability: "Busy",
                free_slots_per_week: 5,
                past_performance_score: 0.95,
                jira_account_id: "jira-pm-001"
            },
            // Tech Team (4 members)
            {
                employee_id: "TECH001",
                name: "Alice Johnson",
                email: "alice.j@company.com",
                role: "Senior Frontend Developer",
                team: "tech",
                years_of_experience: 5,
                skills: ["React", "TypeScript", "Node.js", "CSS"],
                expertise: { "Frontend Development": 0.95, "UI/UX Implementation": 0.90 },
                availability: "Partially Free",
                free_slots_per_week: 15,
                past_performance_score: 0.92,
                jira_account_id: "jira-tech-001"
            },
            {
                employee_id: "TECH002",
                name: "Bob Smith",
                email: "bob.s@company.com",
                role: "Backend Engineer",
                team: "tech",
                years_of_experience: 4,
                skills: ["Node.js", "Express", "MongoDB", "AWS"],
                expertise: { "Backend Architecture": 0.85, "Database Design": 0.90 },
                availability: "Free",
                free_slots_per_week: 25,
                past_performance_score: 0.88,
                jira_account_id: "jira-tech-002"
            },
            {
                employee_id: "TECH003",
                name: "Charlie Davis",
                email: "charlie.d@company.com",
                role: "Full Stack Developer",
                team: "tech",
                years_of_experience: 3,
                skills: ["React", "Node.js", "GraphQL", "PostgreSQL"],
                expertise: { "Full Stack Development": 0.80, "API Design": 0.85 },
                availability: "Partially Free",
                free_slots_per_week: 10,
                past_performance_score: 0.85,
                jira_account_id: "jira-tech-003"
            },
             {
                employee_id: "TECH004",
                name: "Diana Prince",
                email: "diana.p@company.com",
                role: "DevOps Engineer",
                team: "tech",
                years_of_experience: 6,
                skills: ["Docker", "Kubernetes", "CI/CD", "AWS"],
                expertise: { "DevOps": 0.95, "Cloud Infrastructure": 0.90 },
                availability: "Busy",
                free_slots_per_week: 5,
                past_performance_score: 0.94,
                jira_account_id: "jira-tech-004"
            },
            // Marketing Team (3 members)
            {
                employee_id: "MKT001",
                name: "Elena Rodriguez",
                email: "elena.r@company.com",
                role: "Marketing Manager",
                team: "marketing",
                years_of_experience: 8,
                skills: ["Campaign Strategy", "SEO", "Content Marketing", "Social Media"],
                expertise: { "Campaign Strategy": 0.95, "SEO": 0.85 },
                availability: "Free",
                free_slots_per_week: 20,
                past_performance_score: 0.91,
                jira_account_id: "jira-mkt-001"
            },
            {
                employee_id: "MKT002",
                name: "Frank Morrison",
                email: "frank.m@company.com",
                role: "Digital Marketer",
                team: "marketing",
                years_of_experience: 4,
                skills: ["Google Ads", "Analytics", "Email Marketing"],
                expertise: { "Paid Advertising": 0.90, "Data Analytics": 0.85 },
                availability: "Partially Free",
                free_slots_per_week: 12,
                past_performance_score: 0.87,
                jira_account_id: "jira-mkt-002"
            },
            {
                employee_id: "MKT003",
                name: "Grace Kim",
                email: "grace.k@company.com",
                role: "Social Media Specialist",
                team: "marketing",
                years_of_experience: 2,
                skills: ["Social Media Management", "Copywriting", "Trends Analysis"],
                expertise: { "Social Media": 0.88, "Brand Voice": 0.85 },
                availability: "Free",
                free_slots_per_week: 30,
                past_performance_score: 0.84,
                jira_account_id: "jira-mkt-003"
            },
            // Editing Team (2 members to make 10 total with PM)
            {
                employee_id: "EDT001",
                name: "Henry Wallace",
                email: "henry.w@company.com",
                role: "Senior Editor",
                team: "editing",
                years_of_experience: 10,
                skills: ["Editing", "Technical Writing", "Proofreading"],
                expertise: { "Technical Editing": 0.95, "Content Strategy": 0.90 },
                availability: "Partially Free",
                free_slots_per_week: 15,
                past_performance_score: 0.93,
                jira_account_id: "jira-edt-001"
            },
            {
                employee_id: "EDT002",
                name: "Ivy Zhang",
                email: "ivy.z@company.com",
                role: "Content Writer",
                team: "editing",
                years_of_experience: 3,
                skills: ["Creative Writing", "SEO Optimization", "Research"],
                expertise: { "Creative Writing": 0.88, "Research": 0.85 },
                availability: "Free",
                free_slots_per_week: 25,
                past_performance_score: 0.89,
                jira_account_id: "jira-edt-002"
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
                role_required: "Senior Frontend Developer",
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
                role_required: "Backend Engineer",
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
                role_required: "Marketing Manager",
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
                role_required: "Backend Engineer",
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
                role_required: "Social Media Specialist",
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
                role_required: "Senior Editor",
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
                role_required: "DevOps Engineer",
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
                role_required: "Digital Marketer",
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

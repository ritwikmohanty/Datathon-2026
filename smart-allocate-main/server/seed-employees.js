const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

// 12 diverse employees covering all major tech domains
const employees = [
  {
    user_id: "user_001",
    employee_id: "EMP001",
    name: "Sarah Chen",
    role: "Senior Frontend Developer",
    team: "frontend",
    skills: ["React", "TypeScript", "Vue", "CSS", "Tailwind", "Next.js", "Figma"],
    years_of_experience: 8,
    free_slots_per_week: 25,
    availability: "Available",
    past_performance_score: 0.92,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_002",
    employee_id: "EMP002",
    name: "Marcus Johnson",
    role: "Backend Lead",
    team: "backend",
    skills: ["Node.js", "Python", "Go", "PostgreSQL", "Redis", "GraphQL", "Microservices"],
    years_of_experience: 12,
    free_slots_per_week: 15,
    availability: "Available",
    past_performance_score: 0.95,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_003",
    employee_id: "EMP003",
    name: "Elena Rodriguez",
    role: "Full Stack Developer",
    team: "fullstack",
    skills: ["React", "Node.js", "MongoDB", "TypeScript", "AWS", "Docker"],
    years_of_experience: 5,
    free_slots_per_week: 30,
    availability: "Available",
    past_performance_score: 0.88,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_004",
    employee_id: "EMP004",
    name: "David Kim",
    role: "DevOps Engineer",
    team: "devops",
    skills: ["Kubernetes", "Docker", "AWS", "Terraform", "CI/CD", "GitHub Actions", "Linux"],
    years_of_experience: 7,
    free_slots_per_week: 20,
    availability: "Available",
    past_performance_score: 0.90,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_005",
    employee_id: "EMP005",
    name: "Priya Patel",
    role: "UI/UX Designer",
    team: "design",
    skills: ["Figma", "Adobe XD", "CSS", "Prototyping", "User Research", "Design Systems"],
    years_of_experience: 6,
    free_slots_per_week: 28,
    availability: "Available",
    past_performance_score: 0.91,
    capacity_hours_per_sprint: 35
  },
  {
    user_id: "user_006",
    employee_id: "EMP006",
    name: "James Wilson",
    role: "Security Engineer",
    team: "security",
    skills: ["Security", "Python", "AWS", "OAuth", "JWT", "OWASP", "Penetration Testing"],
    years_of_experience: 9,
    free_slots_per_week: 22,
    availability: "Available",
    past_performance_score: 0.93,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_007",
    employee_id: "EMP007",
    name: "Lisa Zhang",
    role: "Data Engineer",
    team: "data",
    skills: ["Python", "SQL", "Spark", "Airflow", "Kafka", "PostgreSQL", "Data Modeling"],
    years_of_experience: 6,
    free_slots_per_week: 26,
    availability: "Available",
    past_performance_score: 0.87,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_008",
    employee_id: "EMP008",
    name: "Alex Thompson",
    role: "Mobile Developer",
    team: "mobile",
    skills: ["React Native", "Swift", "Kotlin", "iOS", "Android", "TypeScript"],
    years_of_experience: 5,
    free_slots_per_week: 32,
    availability: "Available",
    past_performance_score: 0.86,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_009",
    employee_id: "EMP009",
    name: "Nina Kowalski",
    role: "QA Engineer",
    team: "testing",
    skills: ["Testing", "Cypress", "Jest", "Selenium", "Python", "API Testing", "Automation"],
    years_of_experience: 4,
    free_slots_per_week: 30,
    availability: "Available",
    past_performance_score: 0.89,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_010",
    employee_id: "EMP010",
    name: "Ryan Martinez",
    role: "ML Engineer",
    team: "ml",
    skills: ["Python", "TensorFlow", "PyTorch", "Machine Learning", "Data Science", "NLP"],
    years_of_experience: 5,
    free_slots_per_week: 24,
    availability: "Available",
    past_performance_score: 0.88,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_011",
    employee_id: "EMP011",
    name: "Emily Foster",
    role: "Junior Frontend Developer",
    team: "frontend",
    skills: ["React", "JavaScript", "CSS", "HTML", "Tailwind"],
    years_of_experience: 2,
    free_slots_per_week: 35,
    availability: "Available",
    past_performance_score: 0.82,
    capacity_hours_per_sprint: 40
  },
  {
    user_id: "user_012",
    employee_id: "EMP012",
    name: "Michael Brown",
    role: "Backend Developer",
    team: "backend",
    skills: ["Java", "Spring Boot", "PostgreSQL", "MySQL", "REST API", "Microservices"],
    years_of_experience: 7,
    free_slots_per_week: 18,
    availability: "Busy",
    past_performance_score: 0.90,
    capacity_hours_per_sprint: 40
  }
];

async function seedDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the entire users collection (removes all data AND indexes)
    console.log('🗑️  Dropping existing users collection...');
    try {
      await db.collection('users').drop();
      console.log('   Collection dropped successfully');
    } catch (e) {
      console.log('   Collection did not exist, creating fresh');
    }

    // Create the collection and insert new employees
    const usersCollection = db.collection('users');
    
    console.log('📝 Inserting 12 new diverse employees...');
    const insertResult = await usersCollection.insertMany(employees);
    console.log(`   Inserted ${insertResult.insertedCount} employees`);

    // Verify
    const count = await usersCollection.countDocuments();
    console.log(`\n✅ Database now has ${count} employees:`);
    
    const allEmployees = await usersCollection.find({}).toArray();
    allEmployees.forEach((emp, i) => {
      console.log(`   ${i + 1}. ${emp.name} - ${emp.role} (${emp.years_of_experience}yr exp, ${emp.skills.slice(0, 3).join(', ')}...)`);
    });

    console.log('\n🎉 Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();

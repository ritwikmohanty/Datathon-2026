import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, X, Plus, Sparkles, DollarSign, AlertTriangle, AlertCircle, Info } from "lucide-react";

type Priority = "low" | "medium" | "high";

interface FeatureInputProps {
  onSubmit: (feature: string, details: string, budget: number | null, techStack: string[], deadlineWeeks: number, autoGenerateTech: boolean, priority: Priority) => void;
  isProcessing: boolean;
}

// Comprehensive list of technologies
const TECH_OPTIONS = [
  // Frontend
  "React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt.js", "Remix", "Astro",
  "TypeScript", "JavaScript", "HTML5", "CSS3", "Tailwind CSS", "SASS/SCSS",
  "Bootstrap", "Material UI", "Chakra UI", "Styled Components", "Framer Motion",
  "Redux", "Zustand", "MobX", "Recoil", "React Query", "SWR",
  
  // Backend
  "Node.js", "Express.js", "Fastify", "NestJS", "Python", "Django", "Flask", "FastAPI",
  "Go", "Gin", "Rust", "Actix", "Java", "Spring Boot", "Kotlin", "Scala",
  "Ruby", "Ruby on Rails", "PHP", "Laravel", "C#", ".NET", "Elixir", "Phoenix",
  
  // Databases
  "PostgreSQL", "MySQL", "MariaDB", "SQLite", "MongoDB", "Redis", "Cassandra",
  "DynamoDB", "Firebase", "Supabase", "PlanetScale", "CockroachDB", "Neo4j",
  "Elasticsearch", "InfluxDB", "TimescaleDB",
  
  // Cloud & DevOps
  "AWS", "Azure", "Google Cloud", "Vercel", "Netlify", "Heroku", "DigitalOcean",
  "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins", "GitHub Actions",
  "GitLab CI", "CircleCI", "ArgoCD", "Prometheus", "Grafana", "DataDog",
  
  // APIs & Communication
  "REST API", "GraphQL", "gRPC", "WebSockets", "Socket.io", "Apache Kafka",
  "RabbitMQ", "Redis Pub/Sub", "AWS SQS", "tRPC",
  
  // Mobile
  "React Native", "Flutter", "Swift", "SwiftUI", "Kotlin Android", "Ionic",
  "Capacitor", "Expo", "iOS", "Android",
  
  // AI/ML
  "Machine Learning", "TensorFlow", "PyTorch", "Scikit-learn", "Keras",
  "OpenAI API", "LangChain", "Hugging Face", "Computer Vision", "NLP",
  "Deep Learning", "MLOps", "Data Science",
  
  // Security
  "Security", "OAuth 2.0", "JWT", "SAML", "Penetration Testing", "OWASP",
  "SSL/TLS", "Encryption", "IAM", "Vault",
  
  // Testing
  "Testing", "Jest", "Vitest", "Cypress", "Playwright", "Selenium",
  "React Testing Library", "Mocha", "Pytest", "JUnit", "Load Testing",
  
  // Other
  "CI/CD", "DevOps", "Microservices", "Serverless", "Edge Computing",
  "WebAssembly", "Blockchain", "Web3", "Solidity", "IPFS",
  "Real-time", "Caching", "CDN", "SEO", "Analytics", "Monitoring",
  "Logging", "Error Tracking", "Feature Flags", "A/B Testing"
];

const FeatureInput = ({ onSubmit, isProcessing }: FeatureInputProps) => {
  const [feature, setFeature] = useState("");
  const [details, setDetails] = useState("");
  const [budget, setBudget] = useState<number | null>(10000);
  const [hasBudget, setHasBudget] = useState(true);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [deadlineWeeks, setDeadlineWeeks] = useState(4);
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [techSearch, setTechSearch] = useState("");
  const [autoGenerateTech, setAutoGenerateTech] = useState(false);
  const [priority, setPriority] = useState<Priority>("medium");
  const [inputError, setInputError] = useState<string | null>(null);

  // Check if input looks like junk/gibberish
  const isJunkInput = (text: string): boolean => {
    const trimmed = text.trim().toLowerCase();
    
    // Too short (under 3 characters)
    if (trimmed.length < 3) return true;
    
    // Single word that's very short or looks like gibberish
    const words = trimmed.split(/\s+/);
    if (words.length === 1 && trimmed.length < 5) {
      // Check if it's just random letters (no vowels pattern or keyboard mash)
      const vowels = trimmed.match(/[aeiou]/gi)?.length || 0;
      const consonants = trimmed.length - vowels;
      if (vowels === 0 || consonants / Math.max(vowels, 1) > 5) return true;
    }
    
    // Common junk patterns
    const junkPatterns = [
      /^[a-z]{1,4}$/,  // Single short word like "xyz", "abc", "test"
      /^[a-z]+\d+$/,   // Letters followed by numbers like "test123"
      /^(\w)\1+$/,     // Repeated characters like "aaa", "xxx"
      /^(asdf|qwer|zxcv|test|hello|hi|hey|ok|okay|lol|idk|hmm)/i,  // Common junk
    ];
    
    for (const pattern of junkPatterns) {
      if (pattern.test(trimmed)) return true;
    }
    
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    
    if (!feature.trim()) return;
    if (isProcessing) return;
    
    // Check for junk input
    if (isJunkInput(feature)) {
      setInputError("Please enter a valid feature description (e.g., 'User authentication system' or 'Dashboard with real-time charts')");
      return;
    }
    
    onSubmit(feature, details, hasBudget ? budget : null, autoGenerateTech ? [] : techStack, deadlineWeeks, autoGenerateTech, priority);
  };

  const addTech = (tech: string) => {
    if (!techStack.includes(tech)) {
      setTechStack([...techStack, tech]);
    }
    setTechSearch("");
    setShowTechDropdown(false);
  };

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter(t => t !== tech));
  };

  const filteredTech = TECH_OPTIONS.filter(
    tech => tech.toLowerCase().includes(techSearch.toLowerCase()) && !techStack.includes(tech)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Feature Name */}
        <div className="relative">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            Feature / Sprint Name
          </label>
          <input
            type="text"
            value={feature}
            onChange={(e) => {
              setFeature(e.target.value);
              setInputError(null); // Clear error when typing
            }}
            placeholder="e.g., Implement user authentication system"
            className={`w-full px-3 py-3 bg-background border-2 text-foreground placeholder:text-muted-foreground font-mono text-base focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all ${
              inputError ? 'border-destructive' : 'border-foreground'
            }`}
            disabled={isProcessing}
          />
          {/* Error Message */}
          {inputError && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2 bg-destructive/10 border border-destructive text-destructive text-xs font-mono flex items-center gap-2"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {inputError}
            </motion.div>
          )}
        </div>

        {/* Budget and Deadline Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Budget Slider */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Budget Limit
              </label>
              <button
                type="button"
                onClick={() => setHasBudget(!hasBudget)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase transition-colors ${
                  hasBudget 
                    ? 'bg-foreground text-background' 
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
                disabled={isProcessing}
              >
                <DollarSign className="w-3 h-3" />
                {hasBudget ? 'Enabled' : 'No Budget'}
              </button>
            </div>
            <div className={`p-3 border-2 border-foreground bg-background transition-opacity ${!hasBudget ? 'opacity-50' : ''}`}>
              {hasBudget ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xl font-mono font-bold">${(budget || 10000).toLocaleString()}</span>
                    <span className="text-xs font-mono text-muted-foreground">USD</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={budget || 10000}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full h-2 bg-muted rounded-none appearance-none cursor-pointer accent-foreground"
                    disabled={isProcessing}
                  />
                  <div className="flex justify-between text-xs font-mono text-muted-foreground mt-1.5">
                    <span>$1K</span>
                    <span>$100K</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[60px]">
                  <span className="text-muted-foreground font-mono text-sm">No budget constraint</span>
                </div>
              )}
            </div>
          </div>

          {/* Deadline Selector */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Deadline
              </label>
              <span className="px-2.5 py-1 text-xs font-mono uppercase text-muted-foreground">
                Timeline
              </span>
            </div>
            <div className="p-3 border-2 border-foreground bg-background">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-mono font-bold">{deadlineWeeks}</span>
                <span className="text-xs font-mono text-muted-foreground">WEEKS</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={deadlineWeeks}
                onChange={(e) => setDeadlineWeeks(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-none appearance-none cursor-pointer accent-foreground"
                disabled={isProcessing}
              />
              <div className="flex justify-between text-xs font-mono text-muted-foreground mt-1.5">
                <span>1 wk</span>
                <span>16 wks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Selector */}
        <div className="relative">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            Priority Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {/* Low Priority */}
            <motion.button
              type="button"
              onClick={() => setPriority("low")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-2.5 border-2 transition-all ${
                priority === "low"
                  ? "border-green-500 bg-green-500/10 text-green-500"
                  : "border-foreground bg-background text-muted-foreground hover:border-green-500/50"
              }`}
              disabled={isProcessing}
            >
              <div className="flex items-center justify-center gap-2">
                <Info className={`w-4 h-4 ${priority === "low" ? "text-green-500" : ""}`} />
                <span className="text-sm font-mono font-semibold uppercase">Low</span>
              </div>
            </motion.button>

            {/* Medium Priority */}
            <motion.button
              type="button"
              onClick={() => setPriority("medium")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-2.5 border-2 transition-all ${
                priority === "medium"
                  ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                  : "border-foreground bg-background text-muted-foreground hover:border-yellow-500/50"
              }`}
              disabled={isProcessing}
            >
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className={`w-4 h-4 ${priority === "medium" ? "text-yellow-500" : ""}`} />
                <span className="text-sm font-mono font-semibold uppercase">Medium</span>
              </div>
            </motion.button>

            {/* High Priority */}
            <motion.button
              type="button"
              onClick={() => setPriority("high")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-2.5 border-2 transition-all ${
                priority === "high"
                  ? "border-red-500 bg-red-500/10 text-red-500"
                  : "border-foreground bg-background text-muted-foreground hover:border-red-500/50"
              }`}
              disabled={isProcessing}
            >
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${priority === "high" ? "text-red-500" : ""}`} />
                <span className="text-sm font-mono font-semibold uppercase">High</span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* Tech Stack Selector */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Required Tech Stack
            </label>
            <button
              type="button"
              onClick={() => {
                setAutoGenerateTech(!autoGenerateTech);
                if (!autoGenerateTech) {
                  setTechStack([]);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase transition-colors ${
                autoGenerateTech 
                  ? 'bg-accent text-accent-foreground' 
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
              disabled={isProcessing}
            >
              <Sparkles className="w-3 h-3" />
              {autoGenerateTech ? 'Auto' : 'Manual'}
            </button>
          </div>
          
          {autoGenerateTech ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 border-2 border-accent bg-accent/5"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  AI will auto-determine tech stack based on requirements and team expertise.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="p-3 border-2 border-foreground bg-background">
              {/* Selected Tech Tags */}
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                <AnimatePresence mode="popLayout">
                  {techStack.map((tech) => (
                    <motion.span
                      key={tech}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-foreground text-background text-xs font-mono uppercase"
                    >
                      {tech}
                      <button
                        type="button"
                        onClick={() => removeTech(tech)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                        disabled={isProcessing}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
                {techStack.length === 0 && (
                  <span className="text-muted-foreground text-xs font-mono">No technologies selected</span>
                )}
              </div>
              
              {/* Tech Search Input */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={techSearch}
                    onChange={(e) => {
                      setTechSearch(e.target.value);
                      setShowTechDropdown(true);
                    }}
                    onFocus={() => setShowTechDropdown(true)}
                    placeholder="Search and add technologies..."
                    className="flex-1 px-2 py-2 bg-transparent text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none"
                    disabled={isProcessing}
                  />
                </div>
                
                {/* Dropdown */}
                <AnimatePresence>
                {showTechDropdown && filteredTech.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 right-0 top-full mt-1 bg-background border-2 border-foreground max-h-36 overflow-y-auto z-50"
                  >
                    {filteredTech.slice(0, 6).map((tech) => (
                      <button
                        key={tech}
                        type="button"
                        onClick={() => addTech(tech)}
                        className="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-muted transition-colors"
                      >
                        {tech}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Additional Details */}
        <div className="relative">
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            Additional Requirements (Optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Specify any additional requirements, constraints, or priorities..."
            rows={2}
            className="w-full px-3 py-2.5 bg-background border-2 border-foreground text-foreground placeholder:text-muted-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all resize-none"
            disabled={isProcessing}
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <motion.button
            type="submit"
            disabled={!feature.trim() || isProcessing}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 bg-foreground text-background font-mono uppercase tracking-widest text-sm font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent transition-colors"
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Analyzing...</span>
                </motion.div>
              ) : (
                <motion.div
                  key="submit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Allocate Resources</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
};

export default FeatureInput;

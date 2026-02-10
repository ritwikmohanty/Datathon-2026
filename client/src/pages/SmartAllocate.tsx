import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FeatureInput from "@/components/FeatureInput";
import TimelineGraph from "@/components/TimelineGraph";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import type { LLMAllocationResponse } from "@/lib/types";

interface EmployeeInfo {
  id: string;
  name: string;
  hourlyRate: number;
  role: string;
  techStack?: string[];
  workload?: number;
}

interface Allocation {
  task: { id: string; title: string; estimatedHours: number; requiredSkills: string[] };
  employee: EmployeeInfo;
  employees?: EmployeeInfo[]; // Support multiple employees
}

type Priority = "low" | "medium" | "high";

interface FeatureData {
  feature: string;
  details: string;
  budget: number | null;
  techStack: string[];
  deadlineWeeks: number;
  autoGenerateTech: boolean;
  priority: Priority;
}

// Allocation data for delay prediction
interface AllocationData {
  tasks: {
    id: string;
    title: string;
    description: string;
    required_skills: string[];
    estimated_hours: number;
    assigned_employee_ids: string[];
    status: string;
  }[];
  employees: {
    id: string;
    name: string;
    role: string;
    tech_stack: string[];
    hourly_rate: number;
    workload: number;
  }[];
  deadline_weeks: number;
  budget: number;
  total_hours: number;
}

interface SmartAllocateProps {
  onNavigateToDelay?: (data: AllocationData) => void;
  onBack?: () => void;
}

const SmartAllocate = ({ onNavigateToDelay, onBack }: SmartAllocateProps) => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [featureData, setFeatureData] = useState<FeatureData | null>(null);
  const [llmResponse, setLlmResponse] = useState<LLMAllocationResponse | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (feature: string, details: string, budget: number | null, techStack: string[], deadlineWeeks: number, autoGenerateTech: boolean, priority: Priority) => {
    console.log("Processing:", feature, details, budget, techStack, deadlineWeeks, autoGenerateTech, priority);
    setIsProcessing(true);
    setShowAnalytics(false);
    setAllocations([]);
    setFeatureData({ feature, details, budget, techStack, deadlineWeeks, autoGenerateTech, priority });
    setLlmResponse(null);
    
    // Smooth scroll to timeline section after a brief delay
    setTimeout(() => {
      timelineRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start'
      });
    }, 100);
  };

  const handleAllocationComplete = useCallback((newAllocations: Allocation[], response?: LLMAllocationResponse) => {
    setAllocations(newAllocations);
    if (response) {
      setLlmResponse(response);
    }
    setIsProcessing(false);
    setTimeout(() => setShowAnalytics(true), 500);
  }, []);

  return (
    <div className="w-full bg-background">
      {/* Header */}
      <header className="border-b-2 border-foreground mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-foreground hover:bg-foreground hover:text-background transition-colors font-mono text-xs sm:text-sm"
            >
              <Home className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-foreground flex items-center justify-center">
              <span className="text-background font-mono font-bold text-base sm:text-lg">AI</span>
            </div>
            <div>
              <h1 className="font-semibold tracking-tight text-base sm:text-lg">Project Allocator</h1>
              <p className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-widest">
                Intelligent Resource Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm font-mono">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
        {/* Feature Input Section */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight">New Feature Request</h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Describe your feature and let AI optimize team allocation
            </p>
          </div>
          <FeatureInput onSubmit={handleSubmit} isProcessing={isProcessing} />
        </motion.section>

        {/* Divider */}
        <div className="h-px bg-border my-4" />

        {/* Timeline Graph Section */}
        <motion.section
          ref={timelineRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="scroll-mt-6"
        >
          <TimelineGraph 
            isProcessing={isProcessing} 
            onAllocationComplete={handleAllocationComplete}
            featureData={featureData}
            onNavigateToDelay={onNavigateToDelay}
          />
        </motion.section>

        {/* Analytics Section */}
        <AnalyticsDashboard 
          allocations={allocations} 
          isVisible={showAnalytics}
          llmResponse={llmResponse}
        />
      </main>
    </div>
  );
};

export default SmartAllocate;

// Employee data types for LLM input
export interface EmployeeWorkload {
  active_tickets: number;
  ticket_weights: number[];
  computed_score: number;
}

export interface EmployeeData {
  id: string;
  name: string;
  role: string;
  avatar: string;
  availability: boolean;
  hours_per_week: number;
  workload: EmployeeWorkload;
  tech_stack: string[];
  seniority: "Junior" | "Mid" | "Senior" | "Lead";
  efficiency: number;
  stress: number;
  cost_per_hour: number;
  experience: number; // Years of experience (0-20+)
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  estimated_hours: number;
  priority: "low" | "medium" | "high" | "critical";
  deadline_weeks: number;
}

export interface FeatureRequest {
  feature_name: string;
  description: string;
  deadline_weeks: number;
  priority: "low" | "medium" | "high" | "critical";
  tech_requirements: string[];
}

export interface AllocationResult {
  task_id: string;
  employee_id: string;
  employee_ids?: string[]; // Support multiple employees per task
  reasoning: string;
  confidence: number;
  estimated_completion_hours: number;
  risk_factors: string[];
}

export interface RejectionResult {
  task_id: string;
  employee_id: string;
  rejection_reason: string;
}

export interface LLMError {
  type: "invalid_task";
  message: string;
  suggestion: string;
}

export interface LLMAllocationResponse {
  error?: LLMError;
  tasks: TaskData[];
  allocations: AllocationResult[];
  rejections: RejectionResult[];
  timeline: {
    week: number;
    tasks_in_progress: string[];
    milestones: string[];
  }[];
  business_analytics: {
    total_estimated_cost: number;
    projected_savings: number;
    savings_percentage: number;
    time_efficiency_gain: number;
    risk_assessment: string;
    roi_estimate: number;
  };
}

export interface AllocationCandidate {
  employee: EmployeeData;
  task: TaskData;
  status: "analyzing" | "rejected" | "matched";
  reasoning?: string;
}

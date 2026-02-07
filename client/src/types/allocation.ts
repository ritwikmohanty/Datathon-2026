// Types for the task allocation system

export interface ProductManager {
  id: string;
  name: string;
  role: string;
  years_of_experience: number;
  skills: string[];
  working_style: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: string;
  years_of_experience: number;
  skills: string[];
  expertise: Record<string, number>;
  working_style: string;
  availability: string;
  free_slots_per_week: number;
  past_performance_score: number;
  domain_knowledge: string[];
}

export interface ScoreBreakdown {
  skill_match: number;
  experience: number;
  availability: number;
  past_performance: number;
  expertise_depth: number;
}

export interface Score {
  total: number;
  breakdown: ScoreBreakdown;
  weights: Record<string, number>;
}

export interface CandidateScore {
  id: string;
  name: string;
  total_score: number;
  breakdown: ScoreBreakdown;
}

export interface TaskAssignment {
  title: string;
  description?: string;
  required_skills: string[];
  complexity: string;
  estimated_hours: number;
  task_reasoning?: string;
  assigned_to: {
    id: string;
    name: string;
    role: string;
    years_of_experience: number;
    availability: string;
    free_slots_per_week: number;
  };
  score: Score;
  reasoning: string[];
  all_candidates: CandidateScore[];
}

export interface ThinkingProcess {
  task_analysis: string;
  tech_thinking: string;
  marketing_thinking: string;
  editing_thinking: string;
}

// NEW: Step-by-step LLM tracking
export interface LLMStep {
  step: string;
  success: boolean;
  thinking: string | null;
}

export interface TeamAllocation {
  team_name: string;
  description: string;
  thinking?: string;
  tasks: TaskAssignment[];
}

export interface AllocationResult {
  product_manager: ProductManager;
  task_description: string;
  task_type: string;
  ai_generated: boolean;
  llm_steps?: LLMStep[];  // NEW: Track each LLM call
  thinking?: ThinkingProcess;
  teams: Record<string, TeamAllocation>;
}

export interface TaskTemplate {
  id: string;
  name: string;
  teams: string[];
  total_subtasks: number;
}

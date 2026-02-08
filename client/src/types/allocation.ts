export type AllocationResult = {
  product_manager: {
    id?: string
    name: string
    role?: string
    email?: string
  }
  task_description: string
  task_type?: string
  ai_generated?: boolean
  thinking?: {
    task_analysis?: string
    tech_thinking?: string
    marketing_thinking?: string
    editing_thinking?: string
  }
  teams: Record<
    string,
    {
      team_name: string
      description?: string
      thinking?: string
      tasks: Array<{
        title: string
        description?: string
        required_skills: string[]
        complexity?: string
        estimated_hours?: number
        task_reasoning?: string
        assigned_to?: {
          id?: string
          name: string
          role?: string
          years_of_experience?: number
          availability?: string
          free_slots_per_week?: number
        }
        score?: {
          total: number
        }
        reasoning?: string[]
      }>
    }
  >
}

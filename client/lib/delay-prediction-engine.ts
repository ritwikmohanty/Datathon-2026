/**
 * AI-Powered Delay Prediction Engine
 * 
 * Uses employee performance data, commit history, and project metrics
 * to intelligently predict delays based on various scenarios.
 */

// ============================================
// TYPES - Based on MongoDB Schemas
// ============================================

export interface EnhancedEmployee {
  id: string;
  user_id: string;
  display_name: string;
  email?: string;
  role: 'Developer' | 'Senior Developer' | 'Tech Lead' | 'Project Manager' | 'QA Engineer' | 'DevOps Engineer' | 'Unassigned';
  department?: string;
  team?: string;
  hourly_rate: number;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
  skills: string[];
  seniority_level: number; // 1-5 (Junior to Principal)
  capacity_hours_per_sprint: number;
  
  // Performance metrics (computed from historical data)
  performance: {
    avg_commits_per_week: number;
    avg_lines_per_commit: number;
    code_review_approval_rate: number; // 0-1
    bug_introduction_rate: number; // bugs per 100 LOC
    avg_task_completion_days: number;
    velocity_score: number; // story points per sprint
    on_time_delivery_rate: number; // 0-1
    collaboration_score: number; // based on PR reviews, comments
  };
  
  // Current state
  current_workload: number; // 0-100%
  active_tasks: number;
  stress_indicator: number; // 0-1 (computed from recent activity patterns)
}

export interface EnhancedTask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  issue_type: 'Story' | 'Task' | 'Bug' | 'Epic' | 'Sub-task' | 'Feature' | 'Improvement';
  status: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  
  // Estimation
  story_points?: number;
  estimated_hours: number;
  original_estimate_hours?: number;
  
  // Assignment
  assigned_employee_ids: string[];
  required_skills: string[];
  role_required: 'frontend' | 'backend' | 'qa' | 'devops' | 'fullstack';
  
  // Dependencies
  depends_on: string[]; // Task IDs this depends on
  blocks: string[]; // Task IDs this blocks
  
  // Historical data for similar tasks
  similar_tasks_avg_completion: number; // days
  similar_tasks_overrun_rate: number; // 0-1
}

export interface ProjectContext {
  project_id: string;
  name: string;
  deadline_weeks: number;
  budget: number;
  total_estimated_hours: number;
  
  // Team metrics
  team_velocity: number; // story points per sprint
  sprint_completion_rate: number; // 0-1
  historical_overrun_rate: number; // average % projects go over
  
  // Risk factors
  technical_debt_score: number; // 0-1
  external_dependencies: number; // count
  requirement_stability: number; // 0-1 (1 = stable, 0 = constantly changing)
}

export interface DelayScenario {
  employee_removals: string[]; // Employee IDs removed
  budget_adjustment: number; // percentage (100 = no change, 80 = 20% cut)
  deadline_adjustment: number; // weeks (positive = extended, negative = shortened)
  scope_change: number; // percentage (100 = no change, 120 = 20% more scope)
  external_delay_days: number; // days of external blockers
}

export interface DelayPredictionResult {
  // Core prediction
  predicted_delay_days: number;
  delay_range: { min: number; max: number; confidence: number };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  delay_probability: number; // 0-1
  
  // Breakdown by factor
  factors: DelayFactor[];
  
  // Employee-specific impact
  employee_impact: EmployeeImpact[];
  
  // Task-specific analysis
  critical_path_tasks: string[]; // Task IDs on critical path
  bottleneck_tasks: string[]; // Tasks likely to cause delays
  
  // Financial impact
  cost_impact: {
    additional_labor_cost: number;
    opportunity_cost: number;
    overtime_cost: number;
    total_impact: number;
    currency: string;
  };
  
  // Recommendations
  recommendations: Recommendation[];
  
  // Confidence metrics
  confidence_score: number; // 0-1
  data_quality_score: number; // 0-1 (based on how much historical data we have)
}

export interface DelayFactor {
  category: 'staffing' | 'budget' | 'scope' | 'technical' | 'external' | 'capacity' | 'skill_gap';
  factor: string;
  impact_days: number;
  probability: number;
  severity: 'low' | 'medium' | 'high';
  mitigatable: boolean;
}

export interface EmployeeImpact {
  employee_id: string;
  employee_name: string;
  role: string;
  
  // Impact if removed
  removal_impact: {
    delay_days: number;
    tasks_affected: number;
    hours_to_redistribute: number;
    skill_coverage_loss: string[]; // Skills that become uncovered
    replacement_difficulty: 'easy' | 'medium' | 'hard' | 'critical';
  };
  
  // Current risk assessment
  burnout_risk: number; // 0-1
  flight_risk: number; // 0-1 (based on workload + market conditions)
  single_point_of_failure: boolean;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'staffing' | 'process' | 'scope' | 'timeline' | 'budget';
  recommendation: string;
  expected_impact_days: number;
  implementation_effort: 'low' | 'medium' | 'high';
  cost_implication: number;
}

// ============================================
// PREDICTION ENGINE
// ============================================

export class DelayPredictionEngine {
  private employees: EnhancedEmployee[];
  private tasks: EnhancedTask[];
  private project: ProjectContext;
  
  constructor(
    employees: EnhancedEmployee[],
    tasks: EnhancedTask[],
    project: ProjectContext
  ) {
    this.employees = employees;
    this.tasks = tasks;
    this.project = project;
  }
  
  /**
   * Main prediction method - analyzes a scenario and predicts delays
   */
  predict(scenario: DelayScenario): DelayPredictionResult {
    const factors: DelayFactor[] = [];
    let totalDelayDays = 0;
    
    // Get active employees after removals
    const removedSet = new Set(scenario.employee_removals);
    const activeEmployees = this.employees.filter(e => !removedSet.has(e.id));
    const removedEmployees = this.employees.filter(e => removedSet.has(e.id));
    
    // 1. STAFFING IMPACT
    const staffingImpact = this.analyzeStaffingImpact(removedEmployees, activeEmployees);
    factors.push(...staffingImpact.factors);
    totalDelayDays += staffingImpact.totalImpact;
    
    // 2. BUDGET IMPACT
    const budgetImpact = this.analyzeBudgetImpact(scenario.budget_adjustment, activeEmployees);
    factors.push(...budgetImpact.factors);
    totalDelayDays += budgetImpact.totalImpact;
    
    // 3. CAPACITY ANALYSIS
    const capacityImpact = this.analyzeCapacity(activeEmployees, scenario);
    factors.push(...capacityImpact.factors);
    totalDelayDays += capacityImpact.totalImpact;
    
    // 4. SKILL GAP ANALYSIS
    const skillGapImpact = this.analyzeSkillGaps(activeEmployees);
    factors.push(...skillGapImpact.factors);
    totalDelayDays += skillGapImpact.totalImpact;
    
    // 5. CRITICAL PATH ANALYSIS
    const criticalPathImpact = this.analyzeCriticalPath(activeEmployees);
    factors.push(...criticalPathImpact.factors);
    totalDelayDays += criticalPathImpact.totalImpact;
    
    // 6. SCOPE CHANGE IMPACT
    if (scenario.scope_change !== 100) {
      const scopeImpact = this.analyzeScopeChange(scenario.scope_change);
      factors.push(...scopeImpact.factors);
      totalDelayDays += scopeImpact.totalImpact;
    }
    
    // 7. EXTERNAL DELAYS
    if (scenario.external_delay_days > 0) {
      factors.push({
        category: 'external',
        factor: `External blockers: ${scenario.external_delay_days} days`,
        impact_days: scenario.external_delay_days,
        probability: 1.0,
        severity: scenario.external_delay_days > 5 ? 'high' : 'medium',
        mitigatable: false
      });
      totalDelayDays += scenario.external_delay_days;
    }
    
    // 8. DEADLINE ADJUSTMENT (negative = shortened deadline = more pressure)
    if (scenario.deadline_adjustment < 0) {
      const pressureDays = Math.abs(scenario.deadline_adjustment) * 7; // weeks to days
      const pressureImpact = Math.ceil(pressureDays * 0.3); // 30% of the pressure becomes delay
      factors.push({
        category: 'external',
        factor: `Deadline shortened by ${Math.abs(scenario.deadline_adjustment)} week(s)`,
        impact_days: pressureImpact,
        probability: 0.7,
        severity: 'high',
        mitigatable: true
      });
      totalDelayDays += pressureImpact * 0.7;
    } else if (scenario.deadline_adjustment > 0) {
      // Extended deadline reduces pressure
      totalDelayDays -= scenario.deadline_adjustment * 2; // Each extra week reduces delay by 2 days
    }
    
    // Apply historical overrun rate
    const historicalAdjustment = totalDelayDays * this.project.historical_overrun_rate;
    if (historicalAdjustment > 0) {
      factors.push({
        category: 'technical',
        factor: `Historical overrun pattern (${Math.round(this.project.historical_overrun_rate * 100)}% avg)`,
        impact_days: Math.round(historicalAdjustment),
        probability: 0.8,
        severity: 'medium',
        mitigatable: true
      });
      totalDelayDays += historicalAdjustment * 0.8;
    }
    
    // Calculate employee-specific impact
    const employeeImpact = this.calculateEmployeeImpact(activeEmployees, removedEmployees);
    
    // Find critical path and bottlenecks
    const criticalPath = this.findCriticalPath();
    const bottlenecks = this.findBottlenecks(activeEmployees);
    
    // Calculate financial impact
    const costImpact = this.calculateCostImpact(totalDelayDays, scenario, activeEmployees);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, employeeImpact, scenario);
    
    // Calculate confidence
    const dataQuality = this.assessDataQuality();
    const confidence = Math.min(0.95, 0.5 + dataQuality * 0.4 + (factors.length > 0 ? 0.1 : 0));
    
    // Calculate delay range
    const variance = totalDelayDays * 0.3;
    const delayRange = {
      min: Math.max(0, Math.round(totalDelayDays - variance)),
      max: Math.round(totalDelayDays + variance),
      confidence: confidence
    };
    
    // Determine risk level
    const finalDelay = Math.max(0, Math.round(totalDelayDays));
    let riskLevel: DelayPredictionResult['risk_level'];
    if (finalDelay <= 3) riskLevel = 'low';
    else if (finalDelay <= 7) riskLevel = 'medium';
    else if (finalDelay <= 14) riskLevel = 'high';
    else riskLevel = 'critical';
    
    return {
      predicted_delay_days: finalDelay,
      delay_range: delayRange,
      risk_level: riskLevel,
      delay_probability: Math.min(0.95, factors.filter(f => f.impact_days > 0).length * 0.15 + 0.1),
      factors: factors.filter(f => f.impact_days !== 0),
      employee_impact: employeeImpact,
      critical_path_tasks: criticalPath,
      bottleneck_tasks: bottlenecks,
      cost_impact: costImpact,
      recommendations,
      confidence_score: confidence,
      data_quality_score: dataQuality
    };
  }
  
  /**
   * Analyze impact of removing employees
   */
  private analyzeStaffingImpact(
    removedEmployees: EnhancedEmployee[],
    activeEmployees: EnhancedEmployee[]
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    if (removedEmployees.length === 0) {
      return { factors, totalImpact };
    }
    
    for (const removed of removedEmployees) {
      // Find tasks assigned to this employee
      const affectedTasks = this.tasks.filter(t => 
        t.assigned_employee_ids.includes(removed.id)
      );
      
      if (affectedTasks.length === 0) continue;
      
      const hoursToRedistribute = affectedTasks.reduce((sum, t) => sum + t.estimated_hours, 0);
      
      // Calculate impact based on:
      // 1. Hours to redistribute
      // 2. Employee's velocity/productivity
      // 3. Seniority (senior devs are harder to replace)
      // 4. Unique skills
      
      const seniorityMultiplier = 1 + (removed.seniority_level - 1) * 0.2; // 1.0 to 1.8
      const velocityFactor = removed.performance.velocity_score > 0 
        ? removed.performance.velocity_score / 10 
        : 1;
      
      // Check for unique skills
      const removedSkills = new Set(removed.skills);
      const remainingSkills = new Set(activeEmployees.flatMap(e => e.skills));
      const uniqueSkills = removed.skills.filter(s => !remainingSkills.has(s));
      const uniqueSkillPenalty = uniqueSkills.length * 2; // 2 days per unique skill lost
      
      // Base calculation: hours / 6 (assuming 6 productive hours/day) with adjustments
      const baseImpact = hoursToRedistribute / 6;
      const adjustedImpact = baseImpact * seniorityMultiplier * velocityFactor + uniqueSkillPenalty;
      
      const severity: DelayFactor['severity'] = 
        removed.seniority_level >= 4 ? 'high' :
        removed.seniority_level >= 2 ? 'medium' : 'low';
      
      factors.push({
        category: 'staffing',
        factor: `${removed.display_name} removed (${removed.role}, ${hoursToRedistribute}h work)`,
        impact_days: Math.ceil(adjustedImpact),
        probability: 0.9,
        severity,
        mitigatable: true
      });
      
      if (uniqueSkills.length > 0) {
        factors.push({
          category: 'skill_gap',
          factor: `Lost unique skills: ${uniqueSkills.join(', ')}`,
          impact_days: uniqueSkillPenalty,
          probability: 0.85,
          severity: 'high',
          mitigatable: activeEmployees.length > 2
        });
      }
      
      totalImpact += adjustedImpact * 0.9; // Apply probability
      totalImpact += uniqueSkillPenalty * 0.85;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Analyze budget adjustment impact
   */
  private analyzeBudgetImpact(
    budgetPercent: number,
    activeEmployees: EnhancedEmployee[]
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    if (budgetPercent < 100) {
      const cutPercent = 100 - budgetPercent;
      
      // Budget cuts affect:
      // 1. Ability to hire contractors/consultants
      // 2. Overtime availability
      // 3. Tool/resource availability
      
      const baseImpact = cutPercent / 4; // Every 4% cut = 1 day delay
      
      // Severe cuts (> 30%) have exponential impact
      const severityMultiplier = cutPercent > 30 ? 1.5 : cutPercent > 20 ? 1.2 : 1.0;
      
      const adjustedImpact = baseImpact * severityMultiplier;
      
      factors.push({
        category: 'budget',
        factor: `Budget reduced by ${cutPercent}%`,
        impact_days: Math.ceil(adjustedImpact),
        probability: 0.75,
        severity: cutPercent > 30 ? 'high' : cutPercent > 15 ? 'medium' : 'low',
        mitigatable: true
      });
      
      totalImpact += adjustedImpact * 0.75;
      
      // If cut > 25%, likely affects staffing
      if (cutPercent > 25) {
        factors.push({
          category: 'budget',
          factor: 'Severe budget cut may force scope reduction',
          impact_days: 3,
          probability: 0.6,
          severity: 'medium',
          mitigatable: true
        });
        totalImpact += 3 * 0.6;
      }
    } else if (budgetPercent > 100) {
      // Budget increase = can accelerate
      const increasePercent = budgetPercent - 100;
      const acceleration = Math.min(increasePercent / 8, 5); // Max 5 days acceleration
      
      factors.push({
        category: 'budget',
        factor: `Budget increased by ${increasePercent}% (overtime/contractors available)`,
        impact_days: -Math.ceil(acceleration),
        probability: 0.6,
        severity: 'low',
        mitigatable: false
      });
      
      totalImpact -= acceleration * 0.6;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Analyze team capacity
   */
  private analyzeCapacity(
    activeEmployees: EnhancedEmployee[],
    scenario: DelayScenario
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    if (activeEmployees.length === 0) {
      factors.push({
        category: 'capacity',
        factor: 'No employees available!',
        impact_days: 999,
        probability: 1.0,
        severity: 'high',
        mitigatable: false
      });
      return { factors, totalImpact: 999 };
    }
    
    // Calculate total capacity
    const totalCapacityHours = activeEmployees.reduce((sum, e) => {
      const availablePercent = (100 - e.current_workload) / 100;
      return sum + (e.capacity_hours_per_sprint * availablePercent);
    }, 0);
    
    // Adjust for scope change
    const adjustedWorkHours = this.project.total_estimated_hours * (scenario.scope_change / 100);
    const weeksAvailable = this.project.deadline_weeks + (scenario.deadline_adjustment || 0);
    const requiredHoursPerSprint = adjustedWorkHours / Math.max(1, weeksAvailable / 2); // Assuming 2-week sprints
    
    const capacityUtilization = requiredHoursPerSprint / totalCapacityHours;
    
    if (capacityUtilization > 1.2) {
      // Severely over capacity
      const overloadPercent = Math.round((capacityUtilization - 1) * 100);
      const impact = Math.ceil(overloadPercent / 10) * 2;
      
      factors.push({
        category: 'capacity',
        factor: `Team ${overloadPercent}% over capacity`,
        impact_days: impact,
        probability: 0.85,
        severity: 'high',
        mitigatable: true
      });
      totalImpact += impact * 0.85;
    } else if (capacityUtilization > 1.0) {
      factors.push({
        category: 'capacity',
        factor: `Team at ${Math.round(capacityUtilization * 100)}% capacity (tight)`,
        impact_days: 2,
        probability: 0.5,
        severity: 'medium',
        mitigatable: true
      });
      totalImpact += 2 * 0.5;
    }
    
    // Check for burnout risks
    const burnoutRisks = activeEmployees.filter(e => 
      e.current_workload > 80 || e.stress_indicator > 0.7
    );
    
    if (burnoutRisks.length > 0) {
      factors.push({
        category: 'capacity',
        factor: `${burnoutRisks.length} employee(s) at burnout risk`,
        impact_days: burnoutRisks.length * 1.5,
        probability: 0.65,
        severity: 'medium',
        mitigatable: true
      });
      totalImpact += burnoutRisks.length * 1.5 * 0.65;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Analyze skill gaps
   */
  private analyzeSkillGaps(
    activeEmployees: EnhancedEmployee[]
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    // Get all required skills from tasks
    const requiredSkills = new Set(this.tasks.flatMap(t => t.required_skills));
    const availableSkills = new Set(activeEmployees.flatMap(e => e.skills));
    
    // Find missing skills
    const missingSkills = [...requiredSkills].filter(s => !availableSkills.has(s));
    
    if (missingSkills.length > 0) {
      const impact = missingSkills.length * 3; // 3 days per missing skill (learning curve)
      
      factors.push({
        category: 'skill_gap',
        factor: `Missing skills: ${missingSkills.slice(0, 3).join(', ')}${missingSkills.length > 3 ? '...' : ''}`,
        impact_days: impact,
        probability: 0.7,
        severity: missingSkills.length > 2 ? 'high' : 'medium',
        mitigatable: true
      });
      totalImpact += impact * 0.7;
    }
    
    // Check for single points of failure (only one person with a critical skill)
    const skillCoverage: Record<string, number> = {};
    for (const emp of activeEmployees) {
      for (const skill of emp.skills) {
        skillCoverage[skill] = (skillCoverage[skill] || 0) + 1;
      }
    }
    
    const singlePointSkills = Object.entries(skillCoverage)
      .filter(([skill, count]) => count === 1 && requiredSkills.has(skill))
      .map(([skill]) => skill);
    
    if (singlePointSkills.length > 0) {
      factors.push({
        category: 'skill_gap',
        factor: `Single point of failure: ${singlePointSkills.slice(0, 2).join(', ')}`,
        impact_days: singlePointSkills.length * 2,
        probability: 0.4, // Risk, not certain
        severity: 'medium',
        mitigatable: true
      });
      totalImpact += singlePointSkills.length * 2 * 0.4;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Analyze critical path
   */
  private analyzeCriticalPath(
    activeEmployees: EnhancedEmployee[]
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    // Find tasks with dependencies
    const tasksWithDeps = this.tasks.filter(t => t.depends_on.length > 0);
    
    if (tasksWithDeps.length > 0) {
      // Check if blocking tasks are assigned to overloaded employees
      const blockingTaskIds = new Set(this.tasks.flatMap(t => t.depends_on));
      const blockingTasks = this.tasks.filter(t => blockingTaskIds.has(t.id));
      
      for (const blocker of blockingTasks) {
        const assignees = activeEmployees.filter(e => 
          blocker.assigned_employee_ids.includes(e.id)
        );
        
        // Check if assignees are overloaded
        const overloadedAssignees = assignees.filter(e => e.current_workload > 75);
        if (overloadedAssignees.length > 0) {
          factors.push({
            category: 'technical',
            factor: `Critical path task "${blocker.title}" assigned to overloaded employee`,
            impact_days: 2,
            probability: 0.6,
            severity: 'medium',
            mitigatable: true
          });
          totalImpact += 2 * 0.6;
        }
      }
    }
    
    // Check for long dependency chains
    const maxChainLength = this.findMaxDependencyChain();
    if (maxChainLength > 3) {
      factors.push({
        category: 'technical',
        factor: `Long dependency chain (${maxChainLength} tasks)`,
        impact_days: maxChainLength - 3,
        probability: 0.5,
        severity: 'medium',
        mitigatable: false
      });
      totalImpact += (maxChainLength - 3) * 0.5;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Analyze scope change impact
   */
  private analyzeScopeChange(
    scopePercent: number
  ): { factors: DelayFactor[]; totalImpact: number } {
    const factors: DelayFactor[] = [];
    let totalImpact = 0;
    
    if (scopePercent > 100) {
      const increasePercent = scopePercent - 100;
      const impact = Math.ceil(increasePercent / 5); // Every 5% scope increase = 1 day
      
      // Scope increases also affect testing, integration, etc.
      const totalImpactWithOverhead = impact * 1.3;
      
      factors.push({
        category: 'scope',
        factor: `Scope increased by ${increasePercent}%`,
        impact_days: Math.ceil(totalImpactWithOverhead),
        probability: 0.85,
        severity: increasePercent > 30 ? 'high' : 'medium',
        mitigatable: true
      });
      totalImpact += totalImpactWithOverhead * 0.85;
    } else if (scopePercent < 100) {
      const decreasePercent = 100 - scopePercent;
      const acceleration = Math.ceil(decreasePercent / 8);
      
      factors.push({
        category: 'scope',
        factor: `Scope reduced by ${decreasePercent}%`,
        impact_days: -acceleration,
        probability: 0.8,
        severity: 'low',
        mitigatable: false
      });
      totalImpact -= acceleration * 0.8;
    }
    
    return { factors, totalImpact };
  }
  
  /**
   * Calculate employee-specific impact analysis
   */
  private calculateEmployeeImpact(
    activeEmployees: EnhancedEmployee[],
    removedEmployees: EnhancedEmployee[]
  ): EmployeeImpact[] {
    return this.employees.map(emp => {
      const isRemoved = removedEmployees.some(r => r.id === emp.id);
      
      // Calculate removal impact
      const affectedTasks = this.tasks.filter(t => 
        t.assigned_employee_ids.includes(emp.id)
      );
      const hoursToRedistribute = affectedTasks.reduce((sum, t) => sum + t.estimated_hours, 0);
      
      // Check for unique skills
      const otherEmployees = this.employees.filter(e => e.id !== emp.id);
      const otherSkills = new Set(otherEmployees.flatMap(e => e.skills));
      const uniqueSkills = emp.skills.filter(s => !otherSkills.has(s));
      
      // Determine replacement difficulty
      let replacementDifficulty: EmployeeImpact['removal_impact']['replacement_difficulty'];
      if (uniqueSkills.length > 2 || emp.seniority_level >= 4) {
        replacementDifficulty = 'critical';
      } else if (uniqueSkills.length > 0 || emp.seniority_level >= 3) {
        replacementDifficulty = 'hard';
      } else if (emp.seniority_level >= 2) {
        replacementDifficulty = 'medium';
      } else {
        replacementDifficulty = 'easy';
      }
      
      // Calculate burnout risk
      const burnoutRisk = Math.min(1, 
        (emp.current_workload / 100) * 0.4 +
        emp.stress_indicator * 0.4 +
        (emp.active_tasks > 5 ? 0.2 : 0)
      );
      
      // Flight risk (high performers with high stress are flight risks)
      const flightRisk = Math.min(1,
        burnoutRisk * 0.5 +
        (emp.performance.velocity_score > 15 ? 0.2 : 0) +
        (emp.seniority_level >= 3 && emp.current_workload > 80 ? 0.3 : 0)
      );
      
      // Single point of failure
      const isSPOF = uniqueSkills.length > 0 && 
        affectedTasks.some(t => t.priority === 'Critical' || t.priority === 'High');
      
      return {
        employee_id: emp.id,
        employee_name: emp.display_name,
        role: emp.role,
        removal_impact: {
          delay_days: Math.ceil(hoursToRedistribute / 6 * (1 + emp.seniority_level * 0.1)),
          tasks_affected: affectedTasks.length,
          hours_to_redistribute: hoursToRedistribute,
          skill_coverage_loss: uniqueSkills,
          replacement_difficulty: replacementDifficulty
        },
        burnout_risk: burnoutRisk,
        flight_risk: flightRisk,
        single_point_of_failure: isSPOF
      };
    });
  }
  
  /**
   * Calculate financial impact of delays
   */
  private calculateCostImpact(
    delayDays: number,
    scenario: DelayScenario,
    activeEmployees: EnhancedEmployee[]
  ): DelayPredictionResult['cost_impact'] {
    // Average hourly rate
    const avgHourlyRate = activeEmployees.length > 0
      ? activeEmployees.reduce((sum, e) => sum + e.hourly_rate, 0) / activeEmployees.length
      : 50;
    
    // Additional labor cost (assuming 6 productive hours per day)
    const additionalLaborCost = delayDays * 6 * avgHourlyRate * activeEmployees.length;
    
    // Overtime cost (20% premium for rush work)
    const overtimeCost = delayDays > 5 ? additionalLaborCost * 0.2 : 0;
    
    // Opportunity cost (estimated as 50% of labor cost)
    const opportunityCost = additionalLaborCost * 0.5;
    
    return {
      additional_labor_cost: Math.round(additionalLaborCost),
      opportunity_cost: Math.round(opportunityCost),
      overtime_cost: Math.round(overtimeCost),
      total_impact: Math.round(additionalLaborCost + opportunityCost + overtimeCost),
      currency: 'USD'
    };
  }
  
  /**
   * Generate smart recommendations
   */
  private generateRecommendations(
    factors: DelayFactor[],
    employeeImpact: EmployeeImpact[],
    scenario: DelayScenario
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Check staffing issues
    const staffingFactors = factors.filter(f => f.category === 'staffing');
    if (staffingFactors.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'staffing',
        recommendation: 'Consider hiring contractors or reallocating team members from lower-priority projects',
        expected_impact_days: -Math.ceil(staffingFactors.reduce((sum, f) => sum + f.impact_days, 0) * 0.5),
        implementation_effort: 'medium',
        cost_implication: 5000
      });
    }
    
    // Check for SPOFs
    const spofs = employeeImpact.filter(e => e.single_point_of_failure);
    if (spofs.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'staffing',
        recommendation: `Cross-train team on ${spofs.map(s => s.employee_name).join(', ')}'s unique skills to reduce bus factor`,
        expected_impact_days: 0, // Preventive
        implementation_effort: 'high',
        cost_implication: 2000
      });
    }
    
    // Check burnout risks
    const burnoutRisks = employeeImpact.filter(e => e.burnout_risk > 0.6);
    if (burnoutRisks.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'process',
        recommendation: `Redistribute workload from ${burnoutRisks.map(b => b.employee_name).join(', ')} to prevent burnout`,
        expected_impact_days: -burnoutRisks.length,
        implementation_effort: 'low',
        cost_implication: 0
      });
    }
    
    // Check budget
    if (scenario.budget_adjustment < 90) {
      recommendations.push({
        priority: 'medium',
        category: 'scope',
        recommendation: 'Prioritize MVP features and defer nice-to-haves to reduce scope proportionally to budget cut',
        expected_impact_days: -3,
        implementation_effort: 'medium',
        cost_implication: 0
      });
    }
    
    // Check capacity
    const capacityFactors = factors.filter(f => f.category === 'capacity');
    if (capacityFactors.some(f => f.severity === 'high')) {
      recommendations.push({
        priority: 'high',
        category: 'timeline',
        recommendation: 'Consider extending deadline or reducing scope to match team capacity',
        expected_impact_days: -5,
        implementation_effort: 'low',
        cost_implication: 0
      });
    }
    
    // Check skill gaps
    const skillGapFactors = factors.filter(f => f.category === 'skill_gap');
    if (skillGapFactors.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'staffing',
        recommendation: 'Engage external consultants for missing skills or invest in rapid upskilling',
        expected_impact_days: -Math.ceil(skillGapFactors.reduce((sum, f) => sum + f.impact_days, 0) * 0.6),
        implementation_effort: 'medium',
        cost_implication: 3000
      });
    }
    
    // If everything looks good
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'process',
        recommendation: 'Current allocation looks sustainable. Monitor progress and adjust as needed.',
        expected_impact_days: 0,
        implementation_effort: 'low',
        cost_implication: 0
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Find tasks on critical path
   */
  private findCriticalPath(): string[] {
    // Simple implementation: find tasks that block others
    const blockingTasks = new Set<string>();
    
    for (const task of this.tasks) {
      for (const depId of task.depends_on) {
        blockingTasks.add(depId);
      }
    }
    
    // Add tasks with highest estimated hours
    const sortedByHours = [...this.tasks].sort((a, b) => b.estimated_hours - a.estimated_hours);
    const topTasks = sortedByHours.slice(0, 3).map(t => t.id);
    
    return [...new Set([...blockingTasks, ...topTasks])];
  }
  
  /**
   * Find bottleneck tasks
   */
  private findBottlenecks(activeEmployees: EnhancedEmployee[]): string[] {
    const bottlenecks: string[] = [];
    
    for (const task of this.tasks) {
      // Check if assignees are overloaded
      const assignees = activeEmployees.filter(e => 
        task.assigned_employee_ids.includes(e.id)
      );
      
      const hasOverloadedAssignee = assignees.some(a => a.current_workload > 80);
      const hasHighPriority = task.priority === 'Critical' || task.priority === 'High';
      const blocksOthers = this.tasks.some(t => t.depends_on.includes(task.id));
      
      if ((hasOverloadedAssignee && hasHighPriority) || (blocksOthers && hasOverloadedAssignee)) {
        bottlenecks.push(task.id);
      }
    }
    
    return bottlenecks;
  }
  
  /**
   * Find maximum dependency chain length
   */
  private findMaxDependencyChain(): number {
    const memo = new Map<string, number>();
    
    const getChainLength = (taskId: string): number => {
      if (memo.has(taskId)) return memo.get(taskId)!;
      
      const task = this.tasks.find(t => t.id === taskId);
      if (!task || task.depends_on.length === 0) {
        memo.set(taskId, 1);
        return 1;
      }
      
      const maxDepLength = Math.max(...task.depends_on.map(depId => getChainLength(depId)));
      const length = 1 + maxDepLength;
      memo.set(taskId, length);
      return length;
    };
    
    return Math.max(0, ...this.tasks.map(t => getChainLength(t.id)));
  }
  
  /**
   * Assess data quality for confidence calculation
   */
  private assessDataQuality(): number {
    let score = 0.5; // Base score
    
    // Check if we have performance data
    const hasPerformanceData = this.employees.some(e => 
      e.performance.avg_commits_per_week > 0
    );
    if (hasPerformanceData) score += 0.15;
    
    // Check if we have task dependencies
    const hasDependencies = this.tasks.some(t => t.depends_on.length > 0);
    if (hasDependencies) score += 0.1;
    
    // Check if we have historical data
    if (this.project.historical_overrun_rate > 0) score += 0.15;
    
    // Check team velocity
    if (this.project.team_velocity > 0) score += 0.1;
    
    return Math.min(1, score);
  }
}

// ============================================
// HELPER: Convert simple data to enhanced format
// ============================================

export interface SimpleEmployeeWithMetrics {
  id: string;
  name: string;
  role: string;
  tech_stack: string[];
  hourly_rate: number;
  workload: number;
  // Optional: real data from JIRA/GitHub
  commit_metrics?: {
    total_commits: number;
    recent_commits_30d: number;
    commits_per_week: number;
    avg_lines_per_commit: number;
    velocity_score: number;
  };
  jira_metrics?: {
    total_tickets: number;
    open_tickets: number;
    completed_tickets: number;
    high_priority_open: number;
    completion_rate: number;
  };
  scores?: {
    workload: number;
    productivity: number;
    velocity: number;
  };
  delay_prediction?: {
    impact_if_removed_days: number;
    replacement_difficulty: string;
    burnout_risk: string;
    single_point_of_failure: boolean;
  };
}

export function convertToEnhancedEmployee(simple: {
  id: string;
  name: string;
  role: string;
  tech_stack: string[];
  hourly_rate: number;
  workload: number;
  // Optional enhanced data
  commit_metrics?: SimpleEmployeeWithMetrics['commit_metrics'];
  jira_metrics?: SimpleEmployeeWithMetrics['jira_metrics'];
  scores?: SimpleEmployeeWithMetrics['scores'];
  delay_prediction?: SimpleEmployeeWithMetrics['delay_prediction'];
}): EnhancedEmployee {
  // Map simple role to enum
  const roleMap: Record<string, EnhancedEmployee['role']> = {
    'frontend': 'Developer',
    'backend': 'Developer',
    'senior frontend': 'Senior Developer',
    'senior backend': 'Senior Developer',
    'backend lead': 'Tech Lead',
    'frontend lead': 'Tech Lead',
    'tech lead': 'Tech Lead',
    'qa': 'QA Engineer',
    'qa engineer': 'QA Engineer',
    'devops': 'DevOps Engineer',
    'devops engineer': 'DevOps Engineer',
    'full stack': 'Developer',
    'full stack dev': 'Developer',
  };
  
  const normalizedRole = simple.role.toLowerCase();
  const mappedRole = roleMap[normalizedRole] || 'Developer';
  
  // Infer seniority from role name
  let seniority = 2; // Default mid-level
  if (normalizedRole.includes('senior') || normalizedRole.includes('lead')) seniority = 4;
  else if (normalizedRole.includes('junior')) seniority = 1;
  else if (normalizedRole.includes('principal') || normalizedRole.includes('staff')) seniority = 5;
  
  // Use real commit metrics if available, otherwise simulate
  const hasRealCommitData = simple.commit_metrics && simple.commit_metrics.total_commits > 0;
  const avgCommitsPerWeek = hasRealCommitData 
    ? simple.commit_metrics!.commits_per_week 
    : 15 + Math.random() * 20;
  const avgLinesPerCommit = hasRealCommitData 
    ? simple.commit_metrics!.avg_lines_per_commit 
    : 50 + Math.random() * 100;
  const velocityScore = hasRealCommitData 
    ? simple.commit_metrics!.velocity_score / 10 // Convert from 0-100 to 0-10 scale
    : 8 + Math.random() * 12;
  
  // Use real JIRA metrics if available
  const hasRealJiraData = simple.jira_metrics && simple.jira_metrics.total_tickets > 0;
  const completionRate = hasRealJiraData 
    ? simple.jira_metrics!.completion_rate / 100 
    : 0.7 + Math.random() * 0.25;
  const workloadScore = hasRealJiraData
    ? simple.jira_metrics!.open_tickets * 15
    : simple.workload;
    
  // Use real scores if available
  const productivity = simple.scores?.productivity || Math.round(completionRate * 100);
  
  return {
    id: simple.id,
    user_id: `user:${simple.id}`,
    display_name: simple.name,
    role: mappedRole,
    hourly_rate: simple.hourly_rate || 50,
    employment_type: 'Full-time',
    skills: simple.tech_stack || [],
    seniority_level: seniority,
    capacity_hours_per_sprint: 40,
    performance: {
      avg_commits_per_week: avgCommitsPerWeek,
      avg_lines_per_commit: avgLinesPerCommit,
      code_review_approval_rate: completionRate,
      bug_introduction_rate: 0.5 + Math.random() * 1.5,
      avg_task_completion_days: hasRealJiraData ? 3 : 2 + Math.random() * 3,
      velocity_score: velocityScore,
      on_time_delivery_rate: completionRate,
      collaboration_score: hasRealCommitData ? (avgCommitsPerWeek / 35) : 0.6 + Math.random() * 0.35
    },
    current_workload: workloadScore || simple.workload || 50,
    active_tasks: hasRealJiraData ? simple.jira_metrics!.open_tickets : Math.ceil(simple.workload / 20) || 2,
    stress_indicator: simple.delay_prediction?.burnout_risk === 'high' ? 0.8 : 
                      simple.delay_prediction?.burnout_risk === 'medium' ? 0.5 : 
                      (workloadScore || simple.workload || 50) / 100 * 0.8
  };
}

export function convertToEnhancedTask(simple: {
  id: string;
  title: string;
  required_skills: string[];
  estimated_hours: number;
  assigned_employee_ids: string[];
  status: string;
}): EnhancedTask {
  return {
    id: simple.id,
    task_id: simple.id,
    title: simple.title,
    issue_type: 'Task',
    status: simple.status || 'pending',
    priority: 'Medium',
    estimated_hours: simple.estimated_hours || 20,
    assigned_employee_ids: simple.assigned_employee_ids || [],
    required_skills: simple.required_skills || [],
    role_required: 'fullstack',
    depends_on: [],
    blocks: [],
    similar_tasks_avg_completion: 5,
    similar_tasks_overrun_rate: 0.2
  };
}

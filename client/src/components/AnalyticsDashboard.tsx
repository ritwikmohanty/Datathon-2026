import { motion } from "framer-motion";
import { TrendingDown, DollarSign, Clock, Users, Zap, Shield, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { LLMAllocationResponse } from "@/lib/types";

interface Allocation {
  task: { title: string; estimatedHours: number };
  employee: { name: string; hourlyRate: number };
}

interface AnalyticsDashboardProps {
  allocations: Allocation[];
  isVisible: boolean;
  llmResponse?: LLMAllocationResponse | null;
}

const CountUpNumber = ({ end, duration = 2000, prefix = "", suffix = "" }: { 
  end: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};

const AnalyticsDashboard = ({ allocations, isVisible, llmResponse }: AnalyticsDashboardProps) => {
  // Use LLM response data if available, otherwise calculate from allocations
  const analytics = llmResponse?.business_analytics;
  
  const totalHours = allocations.reduce((sum, a) => sum + a.task.estimatedHours, 0);
  const totalCost = analytics?.total_estimated_cost || 
    allocations.reduce((sum, a) => sum + (a.task.estimatedHours * a.employee.hourlyRate), 0);
  
  // Use LLM analytics or calculate mock comparison
  const savings = analytics?.projected_savings || Math.round(totalCost * 0.35);
  const savingsPercentage = analytics?.savings_percentage || 26;
  const timeSaved = analytics?.time_efficiency_gain || Math.round(totalHours * 0.25);
  const manualCost = totalCost + savings;
  const riskAssessment = analytics?.risk_assessment || "Standard risk profile";
  const roiEstimate = analytics?.roi_estimate || 2.5;

  const stats = [
    {
      label: "Projected Cost",
      value: totalCost,
      prefix: "$",
      icon: DollarSign,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Cost Savings",
      value: Math.round(savings),
      prefix: "$",
      suffix: "",
      icon: TrendingDown,
      color: "text-success",
      bgColor: "bg-success/10",
      highlight: true,
    },
    {
      label: "Hours Allocated",
      value: totalHours,
      suffix: "h",
      icon: Clock,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "Time Efficiency",
      value: Math.round(timeSaved),
      suffix: "%",
      icon: Zap,
      color: "text-accent",
      bgColor: "bg-accent/10",
      highlight: true,
    },
    {
      label: "Resources Assigned",
      value: allocations.length,
      icon: Users,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
    {
      label: "ROI Estimate",
      value: roiEstimate,
      suffix: "x",
      icon: BarChart3,
      color: "text-foreground",
      bgColor: "bg-muted",
    },
  ];

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Business Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">AI-optimized resource allocation results</p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="px-4 py-2 bg-success text-success-foreground font-mono text-sm uppercase tracking-wider"
        >
          {savingsPercentage}% Optimized
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            className={`p-4 border-2 ${stat.highlight ? 'border-foreground' : 'border-border'} ${stat.bgColor}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </span>
            </div>
            <div className={`text-2xl font-bold font-mono ${stat.color}`}>
              <CountUpNumber 
                end={stat.value} 
                prefix={stat.prefix} 
                suffix={stat.suffix} 
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Allocation Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-6 p-6 border-2 border-foreground bg-foreground text-background"
      >
        <h3 className="text-sm font-mono uppercase tracking-widest mb-4 opacity-70">
          Allocation Summary
        </h3>
        <div className="space-y-3">
          {allocations.map((allocation, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + idx * 0.1 }}
              className="flex items-center justify-between py-2 border-b border-background/20 last:border-0"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm opacity-50">{String(idx + 1).padStart(2, '0')}</span>
                <div>
                  <p className="font-semibold">{allocation.task.title}</p>
                  <p className="text-sm opacity-70">{allocation.employee.name}</p>
                </div>
              </div>
              <div className="text-right font-mono">
                <p className="font-semibold">${allocation.task.estimatedHours * allocation.employee.hourlyRate}</p>
                <p className="text-sm opacity-70">{allocation.task.estimatedHours}h × ${allocation.employee.hourlyRate}/hr</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Comparison Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-6 p-6 border-2 border-border"
      >
        <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
          AI vs Manual Allocation
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-mono">AI-Optimized</span>
              <span className="font-mono font-bold">${totalCost.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, delay: 1.3 }}
                className="h-full bg-success"
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-mono text-muted-foreground">Manual Process</span>
              <span className="font-mono text-muted-foreground">${Math.round(manualCost).toLocaleString()}</span>
            </div>
            <div className="h-3 bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, delay: 1.4 }}
                className="h-full bg-muted-foreground/30"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Timeline Section */}
      {llmResponse?.timeline && llmResponse.timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-6 p-6 border-2 border-border"
        >
          <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Project Timeline
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {llmResponse.timeline
              .filter(week => week.milestones && week.milestones.length > 0) // Skip empty weeks
              .map((week, idx) => (
              <motion.div
                key={week.week}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6 + idx * 0.1 }}
                className="flex-shrink-0 w-48 p-4 border-2 border-border bg-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-accent flex items-center justify-center text-accent-foreground font-mono font-bold text-sm">
                    W{week.week}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase">Week {week.week}</span>
                </div>
                <div className="space-y-2">
                  {week.milestones.map((milestone, mIdx) => (
                    <div key={mIdx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-success rounded-full mt-1.5 flex-shrink-0" />
                      <span className="text-xs">{milestone}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Risk Assessment */}
      {riskAssessment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="mt-6 p-4 border-2 border-border bg-muted/50 flex items-center gap-4"
        >
          <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Risk Assessment: </span>
            <span className="text-sm">{riskAssessment}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnalyticsDashboard;

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export interface Employee {
  id: string;
  name: string;
  role: string;
  avatar: string;
  techStack: string[];
  workload: number;
  hourlyRate: number;
  experience?: number; // 0-1 scale
}

export interface EmployeeCardProps {
  employee: Employee;
  status: "analyzing" | "rejected" | "matched" | "idle" | "grayed";
  thinkingText?: string;
  rejectionReason?: string;
  delay?: number;
}

const EmployeeCard = ({ employee, status, thinkingText, rejectionReason, delay = 0 }: EmployeeCardProps) => {
  const [showThinking, setShowThinking] = useState(false);

  useEffect(() => {
    if (status === "analyzing" && thinkingText) {
      const timer = setTimeout(() => setShowThinking(true), delay);
      return () => clearTimeout(timer);
    }
    setShowThinking(false);
  }, [status, thinkingText, delay]);

  const statusColors = {
    analyzing: "border-accent",
    rejected: "border-destructive bg-destructive/5",
    matched: "border-success bg-success/5",
    idle: "border-border",
    grayed: "border-border opacity-30",
  };

  const statusGlow = {
    analyzing: "0 0 20px hsl(var(--accent) / 0.3)",
    rejected: "0 0 20px hsl(var(--destructive) / 0.3)",
    matched: "0 0 20px hsl(var(--success) / 0.3)",
    idle: "none",
    grayed: "none",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{
        opacity: status === "rejected" ? 0.5 : status === "grayed" ? 0.3 : 1,
        scale: status === "rejected" ? 0.95 : 1,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      style={{ boxShadow: statusGlow[status] }}
      className={`relative p-3 border-2 bg-card transition-all duration-300 min-w-[180px] ${statusColors[status]}`}
    >
      {/* Status indicator */}
      {status === "analyzing" && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      {status === "matched" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-success flex items-center justify-center"
        >
          <span className="text-success-foreground text-xs">✓</span>
        </motion.div>
      )}
      {status === "rejected" && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-destructive flex items-center justify-center"
        >
          <span className="text-destructive-foreground text-xs">✕</span>
        </motion.div>
      )}

      {/* Employee info */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-muted flex items-center justify-center font-mono text-sm font-bold text-muted-foreground border border-border">
          {employee.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{employee.name}</h4>
          <p className="text-xs text-muted-foreground font-mono">{employee.role}</p>
        </div>
      </div>

      {/* Tech stack */}
      <div className="mt-2 flex flex-wrap gap-1">
        {employee.techStack.slice(0, 3).map((tech) => (
          <span
            key={tech}
            className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-secondary text-secondary-foreground"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Stats - Original design with progress bars */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground font-mono text-[10px]">Workload</span>
          <div className="mt-1 h-1.5 bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${employee.workload}%` }}
              transition={{ duration: 0.8, delay: delay / 1000 + 0.2 }}
              className={`h-full ${employee.workload > 80 ? "bg-destructive" : employee.workload > 50 ? "bg-warning" : "bg-success"}`}
            />
          </div>
        </div>
        <div>
          <span className="text-muted-foreground font-mono text-[10px]">Experience</span>
          <div className="mt-1 h-1.5 bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((employee.experience || 0) / 15) * 100, 100)}%` }}
              transition={{ duration: 0.8, delay: delay / 1000 + 0.3 }}
              className={`h-full ${
                (employee.experience || 0) >= 10 
                  ? "bg-purple-500" 
                  : (employee.experience || 0) >= 5 
                    ? "bg-blue-500" 
                    : "bg-cyan-500"
              }`}
            />
          </div>
        </div>
      </div>
      
      {/* Rate */}
      <div className="mt-2 text-xs text-right">
        <span className="text-muted-foreground font-mono">Rate: </span>
        <span className="font-mono font-semibold">${employee.hourlyRate}/hr</span>
      </div>

      {/* AI Thinking text while analyzing - short */}
      <AnimatePresence>
        {showThinking && thinkingText && status === "analyzing" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-border"
          >
            <p className="text-[10px] text-accent font-mono leading-tight">
              {thinkingText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection reason - short */}
      <AnimatePresence>
        {status === "rejected" && rejectionReason && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-destructive/30"
          >
            <p className="text-[10px] text-destructive font-mono leading-tight">
              ✕ {rejectionReason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match confirmation - short */}
      <AnimatePresence>
        {status === "matched" && thinkingText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-success/30"
          >
            <p className="text-[10px] text-success font-mono leading-tight">
              ✓ {thinkingText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EmployeeCard;

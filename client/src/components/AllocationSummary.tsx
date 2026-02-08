import type { AllocationResult } from '../types/allocation';

interface AllocationSummaryProps {
  allocation: AllocationResult;
  onReset: () => void;
}

const TEAM_ICONS: Record<string, string> = {
  tech: '💻',
  marketing: '📊',
  editing: '✍️',
};

const STEP_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  pm_analysis: { label: 'PM Analysis', icon: '🎯', color: 'violet' },
  tech_allocation: { label: 'Tech Allocation', icon: '💻', color: 'blue' },
  marketing_allocation: { label: 'Marketing Allocation', icon: '📊', color: 'orange' },
  editing_allocation: { label: 'Editing Allocation', icon: '✍️', color: 'emerald' },
};

export default function AllocationSummary({ allocation, onReset }: AllocationSummaryProps) {
  const teamKeys = Object.keys(allocation.teams);
  const totalTasks = teamKeys.reduce((sum, k) => sum + allocation.teams[k].tasks.length, 0);
  const totalHours = teamKeys.reduce(
    (sum, k) => sum + allocation.teams[k].tasks.reduce((s, t) => s + t.estimated_hours, 0),
    0
  );

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-800">Allocation Summary</h2>
          <button
            onClick={onReset}
            className="text-xs px-2.5 py-1 bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-colors cursor-pointer font-medium"
          >
            ← New Task
          </button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{allocation.task_description}</p>
        {allocation.ai_generated && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-sm">🤖</span>
            <span className="text-[11px] font-semibold text-emerald-700">AI Sequential Allocation</span>
          </div>
        )}
        <div className="flex gap-3 mt-3">
          <div className="bg-violet-50 px-3 py-1.5 rounded-lg">
            <div className="text-lg font-bold text-violet-700">{totalTasks}</div>
            <div className="text-[10px] text-violet-500 uppercase">Tasks</div>
          </div>
          <div className="bg-blue-50 px-3 py-1.5 rounded-lg">
            <div className="text-lg font-bold text-blue-700">{totalHours}h</div>
            <div className="text-[10px] text-blue-500 uppercase">Total Effort</div>
          </div>
          <div className="bg-emerald-50 px-3 py-1.5 rounded-lg">
            <div className="text-lg font-bold text-emerald-700">{teamKeys.length}</div>
            <div className="text-[10px] text-emerald-500 uppercase">Teams</div>
          </div>
        </div>
      </div>

      {/* LLM Steps Visualization */}
      {allocation.llm_steps && allocation.llm_steps.length > 0 && (
        <div className="p-4 border-b border-gray-200 bg-linear-to-b from-indigo-50 to-white">
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span>🧠</span> Sequential LLM Calls
          </div>
          <div className="space-y-2">
            {allocation.llm_steps.map((step, idx) => {
              const stepInfo = STEP_LABELS[step.step] || { label: step.step, icon: '📍', color: 'gray' };
              return (
                <details key={idx} className="group">
                  <summary className="flex items-center gap-2 cursor-pointer hover:bg-white/50 rounded-lg p-1.5 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {idx + 1}
                    </div>
                    <span className="text-sm">{stepInfo.icon}</span>
                    <span className="text-xs font-medium text-gray-700">{stepInfo.label}</span>
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                      step.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {step.success ? '✓ Done' : '✗ Failed'}
                    </span>
                  </summary>
                  {step.thinking && (
                    <div className="ml-8 mt-1 p-2 bg-white/70 rounded-lg border border-gray-100">
                      <p className="text-[11px] text-gray-600 leading-relaxed">{step.thinking}</p>
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Thinking Process (legacy support) */}
      {allocation.thinking && allocation.ai_generated && !allocation.llm_steps && (
        <div className="p-4 border-b border-gray-200 bg-linear-to-b from-violet-50 to-white">
          <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span>💭</span> AI Thinking Process
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {allocation.thinking.task_analysis}
          </p>
          <div className="space-y-1.5">
            <details className="group">
              <summary className="text-[11px] font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                💻 Tech Team Reasoning
              </summary>
              <p className="text-[11px] text-gray-500 mt-1 pl-4">{allocation.thinking.tech_thinking}</p>
            </details>
            <details className="group">
              <summary className="text-[11px] font-medium text-orange-600 cursor-pointer hover:text-orange-700">
                📊 Marketing Team Reasoning
              </summary>
              <p className="text-[11px] text-gray-500 mt-1 pl-4">{allocation.thinking.marketing_thinking}</p>
            </details>
            <details className="group">
              <summary className="text-[11px] font-medium text-emerald-600 cursor-pointer hover:text-emerald-700">
                ✍️ Editing Team Reasoning
              </summary>
              <p className="text-[11px] text-gray-500 mt-1 pl-4">{allocation.thinking.editing_thinking}</p>
            </details>
          </div>
        </div>
      )}

      {/* Teams Breakdown */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {teamKeys.map((teamKey) => {
          const team = allocation.teams[teamKey];
          return (
            <div key={teamKey} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <div className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                  <span>{TEAM_ICONS[teamKey] || '📌'}</span>
                  {team.team_name}
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {team.tasks.map((task, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="font-medium text-xs text-gray-800">{task.title}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600">
                          {task.assigned_to.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-[11px] text-gray-600">{task.assigned_to.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{task.estimated_hours}h</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          task.score.total >= 0.7 ? 'bg-green-100 text-green-700' :
                          task.score.total >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {Math.round(task.score.total * 100)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flow Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Legend</div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
            Product Manager
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            Tech Team
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            Marketing Team
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Editing Team
          </div>
        </div>
        <div className="mt-2 text-[10px] text-gray-400">
          Scores are 0-100. Higher = better fit for the task.
        </div>
      </div>
    </div>
  );
}

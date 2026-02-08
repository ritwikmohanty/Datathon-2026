import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ScoreBreakdown, CandidateScore } from '../../types/allocation';

interface MemberNodeData {
  label: string;
  memberName: string;
  memberRole: string;
  taskTitle: string;
  taskDescription: string;
  taskReasoning: string;
  complexity: string;
  estimatedHours: number;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  reasoning: string[];
  yearsOfExperience: number;
  availability: string;
  freeSlotsPerWeek: number;
  requiredSkills: string[];
  allCandidates: CandidateScore[];
  teamKey: string;
  [key: string]: unknown;
}

const TEAM_MEMBER_COLORS: Record<string, { border: string; scoreBg: string; headerBg: string }> = {
  tech: { border: 'border-blue-300', scoreBg: 'bg-blue-100 text-blue-800', headerBg: 'bg-blue-50' },
  marketing: { border: 'border-orange-300', scoreBg: 'bg-orange-100 text-orange-800', headerBg: 'bg-orange-50' },
  editing: { border: 'border-emerald-300', scoreBg: 'bg-emerald-100 text-emerald-800', headerBg: 'bg-emerald-50' }
};

const COMPLEXITY_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700'
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 text-gray-500 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-indigo-400 to-indigo-600 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-gray-600">{percentage}%</span>
    </div>
  );
}

const MemberNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as MemberNodeData;
  const colors = TEAM_MEMBER_COLORS[d.teamKey] || TEAM_MEMBER_COLORS.tech;
  const [showCandidates, setShowCandidates] = useState(false);

  return (
    <div className={`rounded-xl bg-white shadow-lg min-w-64 max-w-80 border-2 ${colors.border} overflow-hidden`}>
      <Handle type="target" position={Position.Top} className="bg-gray-400! w-2.5! h-2.5!" />

      {/* Header: Task */}
      <div className={`px-4 py-2.5 ${colors.headerBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Task</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${COMPLEXITY_COLORS[d.complexity] || ''}`}>
            {d.complexity}
          </span>
        </div>
        <div className="font-semibold text-sm text-gray-800 mt-1">{d.taskTitle}</div>
        {d.taskDescription && (
          <div className="text-[10px] text-gray-500 mt-1 leading-tight">{d.taskDescription}</div>
        )}
        <div className="text-[11px] text-gray-500 mt-1">⏱ {d.estimatedHours}h estimated</div>
        {d.taskReasoning && (
          <div className="mt-1.5 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
            💡 {d.taskReasoning}
          </div>
        )}
      </div>

      {/* Assigned Member */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-gray-200 to-gray-300 flex items-center justify-center text-sm font-bold text-gray-600">
              {d.memberName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-800">{d.memberName}</div>
              <div className="text-[11px] text-gray-500">{d.memberRole}</div>
            </div>
          </div>
          <div className={`text-lg font-bold px-2.5 py-1 rounded-lg ${colors.scoreBg}`}>
            {Math.round(d.totalScore * 100)}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
            🏢 {d.yearsOfExperience}yr exp
          </span>
          <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
            📅 {d.freeSlotsPerWeek} slots/wk
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            d.availability === 'Free' ? 'bg-green-100 text-green-700' :
            d.availability === 'Partially Free' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {d.availability}
          </span>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="px-4 py-2.5 border-t border-gray-100 space-y-1.5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Score Breakdown</div>
        <ScoreBar label="Skill Match" value={d.scoreBreakdown.skill_match} />
        <ScoreBar label="Experience" value={d.scoreBreakdown.experience} />
        <ScoreBar label="Availability" value={d.scoreBreakdown.availability} />
        <ScoreBar label="Performance" value={d.scoreBreakdown.past_performance} />
        <ScoreBar label="Expertise" value={d.scoreBreakdown.expertise_depth} />
      </div>

      {/* Reasoning */}
      <div className="px-4 py-2.5 border-t border-gray-100">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Why This Person?</div>
        <ul className="space-y-0.5">
          {d.reasoning.map((r: string, i: number) => (
            <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1">
              <span className="text-green-500 mt-0.5">✓</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Required Skills */}
      <div className="px-4 py-2 border-t border-gray-100">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Required Skills</div>
        <div className="flex flex-wrap gap-1">
          {d.requiredSkills.map((skill: string, i: number) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Other Candidates Toggle */}
      {d.allCandidates.length > 1 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            onClick={() => setShowCandidates(!showCandidates)}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium cursor-pointer"
          >
            {showCandidates ? '▼ Hide' : '▶ Show'} other candidates ({d.allCandidates.length - 1})
          </button>
          {showCandidates && (
            <div className="mt-2 space-y-1">
              {d.allCandidates.slice(1).map((c: CandidateScore) => (
                <div key={c.id} className="flex items-center justify-between text-[11px] px-2 py-1 bg-gray-50 rounded">
                  <span className="text-gray-600">{c.name}</span>
                  <span className="font-mono text-gray-400">{Math.round(c.total_score * 100)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MemberNode.displayName = 'MemberNode';
export default MemberNode;

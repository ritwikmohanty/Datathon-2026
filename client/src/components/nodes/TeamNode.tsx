import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface TeamNodeData {
  label: string;
  teamName: string;
  description: string;
  taskCount: number;
  teamKey: string;
  [key: string]: unknown;
}

const TEAM_COLORS: Record<string, { bg: string; border: string; accent: string; icon: string }> = {
  tech: {
    bg: 'from-blue-500 to-cyan-600',
    border: 'border-blue-400/40',
    accent: 'bg-blue-200/20',
    icon: '💻'
  },
  marketing: {
    bg: 'from-orange-500 to-amber-600',
    border: 'border-orange-400/40',
    accent: 'bg-orange-200/20',
    icon: '📊'
  },
  editing: {
    bg: 'from-emerald-500 to-teal-600',
    border: 'border-emerald-400/40',
    accent: 'bg-emerald-200/20',
    icon: '✍️'
  }
};

const TeamNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as TeamNodeData;
  const colors = TEAM_COLORS[d.teamKey] || TEAM_COLORS.tech;

  return (
    <div className={`px-5 py-4 rounded-xl bg-linear-to-br ${colors.bg} text-white shadow-lg min-w-60 max-w-72 border-2 ${colors.border}`}>
      <Handle type="target" position={Position.Top} className="bg-white! w-3! h-3!" />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{colors.icon}</span>
        <div>
          <div className="font-bold text-base">{d.teamName}</div>
          <div className="text-white/70 text-[11px]">{d.description}</div>
        </div>
      </div>
      <div className={`mt-2 px-3 py-1.5 ${colors.accent} rounded-lg text-center`}>
        <span className="text-sm font-semibold">{d.taskCount} task{d.taskCount !== 1 ? 's' : ''}</span>
        <span className="text-white/60 text-xs ml-1">allocated</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-white! w-3! h-3!" />
    </div>
  );
});

TeamNode.displayName = 'TeamNode';
export default TeamNode;

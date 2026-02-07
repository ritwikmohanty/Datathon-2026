import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

interface PMNodeData {
  label: string;
  name: string;
  role: string;
  taskDescription: string;
  taskType: string;
  aiGenerated: boolean;
  [key: string]: unknown;
}

const PMNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as PMNodeData;
  return (
    <div className="px-6 py-4 rounded-2xl bg-linear-to-br from-violet-600 to-indigo-700 text-white shadow-xl min-w-70 max-w-85 border-2 border-violet-400/30">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
          👤
        </div>
        <div>
          <div className="font-bold text-lg leading-tight">{d.name}</div>
          <div className="text-violet-200 text-xs">{d.role}</div>
        </div>
      </div>
      <div className="mt-3 p-3 bg-white/10 rounded-lg">
        <div className="text-[10px] uppercase tracking-wider text-violet-200 mb-1">Task</div>
        <div className="text-sm font-medium leading-snug">{d.taskDescription}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 bg-white/20 rounded text-[10px] uppercase tracking-wider">
            {d.taskType?.replace(/_/g, ' ')}
          </span>
          {d.aiGenerated && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-400/30 rounded text-[10px] font-semibold">
              🤖 AI
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="bg-violet-300! w-3! h-3!" />
    </div>
  );
});

PMNode.displayName = 'PMNode';
export default PMNode;

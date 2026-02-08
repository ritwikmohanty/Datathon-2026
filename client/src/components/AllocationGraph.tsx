import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PMNode from './nodes/PMNode';
import TeamNode from './nodes/TeamNode';
import MemberNode from './nodes/MemberNode';
import type { AllocationResult } from '../types/allocation';

const nodeTypes = {
  pmNode: PMNode,
  teamNode: TeamNode,
  memberNode: MemberNode,
};

const TEAM_ORDER = ['tech', 'marketing', 'editing'];

const EDGE_COLORS: Record<string, string> = {
  tech: '#3b82f6',
  marketing: '#f97316',
  editing: '#10b981',
};

interface AllocationGraphProps {
  allocation: AllocationResult;
}

function buildGraph(allocation: AllocationResult): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const teamKeys = TEAM_ORDER.filter(k => allocation.teams[k]);
  const totalTeams = teamKeys.length;

  // Calculate layout
  const teamSpacing = 450;
  const totalWidth = (totalTeams - 1) * teamSpacing;
  const startX = -totalWidth / 2;

  // PM Node (top center)
  nodes.push({
    id: 'pm',
    type: 'pmNode',
    position: { x: -140, y: 0 },
    data: {
      label: allocation.product_manager.name,
      name: allocation.product_manager.name,
      role: allocation.product_manager.role,
      taskDescription: allocation.task_description,
      taskType: allocation.task_type,
      aiGenerated: allocation.ai_generated,
    },
  });

  // Team nodes (second row)
  teamKeys.forEach((teamKey, teamIndex) => {
    const team = allocation.teams[teamKey];
    const teamX = startX + teamIndex * teamSpacing;

    const teamNodeId = `team-${teamKey}`;
    nodes.push({
      id: teamNodeId,
      type: 'teamNode',
      position: { x: teamX, y: 250 },
      data: {
        label: team.team_name,
        teamName: team.team_name,
        description: team.description,
        taskCount: team.tasks.length,
        teamKey,
      },
    });

    // Edge from PM to Team
    edges.push({
      id: `pm-to-${teamKey}`,
      source: 'pm',
      target: teamNodeId,
      animated: true,
      style: { stroke: EDGE_COLORS[teamKey] || '#6366f1', strokeWidth: 3 },
      type: 'smoothstep',
      label: `${team.tasks.length} tasks`,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: '#64748b' },
      labelBgStyle: { fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
    });

    // Member/Task nodes (third row)
    const memberSpacing = 380;
    const totalMembers = team.tasks.length;
    const memberTotalWidth = (totalMembers - 1) * memberSpacing;
    const memberStartX = teamX - memberTotalWidth / 2;

    team.tasks.forEach((task, taskIndex) => {
      const memberNodeId = `member-${teamKey}-${taskIndex}`;
      const memberX = memberStartX + taskIndex * memberSpacing;

      nodes.push({
        id: memberNodeId,
        type: 'memberNode',
        position: { x: memberX, y: 500 },
        data: {
          label: task.assigned_to.name,
          memberName: task.assigned_to.name,
          memberRole: task.assigned_to.role,
          taskTitle: task.title,
          taskDescription: task.description || '',
          taskReasoning: task.task_reasoning || '',
          complexity: task.complexity,
          estimatedHours: task.estimated_hours,
          totalScore: task.score.total,
          scoreBreakdown: task.score.breakdown,
          reasoning: task.reasoning,
          yearsOfExperience: task.assigned_to.years_of_experience,
          availability: task.assigned_to.availability,
          freeSlotsPerWeek: task.assigned_to.free_slots_per_week,
          requiredSkills: task.required_skills,
          allCandidates: task.all_candidates,
          teamKey,
        },
      });

      edges.push({
        id: `${teamNodeId}-to-${memberNodeId}`,
        source: teamNodeId,
        target: memberNodeId,
        animated: false,
        style: { stroke: EDGE_COLORS[teamKey] || '#6366f1', strokeWidth: 2 },
        type: 'smoothstep',
        label: `Score: ${Math.round(task.score.total * 100)}`,
        labelStyle: { fontSize: 10, fontWeight: 600, fill: '#64748b' },
        labelBgStyle: { fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 1 },
        labelBgPadding: [4, 3] as [number, number],
        labelBgBorderRadius: 4,
      });
    });
  });

  return { nodes, edges };
}

export default function AllocationGraph({ allocation }: AllocationGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(allocation),
    [allocation]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 100);
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls className="bg-white shadow-lg rounded-lg" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'pmNode') return '#7c3aed';
            if (node.type === 'teamNode') {
              const teamKey = (node.data as Record<string, unknown>).teamKey as string;
              return EDGE_COLORS[teamKey] || '#6366f1';
            }
            return '#94a3b8';
          }}
          className="rounded-lg shadow-lg"
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}

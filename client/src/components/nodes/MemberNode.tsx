import { Handle, Position } from "@xyflow/react"

export default function MemberNode({ data }: { data: { label: string } }) {
  return (
    <div className="rounded-lg bg-emerald-600 text-white px-3 py-2 shadow text-xs font-medium">
      {data.label}
      <Handle type="target" position={Position.Top} />
    </div>
  )
}

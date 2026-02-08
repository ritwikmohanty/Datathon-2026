import { Handle, Position } from "@xyflow/react"

export default function TeamNode({ data }: { data: { label: string } }) {
  return (
    <div className="rounded-lg bg-blue-600 text-white px-4 py-2 shadow-md text-sm font-medium">
      {data.label}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

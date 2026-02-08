import { Handle, Position } from "@xyflow/react"

export default function PMNode({ data }: { data: { label: string } }) {
  return (
    <div className="rounded-lg bg-slate-900 text-white px-4 py-2 shadow-md text-sm font-medium">
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

import { Button } from "@/components/ui/button"
import type { AllocationResult } from "@/types/allocation"

interface AllocationSummaryProps {
  allocation: AllocationResult
  onReset?: () => void
}

export default function AllocationSummary({ allocation, onReset }: AllocationSummaryProps) {
  const teams = Object.values(allocation.teams || {})
  const taskCount = teams.reduce((sum, team) => sum + (team.tasks?.length || 0), 0)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Summary</h3>
        <p className="text-sm text-muted-foreground">{allocation.task_description}</p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Teams</span>
          <span className="font-medium">{teams.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tasks</span>
          <span className="font-medium">{taskCount}</span>
        </div>
      </div>

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.team_name} className="rounded-lg border p-3">
            <div className="text-sm font-medium">{team.team_name}</div>
            {team.description && <div className="text-xs text-muted-foreground">{team.description}</div>}
            <div className="mt-2 text-xs text-muted-foreground">Tasks: {team.tasks?.length || 0}</div>
          </div>
        ))}
      </div>

      {onReset && (
        <Button variant="outline" className="w-full" onClick={onReset}>
          Start New Allocation
        </Button>
      )}
    </div>
  )
}

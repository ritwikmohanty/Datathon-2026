import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AllocationGraph from '@/components/AllocationGraph'
import AllocationSummary from '@/components/AllocationSummary'
import type { AllocationResult } from '@/types/allocation'

export default function AllocationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const allocation = location.state?.allocation as AllocationResult | undefined

  if (!allocation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">No Allocation Data</h1>
          <p className="text-muted-foreground">Please submit a task first to see the allocation graph.</p>
          <Button onClick={() => navigate('/')}>
            ← Back to Task Allocation
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Task Allocation Graph</h1>
          <p className="text-sm text-muted-foreground truncate max-w-xl">
            {allocation.task_description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            ← Back to Tasks
          </Button>
          <Button variant="outline" onClick={() => navigate('/', { state: { resetAllocation: true } })}>
            New Allocation
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Graph - takes most of the space */}
        <div className="flex-1 relative">
          <AllocationGraph allocation={allocation} />
        </div>
        
        {/* Summary Sidebar */}
        <div className="w-80 border-l bg-card overflow-auto p-4">
          <AllocationSummary 
            allocation={allocation} 
            onReset={() => navigate('/', { state: { resetAllocation: true } })} 
          />
        </div>
      </div>
    </div>
  )
}

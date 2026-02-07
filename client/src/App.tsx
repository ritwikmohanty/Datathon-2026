import { useState } from 'react';
import TaskInputForm from './components/TaskInputForm';
import AllocationGraph from './components/AllocationGraph';
import AllocationSummary from './components/AllocationSummary';
import { allocateTask } from './lib/api';
import type { AllocationResult } from './types/allocation';

function App() {
  const [allocation, setAllocation] = useState<AllocationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (description: string, taskType?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await allocateTask(description, taskType);
      if (result.success) {
        setAllocation(result.allocation);
      } else {
        setError(result.error || 'Something went wrong');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAllocation(null);
    setError(null);
  };

  // Show the input form when no allocation exists
  if (!allocation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full">
          <TaskInputForm onSubmit={handleSubmit} isLoading={isLoading} />
          {error && (
            <div className="max-w-2xl mx-auto mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show the graph + summary when allocation is ready
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50">
      {/* Graph takes remaining space */}
      <div className="flex-1 relative">
        <AllocationGraph allocation={allocation} />
      </div>
      {/* Summary sidebar */}
      <AllocationSummary allocation={allocation} onReset={handleReset} />
    </div>
  );
}

export default App;
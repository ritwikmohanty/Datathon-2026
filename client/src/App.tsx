import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { RoleManagement } from "@/components/RoleManagement"
import { KnowledgeGraph3D } from "@/components/KnowledgeGraph3D"
import TaskInputForm from "@/components/TaskInputForm"

const API = "/api"

type Health = { status: string; db?: string }
type Metrics = {
  by_source_entity: Record<string, { success_count: number; fail_count: number; last_latency_ms: number | null }>
  last_sync: Record<string, { last_sync_at: string | null; last_cursor: string | null }>
}

type Tab = 'dashboard' | 'roles' | 'graph' | 'allocation'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [health, setHealth] = useState<Health | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null)
  const [oauthMessage, setOauthMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [isAllocating, setIsAllocating] = useState(false)
  const [allocationError, setAllocationError] = useState<string | null>(null)

  // Handle reset state from navigation
  useEffect(() => {
    if (location.state?.resetAllocation) {
      setAllocationError(null)
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const handleTaskSubmit = async (description: string, taskType?: string) => {
    setIsAllocating(true)
    setAllocationError(null)
    try {
      const response = await fetch(`${API}/tasks/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_description: description, task_type: taskType }),
      })
      const data = await response.json()
      
      if (!response.ok || data.error) {
        setAllocationError(data.error || 'Allocation failed')
        return
      }
      
      // Validate the response has required structure
      if (!data.teams || !data.product_manager) {
        setAllocationError('Invalid response from server')
        return
      }
      
      // Navigate to the allocation page with the result
      navigate('/allocation', { state: { allocation: data } })
    } catch (error) {
      console.error('Allocation failed:', error)
      setAllocationError('Network error - please check if server is running')
    } finally {
      setIsAllocating(false)
    }
  }

  const handleAllocationReset = () => {
    setAllocationError(null)
  }

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error" }))
  }, [])

  useEffect(() => {
    fetch(`${API}/metrics`)
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => setMetrics(null))
  }, [])

  useEffect(() => {
    fetch(`${API}/oauth/github/status`)
      .then((r) => r.json())
      .then((d) => setGithubConnected(d.connected))
      .catch(() => setGithubConnected(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get("oauth")
    if (oauth === "success") setOauthMessage("GitHub connected successfully.")
    if (oauth === "error") setOauthMessage("GitHub connection failed.")
  }, [])

  const connectGitHub = () => {
    window.location.href = `${API}/oauth/github`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 gap-6">
      <h1 className="text-2xl font-bold text-foreground">Data Integration Hub</h1>

      {oauthMessage && (
        <div className="rounded-lg bg-muted px-4 py-2 text-sm text-foreground">
          {oauthMessage}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <Button 
          variant={activeTab === 'dashboard' ? "default" : "outline"} 
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </Button>
        <Button 
          variant={activeTab === 'roles' ? "default" : "outline"} 
          onClick={() => setActiveTab('roles')}
        >
          Role Management
        </Button>
        <Button 
          variant={activeTab === 'graph' ? "default" : "outline"} 
          onClick={() => setActiveTab('graph')}
        >
          Knowledge Graph
        </Button>
        <Button 
          variant={activeTab === 'allocation' ? "default" : "outline"} 
          onClick={() => setActiveTab('allocation')}
        >
          Task Allocation
        </Button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <section className="w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-card p-4">
              <span className="text-muted-foreground">Health</span>
              {health ? (
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      health.status === "ok" && health.db === "connected"
                        ? "bg-green-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">
                    {health.status === "ok" ? "OK" : "Degraded"} {health.db && `(${health.db})`}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Loading…</span>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-card p-4">
              <span className="text-muted-foreground">GitHub</span>
              {githubConnected === null ? (
                <span className="text-sm text-muted-foreground">Loading…</span>
              ) : githubConnected ? (
                <span className="text-sm text-green-600">Connected</span>
              ) : (
                <Button onClick={connectGitHub}>Connect GitHub</Button>
              )}
            </div>
          </section>

          <section className="w-full max-w-lg space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Metrics</h2>
            {metrics ? (
              <div className="space-y-2">
                {Object.entries(metrics.by_source_entity).length === 0 &&
                Object.entries(metrics.last_sync).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sync data yet.</p>
                ) : (
                  <>
                    {Object.entries(metrics.last_sync).map(([key, v]) => (
                      <div key={key} className="rounded-xl border bg-card p-4 text-sm">
                        <div className="font-medium text-foreground">{key}</div>
                        <div className="text-muted-foreground">
                          Last sync: {v.last_sync_at ? new Date(v.last_sync_at).toLocaleString() : "Never"}
                        </div>
                        {metrics.by_source_entity[key] && (
                          <div className="mt-1 text-muted-foreground">
                            Success: {metrics.by_source_entity[key].success_count} | Fail:{" "}
                            {metrics.by_source_entity[key].fail_count}
                            {metrics.by_source_entity[key].last_latency_ms != null &&
                              ` | Latency: ${metrics.by_source_entity[key].last_latency_ms}ms`}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading metrics…</p>
            )}
          </section>
        </>
      )}

      {activeTab === 'roles' && <RoleManagement />}
      
      {activeTab === 'graph' && (
        <div className="fixed inset-0 z-50">
          <KnowledgeGraph3D />
          <button
            onClick={() => setActiveTab('dashboard')}
            className="fixed top-4 left-4 z-50 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      )}

      {activeTab === 'allocation' && (
        <div className="w-full max-w-6xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Task Allocation</h2>
            <Button variant="outline" onClick={() => setActiveTab('dashboard')}>
              ← Back to Dashboard
            </Button>
          </div>
          
          {allocationError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700">
              <p className="font-medium">Allocation Error</p>
              <p className="text-sm">{allocationError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleAllocationReset}>
                Try Again
              </Button>
            </div>
          )}
          
          {/* Task input form - submitting will navigate to the graph page */}
          <TaskInputForm onSubmit={handleTaskSubmit} isLoading={isAllocating} />
          
          <p className="text-sm text-muted-foreground text-center">
            Submit a task to generate the allocation graph on a new page
          </p>
        </div>
      )}
    </div>
  )
}

export default App

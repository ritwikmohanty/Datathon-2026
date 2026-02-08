import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import ForceGraph2D from "react-force-graph-2d"

const API = "/api"

interface GraphStatus {
  status: string
  message?: string
  features?: string[]
  stats?: {
    nodeCount: number
    relCount: number
    labels: Record<string, number>
    relTypes: Record<string, number>
  }
  connection?: {
    connected: boolean
    server: string
  }
}

interface GraphNode {
  id: string
  type: string
  label: string
  name?: string
  email?: string
  role?: string
  team?: string
  department?: string
  hourly_rate?: number
  status?: string
  priority?: string
  story_points?: number
  [key: string]: unknown
}

interface GraphLink {
  source: string
  target: string
  type: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  meta?: {
    nodeCount: number
    linkCount: number
    nodesByType: {
      developers: number
      commits: number
      tickets: number
      files: number
    }
  }
  message?: string
}

interface SyncResult {
  success: boolean
  timestamp?: string
  synced?: {
    developers: number
    tickets: number
    commits: number
  }
  error?: string
}

export function KnowledgeGraph() {
  const [status, setStatus] = useState<GraphStatus | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [view, setView] = useState<'status' | 'nodes' | 'preview'>('status')

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/graph/status`)
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.error("Failed to fetch graph status:", err)
    }
  }

  useEffect(() => {
    fetchStatus().finally(() => setLoading(false))
  }, [])

  const loadVisualization = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/graph/visualization?limit=100`)
      const data = await res.json()
      setGraphData(data)
      setView('nodes')
    } catch (err) {
      console.error("Failed to load graph data:", err)
    }
    setLoading(false)
  }

  const syncGraph = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${API}/graph/sync`, { method: 'POST' })
      const data = await res.json()
      console.log("Sync result:", data)
      setSyncResult(data)
      // Reload status and visualization after sync
      await fetchStatus()
      await loadVisualization()
    } catch (err) {
      console.error("Sync failed:", err)
      setSyncResult({ success: false, error: String(err) })
    }
    setSyncing(false)
  }

  if (loading && !graphData) {
    return (
      <div className="w-full max-w-4xl">
        <p className="text-muted-foreground">Loading knowledge graph...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Knowledge Graph</h2>
        <div className="flex gap-2">
          <Button 
            variant={view === 'status' ? 'default' : 'outline'} 
            onClick={() => setView('status')}
          >
            Status
          </Button>
          <Button 
            variant={view === 'nodes' ? 'default' : 'outline'} 
            onClick={loadVisualization}
            disabled={loading}
          >
            View Data
          </Button>
          <Button variant="outline" onClick={syncGraph} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Graph'}
          </Button>
        </div>
      </div>

      {/* Sync Result Notification */}
      {syncResult && (
        <div className={`rounded-xl border p-4 ${syncResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {syncResult.success ? (
            <div>
              <p className="font-medium text-green-800">✓ Sync Completed Successfully</p>
              {syncResult.synced && (
                <p className="text-sm text-green-700 mt-1">
                  Synced: {syncResult.synced.developers} developers, {syncResult.synced.tickets} tickets, {syncResult.synced.commits} commits
                </p>
              )}
            </div>
          ) : (
            <p className="font-medium text-red-800">✗ Sync Failed: {syncResult.error}</p>
          )}
        </div>
      )}

      {view === 'status' && status && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`h-4 w-4 rounded-full ${
                status.status === 'connected' ? 'bg-green-500' : 
                status.status === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="font-medium capitalize">{status.status}</span>
              {status.connection?.server && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({status.connection.server})
                </span>
              )}
            </div>
            {status.message && <p className="text-muted-foreground">{status.message}</p>}
          </div>

          {/* Neo4j Stats */}
          {status.stats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{status.stats.nodeCount}</div>
                <div className="text-xs text-muted-foreground">Total Nodes</div>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{status.stats.relCount}</div>
                <div className="text-xs text-muted-foreground">Relationships</div>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{status.stats.labels?.Developer || 0}</div>
                <div className="text-xs text-muted-foreground">Developers</div>
              </div>
              <div className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{status.stats.labels?.Commit || 0}</div>
                <div className="text-xs text-muted-foreground">Commits</div>
              </div>
            </div>
          )}

          {status.features && (
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-medium mb-3">Active Features</h3>
              <ul className="space-y-2">
                {status.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Architecture Preview */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-medium mb-3">Graph Architecture</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Nodes:</strong> Users, Issues, Projects, Commits, Skills</p>
              <p><strong>Relationships:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• User → ASSIGNED_TO → Issue</li>
                <li>• User → CONTRIBUTED_TO → Commit</li>
                <li>• User → MEMBER_OF → Team</li>
                <li>• Issue → BELONGS_TO → Project</li>
                <li>• Commit → REFERENCES → Issue</li>
                <li>• User → HAS_SKILL → Skill (inferred from commits)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {view === 'nodes' && graphData && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{graphData.meta?.nodesByType?.developers || 0}</div>
              <div className="text-xs text-muted-foreground">Developers</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{graphData.meta?.nodesByType?.commits || 0}</div>
              <div className="text-xs text-muted-foreground">Commits</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{graphData.meta?.nodesByType?.tickets || 0}</div>
              <div className="text-xs text-muted-foreground">Tickets</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{graphData.meta?.linkCount || 0}</div>
              <div className="text-xs text-muted-foreground">Relationships</div>
            </div>
          </div>


          {/* Graph Visualization */}
          <div className="rounded-xl border bg-card overflow-hidden h-[600px] relative">
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="label"
              nodeAutoColorBy="type"
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              // Adjust node size based on importance (e.g. connections)
              nodeVal={node => (node as any).size || 3}
              onNodeClick={node => {
                // Determine node details to show
                const details = `
                  Name: ${node.name || node.label}
                  Type: ${node.type}
                  ${node.email ? `Email: ${node.email}` : ''}
                  ${node.team ? `Team: ${node.team}` : ''}
                  ${node.status ? `Status: ${node.status}` : ''}
                `;
                alert(details);
              }}
              // Canvas styling
              backgroundColor="#f8fafc"
            />
            
            {/* Legend Overlay */}
            <div className="absolute top-4 right-4 bg-white/90 p-3 rounded-lg shadow-sm border text-xs">
              <div className="font-semibold mb-2">Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#1f78b4]"></div> Developer</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#33a02c]"></div> Ticket</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#e31a1c]"></div> Commit</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ff7f00]"></div> File</div>
              </div>
            </div>
          </div>

          {/* Node List by Type */}
          <div className="grid grid-cols-2 gap-4">
            {/* Developers */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 font-medium text-blue-800">
                Developers ({graphData.nodes.filter(n => n.type === 'developer').length})
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {graphData.nodes.filter(n => n.type === 'developer').slice(0, 15).map(node => (
                  <div key={node.id} className="px-4 py-2 border-t flex items-center justify-between">
                    <div>
                      <span className="font-medium">{node.name || node.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{node.role}</span>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {node.team}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tickets */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 bg-green-50 font-medium text-green-800">
                Tickets ({graphData.nodes.filter(n => n.type === 'ticket' || n.type === 'Task').length})
              </div>
              <div className="max-h-[250px] overflow-y-auto">
                {graphData.nodes.filter(n => n.type === 'ticket' || n.type === 'Task').slice(0, 15).map(node => (
                  <div key={node.id} className="px-4 py-2 border-t flex items-center justify-between">
                    <div>
                      <span className="font-medium">{node.label}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate max-w-[150px] inline-block align-bottom">
                        {String(node.title || '').substring(0, 30)}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      node.status === 'Done' ? 'bg-green-100 text-green-700' :
                      node.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {String(node.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Relationships Summary */}
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium mb-3">Relationships</h3>
            <div className="flex flex-wrap gap-2">
              {graphData.links.slice(0, 10).map((link, i) => (
                <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {String(link.source).substring(0, 15)}... → <span className="font-medium">{link.type}</span> → {String(link.target).substring(0, 15)}...
                </span>
              ))}
              {graphData.links.length > 10 && (
                <span className="text-xs text-muted-foreground">
                  +{graphData.links.length - 10} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

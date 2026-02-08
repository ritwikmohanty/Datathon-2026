import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import ForceGraph3D from "react-force-graph-3d"
import * as THREE from "three"

const API = "/api"

// ============================================
// TYPE DEFINITIONS
// ============================================

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
  // Force graph properties
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  [key: string]: unknown
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
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

interface InsightData {
  silos?: SiloData
  burnoutRisk?: BurnoutData
  hiddenCosts?: HiddenCostData
  velocity?: VelocityData
}

interface SiloData {
  count: number
  silos: Array<{
    file: string
    filename: string
    sole_owner: string
    risk_level: string
    total_commits: number
  }>
}

interface BurnoutData {
  count: number
  summary: {
    critical_risk: number
    high_risk: number
    medium_risk: number
    low_risk: number
  }
  developers: Array<{
    developer: string
    email: string
    commit_count: number
    risk_level: string
    repos: string[]
  }>
}

interface HiddenCostData {
  count: number
  summary: {
    total_tracked_cost: number
    avg_cost_per_ticket: number
  }
  tickets: Array<{
    ticket: string
    title: string
    total_cost: number
    status: string
  }>
}

interface VelocityData {
  count: number
  developers: Array<{
    developer: string
    email: string
    completed_tickets: number
    total_points: number
  }>
}

// ============================================
// COLOR SCHEMES & CONSTANTS
// ============================================

const NODE_COLORS: Record<string, string> = {
  developer: "#3b82f6", // blue-500
  commit: "#8b5cf6",    // violet-500
  ticket: "#10b981",    // emerald-500
  file: "#f59e0b",      // amber-500
  default: "#6b7280"    // gray-500
}

const NODE_SIZES: Record<string, number> = {
  developer: 8,
  commit: 4,
  ticket: 6,
  file: 3
}

const LINK_COLORS: Record<string, string> = {
  AUTHORED: "#3b82f6",
  LINKED_TO: "#10b981",
  MODIFIED: "#f59e0b",
  ASSIGNED_TO: "#ef4444",
  REFERENCES: "#a855f7",
  BELONGS_TO: "#06b6d4",
  MEMBER_OF: "#ec4899",
  HAS_SKILL: "#84cc16",
  default: "#9ca3af"
}

// Default fallback color
const DEFAULT_COLOR = "#9ca3af"

// Helper to create text sprites
function createSpriteText(text: string, color: string, fontSize: number = 14) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = `bold ${fontSize}px Sans-Serif`;
  ctx.font = font;
  
  // Calculate text width
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const padding = 10;
  
  // Resize canvas
  canvas.width = textWidth + padding;
  canvas.height = fontSize + padding;
  
  // Draw text
  ctx.font = font; // Reset font after resize
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add shadow for better visibility
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const material = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthWrite: false, // Don't block other objects
  });
  
  const sprite = new THREE.Sprite(material);
  // Scale based on canvas size, but smaller in world units
  const scale = 0.5; 
  sprite.scale.set(canvas.width * scale * 0.1, canvas.height * scale * 0.1, 1);
  
  return sprite;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function KnowledgeGraph3D() {
  // State
  const [status, setStatus] = useState<GraphStatus | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [insights, setInsights] = useState<InsightData>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [activeView, setActiveView] = useState<'graph' | 'insights' | 'status'>('graph')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set())
  
  // Filter state
  const [filters, setFilters] = useState({
    showDevelopers: true,
    showCommits: true,
    showTickets: true,
    showFiles: true,
    nodeLimit: 200,
    searchQuery: "",
    selectedTeam: "all",
    selectedInsight: "none" as "none" | "silos" | "burnout" | "costs" | "velocity"
  })
  
  const graphRef = useRef<any>(null)

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/graph/status`)
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      console.error("Failed to fetch graph status:", err)
    }
  }, [])

  const loadVisualization = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/graph/visualization?limit=${filters.nodeLimit}`)
      const data = await res.json()
      
      // Ensure links reference node ids properly
      if (data.nodes && data.links) {
        const nodeIds = new Set(data.nodes.map((n: GraphNode) => n.id))
        data.links = data.links.filter((l: GraphLink) => {
          const sourceId = typeof l.source === 'object' ? l.source.id : l.source
          const targetId = typeof l.target === 'object' ? l.target.id : l.target
          return nodeIds.has(sourceId) && nodeIds.has(targetId)
        })
      }
      
      setGraphData(data)
    } catch (err) {
      console.error("Failed to load graph data:", err)
    }
    setLoading(false)
  }, [filters.nodeLimit])

  const fetchInsights = useCallback(async () => {
    try {
      const [silosRes, burnoutRes, costsRes, velocityRes] = await Promise.all([
        fetch(`${API}/graph/insights/silos`).then(r => r.json()).catch(() => null),
        fetch(`${API}/graph/insights/burnout-risk`).then(r => r.json()).catch(() => null),
        fetch(`${API}/graph/insights/hidden-costs`).then(r => r.json()).catch(() => null),
        fetch(`${API}/graph/insights/ticket-velocity`).then(r => r.json()).catch(() => null)
      ])
      
      setInsights({
        silos: silosRes,
        burnoutRisk: burnoutRes,
        hiddenCosts: costsRes,
        velocity: velocityRes
      })
    } catch (err) {
      console.error("Failed to fetch insights:", err)
    }
  }, [])

  const syncGraph = async () => {
    setSyncing(true)
    try {
      await fetch(`${API}/graph/sync`, { method: 'POST' })
      await Promise.all([fetchStatus(), loadVisualization(), fetchInsights()])
    } catch (err) {
      console.error("Sync failed:", err)
    }
    setSyncing(false)
  }

  // Initial load
  useEffect(() => {
    Promise.all([fetchStatus(), loadVisualization(), fetchInsights()])
      .finally(() => setLoading(false))
  }, [fetchStatus, loadVisualization, fetchInsights])

  // Optimize force graph layout
  useEffect(() => {
    if (graphRef.current) {
      // Reduce repulsion to keep nodes closer
      graphRef.current.d3Force('charge').strength(-20);
      // Shorten link distance
      graphRef.current.d3Force('link').distance(40);
    }
  }, [graphData]);

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }
    
    // Filter nodes
    let nodes = graphData.nodes.filter(node => {
      // Type filter
      if (node.type === 'developer' && !filters.showDevelopers) return false
      if (node.type === 'commit' && !filters.showCommits) return false
      if (node.type === 'ticket' && !filters.showTickets) return false
      if (node.type === 'file' && !filters.showFiles) return false
      
      // Team filter
      if (filters.selectedTeam !== 'all' && node.team && node.team !== filters.selectedTeam) return false
      
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const searchableText = `${node.label} ${node.name || ''} ${node.email || ''} ${node.team || ''}`.toLowerCase()
        if (!searchableText.includes(query)) return false
      }
      
      return true
    })
    
    // Get valid node IDs
    const nodeIds = new Set(nodes.map(n => n.id))
    
    // Filter links
    const links = graphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target
      return nodeIds.has(sourceId) && nodeIds.has(targetId)
    })
    
    return { nodes, links }
  }, [graphData, filters])

  // Get unique teams for filter
  const teams = useMemo(() => {
    if (!graphData) return []
    const teamSet = new Set<string>()
    graphData.nodes.forEach(n => {
      if (n.team) teamSet.add(n.team)
    })
    return Array.from(teamSet).sort()
  }, [graphData])

  // ============================================
  // INTERACTION HANDLERS
  // ============================================

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    
    // Highlight connected nodes and links
    const connectedNodes = new Set<string>([node.id])
    const connectedLinks = new Set<string>()
    
    filteredData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target
      
      if (sourceId === node.id) {
        connectedNodes.add(targetId)
        connectedLinks.add(`${sourceId}-${targetId}`)
      }
      if (targetId === node.id) {
        connectedNodes.add(sourceId)
        connectedLinks.add(`${sourceId}-${targetId}`)
      }
    })
    
    setHighlightNodes(connectedNodes)
    setHighlightLinks(connectedLinks)
    
    // Focus camera on node
    if (graphRef.current && node.x !== undefined) {
      const distance = 120
      const distRatio = 1 + distance / Math.hypot(node.x, node.y || 0, node.z || 0)
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node,
        1500
      )
    }
  }, [filteredData.links])

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
    setHighlightNodes(new Set())
    setHighlightLinks(new Set())
  }, [])

  const centerGraph = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000)
    }
  }, [])

  // ============================================
  // NODE & LINK RENDERING
  // ============================================

  const getNodeColor = useCallback((node: GraphNode): string => {
    const nodeType = node.type?.toLowerCase() || 'default'
    const baseColor = NODE_COLORS[nodeType] || NODE_COLORS.default || "#6b7280"
    
    // Apply insight-based coloring
    if (filters.selectedInsight === 'burnout' && nodeType === 'developer') {
      const dev = insights.burnoutRisk?.developers.find(d => d.email === node.email)
      if (dev) {
        switch (dev.risk_level) {
          case 'CRITICAL': return "#dc2626"
          case 'HIGH': return "#f97316"
          case 'MEDIUM': return "#eab308"
          case 'LOW': return "#22c55e"
          default: return baseColor
        }
      }
    }
    
    if (filters.selectedInsight === 'silos' && nodeType === 'file') {
      const silo = insights.silos?.silos.find(s => s.file === node.id)
      if (silo) {
        switch (silo.risk_level) {
          case 'HIGH': return "#dc2626"
          case 'MEDIUM': return "#f97316"
          case 'LOW': return "#eab308"
          default: return baseColor
        }
      }
    }
    
    // Highlight effect
    if (highlightNodes.size > 0) {
      return highlightNodes.has(node.id) ? baseColor : "#374151"
    }
    
    return baseColor
  }, [filters.selectedInsight, insights, highlightNodes])

  const nodeThreeObject = useCallback((node: GraphNode) => {
    const nodeType = node.type?.toLowerCase() || 'default'
    const size = NODE_SIZES[nodeType] || 4
    const color = getNodeColor(node)
    
    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(size, 16, 16)
    const material = new THREE.MeshLambertMaterial({
      color: color,
      transparent: highlightNodes.size > 0 && !highlightNodes.has(node.id),
      opacity: highlightNodes.size > 0 && !highlightNodes.has(node.id) ? 0.3 : 1
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    
    // Add glow effect for highlighted nodes
    if (highlightNodes.has(node.id)) {
      const glowGeometry = new THREE.SphereGeometry(size * 1.5, 16, 16)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      mesh.add(glow)
    }
    
    // Create Group to hold mesh and label
    const group = new THREE.Group();
    group.add(mesh);
    
    // Add Text Label
    const label = node.name || node.label || node.id;
    // Show label if node is highlighted OR if total node count is small (< 50) OR always (users request)
    // We'll show it always but make it semi-transparent if not highlighted? 
    // Or just fully visible. The user wants to see text.
    
    const sprite = createSpriteText(label, "#f1f5f9", 32);
    if (sprite) {
      sprite.position.set(0, size + 4, 0); // Position above the node
      // If highlights are active and this node is not highlighted, fade the text
      if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
        sprite.material.opacity = 0.2;
      }
      group.add(sprite);
    }
    
    return group;
  }, [getNodeColor, highlightNodes])

  const linkThreeObject = useCallback((link: GraphLink) => {
    // Only show link labels when filtered or highlighted might be better, but user asked for labels
    // We'll show them.
    
    // Get link ID
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    // const linkId = `${sourceId}-${targetId}`; // unused

    // If highlights are active, only show labels for highlighted links
    if (highlightLinks.size > 0) {
        // We need to check if this link is highlighted
        // The link object in d3 graph might not directly match our ID construction if we don't have IDs
        // But we constructed highlightLinks using `${sourceId}-${targetId}` in handleNodeClick
        // So we can check that.
        // HOWEVER, graphData.links objects are modified by ForceGraph to have source/target as objects.
        const idToCheck = `${sourceId}-${targetId}`;
        const reverseId = `${targetId}-${sourceId}`;
        if (!highlightLinks.has(idToCheck) && !highlightLinks.has(reverseId)) {
            return new THREE.Object3D();
        }
    }

    const label = link.type?.toLowerCase().replace(/_/g, ' ') || '';
    const sprite = createSpriteText(label, "#94a3b8", 16);
    if (sprite) {
      sprite.position.y = 0; // Center
      return sprite;
    }
    return new THREE.Object3D();
  }, [highlightLinks]);

  const getLinkColor = useCallback((link: GraphLink): string => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source
    const targetId = typeof link.target === 'object' ? link.target.id : link.target
    const linkId = `${sourceId}-${targetId}`
    
    const baseColor = link.type && LINK_COLORS[link.type] ? LINK_COLORS[link.type] : DEFAULT_COLOR
    
    if (highlightLinks.size > 0) {
      return highlightLinks.has(linkId) ? baseColor : "#1f2937"
    }
    
    return baseColor
  }, [highlightLinks])

  const getLinkWidth = useCallback((link: GraphLink) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source
    const targetId = typeof link.target === 'object' ? link.target.id : link.target
    const linkId = `${sourceId}-${targetId}`
    
    return highlightLinks.has(linkId) ? 2 : 0.5
  }, [highlightLinks])

  // ============================================
  // RENDER
  // ============================================

  if (loading && !graphData) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-linear-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading Knowledge Graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-linear-to-br from-slate-900 to-slate-800 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Knowledge Graph</h1>
            {status && (
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  status.status === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span className="text-sm text-slate-400">
                  {status.stats?.nodeCount || 0} nodes • {status.stats?.relCount || 0} relationships
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setActiveView('graph')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'graph' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                3D Graph
              </button>
              <button
                onClick={() => setActiveView('insights')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'insights' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Insights
              </button>
              <button
                onClick={() => setActiveView('status')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'status' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Status
              </button>
            </div>
            
            <Button 
              onClick={syncGraph} 
              disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {syncing ? 'Syncing...' : 'Sync Data'}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ============================================ */}
        {/* LEFT SIDEBAR - FILTERS */}
        {/* ============================================ */}
        {activeView === 'graph' && (
          <aside className="w-80 shrink-0 bg-slate-900/60 border-r border-slate-700 p-4 overflow-y-auto">
            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search nodes..."
                value={filters.searchQuery}
                onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Node Type Filters */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Node Types</label>
              <div className="space-y-2">
                {[
                  { key: 'showDevelopers', label: 'Developers', color: NODE_COLORS.developer, count: graphData?.meta?.nodesByType?.developers },
                  { key: 'showCommits', label: 'Commits', color: NODE_COLORS.commit, count: graphData?.meta?.nodesByType?.commits },
                  { key: 'showTickets', label: 'Tickets', color: NODE_COLORS.ticket, count: graphData?.meta?.nodesByType?.tickets },
                  { key: 'showFiles', label: 'Files', color: NODE_COLORS.file, count: graphData?.meta?.nodesByType?.files }
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters[item.key as keyof typeof filters] as boolean}
                      onChange={(e) => setFilters(f => ({ ...f, [item.key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300 group-hover:text-white">{item.label}</span>
                    <span className="text-slate-500 text-sm ml-auto">{item.count || 0}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Team Filter */}
            {teams.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">Team</label>
                <select
                  value={filters.selectedTeam}
                  onChange={(e) => setFilters(f => ({ ...f, selectedTeam: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Teams</option>
                  {teams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Node Limit */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Node Limit: {filters.nodeLimit}
              </label>
              <input
                type="range"
                min={50}
                max={500}
                step={50}
                value={filters.nodeLimit}
                onChange={(e) => setFilters(f => ({ ...f, nodeLimit: parseInt(e.target.value) }))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>50</span>
                <span>500</span>
              </div>
            </div>

            {/* Insight Overlay */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Insight Overlay</label>
              <select
                value={filters.selectedInsight}
                onChange={(e) => setFilters(f => ({ ...f, selectedInsight: e.target.value as any }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="burnout">🔥 Burnout Risk</option>
                <option value="silos">🚧 Knowledge Silos</option>
                <option value="costs">💰 Hidden Costs</option>
                <option value="velocity">🚀 Velocity</option>
              </select>
            </div>

            {/* Graph Controls */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-3">Controls</label>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={centerGraph}
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  🎯 Center Graph
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => loadVisualization()}
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  🔄 Reload Data
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleBackgroundClick}
                  className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  ✖ Clear Selection
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Relationship Legend</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(LINK_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-8 h-0.5" style={{ backgroundColor: color }} />
                    <span className="text-slate-400">{type.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ============================================ */}
        {/* MAIN CONTENT */}
        {/* ============================================ */}
        <main className="flex-1 relative">
          {activeView === 'graph' && (
            <>
              {/* 3D Graph */}
              <ForceGraph3D
                ref={graphRef}
                graphData={filteredData}
                nodeThreeObject={nodeThreeObject}
                linkThreeObjectExtend={true}
                linkThreeObject={linkThreeObject}
                nodeLabel={(node: GraphNode) => `
                  <div style="background: rgba(15, 23, 42, 0.95); padding: 12px; border-radius: 8px; max-width: 280px; border: 1px solid rgba(100, 116, 139, 0.5);">
                    <div style="font-weight: 600; color: white; margin-bottom: 8px;">${node.name || node.label}</div>
                    <div style="color: #94a3b8; font-size: 12px;">
                      <div><span style="color: #64748b;">Type:</span> ${node.type}</div>
                      ${node.email ? `<div><span style="color: #64748b;">Email:</span> ${node.email}</div>` : ''}
                      ${node.team ? `<div><span style="color: #64748b;">Team:</span> ${node.team}</div>` : ''}
                      ${node.role ? `<div><span style="color: #64748b;">Role:</span> ${node.role}</div>` : ''}
                      ${node.status ? `<div><span style="color: #64748b;">Status:</span> ${node.status}</div>` : ''}
                      ${node.priority ? `<div><span style="color: #64748b;">Priority:</span> ${node.priority}</div>` : ''}
                    </div>
                  </div>
                `}
                linkColor={getLinkColor}
                linkWidth={getLinkWidth}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                linkOpacity={0.6}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                backgroundColor="#0f172a"
                showNavInfo={false}
              />

              {/* Selected Node Details Panel */}
              {selectedNode && (
                <div className="absolute top-4 right-4 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type?.toLowerCase()] || NODE_COLORS.default }} />
                      <h3 className="font-semibold text-white">{selectedNode.name || selectedNode.label}</h3>
                    </div>
                    <button 
                      onClick={handleBackgroundClick}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Type</span>
                      <p className="text-slate-200 capitalize">{selectedNode.type}</p>
                    </div>
                    {selectedNode.email && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Email</span>
                        <p className="text-slate-200">{selectedNode.email}</p>
                      </div>
                    )}
                    {selectedNode.team && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Team</span>
                        <p className="text-slate-200">{selectedNode.team}</p>
                      </div>
                    )}
                    {selectedNode.role && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Role</span>
                        <p className="text-slate-200">{selectedNode.role}</p>
                      </div>
                    )}
                    {selectedNode.department && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Department</span>
                        <p className="text-slate-200">{selectedNode.department}</p>
                      </div>
                    )}
                    {selectedNode.status && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Status</span>
                        <p className={`inline-block px-2 py-0.5 rounded text-sm ${
                          selectedNode.status === 'Done' ? 'bg-green-900/50 text-green-400' :
                          selectedNode.status === 'In Progress' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>{selectedNode.status}</p>
                      </div>
                    )}
                    {selectedNode.priority && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Priority</span>
                        <p className={`inline-block px-2 py-0.5 rounded text-sm ${
                          selectedNode.priority === 'Critical' || selectedNode.priority === 'Highest' 
                            ? 'bg-red-900/50 text-red-400' 
                            : 'bg-slate-700 text-slate-300'
                        }`}>{selectedNode.priority}</p>
                      </div>
                    )}
                    {selectedNode.hourly_rate && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Hourly Rate</span>
                        <p className="text-slate-200">${selectedNode.hourly_rate}/hr</p>
                      </div>
                    )}
                    
                    {/* Connection count */}
                    <div className="pt-3 border-t border-slate-700">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Connections</span>
                      <p className="text-slate-200">{highlightLinks.size} relationships</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Overlay */}
              <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-3">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-slate-400">Showing:</span>
                    <span className="text-white ml-2 font-medium">{filteredData.nodes.length} nodes</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Links:</span>
                    <span className="text-white ml-2 font-medium">{filteredData.links.length}</span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                Left-click: Select • Drag: Rotate • Scroll: Zoom • Right-drag: Pan
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* INSIGHTS VIEW */}
          {/* ============================================ */}
          {activeView === 'insights' && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Burnout Risk */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-700 bg-linear-to-r from-red-900/30 to-orange-900/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      🔥 Burnout Risk Detection
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Developers with high activity levels</p>
                  </div>
                  <div className="p-4">
                    {insights.burnoutRisk ? (
                      <>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          {[
                            { label: 'Critical', value: insights.burnoutRisk.summary.critical_risk, color: 'text-red-400' },
                            { label: 'High', value: insights.burnoutRisk.summary.high_risk, color: 'text-orange-400' },
                            { label: 'Medium', value: insights.burnoutRisk.summary.medium_risk, color: 'text-yellow-400' },
                            { label: 'Low', value: insights.burnoutRisk.summary.low_risk, color: 'text-green-400' }
                          ].map(item => (
                            <div key={item.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                              <div className="text-xs text-slate-500">{item.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {insights.burnoutRisk.developers.slice(0, 5).map((dev, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                              <div>
                                <span className="text-white">{dev.developer}</span>
                                <span className="text-slate-500 text-sm ml-2">({dev.commit_count} commits)</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                dev.risk_level === 'CRITICAL' ? 'bg-red-900/50 text-red-400' :
                                dev.risk_level === 'HIGH' ? 'bg-orange-900/50 text-orange-400' :
                                dev.risk_level === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                                'bg-green-900/50 text-green-400'
                              }`}>{dev.risk_level}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 text-center py-4">Loading...</p>
                    )}
                  </div>
                </div>

                {/* Knowledge Silos */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-700 bg-linear-to-r from-amber-900/30 to-yellow-900/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      🚧 Knowledge Silos
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Files modified by only one developer</p>
                  </div>
                  <div className="p-4">
                    {insights.silos ? (
                      <>
                        <div className="text-center mb-4">
                          <div className="text-4xl font-bold text-amber-400">{insights.silos.count}</div>
                          <div className="text-sm text-slate-500">Siloed Files Detected</div>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {insights.silos.silos.slice(0, 5).map((silo, i) => (
                            <div key={i} className="p-2 bg-slate-900/30 rounded-lg">
                              <div className="flex justify-between">
                                <span className="text-white font-mono text-sm truncate max-w-[200px]">{silo.filename}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  silo.risk_level === 'HIGH' ? 'bg-red-900/50 text-red-400' :
                                  silo.risk_level === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-400' :
                                  'bg-green-900/50 text-green-400'
                                }`}>{silo.risk_level}</span>
                              </div>
                              <div className="text-slate-500 text-xs mt-1">
                                Owner: {silo.sole_owner} • {silo.total_commits} commits
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 text-center py-4">Loading...</p>
                    )}
                  </div>
                </div>

                {/* Hidden Costs */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-700 bg-linear-to-r from-emerald-900/30 to-green-900/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      💰 Hidden Costs
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Estimated cost per ticket based on developer time</p>
                  </div>
                  <div className="p-4">
                    {insights.hiddenCosts ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-400">
                              ${insights.hiddenCosts.summary.total_tracked_cost.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">Total Tracked Cost</div>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-400">
                              ${Math.round(insights.hiddenCosts.summary.avg_cost_per_ticket).toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500">Avg Cost/Ticket</div>
                          </div>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {insights.hiddenCosts.tickets.slice(0, 4).map((ticket, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-slate-900/30 rounded-lg">
                              <div>
                                <span className="text-white font-mono">{ticket.ticket}</span>
                                <span className="text-slate-500 text-xs ml-2 truncate max-w-[150px] inline-block">{ticket.title}</span>
                              </div>
                              <span className="text-emerald-400 font-semibold">${Math.round(ticket.total_cost)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 text-center py-4">Loading...</p>
                    )}
                  </div>
                </div>

                {/* Velocity */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-700 bg-linear-to-r from-blue-900/30 to-indigo-900/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      🚀 Ticket Velocity
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Developer productivity by completed tickets</p>
                  </div>
                  <div className="p-4">
                    {insights.velocity ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {insights.velocity.developers.slice(0, 6).map((dev, i) => (
                          <div key={i} className="p-3 bg-slate-900/30 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-white">{dev.developer}</span>
                              <span className="text-blue-400 font-bold">{dev.total_points || 0} pts</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                              <span>{dev.completed_tickets} tickets completed</span>
                              <span>{dev.total_points && dev.completed_tickets ? 
                                Math.round(dev.total_points / dev.completed_tickets * 10) / 10 : 0} pts/ticket
                              </span>
                            </div>
                            <div className="mt-2 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full" 
                                style={{ width: `${Math.min((dev.total_points || 0) / 50 * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-4">Loading...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* STATUS VIEW */}
          {/* ============================================ */}
          {activeView === 'status' && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Connection Status */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`h-6 w-6 rounded-full ${
                      status?.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`} />
                    <div>
                      <h3 className="text-xl font-semibold text-white capitalize">{status?.status || 'Unknown'}</h3>
                      {status?.connection?.server && (
                        <p className="text-sm text-slate-400">{status.connection.server}</p>
                      )}
                    </div>
                  </div>
                  
                  {status?.stats && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{status.stats.nodeCount}</div>
                        <div className="text-sm text-slate-500">Total Nodes</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{status.stats.relCount}</div>
                        <div className="text-sm text-slate-500">Relationships</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-purple-400">{status.stats.labels?.Developer || 0}</div>
                        <div className="text-sm text-slate-500">Developers</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-amber-400">{status.stats.labels?.Commit || 0}</div>
                        <div className="text-sm text-slate-500">Commits</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features */}
                {status?.features && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Active Features</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {status.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                          <div className="h-2 w-2 rounded-full bg-green-400" />
                          <span className="text-slate-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Graph Architecture */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Graph Architecture</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Node Types</h4>
                      <ul className="space-y-2">
                        {Object.entries(NODE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
                          <li key={type} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-slate-300 capitalize">{type}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">Relationships</h4>
                      <ul className="space-y-2 text-sm text-slate-400">
                        <li>Developer → AUTHORED → Commit</li>
                        <li>Commit → LINKED_TO → Ticket</li>
                        <li>Commit → MODIFIED → File</li>
                        <li>Ticket → ASSIGNED_TO → Developer</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

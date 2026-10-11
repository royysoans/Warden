import React, { useState, useEffect } from 'react'
import AgentConfigForm from './components/AgentConfigForm'
import SuiteRunner from './components/SuiteRunner'
import TranscriptViewer from './components/TranscriptViewer'
import Scorecard from './components/Scorecard'
import RegressionChart from './components/RegressionChart'
import {
  ShieldAlert, PlayCircle, FileSearch, BarChart3, TrendingUp,
  Cpu, Sparkles, Layers, ChevronDown, RefreshCw, PlusCircle
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

const TABS = [
  { id: 'Register', label: '01. REGISTER', icon: Cpu, color: 'var(--neo-yellow)' },
  { id: 'Run Suite', label: '02. RUN SUITE', icon: PlayCircle, color: 'var(--neo-cyan)' },
  { id: 'Transcripts', label: '03. TRACES', icon: FileSearch, color: 'var(--neo-pink)' },
  { id: 'Scorecard', label: '04. SCORECARD', icon: BarChart3, color: 'var(--neo-purple)' },
  { id: 'Regression', label: '05. REGRESSION', icon: TrendingUp, color: 'var(--neo-lime)' },
]

export default function App() {
  const [tab, setTab] = useState('Register')
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [agentId, setAgentId] = useState(null)
  const [agentName, setAgentName] = useState(null)
  const [agentVersion, setAgentVersion] = useState(null)

  // Store all completed suite runs across prompt iterations for side-by-side comparison
  const [allSuiteRuns, setAllSuiteRuns] = useState([])
  const [activeRunId, setActiveRunId] = useState(null)

  // Fetch agents on initial mount and restore saved agent if present
  useEffect(() => {
    fetchAgents()
  }, [])

  async function fetchAgents(preferredAgentId = null) {
    setLoadingAgents(true)
    try {
      const res = await fetch(`${API}/agents`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const list = await res.json()
      setAgents(list)

      const targetId = preferredAgentId || localStorage.getItem('warden_active_agent_id')
      const targetAgent = list.find(a => a.id === targetId) || list[0]
      if (targetAgent) {
        await selectAgent(targetAgent, false)
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoadingAgents(false)
    }
  }

  async function selectAgent(agent, switchTab = false) {
    if (!agent) return
    setAgentId(agent.id)
    setAgentName(agent.name)
    setAgentVersion(agent.version_label || 'v1.0')
    localStorage.setItem('warden_active_agent_id', agent.id)

    if (switchTab) {
      setTab('Run Suite')
    }

    // Load full historical runs for this agent from SQLite
    try {
      const res = await fetch(`${API}/agents/${agent.id}/runs`)
      if (res.ok) {
        const runs = await res.json()
        setAllSuiteRuns(runs)
        if (runs.length > 0) {
          setActiveRunId(runs[0].runId)
        } else {
          setActiveRunId(null)
        }
      }
    } catch (err) {
      console.error(`Failed to fetch runs for agent ${agent.id}:`, err)
    }
  }

  async function handleAgentRegistered(id, name, versionLabel) {
    setAgentId(id)
    setAgentName(name)
    setAgentVersion(versionLabel || 'v1.0')
    localStorage.setItem('warden_active_agent_id', id)
    setAllSuiteRuns([])
    setActiveRunId(null)
    setTab('Run Suite')
    // Refresh agents list and select newly created agent
    await fetchAgents(id)
  }

  function handleRunCompleted(runId, scorecard, newScenarios, newVerdicts, newTraces, meta = {}) {
    const runEntry = {
      runId,
      agentId: meta.agentId || agentId,
      agentName: meta.agentName || agentName || 'SupportBot',
      versionLabel: meta.versionLabel || agentVersion || `v${allSuiteRuns.length + 1}.0`,
      scorecard,
      scenarios: newScenarios || [],
      verdicts: newVerdicts || [],
      traces: newTraces || {},
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }

    setAllSuiteRuns(prev => {
      const filtered = prev.filter(r => r.runId !== runId)
      return [runEntry, ...filtered]
    })
    setActiveRunId(runId)
  }

  // Only runs with a scorecard and at least one scenario are shown in tabs 3-5
  const completedSuiteRuns = allSuiteRuns.filter(
    r => r.scorecard != null && (r.scenarios?.length ?? 0) > 0
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Main Header */}
      <header style={styles.header}>
        <div style={styles.logoGroup}>
          <div style={styles.logoBadge}>
            <ShieldAlert size={26} strokeWidth={2.5} />
          </div>
          <div>
            <div style={styles.logoTitle}>WARDEN</div>
            <div style={styles.logoSubtitle}>CONTINUOUS INTEGRATION FOR AUTONOMOUS AGENTS</div>
          </div>
        </div>

        <div style={styles.statusGroup}>
          <div className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#111827' }}>
            <span className="pulse-dot"></span> PIPELINE ACTIVE
          </div>

          {/* Interactive Agent Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative' }}>
              <select
                aria-label="Select Target Agent"
                value={agentId || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__new__') {
                    setTab('Register')
                  } else {
                    const found = agents.find(a => a.id === val)
                    if (found) selectAgent(found)
                  }
                }}
                style={styles.agentSelect}
              >
                {agents.length === 0 ? (
                  <option value="">{loadingAgents ? 'Loading agents...' : 'No agents registered'}</option>
                ) : (
                  agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.version_label || 'v1.0'})
                    </option>
                  ))
                )}
                <option value="__new__">+ Register New Agent...</option>
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: '#111827',
                  strokeWidth: 3,
                }}
              />
            </div>

            <button
              title="Refresh Agents List"
              onClick={() => fetchAgents(agentId)}
              className="neo-btn"
              style={styles.iconBtn}
            >
              <RefreshCw size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={styles.container}>
        {/* Navigation Tabs */}
        <nav style={styles.tabNav}>
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  ...styles.tabBtn,
                  background: isActive ? t.color : 'var(--neo-card-bg)',
                  color: '#111827',
                  boxShadow: isActive ? '3px 3px 0px #111827' : '2px 2px 0px #111827',
                  transform: isActive ? 'translate(-1px, -1px)' : 'none',
                  fontWeight: isActive ? 800 : 700,
                  borderColor: '#111827',
                }}
              >
                <Icon size={18} strokeWidth={2.4} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Active Agent & Suite History Bar */}
        {agentId && (
          <div className="neo-box" style={styles.agentBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'var(--neo-cyan)', color: '#111827', padding: 6, border: '2px solid #111827', borderRadius: 6 }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4b5563' }}>ACTIVE TARGET AGENT & VERSION</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{agentName}</span>
                  <span className="neo-badge" style={{ background: 'var(--neo-yellow)' }}>{agentVersion || 'v1.0'}</span>
                  <code style={{ fontSize: 11, background: '#f3eae0', padding: '2px 6px', border: '1.5px solid #111827', borderRadius: 4 }}>ID: {agentId.slice(0, 8)}</code>
                </div>
              </div>
            </div>

            {/* Completed Runs History Counter & Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                HISTORICAL RUNS: <span className="neo-badge" style={{ background: allSuiteRuns.length > 0 ? 'var(--neo-lime)' : '#e5e7eb', color: '#111827' }}>{allSuiteRuns.length} RUNS</span>
              </div>
              {allSuiteRuns.length > 0 && (
                <button
                  onClick={() => setTab('Scorecard')}
                  className="neo-btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    background: 'var(--neo-purple)',
                    color: '#ffffff',
                    border: '2px solid #111827',
                    borderRadius: 4,
                    boxShadow: '2px 2px 0px #111827',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  Latest Scorecard: {allSuiteRuns[0]?.scorecard?.safety_score != null ? `${allSuiteRuns[0].scorecard.safety_score.toFixed(0)}%` : 'N/A'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Contents - Persistent Mounting */}
        <main style={{ marginTop: 20 }}>
          <div style={{ display: tab === 'Register' ? 'block' : 'none' }}>
            <AgentConfigForm
              onAgentRegistered={handleAgentRegistered}
              agents={agents}
              onSelectAgent={(ag) => selectAgent(ag, true)}
              activeAgentId={agentId}
            />
          </div>

          <div style={{ display: tab === 'Run Suite' ? 'block' : 'none' }}>
            <SuiteRunner
              agentId={agentId}
              agentName={agentName}
              agentVersion={agentVersion}
              onRunCompleted={handleRunCompleted}
            />
          </div>

          <div style={{ display: tab === 'Transcripts' ? 'block' : 'none' }}>
            <TranscriptViewer
              allSuiteRuns={completedSuiteRuns}
              activeRunId={activeRunId}
              setActiveRunId={setActiveRunId}
            />
          </div>

          <div style={{ display: tab === 'Scorecard' ? 'block' : 'none' }}>
            <Scorecard
              allSuiteRuns={completedSuiteRuns}
              activeRunId={activeRunId}
              setActiveRunId={setActiveRunId}
            />
          </div>

          <div style={{ display: tab === 'Regression' ? 'block' : 'none' }}>
            <RegressionChart
              agentId={agentId}
              allSuiteRuns={completedSuiteRuns}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

const styles = {
  header: {
    background: 'var(--neo-card-bg)',
    borderBottom: '2.5px solid #111827',
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    boxShadow: '0 3px 0px rgba(17, 24, 39, 0.08)',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logoBadge: {
    background: 'var(--neo-pink)',
    color: '#111827',
    padding: 8,
    border: '2px solid #111827',
    borderRadius: 6,
    boxShadow: '2.5px 2.5px 0px #111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 26,
    fontFamily: 'var(--font-heading)',
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    color: '#111827',
  },
  logoSubtitle: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: '#6b7280',
    marginTop: 4,
  },
  statusGroup: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  agentSelect: {
    padding: '7px 30px 7px 12px',
    background: 'var(--neo-pink)',
    color: '#111827',
    border: '2px solid #111827',
    borderRadius: 6,
    boxShadow: '2.5px 2.5px 0px #111827',
    fontFamily: 'var(--font-heading)',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    appearance: 'none',
    outline: 'none',
    maxWidth: 260,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    padding: '7px 9px',
    background: '#ffffff',
    border: '2px solid #111827',
    borderRadius: 6,
    boxShadow: '2px 2px 0px #111827',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    maxWidth: 1120,
    margin: '24px auto',
    padding: '0 20px',
  },
  tabNav: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    minWidth: 160,
    padding: '11px 16px',
    border: '2px solid #111827',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-heading)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    userSelect: 'none',
    transition: 'all 0.1s ease-in-out',
  },
  agentBar: {
    padding: '12px 20px',
    background: 'var(--neo-card-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
}


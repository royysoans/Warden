import React, { useState } from 'react'
import AgentConfigForm from './components/AgentConfigForm'
import SuiteRunner from './components/SuiteRunner'
import TranscriptViewer from './components/TranscriptViewer'
import Scorecard from './components/Scorecard'
import RegressionChart from './components/RegressionChart'
import { ShieldAlert, PlayCircle, FileSearch, BarChart3, TrendingUp, Cpu, Sparkles, Layers } from 'lucide-react'

const TABS = [
  { id: 'Register', label: '01. REGISTER', icon: Cpu, color: 'var(--neo-yellow)' },
  { id: 'Run Suite', label: '02. RUN SUITE', icon: PlayCircle, color: 'var(--neo-cyan)' },
  { id: 'Transcripts', label: '03. TRACES', icon: FileSearch, color: 'var(--neo-pink)' },
  { id: 'Scorecard', label: '04. SCORECARD', icon: BarChart3, color: 'var(--neo-purple)' },
  { id: 'Regression', label: '05. REGRESSION', icon: TrendingUp, color: 'var(--neo-lime)' },
]

export default function App() {
  const [tab, setTab] = useState('Register')
  const [agentId, setAgentId] = useState(null)
  const [agentName, setAgentName] = useState(null)
  const [agentVersion, setAgentVersion] = useState(null)

  // Store all completed suite runs across prompt iterations for side-by-side comparison
  const [allSuiteRuns, setAllSuiteRuns] = useState([])
  const [activeRunId, setActiveRunId] = useState(null)

  function handleAgentRegistered(id, name, versionLabel) {
    setAgentId(id)
    setAgentName(name)
    setAgentVersion(versionLabel || 'v1.0')
    setTab('Run Suite')
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
      // Replace if existing, else prepend new run
      const filtered = prev.filter(r => r.runId !== runId)
      return [runEntry, ...filtered]
    })
    setActiveRunId(runId)
  }

  // Active run data for Traces and Scorecard
  const activeRun = allSuiteRuns.find(r => r.runId === activeRunId) || allSuiteRuns[0] || null

  // Only fully-completed runs (scorecard present + all 8 scenarios evaluated) are
  // shown in tabs 3-5. Mid-run partial snapshots are excluded so downstream
  // components never show incomplete data or N/A safety scores.
  const completedSuiteRuns = allSuiteRuns.filter(
    r => r.scorecard != null && (r.scenarios?.length ?? 0) >= 8
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
          {agentId ? (
            <div className="neo-badge" style={{ background: 'var(--neo-pink)', color: '#111827' }}>
              AGENT: <span style={{ fontFamily: 'var(--font-mono)' }}>{agentName || 'SupportBot'}</span> ({agentId.slice(0, 6)}…)
            </div>
          ) : (
            <div className="neo-badge" style={{ background: '#f3f4f6', color: '#6b7280', border: '1.5px solid #111827' }}>
              NO AGENT LOADED
            </div>
          )}
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
                <div style={{ fontSize: 12, fontWeight: 800, color: '#4b5563' }}>ACTIVE TARGET AGENT & VERSION</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  {agentName} <span className="neo-badge" style={{ background: 'var(--neo-yellow)', marginLeft: 6 }}>{agentVersion || 'v1.0'}</span> <code style={{ fontSize: 12, background: '#f3eae0', padding: '2px 6px', border: '1.5px solid #111827', borderRadius: 4 }}>ID: {agentId.slice(0, 8)}</code>
                </div>
              </div>
            </div>

            {/* Completed Runs History Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                SUITE RUNS SAVED: <span className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#111827' }}>{allSuiteRuns.length} RUNS</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Contents - Persistent Mounting */}
        <main style={{ marginTop: 20 }}>
          <div style={{ display: tab === 'Register' ? 'block' : 'none' }}>
            <AgentConfigForm onAgentRegistered={handleAgentRegistered} />
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
    gap: 10,
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

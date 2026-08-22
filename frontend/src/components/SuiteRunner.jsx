import React, { useState, useEffect, useRef } from 'react'
import { PlayCircle, StopCircle, CheckCircle2, XCircle, Loader2, ShieldAlert, AlertTriangle, Layers, Terminal, Activity, HelpCircle } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'
const POLL_INTERVAL_MS = 2000

export default function SuiteRunner({ agentId, agentName, agentVersion, onRunCompleted }) {
  const [suiteRunId, setSuiteRunId] = useState(null)
  const [status, setStatus] = useState(null)
  const [scenarios, setScenarios] = useState([])
  const [verdicts, setVerdicts] = useState([])
  const [traces, setTraces] = useState({})
  const [scorecard, setScorecard] = useState(null)
  const [error, setError] = useState(null)
  const [triggering, setTriggering] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [activityLogs, setActivityLogs] = useState([])
  const intervalRef = useRef(null)
  // Tracks the last-seen scenario/verdict counts so the activity log only fires
  // on genuinely new items. A plain closure over `scenarios`/`verdicts` would be
  // stale inside the polling interval (it captures the values from the render
  // that started polling — empty arrays), so we use a ref every poll updates.
  const lastCountsRef = useRef({ scenarios: 0, verdicts: 0 })

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  const prevAgentIdRef = useRef(agentId)
  useEffect(() => {
    if (prevAgentIdRef.current !== agentId) {
      prevAgentIdRef.current = agentId
      stopPolling()
      setSuiteRunId(null)
      setStatus(null)
      setScenarios([])
      setVerdicts([])
      setTraces({})
      setScorecard(null)
      setError(null)
      setActivityLogs([])
      lastCountsRef.current = { scenarios: 0, verdicts: 0 }
    }
  }, [agentId])

  function addLog(msg) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setActivityLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 19)])
  }

  async function triggerRun() {
    if (!agentId) {
      setError('No agent registered yet. Please register an agent in step 01 first.')
      return
    }
    setError(null)
    setScenarios([])
    setVerdicts([])
    setScorecard(null)
    setStatus(null)
    setTriggering(true)
    setActivityLogs([])
    lastCountsRef.current = { scenarios: 0, verdicts: 0 }

    addLog('Initializing suite evaluation pipeline...')
    addLog(`Registering run request for Agent ID: ${agentId.slice(0, 8)}...`)

    try {
      const res = await fetch(`${API}/suites/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSuiteRunId(data.suite_run_id)
      setStatus('pending')
      addLog(`Suite run queued! Run ID: ${data.suite_run_id}`)
      addLog('Capability Mapper running tool risk classification...')

      // Start polling interval
      intervalRef.current = setInterval(() => poll(data.suite_run_id), POLL_INTERVAL_MS)
    } catch (err) {
      const hint = err.message.includes('Failed to fetch') || err.message.includes('NetworkError')
        ? `${err.message} — The backend may be waking up from sleep (Render free tier). Wait 30–60 seconds and try again.`
        : err.message
      setError(hint)
      addLog(`Trigger failed: ${err.message}`)
    } finally {
      setTriggering(false)
    }
  }

  async function cancelRun() {
    if (!suiteRunId || cancelling) return
    setCancelling(true)
    addLog('Sending termination request to pipeline...')
    try {
      const res = await fetch(`${API}/suites/${suiteRunId}/cancel`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      stopPolling()
      setStatus('cancelled')
      addLog('Suite run successfully terminated by user.')
    } catch (err) {
      setError(`Failed to cancel run: ${err.message}`)
      addLog(`Cancel request error: ${err.message}`)
    } finally {
      setCancelling(false)
    }
  }

  async function poll(runId) {
    try {
      const res = await fetch(`${API}/suites/${runId}/results`)
      if (!res.ok) return
      const data = await res.json()
      
      setStatus(data.status)

      const newScenarios = data.scenarios || []
      const newVerdicts = data.verdicts || []
      const newTraces = data.traces || {}

      // Compare against last-seen counts (a ref, not stale closure state)
      const { scenarios: prevScenarioCount, verdicts: prevVerdictCount } = lastCountsRef.current

      if (newScenarios.length > prevScenarioCount) {
        addLog(`Generated & executing ${newScenarios.length} evaluation scenarios...`)
      }
      // Log each newly-arrived verdict (more than one can land between polls)
      for (let idx = prevVerdictCount; idx < newVerdicts.length; idx++) {
        const v = newVerdicts[idx]
        const s = newScenarios.find(sc => sc.id === v.scenario_id)
        const sMsg = s ? `"${s.user_message.slice(0, 35)}..."` : `Scenario #${idx + 1}`
        if (v.acted_safely) {
          addLog(`Evaluated ${sMsg} -> SAFE`)
        } else {
          const flagNames = v.flags?.map(f => f.category).join(', ') || 'UNSAFE'
          addLog(`Evaluated ${sMsg} -> FLAG: [${flagNames}]`)
        }
      }

      lastCountsRef.current = { scenarios: newScenarios.length, verdicts: newVerdicts.length }

      setScenarios(newScenarios)
      setVerdicts(newVerdicts)
      setTraces(newTraces)
      setScorecard(data.scorecard || null)

      // Notify parent App on poll update so Steps 03, 04, 05 update in real-time
      if (onRunCompleted) {
        onRunCompleted(runId, data.scorecard, newScenarios, newVerdicts, newTraces, { agentId, agentName, versionLabel: agentVersion })
      }

      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        stopPolling()
        if (data.status === 'completed') {
          addLog('Suite execution completed! Scorecard generated.')
        } else if (data.status === 'failed') {
          addLog('Pipeline reported failure status.')
          setError(data.scorecard?.error || 'Suite run failed during execution.')
        } else if (data.status === 'cancelled') {
          addLog('Pipeline run stopped: CANCELLED.')
        }
      }
    } catch (err) {
      // silent poll fail
    }
  }

  const verdictMap = {}
  verdicts.forEach(v => { verdictMap[v.scenario_id] = v })

  const totalScenarios = scenarios.length
  const completedCount = verdicts.length
  const safeCount = verdicts.filter(v => v.acted_safely).length
  const unsafeCount = verdicts.filter(v => !v.acted_safely).length
  const targetTotal = Math.max(totalScenarios, 8)
  const progressPercent = targetTotal > 0 ? Math.min(100, Math.round((completedCount / targetTotal) * 100)) : 0

  // Currently active scenario being evaluated
  const currentEvaluatingScenario = scenarios.find(s => !verdictMap[s.id])

  const filteredScenarios = scenarios.filter(s => {
    if (filterCategory === 'ALL') return true
    if (filterCategory === 'FAILED') return verdictMap[s.id] && !verdictMap[s.id].acted_safely
    if (filterCategory === 'SAFE') return verdictMap[s.id] && verdictMap[s.id].acted_safely
    return s.category === filterCategory
  })

  const isRunning = status === 'running' || status === 'pending'

  return (
    <div className="neo-box-lg" style={{ background: '#ffffff', padding: 28 }}>
      {/* Header Banner */}
      <div style={styles.headerBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconSquare}>
            <PlayCircle size={26} color="#000" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, color: '#000' }}>SUITE RUNNER & ADAPTIVE HARNESS</h2>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#4b5563' }}>
              INTERACTIVE TEST SUITE RUNNER WITH REAL-TIME TELEMETRY & TERMINATION CONTROL
            </p>
          </div>
        </div>
        <div className="neo-badge" style={{ background: 'var(--neo-cyan)' }}>
          STEP 2 / 5
        </div>
      </div>

      {!agentId && (
        <div style={styles.warningBox}>
          <AlertTriangle size={20} /> REGISTER AN AGENT IN STEP 01 TO ENABLE SUITE EXECUTION.
        </div>
      )}

      {/* Main Controls & Trigger / Cancel Buttons */}
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="neo-btn neo-btn-cyan"
            onClick={triggerRun}
            disabled={!agentId || triggering || isRunning}
            style={{ fontSize: 18, padding: '16px 28px' }}
          >
            {isRunning || triggering ? (
              <>
                <Loader2 className="spin" size={24} style={{ display: 'inline-block' }} /> RUNNING SUITE...
              </>
            ) : (
              <>
                <PlayCircle size={24} /> LAUNCH SUITE EVALUATION RUN
              </>
            )}
          </button>

          {/* Terminate Run Button */}
          {isRunning && (
            <button
              className="neo-btn neo-btn-pink"
              onClick={cancelRun}
              disabled={cancelling}
              style={{ fontSize: 16, padding: '14px 22px' }}
            >
              {cancelling ? (
                <>
                  <Loader2 className="spin" size={20} /> TERMINATING...
                </>
              ) : (
                <>
                  <StopCircle size={22} /> TERMINATE RUN
                </>
              )}
            </button>
          )}
        </div>

        {status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="neo-badge" style={{ background: getStatusBg(status), color: status === 'failed' || status === 'cancelled' ? '#fff' : '#000', fontSize: 14, padding: '8px 16px' }}>
              {isRunning && <Loader2 className="spin" size={16} style={{ display: 'inline-block', marginRight: 6 }} />}
              STATUS: {status.toUpperCase()}
            </span>
            {suiteRunId && (
              <span className="neo-badge" style={{ background: '#f3f4f6', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                ID: {suiteRunId.slice(0, 8)}...
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorBox}>
          <XCircle size={20} /> {error}
        </div>
      )}

      {/* Interactive Progress Meter Bar */}
      {isRunning && (
        <div style={{ marginTop: 24, padding: 18, background: '#fafafa', border: '3px solid #000', boxShadow: '4px 4px 0px #000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="var(--neo-pink)" />
              LIVE EVALUATION PROGRESS ({completedCount} / {targetTotal} SCENARIOS COMPLETED)
            </div>
            <span className="neo-badge" style={{ background: 'var(--neo-yellow)' }}>
              {progressPercent}% COMPLETE
            </span>
          </div>

          {/* Progress Bar Container */}
          <div style={{ height: 22, width: '100%', background: '#e5e7eb', border: '2px solid #000', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPercent || 5}%`,
                background: 'var(--neo-cyan)',
                borderRight: '2px solid #000',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>

          {/* Currently Evaluated Scenario Banner */}
          {currentEvaluatingScenario && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--neo-yellow)', border: '2px solid #000', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <HelpCircle size={18} />
              <span>CURRENTLY EVALUATING SCENARIO #{completedCount + 1}: <code style={{ fontFamily: 'var(--font-mono)' }}>"{currentEvaluatingScenario.user_message}"</code></span>
            </div>
          )}
        </div>
      )}

      {/* Real-time Telemetry Grid & Activity Console */}
      {status && (
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {/* Telemetry Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="neo-box" style={{ background: 'var(--neo-yellow)', padding: 16 }}>
              <div style={styles.cardStatLabel}>TOTAL SCENARIOS</div>
              <div style={styles.cardStatVal}>{scenarios.length}</div>
            </div>
            <div className="neo-box" style={{ background: 'var(--neo-lime)', padding: 16 }}>
              <div style={styles.cardStatLabel}>SAFE RUNS</div>
              <div style={styles.cardStatVal}>{safeCount}</div>
            </div>
            <div className="neo-box" style={{ background: 'var(--neo-orange)', padding: 16 }}>
              <div style={styles.cardStatLabel}>UNSAFE FLAGS</div>
              <div style={styles.cardStatVal}>{unsafeCount}</div>
            </div>
            <div className="neo-box" style={{ background: 'var(--neo-pink)', padding: 16, color: '#fff' }}>
              <div style={{ ...styles.cardStatLabel, color: '#fff' }}>SAFETY SCORE</div>
              <div style={{ ...styles.cardStatVal, color: '#fff' }}>
                {scorecard ? `${scorecard.safety_score.toFixed(1)}%` : isRunning ? 'EVALUATING...' : 'N/A'}
              </div>
            </div>
          </div>

          {/* Activity Console Log */}
          <div className="neo-box" style={{ background: '#000000', color: '#ffffff', padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--neo-lime)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={14} /> LIVE HARNESS ACTIVITY LOG
            </div>
            <div style={{ flex: 1, maxHeight: 130, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activityLogs.length > 0 ? (
                activityLogs.map((log, i) => (
                  <div key={i} style={{ color: log.includes('FLAG') || log.includes('failed') ? 'var(--neo-pink)' : log.includes('SAFE') || log.includes('completed') ? 'var(--neo-lime)' : '#e5e7eb' }}>
                    {log}
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280' }}>Waiting for harness initialization...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scenario Category Filters & Live Scenario Matrix */}
      {scenarios.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={18} /> GENERATED TEST SCENARIOS ({filteredScenarios.length} / {scenarios.length})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ALL', 'adversarial_injection', 'realistic', 'edge_case', 'goal_drift', 'FAILED'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  style={{
                    ...styles.filterTabBtn,
                    background: filterCategory === cat ? '#000000' : '#ffffff',
                    color: filterCategory === cat ? '#ffffff' : '#000000',
                  }}
                >
                  {cat.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario Cards Grid */}
          <div style={styles.scenarioGrid}>
            {filteredScenarios.map(s => {
              const v = verdictMap[s.id]
              return (
                <div key={s.id} className="neo-box" style={styles.scenarioCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span className="neo-badge" style={{ background: getCategoryBg(s.category), color: s.category === 'adversarial_injection' ? '#fff' : '#000' }}>
                      {s.category.replace('_', ' ').toUpperCase()}
                    </span>
                    {v ? (
                      <span className="neo-badge" style={{ background: v.acted_safely ? 'var(--neo-lime)' : 'var(--neo-pink)', color: v.acted_safely ? '#000' : '#fff' }}>
                        {v.acted_safely ? 'SAFE' : 'UNSAFE'}
                      </span>
                    ) : (
                      <span className="neo-badge" style={{ background: 'var(--neo-yellow)' }}>
                        <Loader2 className="spin" size={10} style={{ display: 'inline-block', marginRight: 4 }} /> EVALUATING...
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#000', marginBottom: 8, lineHeight: 1.4 }}>
                    "{s.user_message}"
                  </div>

                  {s.injected_tool_content && (
                    <div style={{ background: '#fef2f2', border: '2px solid #ef4444', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                      INJECTED: {s.injected_tool_content}
                    </div>
                  )}

                  {v && v.flags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {v.flags.map((f, idx) => (
                        <span key={idx} style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: '#fee2e2', color: '#991b1b', border: '1px solid #000' }}>
                          FLAG: {f.category.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusBg(status) {
  return { pending: 'var(--neo-yellow)', running: 'var(--neo-cyan)', completed: 'var(--neo-lime)', failed: 'var(--neo-pink)', cancelled: 'var(--neo-orange)' }[status] || '#e5e7eb'
}

function getCategoryBg(cat) {
  return { realistic: 'var(--neo-cyan)', edge_case: 'var(--neo-yellow)', adversarial_injection: 'var(--neo-pink)', goal_drift: 'var(--neo-purple)' }[cat] || '#e5e7eb'
}

const styles = {
  headerBox: {
    background: 'var(--neo-cyan)',
    border: '3px solid #000',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    boxShadow: '4px 4px 0px #000',
  },
  iconSquare: {
    background: '#ffffff',
    border: '3px solid #000',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    marginTop: 16,
    background: 'var(--neo-yellow)',
    border: '3px solid #000',
    boxShadow: '4px 4px 0px #000',
    padding: '12px 16px',
    fontWeight: 800,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  errorBox: {
    marginTop: 16,
    background: 'var(--neo-pink)',
    color: '#ffffff',
    border: '3px solid #000',
    boxShadow: '4px 4px 0px #000',
    padding: '12px 16px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  cardStatLabel: {
    fontSize: 11,
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    color: '#000',
    letterSpacing: '0.05em',
  },
  cardStatVal: {
    fontSize: 32,
    fontFamily: 'var(--font-heading)',
    fontWeight: 900,
    color: '#000',
    marginTop: 4,
  },
  filterTabBtn: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    fontSize: 10,
    padding: '4px 10px',
    border: '2px solid #000',
    boxShadow: '2px 2px 0px #000',
    cursor: 'pointer',
  },
  scenarioGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
    marginTop: 12,
    maxHeight: 460,
    overflowY: 'auto',
    paddingRight: 6,
  },
  scenarioCard: {
    padding: 16,
    background: '#ffffff',
    border: '3px solid #000',
    boxShadow: '3px 3px 0px #000',
  },
}

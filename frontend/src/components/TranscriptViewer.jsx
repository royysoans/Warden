import React, { useState } from 'react'
import { FileSearch, AlertTriangle, ShieldCheck, ShieldAlert, CornerDownRight, Terminal, Info, Layers, CheckCircle2 } from 'lucide-react'

const FLAG_STYLE = {
  unsafe_destructive_action: { bg: 'var(--neo-pink)', color: '#ffffff', icon: ShieldAlert, border: '#000' },
  injection_compliance:       { bg: 'var(--neo-orange)', color: '#ffffff', icon: AlertTriangle, border: '#000' },
  goal_drift:                 { bg: 'var(--neo-yellow)', color: '#000000', icon: AlertTriangle, border: '#000' },
  hallucinated_success:       { bg: '#374151', color: '#ffffff', icon: Info, border: '#000' },
  tool_call_loop:             { bg: '#374151', color: '#ffffff', icon: Info, border: '#000' },
}

export default function TranscriptViewer({ scenarios: legacyScenarios, verdicts: legacyVerdicts, traces: legacyTraces = {}, allSuiteRuns = [], activeRunId, setActiveRunId }) {
  const [selectedId, setSelectedId] = useState(null)

  // Resolve current active suite run from allSuiteRuns array
  const activeRun = (allSuiteRuns && allSuiteRuns.find(r => r.runId === activeRunId)) || (allSuiteRuns && allSuiteRuns[0]) || null

  const scenarios = activeRun ? activeRun.scenarios : (legacyScenarios || [])
  const verdicts = activeRun ? activeRun.verdicts : (legacyVerdicts || [])
  const traces = activeRun ? (activeRun.traces || {}) : (legacyTraces || {})

  const verdictMap = {}
  ;(verdicts || []).forEach(v => { verdictMap[v.scenario_id] = v })

  const activeScenarios = scenarios || []
  const effectiveSelectedId = selectedId || (activeScenarios.length > 0 ? activeScenarios[0].id : null)

  const selectedScenario = activeScenarios.find(s => s.id === effectiveSelectedId)
  const selectedVerdict = effectiveSelectedId ? verdictMap[effectiveSelectedId] : null

  return (
    <div className="neo-box-lg" style={{ background: '#ffffff', padding: 28 }}>
      {/* Header Banner */}
      <div style={styles.headerBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconSquare}>
            <FileSearch size={26} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, color: '#ffffff' }}>TRACES & FAILURE MODE INSPECTOR</h2>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neo-pink)' }}>
              LAYER A STRUCTURAL EVIDENCE & LAYER B SEMANTIC JUSTIFICATION AUDITOR
            </p>
          </div>
        </div>
        <div className="neo-badge" style={{ background: 'var(--neo-yellow)', color: '#000' }}>
          STEP 3 / 5
        </div>
      </div>

      {/* Multi-Suite Run Selector Bar */}
      {allSuiteRuns && allSuiteRuns.length > 0 && (
        <div className="neo-box" style={{ background: '#fafafa', padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--neo-pink)" />
            <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>SELECT SUITE RUN TO INSPECT TRACES:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allSuiteRuns.map((run, idx) => {
              const isCurrent = (activeRunId === run.runId) || (!activeRunId && idx === 0)
              const safety = run.scorecard?.safety_score
              return (
                <button
                  key={run.runId}
                  onClick={() => { setActiveRunId(run.runId); setSelectedId(null); }}
                  className="neo-btn"
                  style={{
                    background: isCurrent ? 'var(--neo-pink)' : '#ffffff',
                    color: isCurrent ? '#ffffff' : '#000000',
                    fontSize: 11,
                    padding: '6px 12px',
                    boxShadow: isCurrent ? '3px 3px 0px #000' : '2px 2px 0px #000',
                  }}
                >
                  Suite #{allSuiteRuns.length - idx} ({run.versionLabel || 'v1.0'}) — Safety: {safety != null ? `${safety.toFixed(0)}%` : 'N/A'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!activeScenarios.length && (
        <div style={styles.emptyState}>
          <FileSearch size={48} strokeWidth={1.5} color="#9ca3af" />
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>NO SUITE RUN TRACES AVAILABLE YET</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            GO TO STEP 02 "RUN SUITE" AND LAUNCH AN EVALUATION RUN TO INSPECT SCENARIOS & TRACES HERE.
          </div>
        </div>
      )}

      {activeScenarios.length > 0 && (
        <div style={styles.splitLayout}>
          {/* Left Pane: Scenario Selector List */}
          <div style={styles.leftPane}>
            <div style={styles.paneTitle}>
              SCENARIOS IN SUITE ({activeScenarios.length})
            </div>
            <div style={styles.scrollList}>
              {activeScenarios.map(s => {
                const v = verdictMap[s.id]
                const isSelected = s.id === effectiveSelectedId
                const hasFlags = v?.flags?.length > 0
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      ...styles.scenarioListItem,
                      background: isSelected ? 'var(--neo-yellow)' : '#ffffff',
                      borderLeft: `6px solid ${hasFlags ? 'var(--neo-pink)' : 'var(--neo-lime)'}`,
                      boxShadow: isSelected ? '4px 4px 0px #000' : '2px 2px 0px #000',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="neo-badge" style={{ background: getCategoryBg(s.category), fontSize: 9 }}>
                        {s.category.replace('_', ' ').toUpperCase()}
                      </span>
                      {v && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: v.acted_safely ? 'var(--neo-green)' : 'var(--neo-pink)' }}>
                          {v.acted_safely ? '✓ SAFE' : '⚠ UNSAFE'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{s.user_message}"
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Pane: Selected Scenario Trace Detail */}
          <div style={styles.rightPane}>
            {selectedScenario && (
              <div>
                {/* Scenario Header Info Card */}
                <div className="neo-box" style={{ padding: 18, background: '#fafafa', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="neo-badge" style={{ background: getCategoryBg(selectedScenario.category) }}>
                      {selectedScenario.category.replace('_', ' ').toUpperCase()} SCENARIO
                    </span>
                    {selectedVerdict && (
                      <span className="neo-badge" style={{
                        background: selectedVerdict.acted_safely ? 'var(--neo-lime)' : 'var(--neo-pink)',
                        color: selectedVerdict.acted_safely ? '#000' : '#fff'
                      }}>
                        {selectedVerdict.acted_safely ? '✓ ACTED SAFELY' : '⚠ SAFETY FLAGS RAISED'}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
                    User Prompt: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>"{selectedScenario.user_message}"</span>
                  </div>

                  {selectedScenario.injected_tool_content && (
                    <div className="neo-box" style={{ background: '#fff7ed', borderLeft: '4px solid var(--neo-orange)', padding: 10, marginTop: 10, fontSize: 12 }}>
                      <div style={{ fontWeight: 800, color: 'var(--neo-orange)', marginBottom: 2 }}>⚡ INJECTED TOOL PAYLOAD:</div>
                      <code style={{ fontSize: 11 }}>{selectedScenario.injected_tool_content}</code>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, fontSize: 11 }}>
                    <div>
                      <strong>Expected Outcome:</strong> {selectedScenario.expected_outcome}
                    </div>
                    <div>
                      <strong>Expected Safe Behavior:</strong> {selectedScenario.expected_safe_behavior}
                    </div>
                  </div>
                </div>

                {/* Evaluation Verdict & Failure Flags Section */}
                {selectedVerdict && (
                  <div className="neo-box" style={{ padding: 16, background: '#ffffff', marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>
                      EVALUATION VERDICT & FAILURE FLAGS
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span className="neo-badge" style={{
                        background: selectedVerdict.task_completed ? 'var(--neo-lime)' : 'var(--neo-orange)',
                        color: '#000',
                      }}>
                        {selectedVerdict.task_completed ? '✓ TASK COMPLETED' : '✗ TASK INCOMPLETE'}
                      </span>
                      <span className="neo-badge" style={{
                        background: selectedVerdict.acted_safely ? 'var(--neo-lime)' : 'var(--neo-pink)',
                        color: selectedVerdict.acted_safely ? '#000' : '#fff',
                      }}>
                        {selectedVerdict.acted_safely ? '✓ ACTED SAFELY' : '⚠ SAFETY FLAGS RAISED'}
                      </span>
                    </div>

                    {!selectedVerdict.flags?.length ? (
                      <div className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#000', padding: '8px 12px' }}>
                        <ShieldCheck size={16} /> ZERO FAILURE FLAGS RAISED — AGENT COMPLIED WITH ALL SAFETY CONSTRAINTS
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedVerdict.flags.map((flag, idx) => {
                          const conf = FLAG_STYLE[flag.category] || FLAG_STYLE.unsafe_destructive_action
                          const Icon = conf.icon
                          return (
                            <div
                              key={idx}
                              className="neo-box"
                              style={{
                                background: conf.bg,
                                color: conf.color,
                                padding: 12,
                                border: '2px solid #000',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12 }}>
                                <Icon size={16} />
                                <span>{flag.category.replace(/_/g, ' ').toUpperCase()}</span>
                                {flag.tool_involved && (
                                  <span className="neo-badge" style={{ background: '#000', color: '#fff', fontSize: 10 }}>
                                    TOOL: {flag.tool_involved}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, marginTop: 6, opacity: 0.95, fontFamily: 'var(--font-mono)' }}>
                                {flag.evidence}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Conversation Turns Section */}
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 10 }}>
                  AGENT CONVERSATION TRACE
                </div>

                {(() => {
                  const traceData = traces[effectiveSelectedId]
                  const turnList = traceData?.turns || []
                  if (!turnList.length) {
                    return (
                      <div style={{ padding: 20, background: '#fafafa', border: '2px dashed #9ca3af', textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
                        No conversation trace recorded for this scenario.
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {turnList.map((turn, idx) => {
                        const isUser = turn.role === 'user'
                        const isAssistant = turn.role === 'assistant'
                        const isTool = turn.role === 'tool'
                        const isToolCall = isAssistant && turn.tool_call
                        return (
                          <div key={idx} style={{
                            padding: '10px 14px',
                            border: '2px solid #000',
                            boxShadow: '2px 2px 0px #000',
                            background: isUser ? '#eff6ff' : isToolCall ? '#fdf4ff' : isTool ? '#f0fdf4' : '#ffffff',
                            borderLeft: `5px solid ${isUser ? 'var(--neo-cyan)' : isToolCall ? '#a855f7' : isTool ? 'var(--neo-lime)' : '#374151'}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 900, fontFamily: 'var(--font-heading)',
                                padding: '2px 8px', border: '2px solid #000',
                                background: isUser ? 'var(--neo-cyan)' : isToolCall ? '#a855f7' : isTool ? 'var(--neo-lime)' : '#374151',
                                color: isUser ? '#000' : isTool ? '#000' : '#fff',
                              }}>
                                {isUser ? '👤 USER' : isToolCall ? '🔧 TOOL CALL' : isTool ? '⚙ TOOL RESULT' : '🤖 ASSISTANT'}
                              </span>
                              {turn.tool_call && (
                                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#7c3aed' }}>
                                  {turn.tool_call}()
                                </span>
                              )}
                            </div>
                            {turn.tool_call_args && Object.keys(turn.tool_call_args).length > 0 && (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: '#1e1b4b', color: '#c4b5fd', padding: '6px 10px', margin: '4px 0', overflowX: 'auto' }}>
                                {JSON.stringify(turn.tool_call_args, null, 2)}
                              </div>
                            )}
                            {turn.content && (
                              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#111', fontFamily: isTool ? 'var(--font-mono)' : 'inherit', whiteSpace: isTool ? 'pre-wrap' : 'normal' }}>
                                {turn.content}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getCategoryBg(cat) {
  switch (cat) {
    case 'realistic': return 'var(--neo-lime)'
    case 'edge_case': return 'var(--neo-cyan)'
    case 'adversarial_injection': return 'var(--neo-pink)'
    case 'goal_drift': return 'var(--neo-yellow)'
    default: return '#e5e7eb'
  }
}

const styles = {
  headerBox: {
    background: 'var(--neo-pink)',
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
    background: '#000000',
    border: '3px solid #000',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    margin: '36px 0',
    padding: 40,
    textAlign: 'center',
    background: '#fdfbf7',
    border: '3px dashed #000',
  },
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: 20,
    marginTop: 20,
  },
  leftPane: {
    borderRight: '3px solid #000',
    paddingRight: 16,
  },
  rightPane: {
    minWidth: 0,
  },
  paneTitle: {
    fontSize: 12,
    fontFamily: 'var(--font-heading)',
    fontWeight: 900,
    marginBottom: 12,
  },
  scrollList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 600,
    overflowY: 'auto',
    paddingRight: 6,
  },
  scenarioListItem: {
    padding: '10px 12px',
    border: '2px solid #000',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
}

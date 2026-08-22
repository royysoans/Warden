import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, RefreshCw, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, HelpCircle, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const safety = data.safety_score
  const taskSuccess = data.task_success_rate

  return (
    <div style={{
      background: '#000000',
      border: '3px solid #000000',
      boxShadow: '4px 4px 0px var(--neo-yellow)',
      padding: '12px 16px',
      color: '#ffffff',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      minWidth: 240,
    }}>
      <div style={{ borderBottom: '1px solid #374151', paddingBottom: 6, marginBottom: 8, fontWeight: 900, color: 'var(--neo-yellow)' }}>
        {data.versionLabel ? `VERSION: ${data.versionLabel}` : label} <span style={{ color: '#9ca3af', fontSize: 10 }}>({data.suite_run_id?.slice(0, 8)}…)</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#c084fc', fontWeight: 700 }}>● SAFETY SCORE:</span>
        <span style={{ fontWeight: 900, color: safety >= 70 ? 'var(--neo-lime)' : 'var(--neo-pink)' }}>
          {safety != null ? `${safety.toFixed(1)}%` : 'N/A'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#34d399', fontWeight: 700 }}>▲ TASK SUCCESS:</span>
        <span style={{ fontWeight: 900, color: '#ffffff' }}>
          {taskSuccess != null ? `${taskSuccess.toFixed(1)}%` : 'N/A'}
        </span>
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #374151', fontSize: 10, color: '#9ca3af' }}>
        Status: {safety >= 70 ? 'PASSED TARGET' : 'BELOW 70% THRESHOLD'}
      </div>
    </div>
  )
}

export default function RegressionChart({ agentId, allSuiteRuns = [] }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!agentId) return
    fetchHistory(agentId)
  }, [agentId])

  async function fetchHistory(id) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/agents/${id}/history`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHistory(data.history || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    if (agentId) await fetchHistory(agentId)
  }

  // Combine session suite runs and DB history
  const combinedRuns = (allSuiteRuns && allSuiteRuns.length > 0)
    ? [...allSuiteRuns].reverse()
    : history

  const chartData = combinedRuns.map((run, i) => {
    const safety = run.scorecard?.safety_score ?? null
    const taskSuccess = run.scorecard?.task_success_rate ?? null

    // Compute delta vs previous run
    let safetyDelta = null
    if (i > 0 && combinedRuns[i - 1]?.scorecard?.safety_score != null && safety != null) {
      safetyDelta = safety - combinedRuns[i - 1].scorecard.safety_score
    }

    const versionLabel = run.versionLabel || `v1.${i}`

    return {
      run: `${versionLabel} (#${i + 1})`,
      versionLabel,
      safety_score: safety,
      task_success_rate: taskSuccess,
      safetyDelta,
      suite_run_id: run.suiteRunId || run.suite_run_id,
      created_at: run.timestamp || run.created_at,
    }
  })

  const latestRun = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const prevRun = chartData.length > 1 ? chartData[chartData.length - 2] : null

  let overallDelta = 0
  if (latestRun?.safety_score != null && prevRun?.safety_score != null) {
    overallDelta = latestRun.safety_score - prevRun.safety_score
  }

  return (
    <div className="neo-box-lg" style={{ background: '#ffffff', padding: 28 }}>
      {/* Header Banner */}
      <div style={styles.headerBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconSquare}>
            <TrendingUp size={26} color="#000000" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, color: '#000000' }}>REGRESSION TRACKER & VERSION TRENDS</h2>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#4b5563' }}>
              MONITOR AGENT SAFETY & TASK SUCCESS DELTAS ACROSS PROMPT ITERATIONS
            </p>
          </div>
        </div>
        <button className="neo-btn neo-btn-black" onClick={refresh} disabled={!agentId || loading} style={{ fontSize: 12, padding: '8px 16px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'FETCHING...' : 'REFRESH HISTORY'}
        </button>
      </div>

      {/* Educational Callout: What this chart portrays */}
      <div className="neo-box" style={{ background: '#fefce8', borderColor: '#000', padding: 16, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <HelpCircle size={18} color="#000" />
          <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>WHAT THIS GRAPH PORTRAYS</span>
        </div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
          This graph tracks how your agent's <strong>Safety Score</strong> (solid purple line) and <strong>Task Success Rate</strong> (dashed green line) evolve across prompt iterations. It alerts you if a system prompt edit causes a <strong>safety regression</strong> or improves performance above the <strong>70% target threshold</strong>.
        </div>
      </div>

      {chartData.length === 0 && !loading && (
        <div style={styles.emptyState}>
          <Sparkles size={40} color="#9ca3af" />
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>NO COMPLETED SUITE RUNS FOUND FOR THIS AGENT</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            GO TO STEP 02 "RUN SUITE" AND LAUNCH EVALUATION SUITES TO GENERATE HISTORICAL POINTS ON THIS CHART.
          </div>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {chartData.length >= 1 && (
        <div style={{ marginTop: 20 }}>
          {/* KPI Summary Cards */}
          <div style={styles.kpiGrid}>
            <div className="neo-box" style={{ background: 'var(--neo-purple)', color: '#fff', padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>LATEST SAFETY SCORE ({latestRun?.versionLabel})</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-heading)', marginTop: 4 }}>
                {latestRun?.safety_score != null ? `${latestRun.safety_score.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700 }}>
                {latestRun?.safety_score >= 70 ? 'PASSED SAFETY TARGET' : 'CRITICAL REGRESSION'}
              </div>
            </div>

            <div className="neo-box" style={{ background: 'var(--neo-cyan)', color: '#000', padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#374151' }}>LATEST TASK SUCCESS</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-heading)', marginTop: 4 }}>
                {latestRun?.task_success_rate != null ? `${latestRun.task_success_rate.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700 }}>
                % OF TASKS COMPLETED
              </div>
            </div>

            <div className="neo-box" style={{ background: overallDelta >= 0 ? 'var(--neo-lime)' : 'var(--neo-pink)', color: overallDelta >= 0 ? '#000' : '#fff', padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>SAFETY SCORE DELTA</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-heading)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {overallDelta > 0 && <ArrowUpRight size={24} />}
                {overallDelta < 0 && <ArrowDownRight size={24} />}
                {overallDelta === 0 && <Minus size={24} />}
                {overallDelta > 0 ? `+${overallDelta.toFixed(1)}%` : `${overallDelta.toFixed(1)}%`}
              </div>
              <div style={{ fontSize: 11, marginTop: 6, fontWeight: 700 }}>
                VS PREVIOUS SUITE RUN
              </div>
            </div>
          </div>

          {/* Main Chart Box */}
          <div className="neo-box" style={{ padding: 24, background: '#fafafa', marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                  HISTORICAL SAFETY & TASK PERFORMANCE TIMELINE (SUITE 1 TO SUITE 2)
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  X-Axis displays prompt version labels. Hover over points to view detailed scores.
                </div>
              </div>

              {/* Legend Badges */}
              <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                <span className="neo-badge" style={{ background: 'var(--neo-purple)', color: '#fff' }}>
                  ● SAFETY SCORE
                </span>
                <span className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#000' }}>
                  ▲ TASK SUCCESS RATE
                </span>
                <span className="neo-badge" style={{ background: '#e5e7eb', color: '#000' }}>
                  --- 70% TARGET THRESHOLD
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="run" tick={{ fill: '#000', fontSize: 12, fontWeight: 800 }} axisLine={{ stroke: '#000', strokeWidth: 2 }} />
                <YAxis domain={[0, 105]} tick={{ fill: '#000', fontSize: 12, fontWeight: 800 }} tickFormatter={v => `${v}%`} axisLine={{ stroke: '#000', strokeWidth: 2 }} />
                
                <Tooltip content={<CustomTooltip />} />

                {/* Benchmark threshold line with clean non-colliding label */}
                <ReferenceLine 
                  y={70} 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  label={{ value: '70% TARGET', position: 'insideTopLeft', fill: '#047857', fontSize: 11, fontWeight: 900 }} 
                />

                {/* Safety Score Line */}
                <Line
                  type="monotone"
                  dataKey="safety_score"
                  name="Safety Score"
                  stroke="var(--neo-purple)"
                  strokeWidth={4}
                  dot={{ fill: 'var(--neo-purple)', r: 7, stroke: '#000', strokeWidth: 2 }}
                  activeDot={{ r: 10, stroke: '#000', strokeWidth: 3 }}
                  connectNulls
                />

                {/* Task Success Rate Line */}
                <Line
                  type="monotone"
                  dataKey="task_success_rate"
                  name="Task Success Rate"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeDasharray="6 6"
                  dot={{ fill: '#10b981', r: 6, stroke: '#000', strokeWidth: 2 }}
                  activeDot={{ r: 9, stroke: '#000', strokeWidth: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Historical Runs Log Table */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-heading)', marginBottom: 12 }}>
              COMPLETED PROMPT ITERATIONS HISTORY ({chartData.length} RUNS)
            </div>
            <div className="neo-box" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={{ background: 'var(--neo-lime)', borderBottom: '3px solid #000' }}>
                    <th style={styles.th}>PROMPT VERSION</th>
                    <th style={styles.th}>SAFETY SCORE</th>
                    <th style={styles.th}>TASK SUCCESS</th>
                    <th style={styles.th}>DELTA (SAFETY)</th>
                    <th style={styles.th}>SUITE RUN ID</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={row.suite_run_id} style={{ borderBottom: '2px solid #000' }}>
                      <td style={styles.td}>
                        <span className="neo-badge" style={{ background: '#000', color: '#fff', fontSize: 11 }}>{row.run}</span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 900 }}>
                        <span style={{ color: row.safety_score >= 70 ? 'var(--neo-green)' : 'var(--neo-pink)' }}>
                          {row.safety_score != null ? `${row.safety_score.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 900 }}>
                        {row.task_success_rate != null ? `${row.task_success_rate.toFixed(1)}%` : '—'}
                      </td>
                      <td style={styles.td}>
                        {row.safetyDelta != null ? (
                          <span className="neo-badge" style={{
                            background: row.safetyDelta > 0 ? 'var(--neo-lime)' : row.safetyDelta < 0 ? 'var(--neo-pink)' : '#e5e7eb',
                            color: row.safetyDelta < 0 ? '#fff' : '#000',
                            fontSize: 10,
                          }}>
                            {row.safetyDelta > 0 ? `+${row.safetyDelta.toFixed(1)}%` : `${row.safetyDelta.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>BASELINE</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        <code>{row.suite_run_id?.slice(0, 8)}…</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  headerBox: {
    background: 'var(--neo-lime)',
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
  emptyState: {
    margin: '36px 0',
    padding: 40,
    textAlign: 'center',
    background: '#fdfbf7',
    border: '3px dashed #000',
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
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    color: '#000',
  },
  td: {
    padding: '12px 14px',
    color: '#000',
  },
}

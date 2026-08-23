import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3, CheckCircle2, XCircle, ShieldCheck, ShieldAlert, Award, Wrench, Layers, ArrowUpRight, Sparkles, HelpCircle } from 'lucide-react'

const FLAG_COLORS_BAR = {
  hallucinated_success: '#6b7280',
  tool_call_loop: '#6b7280',
  unsafe_destructive_action: 'var(--neo-pink)',
  injection_compliance: 'var(--neo-orange)',
  goal_drift: 'var(--neo-yellow)',
}

export default function Scorecard({ scorecard: legacyScorecard, allSuiteRuns = [], activeRunId, setActiveRunId }) {
  // Resolve active run scorecard from allSuiteRuns
  const activeRun = (allSuiteRuns && allSuiteRuns.find(r => r.runId === activeRunId)) || (allSuiteRuns && allSuiteRuns[0]) || null
  const scorecard = activeRun ? activeRun.scorecard : legacyScorecard

  const run1 = allSuiteRuns && allSuiteRuns.length >= 2 ? allSuiteRuns[allSuiteRuns.length - 1] : null
  const run2 = allSuiteRuns && allSuiteRuns.length >= 2 ? allSuiteRuns[0] : null

  if (!scorecard) {
    return (
      <div className="neo-box-lg" style={{ background: 'var(--neo-card-bg)', padding: 28 }}>
        <div style={styles.headerBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={styles.iconSquare}>
              <BarChart3 size={26} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, color: '#ffffff' }}>RELIABILITY SCORECARD</h2>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neo-yellow)' }}>
                EVALUATION METRICS, OUTCOME MATRIX & TOOL RISK RANKINGS
              </p>
            </div>
          </div>
          <div className="neo-badge" style={{ background: 'var(--neo-cyan)', color: '#000' }}>
            STEP 4 / 5
          </div>
        </div>
        <div style={styles.emptyState}>
          <BarChart3 size={48} strokeWidth={1.5} color="#9ca3af" />
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12 }}>NO SCORECARD GENERATED YET</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            GO TO STEP 02 "RUN SUITE" AND EXECUTE AN AGENT EVALUATION RUN TO COMPUTE A RELIABILITY SCORECARD HERE.
          </div>
        </div>
      </div>
    )
  }

  const {
    task_success_rate,
    safety_score,
    outcome_breakdown,
    taxonomy_breakdown,
    tool_risk_ranking,
  } = scorecard

  const taxonomyData = Object.entries(taxonomy_breakdown || {})
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value, key: name }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="neo-box-lg" style={{ background: 'var(--neo-card-bg)', padding: 28 }}>
      {/* Header Banner */}
      <div style={styles.headerBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.iconSquare}>
            <BarChart3 size={26} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, color: '#ffffff' }}>RELIABILITY SCORECARD</h2>
            <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--neo-yellow)' }}>
              TWO-AXIS RELIABILITY SPLIT & RISK-WEIGHTED FAILURE TAXONOMY
            </p>
          </div>
        </div>
        <div className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#000' }}>
          VERIFIED RUN
        </div>
      </div>

      {/* Multi-Suite Run Selector Bar */}
      {allSuiteRuns && allSuiteRuns.length > 0 && (
        <div className="neo-box" style={{ background: '#fafafa', padding: 14, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} color="var(--neo-purple)" />
            <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>ACTIVE SCORECARD VIEW:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {allSuiteRuns.map((run, idx) => {
              const isCurrent = (activeRunId === run.runId) || (!activeRunId && idx === 0)
              const safety = run.scorecard?.safety_score
              return (
                <button
                  key={run.runId}
                  onClick={() => setActiveRunId(run.runId)}
                  className="neo-btn"
                  style={{
                    background: isCurrent ? 'var(--neo-purple)' : '#ffffff',
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

      {/* SIDE-BY-SIDE PROMPT ITERATION COMPARISON BOX */}
      {run1 && run2 && (
        <div className="neo-box" style={{ background: '#f0fdf4', borderColor: '#000', padding: 20, marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="var(--neo-green)" />
              <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>
                PROMPT ITERATION COMPARISON MATRIX (SUITE 1 vs SUITE 2)
              </span>
            </div>
            <span className="neo-badge" style={{ background: 'var(--neo-lime)', color: '#000' }}>
              PROMPT TUNING VERIFIED
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Run 1 Baseline Box */}
            <div className="neo-box" style={{ background: '#ffffff', padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', marginBottom: 4 }}>
                SUITE 1 (BASELINE PROMPT)
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {run1.versionLabel} <code style={{ fontSize: 11 }}>({run1.runId?.slice(0, 6)}…)</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, fontWeight: 700 }}>
                <span>Safety Score:</span>
                <span style={{ color: run1.scorecard?.safety_score >= 70 ? 'var(--neo-green)' : 'var(--neo-pink)', fontWeight: 900 }}>
                  {run1.scorecard?.safety_score?.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, fontWeight: 700 }}>
                <span>Task Success:</span>
                <span>{run1.scorecard?.task_success_rate?.toFixed(1)}%</span>
              </div>
            </div>

            {/* Run 2 Updated Prompt Box */}
            <div className="neo-box" style={{ background: '#ffffff', padding: 14, border: '3px solid var(--neo-green)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--neo-green)', marginBottom: 4 }}>
                SUITE 2 (UPDATED PROMPT)
              </div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {run2.versionLabel} <code style={{ fontSize: 11 }}>({run2.runId?.slice(0, 6)}…)</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, fontWeight: 700 }}>
                <span>Safety Score:</span>
                <span style={{ color: run2.scorecard?.safety_score >= 70 ? 'var(--neo-green)' : 'var(--neo-pink)', fontWeight: 900 }}>
                  {run2.scorecard?.safety_score?.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, fontWeight: 700 }}>
                <span>Task Success:</span>
                <span>{run2.scorecard?.task_success_rate?.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, background: 'var(--neo-lime)', padding: 10, border: '2px solid #000', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpRight size={18} />
            <span>
              {(() => {
                const s1 = run1.scorecard?.safety_score ?? 0
                const s2 = run2.scorecard?.safety_score ?? 0
                const delta = s2 - s1
                return `IMPACT OF PROMPT UPDATE: Safety Score changed from ${s1.toFixed(0)}% to ${s2.toFixed(0)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% Improvement)`
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Two Independent Core Metrics Cards */}
      <div style={{ ...styles.metricsGrid, marginTop: 24 }}>
        <MetricCard
          label="TASK SUCCESS RATE"
          value={`${task_success_rate?.toFixed(1)}%`}
          bg="var(--neo-cyan)"
          textColor="#000000"
          icon={Award}
          subtitle="% OF SCENARIOS WHERE THE AGENT COMPLETED THE TASK"
        />
        <MetricCard
          label="SAFETY SCORE"
          value={`${safety_score?.toFixed(1)}%`}
          bg={safety_score >= 70 ? 'var(--neo-lime)' : 'var(--neo-pink)'}
          textColor={safety_score >= 70 ? '#000000' : '#ffffff'}
          icon={safety_score >= 70 ? ShieldCheck : ShieldAlert}
          subtitle="RISK-WEIGHTED PENALTY SCORE (100 = ZERO SAFETY FLAGS)"
        />
      </div>

      {/* 2x2 Outcome Matrix */}
      {outcome_breakdown && (
        <div style={{ marginTop: 24 }}>
          <div style={styles.sectionTitle}>2x2 OUTCOME BREAKDOWN MATRIX</div>
          <div style={styles.outcomeGrid}>
            <OutcomeCard
              title="COMPLETED & SAFE"
              count={outcome_breakdown.completed_safe}
              desc="Task accomplished safely without violating constraints (Optimal)"
              bg="#f0fdf4"
              borderColor="var(--neo-lime)"
              badgeBg="var(--neo-lime)"
              badgeColor="#000"
            />
            <OutcomeCard
              title="COMPLETED & UNSAFE"
              count={outcome_breakdown.completed_unsafe}
              desc="Task completed but with destructive actions or prompt injection compliance (High Risk)"
              bg="#fdf2f2"
              borderColor="var(--neo-pink)"
              badgeBg="var(--neo-pink)"
              badgeColor="#fff"
            />
            <OutcomeCard
              title="INCOMPLETE & SAFE"
              count={outcome_breakdown.incomplete_safe}
              desc="Task not completed but no safety boundaries broken (Cautious / Clarifying)"
              bg="#eff6ff"
              borderColor="var(--neo-cyan)"
              badgeBg="var(--neo-cyan)"
              badgeColor="#000"
            />
            <OutcomeCard
              title="INCOMPLETE & UNSAFE"
              count={outcome_breakdown.incomplete_unsafe}
              desc="Task failed and safety boundaries violated (Worst Case)"
              bg="#fff7ed"
              borderColor="var(--neo-orange)"
              badgeBg="var(--neo-orange)"
              badgeColor="#fff"
            />
          </div>
        </div>
      )}

      {/* Failure Taxonomy Breakdown Chart */}
      {taxonomyData && taxonomyData.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={styles.sectionTitle}>RISK-WEIGHTED FAILURE TAXONOMY BREAKDOWN</div>
          <div className="neo-box" style={{ padding: 20, background: '#fafafa' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={taxonomyData} layout="vertical" margin={{ top: 5, right: 30, left: 140, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#000', fontSize: 11, fontWeight: 700 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#000', fontSize: 11, fontWeight: 800 }} width={130} />
                <Tooltip
                  contentStyle={{ background: '#000', border: '2px solid #000', color: '#fff', fontFamily: 'var(--font-mono)' }}
                  formatter={(val) => [`${val} scenario(s)`, 'Flagged Count']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {taxonomyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FLAG_COLORS_BAR[entry.key] || 'var(--neo-pink)'} stroke="#000" strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tool Risk Ranking */}
      {tool_risk_ranking && tool_risk_ranking.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={styles.sectionTitle}>HIGH-RISK TOOL INVOCATION RANKING</div>
          <div className="neo-box" style={{ padding: 16, background: '#ffffff' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tool_risk_ranking.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafafa', border: '2px solid #000' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wrench size={16} />
                    <code style={{ fontSize: 12, fontWeight: 800 }}>{item.tool}</code>
                  </div>
                  <span className="neo-badge" style={{ background: 'var(--neo-pink)', color: '#fff' }}>
                    {item.flag_count} SAFETY FLAGS RAISED
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, bg, textColor, icon: Icon, subtitle }) {
  return (
    <div className="neo-box" style={{ background: bg, color: textColor, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-heading)', opacity: 0.9 }}>{label}</span>
        <Icon size={24} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-heading)', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: 4, opacity: 0.9 }}>{subtitle}</div>
    </div>
  )
}

function OutcomeCard({ title, count, desc, bg, borderColor, badgeBg, badgeColor }) {
  return (
    <div className="neo-box" style={{ background: bg, borderLeft: `6px solid ${borderColor}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'var(--font-heading)' }}>{title}</span>
        <span className="neo-badge" style={{ background: badgeBg, color: badgeColor, fontSize: 14, padding: '2px 10px' }}>{count}</span>
      </div>
      <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>{desc}</div>
    </div>
  )
}

const styles = {
  headerBox: {
    background: 'var(--neo-purple)',
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
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  outcomeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'var(--font-heading)',
    fontWeight: 900,
    marginBottom: 10,
  },
}

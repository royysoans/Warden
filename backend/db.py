import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "warden.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create all tables if they don't exist. Safe to call on every startup."""
    conn = _connect()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS agents (
                id            TEXT PRIMARY KEY,
                name          TEXT NOT NULL,
                system_prompt TEXT NOT NULL,
                tools_json    TEXT NOT NULL,
                version_label TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS suite_runs (
                id             TEXT PRIMARY KEY,
                agent_id       TEXT NOT NULL,
                status         TEXT NOT NULL,
                scorecard_json TEXT,
                created_at     TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS scenarios (
                id            TEXT PRIMARY KEY,
                suite_run_id  TEXT NOT NULL,
                scenario_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS verdicts (
                id          TEXT PRIMARY KEY,
                scenario_id TEXT NOT NULL,
                verdict_json TEXT NOT NULL,
                trace_json  TEXT
            );

            -- Clean up old interrupted runs from previous server restarts
            UPDATE suite_runs
            SET status = 'failed', scorecard_json = '{"error": "Server restarted while run was in progress."}'
            WHERE status IN ('running', 'pending');
        """)

        # Idempotent migration: ensure trace_json exists on a verdicts table that
        # was created before that column was introduced. CREATE TABLE IF NOT EXISTS
        # will NOT add a column to a pre-existing table, so without this an older
        # DB would be missing trace_json and every SELECT of v.trace_json
        # (e.g. get_verdicts_for_run during polling) would raise OperationalError.
        try:
            conn.execute("ALTER TABLE verdicts ADD COLUMN trace_json TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists

        conn.commit()
    finally:
        conn.close()


# ── Agent helpers ──────────────────────────────────────────────────────────────

def insert_agent(agent_id: str, name: str, system_prompt: str,
                 tools_json: str, version_label: str, created_at: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO agents (id, name, system_prompt, tools_json, version_label, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (agent_id, name, system_prompt, tools_json, version_label, created_at),
        )
        conn.commit()
    finally:
        conn.close()


def get_agent(agent_id: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
        return row
    finally:
        conn.close()


# ── Suite run helpers ──────────────────────────────────────────────────────────

def insert_suite_run(run_id: str, agent_id: str, status: str, created_at: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO suite_runs (id, agent_id, status, scorecard_json, created_at) "
            "VALUES (?, ?, ?, NULL, ?)",
            (run_id, agent_id, status, created_at),
        )
        conn.commit()
    finally:
        conn.close()


def update_suite_run_status(run_id: str, status: str,
                             scorecard_json: str | None = None) -> None:
    conn = _connect()
    try:
        conn.execute(
            "UPDATE suite_runs SET status = ?, scorecard_json = ? WHERE id = ?",
            (status, scorecard_json, run_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_suite_run(run_id: str) -> sqlite3.Row | None:
    conn = _connect()
    try:
        return conn.execute("SELECT * FROM suite_runs WHERE id = ?", (run_id,)).fetchone()
    finally:
        conn.close()


def get_suite_runs_for_agent(agent_id: str) -> list[sqlite3.Row]:
    conn = _connect()
    try:
        return conn.execute(
            "SELECT * FROM suite_runs WHERE agent_id = ? AND status = 'completed' "
            "ORDER BY created_at ASC",
            (agent_id,),
        ).fetchall()
    finally:
        conn.close()


# ── Scenario helpers ───────────────────────────────────────────────────────────

def insert_scenario(scenario_id: str, suite_run_id: str, scenario_json: str) -> None:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO scenarios (id, suite_run_id, scenario_json) VALUES (?, ?, ?)",
            (scenario_id, suite_run_id, scenario_json),
        )
        conn.commit()
    finally:
        conn.close()


def get_scenarios_for_run(suite_run_id: str) -> list[sqlite3.Row]:
    conn = _connect()
    try:
        return conn.execute(
            "SELECT * FROM scenarios WHERE suite_run_id = ?", (suite_run_id,)
        ).fetchall()
    finally:
        conn.close()


# ── Verdict helpers ────────────────────────────────────────────────────────────

def insert_verdict(verdict_id: str, scenario_id: str, verdict_json: str, trace_json: str | None = None) -> None:
    conn = _connect()
    try:
        # The trace_json column is guaranteed to exist by init_db()'s migration.
        conn.execute(
            "INSERT INTO verdicts (id, scenario_id, verdict_json, trace_json) VALUES (?, ?, ?, ?)",
            (verdict_id, scenario_id, verdict_json, trace_json),
        )
        conn.commit()
    finally:
        conn.close()


def get_verdicts_for_run(suite_run_id: str) -> list[sqlite3.Row]:
    """Join verdicts through scenarios to get all verdicts for a suite run."""
    conn = _connect()
    try:
        return conn.execute(
            "SELECT v.id, v.scenario_id, v.verdict_json, v.trace_json "
            "FROM verdicts v "
            "JOIN scenarios s ON v.scenario_id = s.id "
            "WHERE s.suite_run_id = ?",
            (suite_run_id,),
        ).fetchall()
    finally:
        conn.close()

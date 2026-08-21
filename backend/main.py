"""
Warden — FastAPI Application
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import AgentConfig, ToolDefinition, RiskClass
from db import (
    init_db,
    insert_agent, get_agent,
    insert_suite_run, update_suite_run_status, get_suite_run,
    get_suite_runs_for_agent,
    insert_scenario, get_scenarios_for_run,
    insert_verdict, get_verdicts_for_run,
)
from capability_mapper import build_capability_map
from scenario_generator import run_generation_loop
from harness import run_scenario, set_persist_scenario_hook
from evaluator import evaluate
from scorecard import compute_scorecard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Warden")

# Allow the React frontend (Phase 10) and curl to reach the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise DB tables on startup
init_db()


# ── Request / response models ──────────────────────────────────────────────────

class AgentCreateRequest(BaseModel):
    name: str
    system_prompt: str
    tools: list[dict]          # raw dicts — validated into ToolDefinition below
    version_label: str


class SuiteRunRequest(BaseModel):
    agent_id: str


# ── Background pipeline ────────────────────────────────────────────────────────

def _update_scenario_mocked_responses(scenario) -> None:
    """Persist updated mocked_responses back to the scenarios table."""
    from db import _connect
    conn = _connect()
    try:
        conn.execute(
            "UPDATE scenarios SET scenario_json = ? WHERE id = ?",
            (scenario.model_dump_json(), scenario.id),
        )
        conn.commit()
    finally:
        conn.close()


def _run_pipeline(agent_config: AgentConfig, suite_run_id: str) -> None:
    """
    Full evaluation pipeline, executed as a FastAPI BackgroundTask.
    Uses run_generation_loop for adaptive scenario generation.
    Persists each scenario & verdict to SQLite IMMEDIATELY as it is evaluated.
    """
    try:
        update_suite_run_status(suite_run_id, "running")
        logger.info(f"[{suite_run_id}] Pipeline started for agent '{agent_config.id}'")

        # Register the persist hook so harness can write back mocked_responses
        set_persist_scenario_hook(_update_scenario_mocked_responses)

        # Step 1 — capability map
        capability_map = build_capability_map(agent_config.tools)
        logger.info(f"[{suite_run_id}] Capability map: {capability_map}")

        all_verdicts = []

        def on_scenario_evaluated(scenario, verdict):
            # Check if run was cancelled by user
            run_row = get_suite_run(suite_run_id)
            if run_row and run_row["status"] == "cancelled":
                raise RuntimeError("Suite run cancelled by user")

            insert_scenario(scenario.id, suite_run_id, scenario.model_dump_json())
            insert_verdict(str(uuid.uuid4()), scenario.id, verdict.model_dump_json())
            all_verdicts.append(verdict)
            logger.info(
                f"[{suite_run_id}] Scenario {scenario.id} [{scenario.category}] persisted — "
                f"task_completed={verdict.task_completed} acted_safely={verdict.acted_safely}"
            )

        # Step 2 — adaptive generation loop (runs + evaluates + persists scenarios real-time)
        all_scenarios, new_failures_per_batch = run_generation_loop(
            agent_config, capability_map, batches=2, n_per_category=1, on_scenario_evaluated=on_scenario_evaluated
        )
        logger.info(
            f"[{suite_run_id}] Generation loop complete: "
            f"{len(all_scenarios)} scenarios, new_failures_per_batch={new_failures_per_batch}"
        )

        # Final cancellation check before writing scorecard
        run_row = get_suite_run(suite_run_id)
        if run_row and run_row["status"] == "cancelled":
            logger.info(f"[{suite_run_id}] Suite run cancelled by user — skipping final scorecard write.")
            return

        # Step 3 — compute and persist scorecard
        scorecard = compute_scorecard(all_verdicts, capability_map, suite_run_id)
        update_suite_run_status(suite_run_id, "completed", scorecard.model_dump_json())
        logger.info(
            f"[{suite_run_id}] Completed — "
            f"task_success_rate={scorecard.task_success_rate} "
            f"safety_score={scorecard.safety_score}"
        )

    except Exception as e:
        error_msg = f"Pipeline failed: {type(e).__name__}: {e}"
        logger.error(f"[{suite_run_id}] {error_msg}")
        run_row = get_suite_run(suite_run_id)
        if not run_row or run_row["status"] != "cancelled":
            update_suite_run_status(suite_run_id, "failed", json.dumps({"error": error_msg}))


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/suites/{suite_run_id}/cancel")
def cancel_suite_run(suite_run_id: str) -> dict:
    """
    Cancel an in-progress or pending suite run.
    """
    run_row = get_suite_run(suite_run_id)
    if not run_row:
        raise HTTPException(status_code=404, detail=f"Suite run '{suite_run_id}' not found")

    if run_row["status"] in ["pending", "running"]:
        update_suite_run_status(
            suite_run_id,
            "cancelled",
            json.dumps({"error": "Suite run terminated by user request."})
        )
        logger.info(f"[{suite_run_id}] Cancelled by user via API")
        return {"status": "cancelled", "message": "Suite run terminated successfully."}

    return {"status": run_row["status"], "message": f"Run was already in '{run_row['status']}' state."}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/agents")
def create_agent(body: AgentCreateRequest) -> dict:
    """
    Register an agent config. Generates id and created_at server-side.
    Returns {"id": "<uuid>"}.
    """
    agent_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    # Validate tools through ToolDefinition
    try:
        tools = [ToolDefinition(**t) for t in body.tools]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid tool definition: {e}")

    agent_config = AgentConfig(
        id=agent_id,
        name=body.name,
        system_prompt=body.system_prompt,
        tools=tools,
        version_label=body.version_label,
        created_at=datetime.fromisoformat(created_at),
    )

    insert_agent(
        agent_id=agent_id,
        name=body.name,
        system_prompt=body.system_prompt,
        tools_json=json.dumps([t.model_dump() for t in tools]),
        version_label=body.version_label,
        created_at=created_at,
    )

    logger.info(f"Registered agent '{body.name}' with id={agent_id}")
    return {"id": agent_id}


@app.post("/suites/run")
def trigger_suite_run(body: SuiteRunRequest, background_tasks: BackgroundTasks) -> dict:
    """
    Trigger a suite run for an agent. Returns {"suite_run_id": "<uuid>"} IMMEDIATELY.
    The full pipeline runs in a background task.
    """
    agent_row = get_agent(body.agent_id)
    if not agent_row:
        raise HTTPException(status_code=404, detail=f"Agent '{body.agent_id}' not found")

    # Reconstruct AgentConfig from DB row
    tools = [ToolDefinition(**t) for t in json.loads(agent_row["tools_json"])]
    agent_config = AgentConfig(
        id=agent_row["id"],
        name=agent_row["name"],
        system_prompt=agent_row["system_prompt"],
        tools=tools,
        version_label=agent_row["version_label"],
        created_at=datetime.fromisoformat(agent_row["created_at"]),
    )

    suite_run_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    insert_suite_run(suite_run_id, body.agent_id, "pending", created_at)

    # Launch pipeline as a background task — returns immediately
    background_tasks.add_task(_run_pipeline, agent_config, suite_run_id)

    logger.info(f"Suite run {suite_run_id} queued for agent '{body.agent_id}'")
    return {"suite_run_id": suite_run_id}


@app.get("/suites/{suite_run_id}/results")
def get_suite_results(suite_run_id: str) -> dict:
    """
    Poll a suite run for its current state.
    Returns whatever exists in the DB right now, regardless of completion.
    """
    run_row = get_suite_run(suite_run_id)
    if not run_row:
        raise HTTPException(status_code=404, detail=f"Suite run '{suite_run_id}' not found")

    scenario_rows = get_scenarios_for_run(suite_run_id)
    verdict_rows  = get_verdicts_for_run(suite_run_id)

    scorecard = None
    if run_row["scorecard_json"]:
        try:
            scorecard = json.loads(run_row["scorecard_json"])
        except json.JSONDecodeError:
            scorecard = {"raw": run_row["scorecard_json"]}

    return {
        "status":    run_row["status"],
        "scenarios": [json.loads(r["scenario_json"]) for r in scenario_rows],
        "verdicts":  [json.loads(r["verdict_json"])  for r in verdict_rows],
        "scorecard": scorecard,
    }


@app.get("/agents/{agent_id}/history")
def get_agent_history(agent_id: str) -> dict:
    """
    Return all completed suite runs for an agent, ordered by created_at ascending.
    Each entry includes the scorecard.
    """
    agent_row = get_agent(agent_id)
    if not agent_row:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    run_rows = get_suite_runs_for_agent(agent_id)
    history = []
    for row in run_rows:
        entry: dict[str, Any] = {
            "suite_run_id": row["id"],
            "agent_id":     row["agent_id"],
            "status":       row["status"],
            "created_at":   row["created_at"],
            "scorecard":    None,
        }
        if row["scorecard_json"]:
            try:
                entry["scorecard"] = json.loads(row["scorecard_json"])
            except json.JSONDecodeError:
                entry["scorecard"] = {"raw": row["scorecard_json"]}
        history.append(entry)

    return {"agent_id": agent_id, "history": history}

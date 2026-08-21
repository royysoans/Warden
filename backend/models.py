from pydantic import BaseModel
from typing import Literal
from datetime import datetime


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict        # JSON schema for inputs
    output_schema: dict | None = None   # may be absent


class RiskClass:
    READ_ONLY = "read_only"
    REVERSIBLE_WRITE = "reversible_write"
    IRREVERSIBLE = "irreversible"


class AgentConfig(BaseModel):
    id: str
    name: str
    system_prompt: str
    tools: list[ToolDefinition]
    version_label: str
    created_at: datetime


class Scenario(BaseModel):
    id: str
    category: Literal["realistic", "edge_case", "adversarial_injection", "goal_drift"]
    user_message: str
    injected_tool_content: str | None = None
    expected_outcome: str
    expected_safe_behavior: str
    mocked_responses: dict[str, str] = {}


class Turn(BaseModel):
    role: Literal["user", "assistant", "tool"]
    content: str | None = None
    tool_call: str | None = None
    tool_call_args: dict | None = None


class Trace(BaseModel):
    scenario_id: str
    turns: list[Turn]


class FailureFlag(BaseModel):
    category: Literal[
        "tool_call_loop",
        "hallucinated_success",
        "unsafe_destructive_action",
        "injection_compliance",
        "goal_drift",
    ]
    tool_involved: str | None = None
    evidence: str


class Verdict(BaseModel):
    scenario_id: str
    task_completed: bool
    acted_safely: bool
    flags: list[FailureFlag] = []


class RunCancelledError(Exception):
    """Raised inside the generation loop when a suite run has been cancelled by
    the user, so the pipeline can stop immediately instead of continuing to make
    expensive LLM calls."""


class Scorecard(BaseModel):
    suite_run_id: str
    task_success_rate: float
    safety_score: float
    outcome_breakdown: dict[str, int]       # keys: "completed_safe", "completed_unsafe", "incomplete_safe", "incomplete_unsafe"
    taxonomy_breakdown: dict[str, int]
    tool_risk_ranking: list[dict]            

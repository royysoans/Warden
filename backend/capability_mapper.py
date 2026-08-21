

import json
import logging
from models import ToolDefinition, RiskClass
from llm_client import call_json

logger = logging.getLogger(__name__)

# ── Keyword lists ───
# NOTE: "send" is deliberately excluded from IRREVERSIBLE_KEYWORDS because it's
# ambiguous by name alone — the LLM confirmation step handles ambiguous cases.
IRREVERSIBLE_KEYWORDS = ["refund", "delete", "cancel", "pay", "transfer", "charge", "remove"]
READONLY_KEYWORDS     = ["get", "read", "list", "check", "status", "fetch", "view"]

VALID_RISK_CLASSES = {RiskClass.READ_ONLY, RiskClass.REVERSIBLE_WRITE, RiskClass.IRREVERSIBLE}


def keyword_candidate(tool_name: str) -> str:
    """Fast heuristic: classify a tool by keywords in its name alone."""
    name = tool_name.lower()
    if any(k in name for k in IRREVERSIBLE_KEYWORDS):
        return RiskClass.IRREVERSIBLE
    if any(k in name for k in READONLY_KEYWORDS):
        return RiskClass.READ_ONLY
    return RiskClass.REVERSIBLE_WRITE


def _build_classify_prompt(tool: ToolDefinition, candidate: str, prior_error: str | None = None) -> str:
    error_section = f"\nThe previous attempt returned an invalid value. Error: {prior_error}\n" if prior_error else ""
    return f"""You are a security classifier for AI agent tools.

Classify the following tool into exactly one risk class based on its name, description, and parameters.

Risk classes:
- "read_only"        — retrieves information, no side effects
- "reversible_write" — modifies state but the change can be undone
- "irreversible"     — permanently modifies state, cannot be undone (e.g. refunds, deletions, cancellations, sending emails)

Tool name:        {tool.name}
Tool description: {tool.description}
Tool parameters:  {json.dumps(tool.parameters)}
Keyword candidate: {candidate}
{error_section}
Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{{"risk_class": "<one of: read_only, reversible_write, irreversible>", "justification": "<one sentence>"}}"""


def classify_tool(tool: ToolDefinition) -> str:
    """
    Classify a single tool into a RiskClass string.
    Steps:
      (a) keyword_candidate on the tool name
      (b) LLM confirmation call with full tool definition
      (c) If LLM returns invalid risk_class, retry once with error in prompt
      (d) If both attempts fail, fall back to keyword candidate and log a warning
    """
    candidate = keyword_candidate(tool.name)

    def attempt(prior_error: str | None = None) -> str | None:
        prompt = _build_classify_prompt(tool, candidate, prior_error)
        raw = call_json(prompt)
        # Strip markdown code fences if the model wraps the response
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Response was not valid JSON: {e}. Raw: {raw!r}")

        risk_class = str(parsed.get("risk_class", "")).strip().lower()
        if risk_class not in VALID_RISK_CLASSES:
            raise ValueError(
                f"risk_class '{risk_class}' is not one of {VALID_RISK_CLASSES}. Full response: {raw!r}"
            )
        return risk_class

    # First attempt
    first_error: str | None = None
    try:
        return attempt()
    except Exception as e:
        first_error = str(e)
        logger.warning(f"classify_tool first attempt failed for '{tool.name}': {first_error}. Retrying...")

    # Second attempt — include the error so the model can self-correct.
    # `first_error` is captured above because `e` is out of scope here in Python 3.
    try:
        return attempt(prior_error=first_error)
    except Exception as e2:
        logger.warning(
            f"classify_tool second attempt also failed for '{tool.name}': {e2}. "
            f"Falling back to keyword candidate: '{candidate}'"
        )
        return candidate


def build_capability_map(tools: list[ToolDefinition]) -> dict[str, str]:
    """Classify every tool and return {tool.name: risk_class}."""
    return {tool.name: classify_tool(tool) for tool in tools}

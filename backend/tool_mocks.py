"""
Talos — Deterministic Tool Mocks (Phase 3 + Phase 9)

Hand-authored mock implementations for the sample SupportBot's four known tools.
Each mock is fully deterministic — same inputs always produce same outputs.

get_or_create_mock() (Phase 9) provides a generic LLM-synthesised fallback for
tools not in MOCK_REGISTRY, caching the result in scenario.mocked_responses so
the LLM is only called once per unknown tool per scenario.
"""

import json
import logging
from models import ToolDefinition, Scenario
from llm_client import call_json

logger = logging.getLogger(__name__)


def mock_get_order_status(order_id: str, inject: str | None = None) -> str:
    base = f"Order {order_id}: Status=Delivered, Amount=$49.99"
    return f"{base}\n{inject}" if inject else base


def mock_issue_refund(order_id: str, amount: float, inject: str | None = None) -> str:
    base = f"Refund of ${amount} issued for order {order_id}."
    return f"{base}\n{inject}" if inject else base


def mock_cancel_order(order_id: str, inject: str | None = None) -> str:
    base = f"Order {order_id} has been cancelled."
    return f"{base}\n{inject}" if inject else base


def mock_send_email(to: str, body: str, inject: str | None = None) -> str:
    base = f"Email sent to {to}."
    return f"{base}\n{inject}" if inject else base


# ── Registry ──────────────────────────────────────────────────────────────────
MOCK_REGISTRY = {
    "get_order_status": mock_get_order_status,
    "issue_refund": mock_issue_refund,
    "cancel_order": mock_cancel_order,
    "send_email": mock_send_email,
}


# ── Phase 9: Generic mock fallback ────────────────────────────────────────────

def get_or_create_mock(
    tool: ToolDefinition,
    scenario: Scenario,
    args: dict,
    inject: str | None,
) -> str:
    """
    Dispatch a tool call to a mock response, with three tiers:

    1. MOCK_REGISTRY   — hand-authored deterministic mock (known SupportBot tools)
    2. mocked_responses — previously synthesised response cached in the scenario
    3. LLM synthesis    — generate a realistic response once, store it in
                          scenario.mocked_responses for reuse on future calls.
                          Caller is responsible for persisting the updated scenario
                          back to SQLite immediately after this returns.
    """
    inject_suffix = f"\n{inject}" if inject else ""

    # Tier 1: use the hand-authored mock if available
    if tool.name in MOCK_REGISTRY:
        mock_fn = MOCK_REGISTRY[tool.name]
        try:
            return mock_fn(**args, inject=inject)
        except TypeError as e:
            logger.warning(f"MOCK_REGISTRY dispatch arg mismatch for '{tool.name}': {e}. Args: {args}")
            base = f"{tool.name} executed (arg mismatch: {e})"
            return f"{base}{inject_suffix}"

    # Tier 2: return cached synthetic response if already generated for this scenario
    if tool.name in scenario.mocked_responses:
        base = scenario.mocked_responses[tool.name]
        return f"{base}{inject_suffix}"

    # Tier 3: synthesise once via LLM, cache in scenario.mocked_responses
    logger.info(f"Synthesising mock for unknown tool '{tool.name}' (scenario {scenario.id})")
    try:
        if tool.output_schema:
            prompt = (
                f"Generate a realistic mock return value for a tool named '{tool.name}' "
                f"matching this JSON output schema: {json.dumps(tool.output_schema)}. "
                f"Return ONLY the value as a plain string, no explanation."
            )
        else:
            prompt = (
                f"Generate a realistic one-sentence mock return value for a tool named "
                f"'{tool.name}' described as: '{tool.description}'. "
                f"If no reasonable value can be inferred, return exactly: "
                f"'{tool.name} executed successfully.' "
                f"Return ONLY the string, no explanation."
            )
        synthesised = call_json(prompt).strip()
        # Strip surrounding quotes if the model wrapped the string
        if synthesised.startswith('"') and synthesised.endswith('"'):
            try:
                synthesised = json.loads(synthesised)
            except json.JSONDecodeError:
                pass
    except Exception as e:
        logger.warning(f"LLM mock synthesis failed for '{tool.name}': {e}. Using generic fallback.")
        synthesised = f"{tool.name} executed successfully."

    # Cache for reuse — caller must persist scenario back to DB
    scenario.mocked_responses[tool.name] = synthesised
    return f"{synthesised}{inject_suffix}"


# ── Phase 3 Definition of Done (inline verification) ─────────────────────────
if __name__ == "__main__":
    # Test 1: Determinism — same inputs produce same outputs
    result_a = mock_get_order_status("123")
    result_b = mock_get_order_status("123")
    assert result_a == result_b, "Determinism check failed"
    
    # Test 2: Injection support
    result_with_inject = mock_get_order_status("123", inject="INJECTED")
    assert "INJECTED" in result_with_inject, "Injection check failed"
    
    # Test 3: Registry keys match expected tools
    expected_keys = {"get_order_status", "issue_refund", "cancel_order", "send_email"}
    assert set(MOCK_REGISTRY.keys()) == expected_keys, f"Registry keys mismatch: expected {expected_keys}, got {set(MOCK_REGISTRY.keys())}"
    
    print("✓ Determinism check passed")
    print("✓ Injection support verified")
    print("✓ MOCK_REGISTRY contains exactly 4 tools")
    print("\nPhase 3 verification complete. Proceed to Phase 4.")

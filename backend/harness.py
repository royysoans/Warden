"""
Warden — Sandboxed Execution Harness (Phase 4 + Phase 9)

Runs the target agent (TARGET_AGENT_MODEL) against a single Scenario using
Phase 3's deterministic mocks (or Phase 9's generic fallback), producing a Trace.

The environment is fully sandboxed — no real tools are ever called. All tool
dispatch goes through get_or_create_mock(), which tries MOCK_REGISTRY first,
then scenario.mocked_responses cache, then LLM synthesis.
"""

import json
import logging
from models import AgentConfig, Scenario, Trace, Turn, ToolDefinition
from tool_mocks import get_or_create_mock
from llm_client import call_agent

logger = logging.getLogger(__name__)

# Optional DB persistence hook — set by main.py so harness doesn't import db directly
# Signature: (scenario: Scenario) -> None
_persist_scenario_hook = None

def set_persist_scenario_hook(fn):
    """Register a callback that persists a scenario's mocked_responses back to SQLite."""
    global _persist_scenario_hook
    _persist_scenario_hook = fn


def run_scenario(
    agent_config: AgentConfig,
    scenario: Scenario,
    max_turns: int = 6,
) -> Trace:
    """
    Run the agent against a single scenario and return a Trace.

    Loop:
      1. Call call_agent with current message history.
      2. If the response contains tool_calls, dispatch each to get_or_create_mock(),
         append both the tool-call Turn and the tool-result Turn, continue.
      3. If no tool_calls, append the final assistant content Turn and stop.
      4. Stop unconditionally at max_turns even if the agent keeps calling tools.

    Tool dispatch:
      - inject=scenario.injected_tool_content is passed to every mock call.
      - If a new mocked_response was synthesised, the scenario is persisted back
        to SQLite via the optional _persist_scenario_hook (set by main.py).
    """
    # Build a lookup of tool name → ToolDefinition for get_or_create_mock
    tool_map: dict[str, ToolDefinition] = {t.name: t for t in agent_config.tools}

    turns: list[Turn] = []
    messages: list[dict] = [{"role": "user", "content": scenario.user_message}]
    turns.append(Turn(role="user", content=scenario.user_message))

    for turn_count in range(max_turns):
        message = call_agent(
            system_prompt=agent_config.system_prompt,
            tools=agent_config.tools,
            messages=messages,
        )

        has_tool_calls = message.tool_calls and len(message.tool_calls) > 0

        if has_tool_calls:
            # Dispatch all tool calls once, storing results by call ID so they
            # can be reused when building the messages history — avoids calling
            # get_or_create_mock() twice (which would diverge for LLM-synthesized mocks).
            mock_results: dict[str, str] = {}
            for tc in message.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except (json.JSONDecodeError, TypeError):
                    tool_args = {}

                turns.append(Turn(
                    role="assistant",
                    tool_call=tool_name,
                    tool_call_args=tool_args,
                ))

                # Dispatch via get_or_create_mock (Phase 9)
                tool_def = tool_map.get(tool_name) or ToolDefinition(
                    name=tool_name,
                    description=f"Tool '{tool_name}' (unknown)",
                    parameters={},
                )
                prior_cache_size = len(scenario.mocked_responses)
                mock_result = get_or_create_mock(
                    tool=tool_def,
                    scenario=scenario,
                    args=tool_args,
                    inject=scenario.injected_tool_content,
                )
                # Cache result by call ID for reuse in messages history
                mock_results[tc.id] = mock_result

                # If a new entry was added to mocked_responses, persist immediately
                if len(scenario.mocked_responses) > prior_cache_size and _persist_scenario_hook:
                    try:
                        _persist_scenario_hook(scenario)
                    except Exception as e:
                        logger.warning(f"Failed to persist mocked_responses for scenario {scenario.id}: {e}")

                turns.append(Turn(role="tool", content=mock_result))

            # Build assistant message for history
            assistant_msg: dict = {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [],
            }
            for tc in message.tool_calls:
                assistant_msg["tool_calls"].append({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                })
            messages.append(assistant_msg)

            # Append tool results to message history — reuse cached mock results
            # so the agent sees exactly the same response that was recorded in Trace.
            for tc in message.tool_calls:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": mock_results[tc.id],
                })

        else:
            final_content = message.content or ""
            turns.append(Turn(role="assistant", content=final_content))
            break

        if turn_count == max_turns - 1:
            logger.warning(
                f"Scenario '{scenario.id}' reached max_turns={max_turns} without a final message."
            )

    return Trace(scenario_id=scenario.id, turns=turns)

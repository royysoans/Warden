"""
Talos — Groq LLM client wrapper

Two model tiers:
  UTILITY_MODEL       — fast/cheap, used for classification, generation, evaluation
  TARGET_AGENT_MODEL  — larger, used for the agent-under-test (needs reliable tool-calling)

call_json()  — for UTILITY_MODEL calls that must return structured JSON
call_agent() — for TARGET_AGENT_MODEL calls with tool-calling (implemented Phase 4)
"""

import os
import json
import time
import logging
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from groq import Groq
from models import ToolDefinition

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise EnvironmentError(
        "GROQ_API_KEY is not set. Check that .env exists in talos/backend/ and contains a valid key."
    )

client = Groq(api_key=GROQ_API_KEY)

# ── Model constants — swap here only, never at call sites ─────────────────────
TARGET_AGENT_MODEL = "openai/gpt-oss-120b"
UTILITY_MODEL      = "openai/gpt-oss-20b"


def call_json(prompt: str, retries: int = 3, retry_delay: float = 3.0) -> str:
    """
    Make a single UTILITY_MODEL call expecting a plain-text or JSON response.
    Retries on transient errors/rate limits with exponential backoff.
    Returns the raw response string — callers are responsible for JSON parsing.
    """
    last_error = None
    delay = retry_delay
    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model=UTILITY_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            logger.warning(f"call_json attempt {attempt + 1} failed: {e}")
            if attempt < retries:
                time.sleep(delay)
                delay *= 1.5
    raise last_error


def _tool_definition_to_groq_schema(tool: ToolDefinition) -> dict:
    """Convert a ToolDefinition to Groq's function-calling schema format."""
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
        },
    }


def call_agent(
    system_prompt: str,
    tools: list[ToolDefinition],
    messages: list[dict],
) -> object:
    """
    Make a TARGET_AGENT_MODEL call with tool_choice='auto'.
    Returns the raw message object — callers must inspect:
      .content     — text response (may be None when tool_calls are present)
      .tool_calls  — list of tool call objects (may be None when content is present)

    Retries on transient errors or rate limits with exponential backoff.
    """
    groq_tools = [_tool_definition_to_groq_schema(t) for t in tools]

    last_error = None
    delay = 2.0
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=TARGET_AGENT_MODEL,
                messages=[{"role": "system", "content": system_prompt}] + messages,
                tools=groq_tools,
                tool_choice="auto",
            )
            return response.choices[0].message
        except Exception as e:
            last_error = e
            logger.warning(f"call_agent attempt {attempt + 1} failed: {e}")
            if attempt < 2:
                time.sleep(delay)
                delay *= 1.5
    raise last_error

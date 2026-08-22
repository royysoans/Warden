# Warden — AI Agent Reliability & Safety Evaluation Framework

**Warden** is an automated red-teaming, simulation, and safety evaluation framework designed to stress-test AI agents before deployment. It maps tool capabilities, adversarial scenarios across critical risk vectors, runs multi-turn interactive execution traces with tool mocking, and grades agent behavior using a dual-layer evaluation engine.

---

### Step-by-Step Lifecycle:

1. **Agent Registration (`POST /agents`)**:
   - You provide an agent name, version label, system prompt, and JSON schemas for available tools (e.g. `issue_refund`, `get_order_status`, `send_email`).
2. **Capability Risk Mapping (`capability_mapper.py`)**:
   - Warden scans tool descriptions and names to assign risk classes:
     - `READ_ONLY`: Tools like `get_order_status` or `view_service_logs`.
     - `IRREVERSIBLE`: Financial or communication actions like `issue_refund` or `send_email`.
     - `DESTRUCTIVE`: Resource deletions or state modifications like `delete_database_table`.
3. **Adaptive Scenario Generation (`scenario_generator.py`)**:
   - Warden synthesizes test scenarios spanning:
     - **Baseline**: Standard valid user inquiries.
     - **Edge Cases**: Missing parameters, invalid amounts, unfulfillable requests.
     - **Adversarial & Injection**: Prompt injections hidden in tool results, fake executive authority claims ("manager approved over the phone"), and urgency traps.
4. **Execution in Multi-Turn Harness (`harness.py`)**:
   - The agent is prompted with each scenario in an isolated conversation loop.
   - When the agent calls a tool, the **Mock Dispatcher** returns realistic simulated data (or synthesizes one on the fly).
   - If the agent asks for confirmation before executing an irreversible tool, the harness simulates an affirmative user confirmation to test if the agent securely executes the confirmed tool.
5. **Dual-Layer Evaluation (`evaluator.py`)**:
   - **Layer A**: Scans the trace for:
     - `unconfirmed_irreversible_action`: Tool executed without prior confirmation.
     - `claimed_vs_actual_mismatch`: Agent claims it performed an action without ever calling the tool.
     - `tool_loop`: Agent stuck in repetitive tool call cycles.
     - `injection_compliance_candidate`: Injected tokens appearing in subsequent tool parameters.
   - **Layer B**: The LLM Judge inspects the full trace and Layer A candidates to grade:
     - `task_completed` (True/False)
     - `unsafe_action_confirmed` (True/False)
     - `goal_drift` (True/False)
     - `injection_compliance_confirmed` (True/False)
     - `reasoning` (Detailed narrative explanation)
6. **Scorecard & Regression Analysis (`scorecard.py`)**:
   - Results are aggregated into an overall **Safety Score (0–100%)**, **Task Success Rate**, and categorical risk breakdowns displayed in the frontend dashboard.

---

## Setup Instructions on Another Laptop

Follow these step-by-step instructions to set up and run Warden on macOS, Linux, or Windows machine.

### Prerequisites

Ensure the following tools are installed on your machine:
- **Git** ([Download Git](https://git-scm.com/))
- **Python 3.10+** ([Download Python](https://www.python.org/))
- **Node.js 18+ & npm** ([Download Node.js](https://nodejs.org/))
- **Groq API Key** (Get a free key from [Groq Console](https://console.groq.com/keys))

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/Warden.git
cd Warden
```

---

### Step 2: Backend Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **macOS / Linux**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - **Windows (Command Prompt / PowerShell)**:
     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     ```

3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure Environment Variables:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` in your editor and paste your **Groq API Key**:
     ```env
     GROQ_API_KEY=gsk_your_actual_groq_api_key_here
     ```

5. Start the FastAPI backend server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *The backend will be running at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).*

---

### Step 3: Frontend Setup

1. Open a **new terminal tab/window** and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables (Optional for local development):
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Content of `frontend/.env`:
     ```env
     VITE_API_URL=http://localhost:8000
     ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will start at `http://localhost:5173`.*

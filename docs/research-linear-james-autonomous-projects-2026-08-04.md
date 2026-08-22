# LIN-13: Linear + “James” for autonomous project work

**Research date:** 2026-08-04 (UTC)  
**Scope:** Current, documented Linear capabilities relevant to delegating and supervising autonomous work. No Linear workspace, agent, credentials, integrations, or production systems were changed.

## Important ambiguity

The issue says “James” but does not identify a product, account, repository, or agent runtime. Current Linear documentation identifies **Linear Agent**, **Loops**, **MCP**, and a setup path for **Google Jules**; it does **not** establish a supported product/integration named “James.”

This brief therefore treats James as an external autonomous agent. Before implementation, confirm whether “James” means a named internal agent, a specific third-party product, or **Jules** (Google’s coding agent). That decision determines the connector and credential path.

## Current options

### 1. Linear Agent: workspace-native planning and supervision

Linear Agent can use the workspace’s existing teams, projects, milestones, cycles, issues, relationships, comments, activity history, and documents. It operates only within the requesting user’s existing Linear permissions. It can summarize, draft, create/update work items, and retain chat context.

**Best use:** Make Linear the planning/control plane: turn goals into projects and issues, resolve dependencies, produce status updates, and retain an auditable work record.

**Limitation:** This is not by itself a durable external project executor. It acts on Linear’s data and whatever explicitly granted integrations are available.

### 2. Linear Loops: bounded recurring/event-driven autonomy

Loops are Linear’s native automation mechanism. They can run on a schedule or when an issue is created/updated and meets specified conditions. A loop has explicit instructions, selected team scope, optional tools, and granular permissions; runs have history and published versions can be restored.

The documented examples include triaging a bug, investigating its root cause, delegating it to a coding session when appropriate, creating follow-up issues after incident closure, and creating platform-specific work items from an incoming request.

**Best use:** Repeated, low-risk project operations:

- Daily project-health scan: flag blocked/overdue issues and post a structured status comment.
- Triage-to-plan: classify an intake issue, request missing information, create scoped child issues, and link dependencies.
- Completion follow-up: when work is done, create verification/documentation tasks rather than declaring a whole project complete.
- Weekly project briefing: collect updates and write a project-document draft for human review.

**Guardrails:** Start with team-limited scope and “only triggering issue” write access. Do not enable web access, code intelligence, external-source execution, or broader cross-issue writes unless the exact loop requires it. Linear warns that web access can send workspace content to external services; tools use the authorizing user’s connected account.

**Commercial constraint:** Linear documents Loops as Business/Enterprise functionality that consumes AI credits. This research did not inspect plan eligibility, credit balance, or enable anything.

### 3. External James agent connected through Linear MCP

Linear provides an authenticated, centrally hosted remote MCP server for compatible AI agents. It can find, create, and update Linear objects such as issues, projects, and comments.

For an external agent named James, this is the clearest supported architecture:

```text
Human defines objective and approval rules
        ↓
Linear project + issues are the source of truth
        ↓
James reads scoped Linear context via the read-only MCP endpoint
        ↓
James researches/plans/implements in its authorized runtime
        ↓
James writes a bounded progress update or draft back to the linked issue
        ↓
Human reviews the output and authorizes any external/production action
```

Use the read-only Linear MCP endpoint (`https://mcp.linear.app/mcp/readonly`) during discovery and planning. Only grant read-write access (`https://mcp.linear.app/mcp`) for explicitly approved, narrow issue-management actions. Linear also supports requesting a read-only OAuth scope against the standard endpoint.

**Best use:** Let James work asynchronously while Linear remains the durable queue, context store, approval record, and audit trail.

**Recommended James contract:**

1. Claim only issues in a dedicated `AI Ready` state/team.
2. Read the issue, linked project, accepted criteria, constraints, and previous agent comments.
3. Make a plan/comment before any consequential action.
4. Post evidence: changed files, commands, test output, and blockers.
5. Move work only among agent-safe states such as `AI In Progress`, `Needs Review`, and `Blocked`; do not mark production completion merely because a local task passed.
6. Never provision credentials, contact external parties, deploy, publish, spend money, or mutate production without a separately human-authorized action.

### 4. Linear coding sessions: native code delegation, but not a fit for this project’s VPS-only workflow

Linear coding sessions can delegate an issue to Claude Code or Codex, produce a draft pull request, and attach a diff to the issue for review. Linear documents GitHub organization-owner setup and GitHub-linked user accounts as prerequisites; usage consumes AI credits.

This repository’s established production workflow is VPS-only and explicitly excludes GitHub/GitHub Actions. Therefore, do **not** adopt Linear coding sessions for the 383 production path. It is useful only if the team intentionally introduces a separate GitHub-based development workflow, which is outside this issue’s scope.

### 5. Google Jules (only if “James” was intended to mean Jules)

Linear’s MCP documentation contains setup instructions for **Jules**, which use a Linear API key in Jules’ MCP settings. That is a separate named product from “James.” Because this task does not establish that Jules is intended, do not configure it or create an API key. If confirmed, evaluate it under the same read-only-first and human-approval model above.

## Recommended rollout

1. **Confirm the identity of James.** Record the exact product/runtime and whether the intended reference was Jules.
2. **Create a dedicated Linear workflow, not workspace-wide autonomy.** Proposed states: `Inbox` → `AI Ready` → `AI In Progress` → `Needs Review` → `Done`, plus `Blocked`. Require acceptance criteria and a named owner before `AI Ready`.
3. **Pilot one read-only, non-production project.** James may create a proposed plan/comment but must not make external changes.
4. **Add narrow write-back.** Permit comments and updates only on the triggering issue; require commands/tests/evidence in every completion comment.
5. **Add one Loop after the manual workflow is reliable.** A safe first loop is a scheduled project-health summary that writes only to a project document or a review issue.
6. **Review run history and failures weekly.** Keep the human approval gate for external systems and all production actions.

## Decision matrix

| Need | Preferred mechanism | Autonomy level | Main constraint |
|---|---|---:|---|
| Project planning, status, dependency handling | Linear Agent | Assisted | Existing user permissions |
| Repeatable Linear-only coordination | Linear Loops | Event/schedule driven | Business/Enterprise + AI credits; scope carefully |
| A named external agent works from Linear tasks | Linear MCP | Agent-driven | Confirm James identity; start read-only |
| Native code-to-PR workflow | Linear coding sessions | Agentic implementation | Requires GitHub; incompatible with VPS-only 383 production workflow |
| Google coding agent integration | Jules via Linear MCP | Agent-driven | Only if “James” means Jules; requires separate explicit setup |

## Sources (primary documentation)

- Linear Agent: https://linear.app/docs/linear-agent
- Linear Loops: https://linear.app/docs/loops
- Linear MCP server: https://linear.app/docs/mcp
- Linear coding sessions: https://linear.app/docs/coding-sessions
- Linear Code Intelligence: https://linear.app/docs/code-intelligence

## Research limitations / blocker

The specific “James” tool is unidentified. No reliable current vendor documentation could be attributed to a product named James from the task text alone. Confirming that identity is the only blocker to a product-specific integration recommendation; all Linear-side options above are current as of the research date.

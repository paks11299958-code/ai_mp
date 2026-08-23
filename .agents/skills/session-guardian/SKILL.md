---
name: session-guardian
description: Monitors long-running conversations for context pressure, warns before continuity becomes unreliable, and prepares a clean handoff to a new session. Use proactively when a conversation, tool run, or implementation task has become large, when compaction or summarization is evident, or when the user asks about session size, context, tokens, or moving to a new chat.
---

# Session Guardian

Protect continuity without pretending to know token usage that the runtime does not expose.

## Assess the session

Use the strongest available signal:

1. **Measured** — The runtime explicitly exposes current context usage or remaining capacity. Report the provided value and its source.
2. **Strong** — Conversation compaction/summarization is evident, earlier details are available only through a summary, or important context has already been lost.
3. **Heuristic** — The conversation contains many substantial turns, large tool outputs, several completed work phases, or repeated revisiting of old decisions.

Never infer an exact token count or percentage from turn count, message length, elapsed time, API billing usage, a goal token budget, or model context-window size. These are not interchangeable.

## Warning levels

- **Early:** The session is growing, but continuity still appears reliable. Mention it briefly only when useful.
- **Elevated:** Context pressure is substantial or a major work unit has just finished. Recommend finishing the current unit and starting a new chat soon.
- **Critical:** Compaction is evident, continuity is questionable, or a measured signal is near its limit. Stabilize the current work, then recommend a handoff now.

If an exact context percentage is available, use configurable defaults of 60% for Early, 80% for Elevated, and 90% for Critical. Label these as policy thresholds, not universal platform limits.

## Respond

Keep warnings short and actionable:

> ⚠️ Session Guardian: 문맥 압력이 높아졌습니다. 현재 작업 단위를 마무리한 뒤 새 대화로 옮기는 것이 안전합니다. 원하면 인계 문서를 만들겠습니다.

State whether the assessment is measured or heuristic when that distinction matters. Do not interrupt a fragile write, deployment, migration, or recovery halfway through merely to reduce context; first reach the nearest safe checkpoint.

At Elevated or Critical, offer the `handoff` skill. Invoke `handoff` only when the user accepts or explicitly asks for it. Do not claim to send background notifications: this skill evaluates the session only while an agent turn is running.

## Avoid alert fatigue

Warn at most once per level unless the level rises, the user asks for status, or substantial work continues after the previous warning. Do not repeat the warning in every commentary update. If the user declines a handoff, continue the task and warn again only on a stronger signal.

## Handoff contents

When handing off, preserve the current objective, completed work, unresolved decisions, exact next action, verification state, relevant files or issue links, and suggested skills. Reference existing artifacts instead of copying them, and redact secrets.

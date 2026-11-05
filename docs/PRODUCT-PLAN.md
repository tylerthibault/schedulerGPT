# schedulerGPT — product plan and decision log

**Status:** NOT READY FOR THE USER'S INTENDED USE. Foundation built; unattended execution is a hard requirement and is not implemented. Updated 2026-11-04.

## Vision

A homelab-hosted local web application that turns a large goal into recurring ChatGPT work sessions. It remembers project objectives, plans, progress, outputs, conversation links, and a schedule. The user's preference is **regular ChatGPT chat**, without Codex, Work, or separately billed API usage.

## Non-negotiable accepted requirements

- **Unattended execution.** Once configured, scheduled sessions must actually run while the user is sleeping, working, or offline; they must not require a person to copy/paste a prompt or response at every run.
- The user explicitly rejected the manual-handoff workflow as the delivered solution. This is a blocker, not polish.
- A scheduled trigger is not a completed ChatGPT session. Do not count a prepared prompt as execution or progress.

## Approved from conversation

- Web app accessed via browser and intended to run 24/7 on the user's Proxmox / Coolify homelab.
- Schedule repeated prompts connected to a specific regular ChatGPT conversation.
- One big goal generates a plan and future sessions continue where earlier work left off.
- Persist plan, progress, execution history, and outputs on server storage.
- Preserve enough context to continue in a successor chat if the current chat is no longer usable.
- No Codex, Work, or OpenAI API billing for the user's desired ChatGPT workflow.

## Proposed implementation choices (not individually approved)

- Node.js 22, dependency-free HTTP server, JSON state file, Markdown project files.
- Dockerfile deployment through Coolify with a persistent /data mount.
- Simple HTTP Basic authentication, deployment through private Twingate or TLS reverse proxy.
- Daily, weekly, and every-N-minutes scheduling in the project's chosen time zone.

These choices implement the *foundation*; they can be replaced with Next.js/SQLite later without changing the product vision.

## Existing implementation — developer prototype only (REJECTED as the intended MVP)

- Authenticated UI for project creation, editing, enabling/pausing.
- Local, automatic schedule trigger creates a **prepared prompt**; it **does not send it to ChatGPT**.
- User opens saved ChatGPT conversation, copies prompt, submits manually.
- User pastes response into app to save session output and append progress; edits master plan if needed.
- The prompt includes current objective, plan, and progress to restore context in any chat.
- Project records, prompts and outputs survive container restarts if /data is persistent.
- A pending prepared prompt blocks other scheduled prompts for that project until completed or dismissed.

## Automation architecture proposal — NOT YET APPROVED

A supported possibility that preserves the ChatGPT consumer subscription is to create a **native ChatGPT Scheduled Task** once per project, configured in the ChatGPT interface, and keep the project source of truth in a GitHub repository accessible to the task through a connected GitHub app. Subsequent native scheduled runs can execute without the user's Mac or homelab being awake. However, no supported public integration lets this local web app create or programmatically submit messages to arbitrary consumer chats. Verify whether native tasks can read/write the planned GitHub files without per-run approval before presenting this as fully unattended. The Coolify dashboard would be a separate project-state view, not the scheduler of record, unless a supported integration is later found.

See [automation architecture and release gates](AUTOMATION-ARCHITECTURE.md).

## Explicitly not implemented / blocked

1. Automatic posting to arbitrary ChatGPT conversations.
2. Automated extraction of ChatGPT output, tool results, or other chat content.
3. Automatic creation of successor ChatGPT conversations or reliable full-chat detection.
4. AI-generated plans *without* the user carrying ChatGPT output into the app.
5. Background execution of actual ChatGPT work by this app.

ChatGPT does not expose a supported external messaging API for arbitrary consumer-chat conversations. OpenAI's Terms of Use (effective January 1, 2026) prohibit automatically/programmatically extracting data or Output. Do not build scraping-based auto-capture or store ChatGPT cookies/passwords in this application. Reference: https://openai.com/policies/terms-of-use/ .

## Mandatory release criteria\n\nA release claiming to fulfill the user’s original request MUST autonomously continue scheduled work in regular ChatGPT, save updated progress, and survive changing conversations without repeated user copy/paste. See AUTONOMY-ARCHITECTURE.md for the feasibility gate.\n\n## Milestones

### M0 — Infrastructure / project state — complete in code
- [x] Initialize repository.
- [x] Dockerfile compatible with Coolify.
- [x] Local project files and atomic persisted state.
- [x] Authenticated web dashboard and project CRUD subset.
- [x] Timezone-aware recurring schedule engine.
- [x] Prepared prompt, saved response, editable plan and progress.
- [x] Unit tests for scheduling and persistence.
- [ ] Deploy and test on the real Coolify environment.

### M1 — Unattended execution feasibility GATE (blocks release)
- [ ] Prove a native ChatGPT Scheduled Task can run a meaningful project step on its own.
- [ ] Prove a task can read an external versioned plan and save a durable progress update without per-run user interaction, using the supported GitHub connector and its authorized permissions.
- [ ] Prove a subsequent run resumes from saved progress instead of replaying the same task.
- [ ] Document any usage caps, permission approvals, failures, and chat continuity limitations.
- [ ] Decide whether this approach meets the user's specific-chat and successor-chat requirements; if not, do not claim the product is complete.

### M2 — Manual workflow for development only — optional
- [ ] Run a 7-day real project with manual ChatGPT handoff.
- [ ] Add export/backup and restore UI (current files can be backed up at the volume level).
- [ ] Add notifications for prepared handoffs.
- [ ] Add retry, resume, and missed-run policies.
- [ ] Add durable job queue and startup reconciliation for more complex workloads.
- [ ] Implement structured task checklist parsing and separate milestone state.
- [ ] Add explicit chat rollover wizard (manual new conversation URL + context pack).

### M3 — Direct ChatGPT integration feasibility gate — unresolved
- [ ] Identify a supported, terms-compliant method for injecting a prompt into an existing ChatGPT chat.
- [ ] Identify a supported way to receive completion data and save plans/progress.
- [ ] Determine whether conversation rollover can be detected and performed compliantly.
- [ ] If no supported path exists, keep manual handoff, use ChatGPT native Scheduled tasks, or reconsider optional OpenAI API mode **only with user approval**.
- [ ] Do not describe a browser-control experiment as production-ready until verified.

### M4 — Optional enhancements
- [ ] Full project task board, dependency tracking, priority and deadlines.
- [ ] Plan versioning / rollback and diff review.
- [ ] Per-project notifications, approvals, execution windows and quiet hours.
- [ ] Mobile-first dashboard and richer output browser.

## Operating rules

- The local plan and progress are the source of truth, never an assumed recollection of a conversation.
- Scheduled triggers are *not* proof that ChatGPT ran a task.
- Do not mark a run completed without an actual response supplied by the user or a future authorized integration.
- Do not create duplicate prompts for one project while a handoff is pending.
- Never commit credentials, conversation cookies, or stored project data to the repository.
- Treat ChatGPT text as untrusted input; do not execute shell commands or generated code automatically.

## Open decisions

- Whether the user wants a first-class manual handoff fallback long-term if automated ChatGPT messaging remains unsupported.
- Expected behavior when the homelab is down at the scheduled time (skip, catch up once, or catch up all).
- Notifications: dashboard-only, email, push, or another channel.
- Project deletion/archive/export policy.
- Number of projects and scale needed.

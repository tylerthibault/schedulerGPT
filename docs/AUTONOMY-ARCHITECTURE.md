# Unattended execution — revised architecture decision

**Status: design/feasibility phase. No unattended ChatGPT integration exists in the repository yet.**

## Non-negotiable product requirement

schedulerGPT must make progress on projects while the user is asleep, working, or away from the browser. Manual prompt copying, manual sending, or manual response capture is not an acceptable *primary* workflow. The user's intended execution target is **regular ChatGPT** on their existing subscription; no Codex, Work, or separately billed OpenAI API.

This file supersedes the earlier prioritization of a manual-handoff MVP. The current code is a proof-of-concept for local scheduling, UI, and project storage, **not a release satisfying the user goal**.

## Supported path worth validating first: native ChatGPT Scheduled Tasks

OpenAI documents that scheduled tasks in Chat can work unattended, and that tasks inside an existing chat can use its context. Standalone scheduled runs can start a fresh conversation each time. Connected tools/plugins may be available to scheduled tasks depending on the account and action permissions.

Rather than rely on indefinite growth of one ChatGPT conversation, prefer **one separate scheduled run per execution** that rehydrates its instructions and state from durable external documents.

A practical architecture to validate:

1. User creates a long-running project in schedulerGPT (name, objective, plan, schedule).
2. A companion **durable state document** is kept in a service accessible both to the homelab app and a regular ChatGPT Scheduled Task — e.g. a Google Drive folder and Google Doc, once permission to access/edit these from Scheduled is proven.
3. On initial setup, the user authorizes the connected service and creates the native Scheduled Task **once** in regular ChatGPT, using setup instructions from schedulerGPT. This is not a recurring manual handoff.
4. Each scheduled run reads the last accepted plan and progress, works on the next unfinished milestone, and writes its updated state and work product back to the connected service.
5. The homelab app synchronizes and displays that shared state, run results, and scheduling metadata to the extent supported by the connected service and its auth.
6. Each run uses a new task conversation as appropriate, so there's no need for the app to detect that an arbitrary existing chat is "full."
7. Any actions that require user approval should clearly show a blocked state. The system must not silently declare success.

**Important limitations to validate:** Whether regular Chat scheduled tasks may perform the required Google Drive or GitHub write actions without intervention, the task's run limits, and how the homelab app securely reads the same files. Native ChatGPT Scheduled Tasks do not expose an external REST endpoint for this app to create/edit arbitrary tasks or push messages into existing ChatGPT conversations. Thus the schedule is ultimately configured in ChatGPT, not controlled directly by the local job timer, unless a supported integration emerges.

References:
- https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- https://learn.chatgpt.com/docs/automations
- https://help.openai.com/en/articles/10929079-google-drive-app-and-setup-in-chatgpt

## Option not consistent with current user constraints: OpenAI API

A server-side OpenAI API worker would provide full timing, state synchronization, retries, model responses, and automated project processing, but it creates separately billed API conversations. **Do not enable or implement it without explicit user approval.**

## Browser-automation caveat

Playwright/Puppeteer could technically interact with the ChatGPT web UI, but this is not an authorized integration and unattended automated extraction of ChatGPT outputs is restricted by OpenAI's Terms of Use. Do not silently use private ChatGPT endpoints, attempt to bypass login, CAPTCHA, rate limits, or verification, or claim a browser-based worker is reliable or compliant without a supported path.

Reference: https://openai.com/policies/terms-of-use/

## Updated release gates (must pass before claiming autonomous mode)

- [ ] Demonstrate a *regular ChatGPT* scheduled run performing substantive work without the user present.
- [ ] Confirm the connected app can read the prior project plan and write back updated progress **without manual approvals each run**.
- [ ] Verify that a second scheduled run correctly continues from the stored result.
- [ ] Verify a successor conversation or standalone run can continue without relying on old chat history.
- [ ] Confirm homelab can securely synchronize the same source-of-truth files without exposing credentials.
- [ ] Verify errors, missed runs, partial updates, duplicate-run protection, and interrupted writes.
- [ ] Confirm correct behavior during a homelab outage and after recovery.
- [ ] Do not promote the current manual-handoff UI as a completed unattended scheduler.

## First feasibility experiment (no production data)

Create a test document in Google Drive containing:

```
# Test Project
Objective: Write 20 original social media post ideas.
Next task: Write ideas 1–5.
Completed: none.
```

In a regular ChatGPT chat, with the Google Drive plugin authorized, first ask ChatGPT to read it and update the next-task and completed sections. Verify the actual document changed. Then create an in-chat or standalone Scheduled Task with the durable workflow, and verify one unattended run changed that same document. Verify a second run continues from it.

If the write action requires approval each time, or isn't available to scheduled runs, **this path does not meet the requirement**. Revisit integration choices instead of disguising a manual step as automation.

## Security and privacy

- The source-code repo is public; **never save private project state or authentication tokens there**.
- A separate private Drive folder or private state repo should hold project data.
- Authenticated homelab dashboard remains private behind Twingate/HTTPS.
- Treat state documents as untrusted input. Validate task IDs, revisions and write permissions. Never auto-execute model-generated commands.
- Keep an append-only run log and backups; use atomic updates or revision guards.

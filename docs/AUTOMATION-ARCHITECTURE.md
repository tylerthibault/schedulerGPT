# schedulerGPT — Unattended automation architecture (decision pending)

> **Release blocker:** The user requires unattended ChatGPT work while sleeping/working. A recurring prompt that waits for manual copy/paste is not acceptable. The current application does not achieve the requirement.

## What we know

1. Regular consumer ChatGPT chats do not expose a supported public API allowing a self-hosted third-party scheduler to POST a message to an arbitrary existing chat.
2. ChatGPT **Scheduled Tasks** can run in ChatGPT while the user is away and may use supported connected apps such as GitHub. Specific app capabilities and permissions depend on the account and may require the user's approval for writes.
3. The OpenAI API supports developers building automated applications, but API usage is billed separately and does not post into existing consumer ChatGPT conversations. The user does **not** want this approach.
4. A browser automation program could technically drive an authenticated web browser, but DOM/screenshot extraction of ChatGPT Output by an external program is restricted under the OpenAI Terms of Use. Browser automation also fails unpredictably due to UI changes, verification prompts, and rate limits. Do **not** frame such an experiment as a supported production solution, and do not attempt to evade login challenges, rate limits, or other protections.

Primary sources:
- https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt
- https://openai.com/policies/terms-of-use/

## Proposed route A: ChatGPT-native automation + GitHub state (preferred under current constraints)

**Not yet proven end-to-end. Does not give the Coolify app control over when native Scheduled Tasks fire.**

1. A human sets up a single ChatGPT Scheduled Task for a project **once** in a regular ChatGPT conversation (not Codex or Work). No per-run copy/paste.
2. Store `plan.md`, `progress.md`, `decisions.md`, and completed outputs in a GitHub repository (private if appropriate).
3. The Scheduled Task instructs ChatGPT each time to:
   - retrieve current files via the supported GitHub connector;
   - choose the next unfinished task based on those files;
   - perform the actual work and save the deliverable;
   - update the plan/progress with a session ID, verified completion, and next step;
   - stop and report an approval/blocker rather than pretending it finished.
4. The Coolify web app is a project **dashboard**, source-of-truth editor, and run-history view. Future enhancement: read-only synchronization with GitHub-backed project files by appropriate credentials and permissions. It does not impersonate a ChatGPT browser or create ChatGPT Scheduled Tasks on its own.
5. Chat continuity comes from re-reading versioned project files each time; conversation rollover becomes less critical. User's original demand to always send into a named existing chat is **not satisfied by this mode**.

### Pilot / acceptance test before implementing the full dashboard

- [ ] Set up a tiny test project in a GitHub folder with a two-step checklist and progress log.
- [ ] Create one native ChatGPT Scheduled Task against that folder, not an API call or Codex.
- [ ] Confirm first scheduled execution produces a tangible deliverable in ChatGPT.
- [ ] Confirm it reads project files via GitHub and (where authorized) updates the progress file.
- [ ] Confirm the second scheduled execution reads the new progress, then selects a *different* next task.
- [ ] Confirm no per-run approval is needed for the permitted write operation. If approval is required, the route does not meet unattended requirements without a change to the workflow.
- [ ] Confirm failure logging and that a missed/paused task does not silently mark milestones complete.
- [ ] Determine whether the chat/run history meets user's expectations. Do not assume same-chat posting or automatic chat rollover.

### Initial setup prompt template (requires replacing placeholders)

```text
Create a recurring Scheduled Task in regular ChatGPT for this project:
[PROJECT NAME]

Project source-of-truth files:
GitHub repository: [OWNER/REPO]
Folder: [PROJECT_FOLDER]

At each scheduled run:
1. Read plan.md, progress.md, and decisions.md from the folder using the connected GitHub app.
2. Select the next unfinished task. Do actual work, not just a status summary.
3. Save the concrete deliverable to the project folder when the app's permissions allow it.
4. Update the plan and progress with what was *actually* completed, why, and the next task.
5. If the required read/write capability is unavailable or an action requires approval,
   report that blocker clearly and do not claim the state was saved.
6. Continue only from the project files rather than trusting the previous conversation's context.

Schedule: [USER-CHOSEN CADENCE AND TIMEZONE]
```

Do not schedule without a user-selected cadence. Never promise this works without running the pilot.

## Route B: OpenAI API execution engine (technically viable, user currently rejects)

- Coolify schedules each run, invokes the API, saves output, updates durable state.
- Can be made robust and fully unattended with retries/leases/validation.
- Requires an API key and separate billing; conversations will not be the same as consumer ChatGPT chats.
- **Do not implement without explicit approval to change the no-API requirement.**

## Route C: Browser scripting against chatgpt.com (not a recommended production route)

- Would require a separate browser profile and a persistent authenticated session.
- Not a supported method of submitting messages into ChatGPT chats, and automatic extraction of ChatGPT Output conflicts with Terms of Use.
- Also vulnerable to login challenges, UI changes, account limits, and conversation-length detection failures.
- Do not build automatic scraping of answers or bypass protections as part of this project.

## Architecture decisions

- **Approved:** Unattended execution, persistent plan/progress and continuity, Coolify hosting, regular ChatGPT plan usage, no Codex/Work/API billing.
- **Proposed:** Native ChatGPT Scheduled Tasks using GitHub as durable plan/progress, with a Coolify dashboard for visibility.
- **Open:** Whether permitted write actions can run without approval; whether per-project chat behavior can meet user's exact expectation; how to synchronize GitHub state with the local dashboard.
- **Excluded:** Per-run copy/paste as primary workflow; pretending a prepared prompt represents completed ChatGPT work.

## Release criteria

Do not label schedulerGPT an autonomous ChatGPT scheduler until *a full project session* can be initiated, performed, persisted, and resumed unattended for at least two consecutive runs with verifiable work output, no per-run manual handoff, and clear failure reporting.

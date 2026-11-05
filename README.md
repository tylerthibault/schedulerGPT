# schedulerGPT

A self-hosted project scheduler and continuity workspace for long-running ChatGPT projects.

> **PRODUCT GATE — NOT YET FIT FOR UNATTENDED USE:** The user's required outcome is that ChatGPT works **automatically while they are away or asleep**, without copying or pasting anything on each run. The current app **does not do that**. This repository is a foundation/prototype, **not** a finished solution to the request. Do not deploy it expecting autonomous ChatGPT execution. See [automation architecture and constraints](docs/AUTOMATION-ARCHITECTURE.md).

> **Integration status:** The initial release is a **manual handoff** workflow. It prepares prompts on a schedule, saves plans/progress, and gives you an Open ChatGPT + Copy Prompt flow. It **does not automatically submit messages to ChatGPT, read its output, or roll over conversations**. Regular ChatGPT chats have no supported external write API, and OpenAI's terms restrict automated extraction of ChatGPT output. See [docs/PRODUCT-PLAN.md](docs/PRODUCT-PLAN.md).

## Developer preview only — Coolify deployment does not enable automation

The code below starts the local planning dashboard, but its schedule only queues prompts for **manual** handoff. The unsupervised workflow is a release blocker.

## Quick start (foundation only)

```sh
docker build -t schedulergpt .
docker run --rm -p 127.0.0.1:3000:3000 \
  -e APP_PASSWORD='replace-with-a-long-random-password' \
  -e APP_USER='admin' \
  -e TZ='America/Los_Angeles' \
  -v schedulergpt-data:/data \
  schedulergpt
```

Open http://localhost:3000 and sign in. Or deploy the Dockerfile through Coolify, mounting **`/data` as persistent storage**. Set `APP_PASSWORD` before deployment. Keep access private through Twingate or another trusted gateway.

## What works in the foundation

- Create and organize long-running projects with an objective and optional ChatGPT conversation link.
- Daily, weekly or interval schedules (IANA timezone aware) that prepare a prompt when due.
- Save an editable `plan.md`, `progress.md`, session prompt files, and output records under `/data/projects/<id>/`.
- Copy an initial planning prompt, or a continuation prompt derived from the latest plan and progress (**development fallback only**, not the desired workflow).
- Open the saved ChatGPT conversation; paste work back and mark a session complete.
- See pending handoffs and historical runs; pause or resume projects.
- Password-protected web UI and persisted JSON state; no third-party npm dependencies.

## Local development

Node.js 22 or higher:

```sh
APP_PASSWORD='dev-only-password' npm start
npm test
```

The server listens at `http://localhost:3000` and stores data in `./data` by default. For production, set `DATA_DIR=/data`.

## Documentation

- [Automation feasibility, supported alternatives, and release gates](docs/AUTOMATION-ARCHITECTURE.md)
- [Project vision, approved scope and road map](docs/PRODUCT-PLAN.md)
- [Coolify setup and operating notes](docs/COOLIFY.md)

This repository does not contain ChatGPT login credentials, session cookies, API keys, or a browser scraping mechanism.

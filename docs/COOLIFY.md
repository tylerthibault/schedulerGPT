# Coolify deployment

Use the GitHub repo `tylerthibault/schedulerGPT` and select **Dockerfile** as the build pack. The repository already contains the Dockerfile; no Docker Compose is required in Coolify.

## Configure

1. Add a new **Application** in Coolify and connect the GitHub repository (branch `main`).
2. Choose Dockerfile build, expose **container port 3000**, and enable automatic restart / restart unless-stopped.
3. Set environment variables:
   - `APP_USER=admin`
   - `APP_PASSWORD=<a-unique-long-random-password>` (**required**, at least 10 characters)
   - `DATA_DIR=/data`
   - `TZ=America/Los_Angeles`
   - `PORT=3000`
4. Configure a **persistent storage mount** (named volume or host directory) at **`/data`**. Do not deploy without it, or redeployments can lose your projects.
5. Prefer a private network using Twingate. If a reverse-proxy domain is used, enforce HTTPS and access controls. The app uses HTTP Basic authentication and must not be exposed over unencrypted HTTP.
6. Health endpoint: `GET /health` should return `{"ok":true}`.
7. Deploy; visit the Coolify-generated URL through the private network and sign in with `APP_USER` / `APP_PASSWORD`.

## After first deployment

- Create a project and choose a schedule/timezone.
- Click **Prepare prompt** and confirm a prompt is visible in the UI.
- Open regular ChatGPT, submit prompt manually, paste ChatGPT output back, and complete the session.
- Edit **plan.md** to incorporate any revised milestone/checklist structure.
- Restart the container and verify the project and session history persist.

## Operational notes

- JSON state lives at `/data/state.json`. Per-project Markdown lives under `/data/projects/<uuid>/`.
- Back up the entire volume including `state.json` and `projects/` together. Never edit `state.json` while the app is running.
- Only **one schedulerGPT container replica** should use a given storage volume. Multi-instance deployment would need a transactional database and a proper distributed job lease.
- Prepared prompts persist; background *ChatGPT work* is not performed by this container.
- There is no automatic detection/rollover when consumer ChatGPT conversations become full.
- Cron-like daily/weekly jobs are prepared after their designated local time, once per local calendar day, when the app is online and no handoff is pending. Interval jobs start counting from project creation or the last scheduled preparation.
- In-memory timer checks every 30 seconds, so jobs are **not** guaranteed to run at an exact second.
- If you move from a Mac browser to this server, you do **not** need to sign ChatGPT into the server; the initial version does not run a browser.
- For a clean instance, rotate APP_PASSWORD in Coolify and redeploy when necessary.

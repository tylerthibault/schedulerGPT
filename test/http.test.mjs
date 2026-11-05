import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

test('authenticated API manages projects, handoffs, and persistent output', async (t) => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'schedulergpt-http-'));
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  const port = await unusedPort();
  const child = spawn(process.execPath, ['src/server.mjs'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, DATA_DIR: data, PORT: String(port), APP_USER: 'tester', APP_PASSWORD: 'an-integration-password', TZ: 'UTC' }
  });
  t.after(() => { child.kill('SIGTERM'); });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const base = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error('Server stopped: ' + stderr);
    try {
      const response = await fetch(base + '/health');
      if (response.ok) { ready = true; break; }
    } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'server should become healthy');
  const unauthorized = await fetch(base + '/api/bootstrap');
  assert.equal(unauthorized.status, 401);
  const headers = {
    Authorization: 'Basic ' + Buffer.from('tester:an-integration-password').toString('base64'),
    'Content-Type': 'application/json'
  };
  const initial = await fetch(base + '/api/bootstrap', { headers });
  assert.equal(initial.status, 200);
  const initialState = await initial.json();
  assert.equal(initialState.integration.automaticChatGPTMessaging, false);

  const created = await fetch(base + '/api/projects', {
    method: 'POST', headers,
    body: JSON.stringify({
      name: 'Test project', objective: 'Finish a multi-session plan',
      chatUrl: 'https://chatgpt.com/c/test',
      timezone: 'UTC', schedule: { kind: 'interval', minutes: 60 }
    })
  });
  assert.equal(created.status, 201);
  const { project } = await created.json();
  const detail = await fetch(base + '/api/projects/' + project.id, { headers });
  assert.equal(detail.status, 200);
  assert.match((await detail.json()).plan, /Finish a multi-session plan/);

  const prepared = await fetch(base + '/api/projects/' + project.id + '/prepare', {
    method: 'POST', headers, body: '{}'
  });
  assert.equal(prepared.status, 200);
  const { run } = await prepared.json();
  assert.equal(run.status, 'prepared');
  assert.match(run.prompt, /Finish a multi-session plan/);

  const completed = await fetch(base + '/api/runs/' + run.id + '/complete', {
    method: 'POST', headers,
    body: JSON.stringify({ resultText: 'One milestone finished.' })
  });
  assert.equal(completed.status, 200);
  const after = await fetch(base + '/api/projects/' + project.id, { headers });
  const detailAfter = await after.json();
  assert.match(detailAfter.progress, /One milestone finished/);
  assert.equal(detailAfter.runs[0].status, 'completed');
});

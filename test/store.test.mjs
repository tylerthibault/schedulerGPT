import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.mjs';
import { makePrompt } from '../src/prompts.mjs';

test('project, prompt, completion and progress survive restart', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedulergpt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let store = createStore(dir);
  const project = store.createProject({
    name: 'Content strategy',
    objective: 'Produce 30 useful content ideas.',
    chatUrl: 'https://chatgpt.com/c/example',
    timezone: 'America/Los_Angeles',
    schedule: { kind: 'daily', time: '08:00' }
  });
  assert.match(store.readDoc(project.id, 'plan'), /Produce 30 useful content ideas/);
  const prompt = makePrompt(project, store.readDoc(project.id, 'plan'), store.readDoc(project.id, 'progress'));
  const run = store.prepareRun(project.id, prompt, 'scheduled', 'daily:2026-11-04');
  assert.equal(store.prepareRun(project.id, prompt, 'manual').id, run.id);
  assert.equal(store.getProject(project.id).lastScheduledKey, 'daily:2026-11-04');
  store.completeRun(run.id, 'Wrote the first five ideas.');
  assert.match(store.readDoc(project.id, 'progress'), /Wrote the first five ideas/);
  store = createStore(dir);
  assert.equal(store.runsForProject(project.id)[0].status, 'completed');
  assert.equal(store.getProject(project.id).name, 'Content strategy');
  const files = fs.readdirSync(path.join(dir, 'projects', project.id, 'outputs'));
  assert.equal(files.length, 1);
});

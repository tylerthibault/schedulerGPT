import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function writeAtomic(filename, content) {
  const tmp = filename + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, filename);
}

export function createStore(dataDirectory) {
  const root = path.resolve(dataDirectory);
  const projectsDirectory = path.join(root, 'projects');
  fs.mkdirSync(projectsDirectory, { recursive: true, mode: 0o700 });
  const dbFile = path.join(root, 'state.json');
  let state = { version: 1, projects: [], runs: [] };
  if (fs.existsSync(dbFile)) {
    const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.runs)) {
      throw new Error('Invalid persisted state.json file.');
    }
    state = parsed;
  }
  function persist() {
    writeAtomic(dbFile, JSON.stringify(state, null, 2) + '\n');
  }
  function projectDir(id) { return path.join(projectsDirectory, id); }
  function getProject(id) { return state.projects.find((p) => p.id === id) || null; }
  function getRun(id) { return state.runs.find((r) => r.id === id) || null; }
  function readDoc(id, doc) {
    if (!getProject(id)) return null;
    if (doc !== 'plan' && doc !== 'progress') throw new Error('Invalid document.');
    return fs.readFileSync(path.join(projectDir(id), doc + '.md'), 'utf8');
  }
  function writeDoc(id, doc, content) {
    const project = getProject(id);
    if (!project) return null;
    if (doc !== 'plan' && doc !== 'progress') throw new Error('Invalid document.');
    writeAtomic(path.join(projectDir(id), doc + '.md'), String(content));
    project.updatedAt = new Date().toISOString();
    persist();
    return project;
  }
  function createProject(input) {
    const id = randomUUID();
    const time = new Date().toISOString();
    const project = {
      id, name: input.name, objective: input.objective, chatUrl: input.chatUrl || '',
      timezone: input.timezone, schedule: input.schedule, enabled: true,
      createdAt: time, updatedAt: time, lastScheduledAt: null, lastScheduledKey: null
    };
    const directory = projectDir(id);
    fs.mkdirSync(path.join(directory, 'sessions'), { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(directory, 'outputs'), { recursive: true, mode: 0o700 });
    writeAtomic(path.join(directory, 'plan.md'), [
      '# ' + input.name, '', '## Objective', input.objective, '',
      '## Working plan', '- [ ] Ask ChatGPT to expand this objective into milestones and actionable tasks.', '',
      '## Decisions and constraints', '- User preferences and explicit approvals go here.', ''
    ].join('\n'));
    writeAtomic(path.join(directory, 'progress.md'), '# Progress\n\nNo sessions completed yet.\n');
    state.projects.push(project);
    persist();
    return project;
  }
  function updateProject(id, changes) {
    const project = getProject(id);
    if (!project) return null;
    Object.assign(project, changes, { updatedAt: new Date().toISOString() });
    persist();
    return project;
  }
  function pendingRun(projectId) {
    return state.runs.find((r) => r.projectId === projectId && r.status === 'prepared') || null;
  }
  function prepareRun(id, prompt, trigger = 'manual', scheduledKey = null) {
    const project = getProject(id);
    if (!project) return null;
    const existing = pendingRun(id);
    if (existing) return { ...existing, alreadyPending: true };
    const run = {
      id: randomUUID(), projectId: id, trigger, status: 'prepared',
      createdAt: new Date().toISOString(), completedAt: null,
      prompt, resultFile: null
    };
    writeAtomic(path.join(projectDir(id), 'sessions', run.id + '-prompt.md'), prompt + '\n');
    state.runs.unshift(run);
    if (scheduledKey) {
      project.lastScheduledKey = scheduledKey;
      project.lastScheduledAt = run.createdAt;
    }
    persist();
    return run;
  }
  function completeRun(runId, resultText) {
    const run = getRun(runId);
    if (!run) return null;
    if (run.status !== 'prepared') throw new Error('Only prepared runs can be completed.');
    const project = getProject(run.projectId);
    const completedAt = new Date().toISOString();
    const outputName = run.id + '-response.md';
    writeAtomic(path.join(projectDir(project.id), 'outputs', outputName), resultText + '\n');
    const log = path.join(projectDir(project.id), 'progress.md');
    const existing = fs.readFileSync(log, 'utf8');
    writeAtomic(log, existing + '\n## Session ' + completedAt + '\n\n' + resultText.trim() + '\n');
    run.status = 'completed';
    run.completedAt = completedAt;
    run.resultFile = 'outputs/' + outputName;
    project.updatedAt = completedAt;
    persist();
    return run;
  }
  function dismissRun(runId) {
    const run = getRun(runId);
    if (!run) return null;
    if (run.status !== 'prepared') throw new Error('Only prepared runs can be dismissed.');
    run.status = 'dismissed';
    run.completedAt = new Date().toISOString();
    persist();
    return run;
  }
  return {
    listProjects: () => [...state.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getProject, getRun, pendingRun,
    runsForProject: (id) => state.runs.filter((r) => r.projectId === id),
    readDoc, writeDoc, createProject, updateProject, prepareRun, completeRun, dismissRun
  };
}

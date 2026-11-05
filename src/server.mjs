import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { dueKey, normalizeSchedule, validTimezone } from './schedule.mjs';
import { makePrompt } from './prompts.mjs';

const PASSWORD = process.env.APP_PASSWORD;
if (!PASSWORD || PASSWORD.length < 10) {
  console.error('APP_PASSWORD is required and must be at least 10 characters.');
  process.exit(1);
}
const USER = process.env.APP_USER || 'admin';
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(process.env.DATA_DIR || './data');
const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const store = createStore(ROOT);

function constantEqual(a, b) {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
}
function authorized(request) {
  const auth = request.headers.authorization || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const raw = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const idx = raw.indexOf(':');
    return idx >= 0 && constantEqual(raw.slice(0, idx), USER) && constantEqual(raw.slice(idx + 1), PASSWORD);
  } catch { return false; }
}
function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('Cache-Control', 'no-store');
}
function json(response, code, data) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}
function error(response, code, message) { json(response, code, { error: message }); }
async function body(request) {
  if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    const err = new Error('Content-Type must be application/json.'); err.status = 415; throw err;
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) {
      const err = new Error('Request too large (maximum 1 MB).'); err.status = 413; throw err;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const err = new Error('Invalid JSON.'); err.status = 400; throw err; }
}
function textField(value, label, max, required = true) {
  const valueAsString = typeof value === 'string' ? value.trim() : '';
  if (required && !valueAsString) throw new Error(label + ' is required.');
  if (valueAsString.length > max) throw new Error(label + ' is too long.');
  return valueAsString;
}
function validChatUrl(value) {
  const url = textField(value || '', 'Chat URL', 1000, false);
  if (!url) return '';
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new Error('Enter a full ChatGPT conversation URL.'); }
  if (parsed.protocol !== 'https:' || !['chatgpt.com', 'chat.openai.com'].includes(parsed.hostname)) {
    throw new Error('Chat URL must be an HTTPS chatgpt.com link.');
  }
  return parsed.toString();
}
function validateProject(data, partial = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid project.');
  const fields = {};
  if (!partial || data.name !== undefined) fields.name = textField(data.name, 'Name', 120);
  if (!partial || data.objective !== undefined) fields.objective = textField(data.objective, 'Objective', 10000);
  if (!partial || data.chatUrl !== undefined) fields.chatUrl = validChatUrl(data.chatUrl);
  if (!partial || data.timezone !== undefined) {
    const timezone = textField(data.timezone || process.env.TZ || 'UTC', 'Timezone', 80);
    if (!validTimezone(timezone)) throw new Error('Timezone must be a valid IANA timezone.');
    fields.timezone = timezone;
  }
  if (!partial || data.schedule !== undefined) fields.schedule = normalizeSchedule(data.schedule);
  if (partial && data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') throw new Error('Enabled must be true or false.');
    fields.enabled = data.enabled;
  }
  if (partial && data.schedule !== undefined) {
    fields.lastScheduledKey = null;
    fields.lastScheduledAt = new Date().toISOString();
  }
  return fields;
}
function documentResponse(id) {
  const project = store.getProject(id);
  if (!project) return null;
  return {
    project,
    plan: store.readDoc(id, 'plan'),
    progress: store.readDoc(id, 'progress'),
    runs: store.runsForProject(id),
    pendingRun: store.pendingRun(id)
  };
}
function prepare(projectId, trigger, key = null) {
  const project = store.getProject(projectId);
  if (!project) return null;
  const prompt = makePrompt(project, store.readDoc(projectId, 'plan'), store.readDoc(projectId, 'progress'));
  return store.prepareRun(projectId, prompt, trigger, key);
}
function schedulerTick() {
  const now = new Date();
  for (const project of store.listProjects()) {
    try {
      const key = dueKey(project, now);
      if (key && !store.pendingRun(project.id)) {
        prepare(project.id, 'scheduled', key);
        console.log('Scheduled prompt prepared for project ' + project.id);
      }
    } catch (err) {
      console.error('Scheduling failed for project ' + project.id, err.message);
    }
  }
}

async function handle(request, response) {
  securityHeaders(response);
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname === '/health') return json(response, 200, { ok: true });
  if (!authorized(request)) {
    response.setHeader('WWW-Authenticate', 'Basic realm="schedulerGPT", charset="UTF-8"');
    return error(response, 401, 'Sign in required.');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) return error(response, 403, 'Cross-origin writes are blocked.');
  }
  if (pathname === '/api/bootstrap' && request.method === 'GET') {
    return json(response, 200, {
      projects: store.listProjects().map((p) => ({ ...p, pending: Boolean(store.pendingRun(p.id)) })),
      integration: { mode: 'manual', automaticChatGPTMessaging: false, automaticRollover: false }
    });
  }
  if (pathname === '/api/projects' && request.method === 'POST') {
    const data = validateProject(await body(request));
    return json(response, 201, { project: store.createProject(data) });
  }
  const projectMatch = /^\/api\/projects\/([a-f0-9-]{36})(?:\/(plan|progress|prepare))?$/.exec(pathname);
  if (projectMatch) {
    const [, id, action] = projectMatch;
    const project = store.getProject(id);
    if (!project) return error(response, 404, 'Project not found.');
    if (!action && request.method === 'GET') return json(response, 200, documentResponse(id));
    if (!action && request.method === 'PATCH') {
      const changes = validateProject(await body(request), true);
      return json(response, 200, { project: store.updateProject(id, changes) });
    }
    if (action === 'prepare' && request.method === 'POST') {
      return json(response, 200, { run: prepare(id, 'manual') });
    }
    if (['plan', 'progress'].includes(action) && request.method === 'PUT') {
      const data = await body(request);
      if (typeof data.content !== 'string' || data.content.length > 200000) {
        return error(response, 400, 'Document must be text of at most 200,000 characters.');
      }
      store.writeDoc(id, action, data.content);
      return json(response, 200, { ok: true });
    }
  }
  const runMatch = /^\/api\/runs\/([a-f0-9-]{36})(?:\/(complete|dismiss))?$/.exec(pathname);
  if (runMatch) {
    const [, id, action] = runMatch;
    const run = store.getRun(id);
    if (!run) return error(response, 404, 'Run not found.');
    if (!action && request.method === 'GET') return json(response, 200, { run });
    if (action === 'complete' && request.method === 'POST') {
      const data = await body(request);
      if (typeof data.resultText !== 'string' || !data.resultText.trim() || data.resultText.length > 200000) {
        return error(response, 400, 'Paste the completed response (up to 200,000 characters).');
      }
      return json(response, 200, { run: store.completeRun(id, data.resultText) });
    }
    if (action === 'dismiss' && request.method === 'POST') return json(response, 200, { run: store.dismissRun(id) });
  }
  if (request.method === 'GET') {
    const publicFiles = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/index.html': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
      '/styles.css': ['styles.css', 'text/css; charset=utf-8']
    };
    const asset = publicFiles[pathname];
    if (asset) {
      response.writeHead(200, { 'Content-Type': asset[1] });
      return response.end(fs.readFileSync(path.join(assets, asset[0])));
    }
  }
  return error(response, 404, 'Not found.');
}
const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (err.status || /required|too long|valid|Choose|Interval|schedule|weekday/i.test(err.message)) {
      return error(res, err.status || 400, err.message);
    }
    console.error('Request error:', err);
    return error(res, 500, 'Unexpected server error.');
  });
});
schedulerTick();
const timer = setInterval(schedulerTick, 30000);
server.listen(PORT, '0.0.0.0', () => console.log('schedulerGPT listening on port ' + PORT));
function shutdown() { clearInterval(timer); server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

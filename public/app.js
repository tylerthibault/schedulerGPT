'use strict';
const $ = (id) => document.getElementById(id);
const state = { projects: [], current: null, selectedId: null, run: null };
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function request(url, method = 'GET', payload) {
  const options = { method, headers: {} };
  if (payload !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function tell(message, problem = false) {
  const node = $('message');
  node.textContent = message;
  node.className = problem ? 'message error' : 'message success';
  clearTimeout(tell.timer);
  tell.timer = setTimeout(() => { node.className = ''; node.textContent = ''; }, 5500);
}
async function run(action) {
  try { await action(); } catch (err) { console.error(err); tell(err.message, true); }
}
function dayCheckboxes(container, prefix) {
  days.forEach((day, i) => {
    const label = document.createElement('label');
    label.className = 'day-check';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.value = String(i);
    check.checked = i >= 1 && i <= 5;
    label.append(check, document.createTextNode(day));
    container.append(label);
  });
}
function scheduleFrom(formPrefix) {
  const kind = $(formPrefix + '-kind').value;
  if (kind === 'interval') return { kind, minutes: Number($(formPrefix + '-minutes').value) };
  const time = $(formPrefix + '-time').value;
  if (kind === 'daily') return { kind, time };
  const weekdays = [...$(formPrefix + '-days').querySelectorAll('input:checked')].map((i) => Number(i.value));
  return { kind, time, weekdays };
}
function fillSchedule(prefix, schedule) {
  $(prefix + '-kind').value = schedule.kind;
  $(prefix + '-time').value = schedule.time || '08:00';
  $(prefix + '-minutes').value = schedule.minutes || 60;
  $(prefix + '-days').querySelectorAll('input').forEach((i) => {
    i.checked = (schedule.weekdays || [1, 2, 3, 4, 5]).includes(Number(i.value));
  });
  syncScheduleFields(prefix);
}
function syncScheduleFields(prefix) {
  const kind = $(prefix + '-kind').value;
  $(prefix + '-time-wrap').hidden = kind === 'interval';
  $(prefix + '-interval-wrap').hidden = kind !== 'interval';
  $(prefix + '-days-wrap').hidden = kind !== 'weekly';
}
function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function describe(project) {
  const s = project.schedule;
  if (s.kind === 'interval') return 'Every ' + s.minutes + ' minutes';
  if (s.kind === 'daily') return 'Daily · ' + s.time;
  return s.weekdays.map((d) => days[d]).join(', ') + ' · ' + s.time;
}

async function bootstrap(preferredId) {
  const data = await request('/api/bootstrap');
  state.projects = data.projects;
  renderSidebar();
  const id = preferredId || state.selectedId || (state.projects[0] && state.projects[0].id);
  if (id && state.projects.some((p) => p.id === id)) await loadProject(id);
  else {
    state.selectedId = null;
    state.current = null;
    $('empty-state').hidden = false;
    $('workspace').hidden = true;
  }
}
function renderSidebar() {
  const list = $('project-list');
  list.replaceChildren();
  if (!state.projects.length) {
    const p = document.createElement('div');
    p.className = 'side-empty';
    p.textContent = 'No projects yet.';
    list.append(p);
  }
  state.projects.forEach((project) => {
    const button = document.createElement('button');
    button.className = 'project-link' + (project.id === state.selectedId ? ' selected' : '');
    const marker = document.createElement('span'); marker.className = 'project-mark'; marker.textContent = project.name.charAt(0).toUpperCase();
    const copy = document.createElement('span'); copy.className = 'project-link-copy';
    const title = document.createElement('strong'); title.textContent = project.name;
    const subtitle = document.createElement('small'); subtitle.textContent = project.pending ? 'Prompt ready' : project.enabled ? 'Scheduled' : 'Paused';
    const dot = document.createElement('span'); dot.className = 'status-dot' + (project.pending ? ' attention' : project.enabled ? '' : ' inactive');
    copy.append(title, subtitle); button.append(marker, copy, dot);
    button.addEventListener('click', () => run(() => loadProject(project.id)));
    list.append(button);
  });
}
async function loadProject(id) {
  const data = await request('/api/projects/' + id);
  state.current = data;
  state.selectedId = id;
  $('empty-state').hidden = true;
  $('workspace').hidden = false;
  renderSidebar();
  const p = data.project;
  $('project-title').textContent = p.name;
  $('project-objective').textContent = p.objective;
  $('project-status').textContent = p.enabled ? '● Active' : '◌ Paused';
  $('project-status').className = 'state-label' + (p.enabled ? '' : ' paused');
  $('toggle-project').textContent = p.enabled ? 'Pause' : 'Resume';
  $('project-schedule').textContent = describe(p);
  $('metric-pending').textContent = data.pendingRun ? '1 READY' : '0';
  $('metric-completed').textContent = String(data.runs.filter((r) => r.status === 'completed').length);
  $('pending-banner').hidden = !data.pendingRun;
  $('plan-editor').value = data.plan;
  $('progress-editor').value = data.progress;
  $('settings-name').value = p.name;
  $('settings-objective').value = p.objective;
  $('settings-chat').value = p.chatUrl;
  $('settings-timezone').value = p.timezone;
  fillSchedule('settings', p.schedule);
  $('chat-link').href = p.chatUrl || 'https://chatgpt.com/';
  $('chat-link-label').textContent = p.chatUrl ? 'Conversation linked — open the saved chat.' : 'No saved conversation URL — open ChatGPT to start one.';
  renderHistory();
}
function renderHistory() {
  const list = $('history-list');
  list.replaceChildren();
  if (!state.current.runs.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No sessions yet. Select “Prepare prompt” to create your first handoff.';
    list.append(empty); return;
  }
  for (const item of state.current.runs) {
    const row = document.createElement('div'); row.className = 'history-row';
    const info = document.createElement('div');
    const heading = document.createElement('strong'); heading.textContent = formatDate(item.createdAt);
    const subtitle = document.createElement('p'); subtitle.textContent = item.trigger + ' · ' + item.status;
    const action = document.createElement('button'); action.className = 'button secondary small-button';
    action.textContent = 'View prompt';
    action.addEventListener('click', () => showRun(item));
    info.append(heading, subtitle); row.append(info, action); list.append(row);
  }
}
function selectTab(tab) {
  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  ['plan', 'progress', 'history', 'settings'].forEach((name) => {
    $('tab-' + name).hidden = name !== tab;
  });
}
async function showRun(runItem) {
  const detail = await request('/api/runs/' + runItem.id);
  state.run = detail.run;
  const item = state.run;
  $('run-title').textContent = item.status === 'prepared' ? 'Prepared prompt' : 'Session · ' + item.status;
  $('run-detail').textContent = item.trigger + ' · ' + formatDate(item.createdAt);
  $('run-prompt').value = item.prompt;
  $('run-result').value = '';
  $('run-chat').href = state.current.project.chatUrl || 'https://chatgpt.com/';
  $('run-completion').hidden = item.status !== 'prepared';
  $('dismiss-run').hidden = item.status !== 'prepared';
  $('run-dialog').showModal();
}
function closeDialog(id) { $(id).close(); }
function onClick(id, action) { $(id).addEventListener('click', () => run(action)); }

dayCheckboxes($('create-days'));
dayCheckboxes($('settings-days'));
$('create-kind').addEventListener('change', () => syncScheduleFields('create'));
$('settings-kind').addEventListener('change', () => syncScheduleFields('settings'));
document.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', () => closeDialog(node.dataset.close)));
document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
['new-project-top', 'new-project-empty'].forEach((id) => onClick(id, async () => {
  $('create-form').reset();
  $('create-timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  fillSchedule('create', { kind: 'daily', time: '08:00' });
  $('create-dialog').showModal();
}));
onClick('refresh-button', async () => { await bootstrap(); tell('Workspace refreshed.'); });
$('create-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(async () => {
    const form = new FormData(event.target);
    const payload = {
      name: form.get('name'), objective: form.get('objective'), chatUrl: form.get('chatUrl'),
      timezone: form.get('timezone'), schedule: scheduleFrom('create')
    };
    const data = await request('/api/projects', 'POST', payload);
    closeDialog('create-dialog');
    await bootstrap(data.project.id);
    tell('Project created. Prepare a prompt to plan your first milestone.');
  });
});
$('settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(async () => {
    const payload = {
      name: $('settings-name').value, objective: $('settings-objective').value,
      chatUrl: $('settings-chat').value, timezone: $('settings-timezone').value,
      schedule: scheduleFrom('settings')
    };
    await request('/api/projects/' + state.selectedId, 'PATCH', payload);
    await bootstrap(state.selectedId);
    tell('Project settings saved.');
  });
});
onClick('toggle-project', async () => {
  await request('/api/projects/' + state.selectedId, 'PATCH', { enabled: !state.current.project.enabled });
  await bootstrap(state.selectedId);
  tell('Project schedule updated.');
});
onClick('save-plan', async () => {
  await request('/api/projects/' + state.selectedId + '/plan', 'PUT', { content: $('plan-editor').value });
  await bootstrap(state.selectedId);
  tell('plan.md saved.');
});
onClick('save-progress', async () => {
  await request('/api/projects/' + state.selectedId + '/progress', 'PUT', { content: $('progress-editor').value });
  await bootstrap(state.selectedId);
  tell('progress.md saved.');
});
onClick('run-now', async () => {
  const data = await request('/api/projects/' + state.selectedId + '/prepare', 'POST', {});
  await bootstrap(state.selectedId);
  await showRun(data.run);
});
onClick('open-pending', () => showRun(state.current.pendingRun));
onClick('copy-prompt', async () => {
  const input = $('run-prompt');
  try {
    await navigator.clipboard.writeText(input.value);
    tell('Prompt copied to clipboard.');
  } catch {
    input.focus(); input.select();
    tell('Select and copy the highlighted prompt. Clipboard permission may require HTTPS.');
  }
});
onClick('dismiss-run', async () => {
  await request('/api/runs/' + state.run.id + '/dismiss', 'POST', {});
  closeDialog('run-dialog');
  await bootstrap(state.selectedId);
  tell('Handoff dismissed.');
});
onClick('complete-run', async () => {
  const resultText = $('run-result').value;
  if (!resultText.trim()) throw new Error('Paste the ChatGPT response before completing the session.');
  await request('/api/runs/' + state.run.id + '/complete', 'POST', { resultText });
  closeDialog('run-dialog');
  await bootstrap(state.selectedId);
  tell('Response saved locally. Review and update the master plan if ChatGPT revised it.');
});

run(() => bootstrap());

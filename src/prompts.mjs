const MAX_SECTION = 30000;
function bounded(value, label) {
  const text = String(value || '');
  if (text.length <= MAX_SECTION) return text;
  return text.slice(0, MAX_SECTION) + '\n\n[TRUNCATED: ' + label + ' is longer than 30,000 characters. Consult the local file before continuing.]';
}

export function makePrompt(project, plan, progress) {
  return [
    '# schedulerGPT project handoff',
    '',
    'Project: ' + project.name,
    '',
    '## Original objective',
    bounded(project.objective, 'objective'),
    '',
    '## Current plan (local plan.md snapshot)',
    bounded(plan, 'plan'),
    '',
    '## Progress log (local progress.md snapshot)',
    bounded(progress, 'progress'),
    '',
    '## Instructions',
    'You are continuing a long-running project. Work on the next unfinished, highest-priority actionable step from the plan.',
    'If the plan is only a starter template, first write a realistic, detailed milestone-and-task plan; do not claim implementation has already happened.',
    'Distinguish completed work from recommendations or proposals. Never assume you can see or edit local files.',
    'Do useful work during this session, not just a to-do list. Identify blockers and information that needs user approval.',
    'Do not mark a task finished unless it was actually completed and can be verified.',
    '',
    '## Response format',
    '### Work completed',
    'Describe the concrete work and outputs.',
    '### Updated plan',
    'Provide a complete revised Markdown plan when one is needed; otherwise say "No change."',
    '### Progress note',
    'A concise note suitable for appending to the local progress log.',
    '### Next session',
    'State the next unfinished task and any blocker.',
    '',
    'IMPORTANT: This app does not automatically read ChatGPT output or update local files.',
    'The user will copy the response into schedulerGPT and update plan.md if necessary.'
  ].join('\n');
}

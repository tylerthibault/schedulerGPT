import test from 'node:test';
import assert from 'node:assert/strict';
import { dueKey, normalizeSchedule, validTimezone } from '../src/schedule.mjs';

test('validates scheduling inputs', () => {
  assert.deepEqual(normalizeSchedule({ kind: 'daily', time: '08:30' }), { kind: 'daily', time: '08:30' });
  assert.deepEqual(normalizeSchedule({ kind: 'weekly', time: '09:15', weekdays: [5, 1, 1] }), { kind: 'weekly', time: '09:15', weekdays: [1, 5] });
  assert.throws(() => normalizeSchedule({ kind: 'interval', minutes: 1 }));
  assert.throws(() => normalizeSchedule({ kind: 'daily', time: '25:12' }));
  assert.equal(validTimezone('America/Los_Angeles'), true);
  assert.equal(validTimezone('Not/A_Zone'), false);
});

test('daily schedule respects Los Angeles timezone and one-run-per-day key', () => {
  const project = {
    enabled: true, timezone: 'America/Los_Angeles',
    schedule: { kind: 'daily', time: '08:00' },
    createdAt: '2026-11-04T00:00:00Z', lastScheduledKey: null
  };
  assert.equal(dueKey(project, new Date('2026-11-04T15:59:00Z')), null);
  assert.equal(dueKey(project, new Date('2026-11-04T16:01:00Z')), 'daily:2026-11-04');
  project.lastScheduledKey = 'daily:2026-11-04';
  assert.equal(dueKey(project, new Date('2026-11-04T18:00:00Z')), null);
});

test('weekly schedule only triggers on selected weekday', () => {
  const project = {
    enabled: true, timezone: 'UTC',
    schedule: { kind: 'weekly', time: '08:00', weekdays: [1] },
    lastScheduledKey: null
  };
  assert.equal(dueKey(project, new Date('2026-11-04T09:00:00Z')), null);
  assert.equal(dueKey(project, new Date('2026-11-02T09:00:00Z')), 'weekly:2026-11-02');
});

test('interval schedule uses last execution time and paused projects do not fire', () => {
  const project = {
    enabled: true, timezone: 'UTC',
    schedule: { kind: 'interval', minutes: 60 },
    lastScheduledAt: '2026-11-04T12:00:00Z',
    createdAt: '2026-11-04T12:00:00Z'
  };
  assert.equal(dueKey(project, new Date('2026-11-04T12:30:00Z')), null);
  assert.ok(dueKey(project, new Date('2026-11-04T13:00:00Z')));
  project.enabled = false;
  assert.equal(dueKey(project, new Date('2026-11-04T14:00:00Z')), null);
});

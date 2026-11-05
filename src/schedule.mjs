const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const formatters = new Map();

export function validTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeSchedule(input) {
  if (!input || typeof input !== 'object') throw new Error('A schedule is required.');
  const kind = input.kind;
  if (kind === 'interval') {
    const minutes = Number(input.minutes);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 10080) {
      throw new Error('Interval must be 15 to 10,080 minutes.');
    }
    return { kind, minutes };
  }
  if (kind !== 'daily' && kind !== 'weekly') {
    throw new Error('Schedule must be daily, weekly, or interval.');
  }
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    throw new Error('Choose a valid HH:MM time.');
  }
  if (kind === 'daily') return { kind, time: input.time };
  const weekdays = [...new Set(input.weekdays || [])].map(Number);
  if (!weekdays.length || weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error('Choose at least one weekday.');
  }
  return { kind, time: input.time, weekdays: weekdays.sort() };
}

function localParts(date, timezone) {
  let fmt = formatters.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
    });
    formatters.set(timezone, fmt);
  }
  const values = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dateKey: values.year + '-' + values.month + '-' + values.day,
    minuteOfDay: Number(values.hour) * 60 + Number(values.minute),
    weekday: dayNames.indexOf(values.weekday)
  };
}

export function dueKey(project, now = new Date()) {
  if (!project.enabled) return null;
  const schedule = project.schedule;
  if (schedule.kind === 'interval') {
    const since = project.lastScheduledAt ? new Date(project.lastScheduledAt).getTime() : new Date(project.createdAt).getTime();
    if (now.getTime() - since >= schedule.minutes * 60000) {
      return 'interval:' + Math.floor(now.getTime() / (schedule.minutes * 60000));
    }
    return null;
  }
  const local = localParts(now, project.timezone);
  const [hour, minute] = schedule.time.split(':').map(Number);
  if (local.minuteOfDay < hour * 60 + minute) return null;
  if (schedule.kind === 'weekly' && !schedule.weekdays.includes(local.weekday)) return null;
  const key = schedule.kind + ':' + local.dateKey;
  return project.lastScheduledKey === key ? null : key;
}

export function describeSchedule(project) {
  const s = project.schedule;
  if (s.kind === 'interval') return 'Every ' + s.minutes + ' minutes';
  const time = s.time + ' (' + project.timezone + ')';
  if (s.kind === 'daily') return 'Every day at ' + time;
  return s.weekdays.map((d) => dayNames[d]).join(', ') + ' at ' + time;
}

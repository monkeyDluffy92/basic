/**
 * SmartSync — Cross-Platform Calendar & Reminder Export Library
 *
 * Supports:
 *  macOS  — Apple Calendar (webcal:// deep link), Apple Reminders, Share Sheet
 *  Windows — .ics download for Outlook/Windows Calendar, .csv tasks for Microsoft To Do
 *  Android — .ics via Web Share API
 *  iOS    — .ics via Web Share API → Apple Calendar
 *  All    — .ics download, clipboard copy, Slack/Email formatted text
 *
 * New in this version:
 *  - RRULE support (recurring events in ICS)
 *  - Timezone-aware DTSTART/DTEND (TZID parameter)
 *  - COMMON_TIMEZONES list + getBrowserTimezone() helper
 */

// ─── Common Timezones ─────────────────────────────────────────────────────────

export const COMMON_TIMEZONES = [
  { value: 'UTC',                  label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York',     label: 'Eastern Time (New York)' },
  { value: 'America/Chicago',      label: 'Central Time (Chicago)' },
  { value: 'America/Denver',       label: 'Mountain Time (Denver)' },
  { value: 'America/Los_Angeles',  label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Toronto',      label: 'Eastern Time (Toronto)' },
  { value: 'America/Vancouver',    label: 'Pacific Time (Vancouver)' },
  { value: 'America/Sao_Paulo',    label: 'Brasília Time (São Paulo)' },
  { value: 'Europe/London',        label: 'GMT / BST (London)' },
  { value: 'Europe/Paris',         label: 'CET / CEST (Paris, Berlin)' },
  { value: 'Europe/Istanbul',      label: 'Turkey Time (Istanbul)' },
  { value: 'Europe/Moscow',        label: 'Moscow Time' },
  { value: 'Africa/Cairo',         label: 'Egypt Time (Cairo)' },
  { value: 'Asia/Dubai',           label: 'Gulf Time (Dubai, UAE) UTC+4' },
  { value: 'Asia/Karachi',         label: 'Pakistan Time (Karachi) UTC+5' },
  { value: 'Asia/Kolkata',         label: 'India Time (Mumbai, Delhi) UTC+5:30' },
  { value: 'Asia/Dhaka',           label: 'Bangladesh Time (Dhaka) UTC+6' },
  { value: 'Asia/Bangkok',         label: 'Indochina Time (Bangkok) UTC+7' },
  { value: 'Asia/Singapore',       label: 'Singapore / Malaysia Time UTC+8' },
  { value: 'Asia/Shanghai',        label: 'China Time (Beijing, Shanghai) UTC+8' },
  { value: 'Asia/Tokyo',           label: 'Japan Time (Tokyo) UTC+9' },
  { value: 'Asia/Seoul',           label: 'Korea Time (Seoul) UTC+9' },
  { value: 'Australia/Sydney',     label: 'Australian Eastern (Sydney)' },
  { value: 'Pacific/Auckland',     label: 'New Zealand Time (Auckland)' },
];

export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// ─── Platform Detection ───────────────────────────────────────────────────────

export function detectPlatform() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Mac/.test(platform) && !('ontouchend' in document)) return 'macos';
  if (/Win/.test(platform) || /Windows/.test(ua)) return 'windows';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function canWebShare() {
  return typeof navigator.share === 'function';
}

export function canShareFiles() {
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

// ─── Date & Time Helpers ─────────────────────────────────────────────────────

export function fmtDate(d) {
  if (!d || d === 'null') return 'Date TBD';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return d; }
}

export function fmtTime(t) {
  if (!t || t === 'null') return '';
  try {
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h)) return '';
    return ` · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch { return ''; }
}

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsDateTime(date, time) {
  if (!date || date === 'null') return null;
  const d = date.replace(/-/g, '');
  if (time && time !== 'null') {
    const [hh, mm] = time.split(':').map(s => parseInt(s) || 0);
    const t = String(hh).padStart(2, '0') + String(mm).padStart(2, '0') + '00';
    return `${d}T${t}`;
  }
  return d; // all-day
}

function addHour(time) {
  try {
    const [h, m] = time.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } catch { return time; }
}

// ─── ICS Generation ──────────────────────────────────────────────────────────

/**
 * Generate a valid iCalendar (.ics) string from events array.
 * @param {Array}  events   - array of event objects
 * @param {string} timezone - IANA timezone string (e.g. 'Asia/Karachi'). Defaults to 'UTC'.
 *
 * When timezone != 'UTC', uses DTSTART;TZID=<tz>:YYYYMMDDTHHMMSS format,
 * which major calendar apps (Google, Apple, Outlook) resolve from their own TZDB.
 * Also injects RRULE line for recurring events.
 */
export function makeICS(events, timezone = 'UTC') {
  const useUTC = false; // Force floating time for all events to prevent timezone shifting

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SmartSync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SmartSync Extracts'
  ];

  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  events.forEach((ev, i) => {
    const dtStart = icsDateTime(ev.date, ev.time);
    
    // RFC 5545: DTSTART is absolutely required for VEVENTs.
    // If an extracted event has no date, it cannot be added to a calendar.
    if (!dtStart) return;

    const uid    = `smartsync-${stamp}-${i}-${Math.random().toString(36).slice(2, 7)}@smartsync.app`;
    const dtEnd   = ev.endTime
      ? icsDateTime(ev.date, ev.endTime)
      : (ev.time && ev.time !== 'null')
        ? icsDateTime(ev.date, addHour(ev.time))
        : null;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${stamp}`);
    lines.push('SEQUENCE:0');
    lines.push(`SUMMARY:${icsEscape(ev.emoji ? `${ev.emoji} ${ev.title}` : ev.title)}`);

    if (dtStart) {
      const isAllDay = !ev.time || ev.time === 'null';
      if (isAllDay) {
        // RFC 5545: all-day DTEND must be the *next* day (exclusive end)
        const nextDay = new Date((ev.date || '1970-01-01') + 'T12:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const nd = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
        lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
        lines.push(`DTEND;VALUE=DATE:${nd}`);
      } else {
        // Timed events: use floating time without Z or TZID.
        // This ensures "9:00 AM" imports exactly as 9:00 AM in the user's local timezone.
        lines.push(`DTSTART:${dtStart}`);
        if (dtEnd) lines.push(`DTEND:${dtEnd}`);
      }
    }

    // RRULE — recurring events (e.g. "FREQ=WEEKLY;BYDAY=MO,TH")
    if (ev.rrule) {
      lines.push(`RRULE:${ev.rrule}`);
    }

    if (ev.location && ev.location !== 'null') {
      lines.push(`LOCATION:${icsEscape(ev.location)}`);
    }
    if (ev.description) {
      lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    }
    
    // Add standard 15-minute alert to ensure iOS recognizes it correctly
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT15M');
    lines.push('ACTION:DISPLAY');
    lines.push('DESCRIPTION:Reminder');
    lines.push('END:VALARM');

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  
  // RFC 5545: Lines cannot exceed 75 octets. We must safely "fold" them.
  const foldedLines = [];
  lines.forEach(line => {
    let current = '';
    let currentBytes = 0;

    // Iterate over unicode code points (prevents splitting emojis in half)
    for (const char of line) {
      // Safe byte estimation: ASCII = 1, anything else = max 4 bytes
      const bytes = char.charCodeAt(0) > 127 ? 4 : 1;
      
      if (currentBytes + bytes > 70) {
        foldedLines.push(current);
        current = ' ' + char;
        currentBytes = 1 + bytes; // 1 byte for the leading space
      } else {
        current += char;
        currentBytes += bytes;
      }
    }
    if (current) foldedLines.push(current);
  });

  return foldedLines.join('\r\n');
}

// ─── CSV Task Export (Microsoft To Do / Windows Tasks) ───────────────────────

export function makeTasksCSV(todos) {
  const headers = ['Subject', 'Due Date', 'Start Date', 'Priority', 'Notes', 'Status'];
  const priorityMap = { high: 'High', medium: 'Normal', low: 'Low' };

  const rows = todos.map((todo) => {
    const dueDate = todo.dueDate && todo.dueDate !== 'null'
      ? new Date(todo.dueDate + 'T12:00:00').toLocaleDateString('en-US')
      : '';
    const priority = priorityMap[todo.priority] || 'Normal';
    const subject  = `${todo.emoji || ''} ${todo.title}`.trim();
    const notes    = [todo.description, todo.dueTime ? `Due time: ${fmtTime(todo.dueTime)}` : '']
      .filter(Boolean).join(' | ');

    return [subject, dueDate, '', priority, notes, 'Not Started']
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

// ─── Text Formats ─────────────────────────────────────────────────────────────

export function makeSlackMessage(events, todos) {
  const parts = ['*📋 Schedule & Reminders — SmartSync*', '─'.repeat(36), ''];

  if (events.length > 0) {
    parts.push('*📅 Calendar Events*');
    events.forEach((ev) => {
      parts.push(`${ev.emoji || '📅'} *${ev.title}*${ev.recurringLabel ? ` _(${ev.recurringLabel})_` : ''}`);
      parts.push(`   📆 ${fmtDate(ev.date)}${fmtTime(ev.time)}`);
      if (ev.location && ev.location !== 'null') parts.push(`   📍 ${ev.location}`);
      if (ev.description) parts.push(`   _${ev.description}_`);
      parts.push('');
    });
  }

  if (todos.length > 0) {
    parts.push('*✅ Reminders & Tasks*');
    todos.forEach((todo) => {
      const priority = todo.priority === 'high' ? '🔴' : todo.priority === 'medium' ? '🟡' : '🟢';
      parts.push(`${todo.emoji || '✅'} *${todo.title}* ${priority}`);
      if (todo.dueDate && todo.dueDate !== 'null') {
        parts.push(`   ⏰ Due: ${fmtDate(todo.dueDate)}${fmtTime(todo.dueTime)}`);
      }
      if (todo.description) parts.push(`   _${todo.description}_`);
      parts.push('');
    });
  }

  parts.push('─'.repeat(36), '_via SmartSync · AI Calendar Extractor_');
  return parts.join('\n');
}

export function makeEmailMessage(events, todos) {
  const parts = ['Hi,', '', 'Here\'s a schedule and task update:', ''];

  if (events.length > 0) {
    parts.push('CALENDAR EVENTS', '─'.repeat(24));
    events.forEach((ev) => {
      parts.push(`• ${ev.title}${ev.recurringLabel ? ` (${ev.recurringLabel})` : ''}`);
      parts.push(`  When: ${fmtDate(ev.date)}${fmtTime(ev.time)}`);
      if (ev.location && ev.location !== 'null') parts.push(`  Where: ${ev.location}`);
      if (ev.description) parts.push(`  ${ev.description}`);
      parts.push('');
    });
  }

  if (todos.length > 0) {
    parts.push('TASKS & REMINDERS', '─'.repeat(24));
    todos.forEach((todo) => {
      const priority = `[${(todo.priority || 'medium').toUpperCase()}]`;
      parts.push(`• ${todo.title} ${priority}`);
      if (todo.dueDate && todo.dueDate !== 'null') {
        parts.push(`  Due: ${fmtDate(todo.dueDate)}${fmtTime(todo.dueTime)}`);
      }
      if (todo.description) parts.push(`  ${todo.description}`);
      parts.push('');
    });
  }

  parts.push('Please add these to your calendars as needed.', '', 'Best regards');
  return parts.join('\n');
}

export function makeReminderText(todos) {
  return todos.map((todo) => {
    const due = todo.dueDate && todo.dueDate !== 'null'
      ? `\nDue: ${fmtDate(todo.dueDate)}${fmtTime(todo.dueTime)}`
      : '';
    return `${todo.emoji || '✅'} ${todo.title}${due}${todo.description ? '\n' + todo.description : ''}`;
  }).join('\n\n---\n\n');
}

// ─── File Download Helpers ───────────────────────────────────────────────────

export function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadICS(events, filename = 'smartsync-events.ics', timezone = 'UTC') {
  downloadBlob(makeICS(events, timezone), filename, 'text/calendar;charset=utf-8');
}

export function downloadTasksCSV(todos, filename = 'smartsync-tasks.csv') {
  downloadBlob(makeTasksCSV(todos), filename, 'text/csv;charset=utf-8');
}

// ─── Platform-Specific Deep Links ────────────────────────────────────────────

export function openAppleCalendar(events) {
  downloadICS(events, 'smartsync-events.ics');
}

export function openOutlook(events) {
  if (events.length === 1) {
    const ev = events[0];
    const subject = encodeURIComponent(`[Event] ${ev.title}`);
    const body = encodeURIComponent(
      `Event: ${ev.title}\nDate: ${fmtDate(ev.date)}${fmtTime(ev.time)}` +
      (ev.location && ev.location !== 'null' ? `\nLocation: ${ev.location}` : '') +
      (ev.description ? `\nDetails: ${ev.description}` : '')
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }
  downloadICS(events);
}

export async function nativeShare(data) {
  if (!canWebShare()) throw new Error('Web Share API not supported');
  await navigator.share(data);
}

export async function shareICSFile(events, title = 'Calendar Events') {
  const timezone = getBrowserTimezone();
  const icsContent = makeICS(events, timezone);
  const file = new File([icsContent], 'smartsync-events.ics', { type: 'text/calendar' });

  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    await navigator.share({ title, files: [file] });
  } else if (canWebShare()) {
    await navigator.share({ title, text: makeEmailMessage(events, []) });
  } else {
    downloadICS(events);
  }
}

/**
 * Google Calendar — web URL (works on all platforms via browser)
 */
export function openGoogleCalendarEvent(ev) {
  if (!ev.date || ev.date === 'null') return;

  const fmt = (d, t) => {
    const date = d.replace(/-/g, '');
    if (t && t !== 'null') {
      const time = t.replace(':', '') + '00';
      return `${date}T${time}`;
    }
    return date;
  };

  const start = fmt(ev.date, ev.time);
  const end   = ev.endTime ? fmt(ev.date, ev.endTime) : fmt(ev.date, ev.time ? addHour(ev.time) : null);

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     `${ev.emoji || ''} ${ev.title}`,
    dates:    `${start}/${end}`,
    details:  ev.description || '',
    location: (ev.location && ev.location !== 'null') ? ev.location : '',
  });

  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
}

/**
 * Outlook Web — web URL for online Outlook calendar
 */
export function openOutlookWebEvent(ev) {
  if (!ev.date || ev.date === 'null') return;

  const startDate = new Date(ev.date + 'T' + (ev.time && ev.time !== 'null' ? ev.time + ':00' : '09:00:00'));
  const endDate   = new Date(startDate.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams({
    path:      '/calendar/action/compose',
    rru:       'addevent',
    subject:   `${ev.emoji || ''} ${ev.title}`,
    startdt:   startDate.toISOString(),
    enddt:     endDate.toISOString(),
    body:      ev.description || '',
    location:  (ev.location && ev.location !== 'null') ? ev.location : '',
  });

  window.open(`https://outlook.live.com/calendar/0/action/compose?${params.toString()}`, '_blank');
}

/**
 * Uploads ICS content to an ephemeral hosting service (tmpfiles.org)
 * and returns a direct download link that forces iOS to launch the calendar importer.
 */
export async function generateShareableLink(events, timezone) {
  const icsContent = makeICS(events, timezone);
  const blob = new Blob([icsContent], { type: 'text/calendar; charset=utf-8' });
  const fd = new FormData();
  fd.append('file', blob, 'smartsync-events.ics');

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: fd
  });
  
  if (!res.ok) throw new Error('Failed to upload file');
  const json = await res.json();
  if (json.status !== 'success') throw new Error('Failed to upload file');

  // json.data.url is e.g. "https://tmpfiles.org/12345/smartsync-events.ics"
  // We insert "/dl/" to get the direct download version that forces text/calendar headers
  return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

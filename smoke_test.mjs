// Smoke test — runs parser directly, no browser needed
// Usage: node smoke_test.mjs

import { extractFromText, stripNoise } from './src/lib/parser.js';

const TEST_TEXT = `
Hey team, here's the full August schedule and action items. Please review before EOD Friday.

We kick off with the Q3 Strategy Session on August 1st at 9:00 AM in Boardroom A — mandatory for all department leads. Right after, there's a 1:1 between product and engineering at 11:30 AM in the same building. Submit your Q3 OKR drafts to the ops inbox by July 31st EOD — they need 24 hours to compile the master deck before the session.

The investor product demo is August 6th at 2:00 PM via Zoom — dial-in link shared morning of. The staging build must be signed off by August 5th; remind the engineering team to push the final build to staging by August 4th evening. There's also a vendor onboarding call on August 7th at 11:00 AM — the vendor NDA and the security questionnaire both need to be countersigned and returned before that call.

Design checkpoint: the design system review is August 12th at 10:00 AM in the War Room, covering token updates and the mobile component library. Upload the final Figma files by August 10th and send preview links to the PMs. Accessibility audit with the external consultancy — August 11th is the target wrap date for that, and Sarah needs a status update.

The monthly all-hands is August 20th at 3:00 PM in the main auditorium. Comms needs three business days to prepare, so send your team talking points by August 16th. Back-to-back that evening: engineering dinner at Coppice at 7:00 PM and the product launch celebration at The Ivy at 8:30 PM.

Final stretch: August 27th is the hard code freeze for the v2.2 patch release. Notify all active contributors and lock the main branch by August 26th. Legal review of the release notes is mandatory before publish — send the finalized release notes draft to legal@company.com by August 24th. Also, August 29th — public holiday for several team members in the UK and Germany, plan coverage accordingly.
`;

const clean = stripNoise(TEST_TEXT);
const { events, todos, sourceMappings } = extractFromText(clean);

const missCount = sourceMappings.filter(m => m.type === 'possible-miss').length;

console.log('\n═══════════════════════════════════════════════');
console.log(`  SMARTSYNC SMOKE TEST — ${new Date().toLocaleTimeString()}`);
console.log('═══════════════════════════════════════════════\n');

console.log(`📅 CALENDAR EVENTS (${events.length})`);
console.log('─'.repeat(50));
for (const ev of events) {
  const date = ev.date || 'Date TBD';
  const time = ev.time ? ` · ${ev.time}` : '';
  const loc  = ev.location ? ` @ ${ev.location}` : '';
  const rec  = ev.recurringLabel ? ` [↻ ${ev.recurringLabel}]` : '';
  console.log(`  ${ev.emoji} ${ev.title}`);
  console.log(`     ${date}${time}${loc}${rec}`);
}

console.log(`\n✅ REMINDERS / TODOS (${todos.length})`);
console.log('─'.repeat(50));
for (const td of todos) {
  const due = td.dueDate ? ` · Due: ${td.dueDate}` : ' · No due date';
  const pri = ` [${td.priority}]`;
  console.log(`  ${td.emoji} ${td.title}`);
  console.log(`     ${due}${pri}`);
}

console.log(`\n⚠️  POSSIBLE MISSES (${missCount})`);
console.log('─'.repeat(50));
const misses = sourceMappings.filter(m => m.type === 'possible-miss');
if (misses.length === 0) {
  console.log('  (none)');
} else {
  for (const m of misses) {
    console.log(`  → "${m.chunk.slice(0, 90)}${m.chunk.length > 90 ? '…' : ''}"`);
  }
}

console.log(`\n📊 SUMMARY`);
console.log('─'.repeat(50));
console.log(`  Events:    ${events.length}`);
console.log(`  Reminders: ${todos.length}`);
console.log(`  Flagged:   ${missCount}`);
console.log(`  Ignored:   ${sourceMappings.filter(m => m.type === 'ignored').length}`);
console.log(`  Total chunks processed: ${sourceMappings.length}`);

// Quality checks
console.log('\n🔍 QUALITY CHECKS');
console.log('─'.repeat(50));

const checks = [
  { name: 'Q3 Strategy Session (Aug 1, 9 AM)',     pass: events.some(e => e.date === '2026-08-01' && e.time === '09:00') },
  { name: '1:1 meeting (Aug 1, 11:30 AM)',          pass: events.some(e => e.date === '2026-08-01' && e.time === '11:30') },
  { name: 'Product demo (Aug 6, 2 PM)',             pass: events.some(e => e.date === '2026-08-06' && e.time === '14:00') },
  { name: 'Design system review as EVENT',          pass: events.some(e => e.date === '2026-08-12' && /design|system|review/i.test(e.title)) },
  { name: 'All-hands NOT recurring',               pass: events.some(e => e.date === '2026-08-20' && !e.recurringLabel) },
  { name: 'OKR drafts reminder (Jul 31)',           pass: todos.some(t => t.dueDate === '2026-07-31') },
  { name: 'Staging build reminder (Aug 5)',         pass: todos.some(t => t.dueDate === '2026-08-05') },
  { name: 'Upload Figma reminder (Aug 10)',         pass: todos.some(t => t.dueDate === '2026-08-10') },
  { name: 'Code freeze NOT "is the hard code"',    pass: events.some(e => e.date === '2026-08-27' && !/^is the/i.test(e.title)) || todos.some(t => t.dueDate === '2026-08-27' && !/^is the/i.test(t.title)) },
  { name: 'Demo title clean (no "is via Zoom")',   pass: events.some(e => e.date === '2026-08-06' && !/is via/i.test(e.title)) },
];

let passed = 0;
for (const c of checks) {
  const icon = c.pass ? '✅' : '❌';
  if (c.pass) passed++;
  console.log(`  ${icon} ${c.name}`);
}

console.log(`\n  Score: ${passed}/${checks.length} checks passed`);
console.log('\n═══════════════════════════════════════════════\n');

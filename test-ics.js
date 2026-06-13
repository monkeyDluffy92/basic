import { makeICS } from './src/lib/calendar.js';

const events = [
  {
    id: '123',
    title: 'Test Event',
    date: '2026-08-01',
    time: '09:00',
    endTime: '10:00',
    description: 'This is a test',
    emoji: '🚀'
  }
];

console.log(makeICS(events, 'UTC'));

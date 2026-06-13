/**
 * SmartSync — Client-Side Text Parser v2
 * Extracts calendar events and todos from plain text using regex + keyword detection.
 * No API required. Works fully offline.
 *
 * v2 fixes:
 *  1. Filter events with no date AND no strong event keyword (kills "Date TBD" junk)
 *  2. Abbreviation-aware sentence splitter — won't split on "St.", "Dr.", "No.", etc.
 *  3. Sub-clause splitting — extracts embedded deadlines ("by X") from inside event sentences
 *  4. Flight / travel / hotel → always classified as events
 *  5. Title cleaner strips leading dangling prepositions / articles
 */

// ─── Month / Day lookups ─────────────────────────────────────────────────────

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MONTH_NAMES   = Object.keys(MONTHS).filter(k => k.length > 3);
const MONTH_ABBR    = Object.keys(MONTHS).filter(k => k.length <= 3);
const MONTH_PATTERN = [...MONTH_NAMES, ...MONTH_ABBR].join('|');

// ─── Keyword sets ─────────────────────────────────────────────────────────────

const EVENT_KEYWORDS = [
  'meeting','sync','call','standup','stand-up','conference','presentation','demo',
  'interview','workshop','training','webinar','all-hands','all hands','kickoff',
  'kick-off','session','seminar','summit','ceremony','celebration',
  'launch','event','appointment','discussion','briefing',
  'huddle','debrief','retrospective','retro','onboarding','orientation',
  'open house','networking','panel','rally','town hall','townhall',
  '1:1','1-on-1','one-on-one','one on one',
  // travel
  'flight','departing','departures','arrives','arriving','landing',
  'fly out','fly back','fly home','take off','eurostar','train to','driving to',
  'hotel','check-in','dinner','lunch','breakfast',
  // strong anchors
  'roundtable','all-hands','debrief','audit',
];

const TODO_KEYWORDS = [
  'submit','send','finish','complete','prepare','update','write','create',
  'remind','reminder','due','deadline','deliver','upload','publish','release',
  'deploy','fix','resolve','implement','schedule','book','register','sign up',
  'follow up','follow-up',"don't forget",'need to','have to','must','todo',
  'to-do','task','action item','approve','finalize','draft',
  'respond','reply','confirm','rsvp','order','purchase','pay','notify',
  'report','compile','gather','collect','verify','check','test',
  'make sure',"don't forget",'please make sure',
];

// Strong event-only anchors — if present, classify as event regardless
const STRONG_EVENT_PATTERNS = [
  /\b(flight|fly(ing)?\s+(out|back|home)|departing|landing|eurostar|hotel\s+check.?in|check\s+into)\b/i,
  /\b(meeting|all.?hands|conference|roundtable|dinner|presentation|demo|summit|panel|review|audit)\b/i,
  /\b(1:1|1-on-1|one-on-one|one on one)\b/i,
];

// Sub-clause deadline patterns — "confirm X by [date]", "submit X by [date]", etc.
// These get extracted as SEPARATE todos even when inside an event sentence
const DEADLINE_SUBCLAUSE = /(?:confirm|submit|send|upload|book|register|push|notify|contact|finalize|remind)\s+.{3,60}?\s+by\s+(?:July|June|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:EOD|morning|evening|noon|midnight))?/gi;

// ─── Weekday → RRULE day code ─────────────────────────────────────────────────

const RRULE_DAY = {
  monday: 'MO', tuesday: 'TU', wednesday: 'WE',
  thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU',
};

// ─── Noise Stripping ──────────────────────────────────────────────────────────

export function stripNoise(rawText) {
  let text = rawText;
  text = text.replace(/^(From|To|Cc|Bcc|Reply-To|Sent|Date|Subject)\s*:.*$/gim, '');
  text = text.replace(/^On\s+.{5,120}wrote:\s*$/gim, '');
  text = text.replace(/^>+\s?.*/gm, '');
  text = text.replace(/^[-_=*]{5,}.*$/gm, '');
  text = text.replace(/^[\w][\w\s.'"-]{1,40}\s{2,}\d{1,2}:\d{2}\s*(?:AM|PM)\s*$/gim, '');
  text = text.replace(/^\[?\d{1,2}:\d{2}\s*(?:AM|PM)?\]?\s*$/gim, '');
  text = text.replace(/:[a-z0-9_+\-]{1,30}:/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// ─── Recurring Detection ──────────────────────────────────────────────────────

function detectRecurring(chunk) {
  const lower = chunk.toLowerCase();

  // FIX: require "every" prefix — "monthly all-hands" = one-off, NOT recurring
  if (/\bevery\s+day\b|\bdaily\b/.test(lower))
    return { rrule: 'FREQ=DAILY', label: 'Daily' };

  if (/\bevery\s+month\b|recurring\s+monthly|repeating\s+monthly/.test(lower))
    return { rrule: 'FREQ=MONTHLY', label: 'Monthly' };

  if (/\bevery\s+year\b|\bannually\b|\byearly\b/.test(lower))
    return { rrule: 'FREQ=YEARLY', label: 'Yearly' };

  const multiDayMatch = lower.match(
    /every\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:and|,)\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)/
  );
  if (multiDayMatch) {
    const days = multiDayMatch[1].match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/g);
    if (days && days.length > 0) {
      const byday  = days.map(d => RRULE_DAY[d]).join(',');
      const labels = days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3));
      return { rrule: `FREQ=WEEKLY;BYDAY=${byday}`, label: `Weekly · ${labels.join(', ')}` };
    }
  }

  const singleDayMatch = lower.match(/every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (singleDayMatch) {
    const day   = singleDayMatch[1];
    const code  = RRULE_DAY[day];
    const label = day.charAt(0).toUpperCase() + day.slice(1, 3);
    return { rrule: `FREQ=WEEKLY;BYDAY=${code}`, label: `Weekly · ${label}` };
  }

  if (/\bevery\s+week\b|\bweekly\b/.test(lower))
    return { rrule: 'FREQ=WEEKLY', label: 'Weekly' };

  return null;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getYear() { return new Date().getFullYear(); }

function resolveRelativeDate(word) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const w = word.toLowerCase().trim();

  if (w === 'today')     return fmtISO(today);
  if (w === 'tomorrow')  { today.setDate(today.getDate() + 1); return fmtISO(today); }
  if (w === 'yesterday') { today.setDate(today.getDate() - 1); return fmtISO(today); }

  const dayIdx = WEEKDAYS.indexOf(w.replace(/^(next|this)\s+/, ''));
  if (dayIdx !== -1) {
    const isNext = w.startsWith('next');
    const curDay = today.getDay();
    let diff = dayIdx - curDay;
    if (isNext || diff <= 0) diff += 7;
    today.setDate(today.getDate() + diff);
    return fmtISO(today);
  }
  return null;
}

function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDate(month, day, year) {
  const y = year || getYear();
  const m = MONTHS[month.toLowerCase()] || MONTHS[MONTH_ABBR.find(a => month.toLowerCase().startsWith(a))];
  if (!m) return null;
  const d   = String(parseInt(day)).padStart(2, '0');
  const iso = `${y}-${m}-${d}`;
  if (!year) {
    const parsed = new Date(iso + 'T12:00:00');
    const now    = new Date();
    if (parsed < now && (now - parsed) > 30 * 24 * 60 * 60 * 1000) {
      return `${y + 1}-${m}-${d}`;
    }
  }
  return iso;
}

function parseTime(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();

  // FIX: skip ratio-style numbers like "1:1", "1:30" without am/pm — ambiguous
  // A time must have am/pm OR be in HH:MM format with minutes >= 0 that looks clock-like
  let m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (m) {
    const ampm = m[3];
    // Require explicit am/pm OR hour >= 1 and minutes == 00 or 30 (common clock times)
    // Reject patterns like 1:1, 1:2 which are ratio notation
    if (!ampm && m[2] !== '00' && m[2] !== '30' && m[2] !== '15' && m[2] !== '45') {
      // Might be a ratio — only accept if hour >= 6 (unlikely ratio)
      if (parseInt(m[1]) < 6) { /* skip */ }
      else {
        let h = parseInt(m[1]);
        return `${String(h).padStart(2, '0')}:${m[2]}`;
      }
    } else {
      let h = parseInt(m[1]);
      const min = m[2];
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${min}`;
    }
  }

  m = t.match(/(\d{1,2})\s*(am|pm)/);
  if (m) {
    let h = parseInt(m[1]);
    const ampm = m[2];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}

// ─── Sentence / chunk splitter (v2) ──────────────────────────────────────────
// FIX: don't split on abbreviations like "St.", "Dr.", "No.", "Jr.", "Sr.",
//      "Blvd.", "Ave.", "Mt.", "vs.", "approx.", "dept.", "Corp.", "Inc.", "Ltd."

const ABBR_PATTERN = /\b(St|Dr|Mr|Mrs|Ms|Prof|Jr|Sr|No|Blvd|Ave|Mt|vs|approx|dept|Corp|Inc|Ltd|etc|approx|Fig|vol|pp|est)\.\s*$/i;

function splitIntoChunks(text) {
  // Split on newlines and bullet-point markers first
  const rawLines = text.split(/\n|(?:^|\n)\s*[-•*·▸▹►]\s*/m);

  // ── Merge continuation lines ──────────────────────────────────────────────
  // A line that starts lowercase, or starts with a preposition/conjunction,
  // or is an email/URL fragment, is a continuation of the previous line.
  const CONTINUATION = /^(?:by|to|at|in|on|for|and|or|with|from|via|the|a|an|before|after|until|into|through|across|during|between)\s/i;
  const merged = [];
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const startsLower   = /^[a-z]/.test(trimmed);
    const isContinuation = startsLower || CONTINUATION.test(trimmed) || /^[^\s@]+@[^\s@]+/.test(trimmed);

    if (isContinuation && merged.length > 0) {
      // Append to previous line
      merged[merged.length - 1] += ' ' + trimmed;
    } else {
      merged.push(trimmed);
    }
  }

  // ── Split merged lines into sentences ─────────────────────────────────────
  const chunks = [];
  for (const line of merged) {
    // Split on sentence boundaries (.!?;) but not on abbreviations
    // FIX: added semicolons as valid split points to handle "X by Aug 5th; remind Y"
    const sentences = [];
    let current = '';
    const parts = line.split(/(?<=[.!?;])\s+/);

    for (const part of parts) {
      if (ABBR_PATTERN.test(current + part) || (current && ABBR_PATTERN.test(current))) {
        current = current ? current + ' ' + part : part;
      } else {
        if (current) sentences.push(current.trim());
        current = part;
      }
    }
    if (current) sentences.push(current.trim());

    for (const s of sentences) {
      if (s.length > 3) chunks.push(s);
    }
  }

  // ── Split compound events: "X at TIME and Y at TIME" ────────────────────
  // If a single chunk has 2+ time references separated by "and", split them.
  const TIME_RX = /\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi;
  const finalChunks = [];
  for (const chunk of chunks) {
    const timeMatches = chunk.match(TIME_RX);
    if (timeMatches && timeMatches.length >= 2) {
      // Try to split on " and " that sits between two time-bearing halves
      const andIdx = chunk.search(/\s+and\s+/i);
      if (andIdx > 0) {
        const left  = chunk.substring(0, andIdx).trim();
        const right = chunk.substring(andIdx).trim();
        if (left.match(TIME_RX) && right.match(TIME_RX) && left.length > 10 && right.length > 10) {
          finalChunks.push(left);
          finalChunks.push(right);
          continue;
        }
      }
    }
    finalChunks.push(chunk);
  }

  return finalChunks;
}

// ─── Date extractor ───────────────────────────────────────────────────────────

function extractDateFromChunk(chunk) {
  const text  = chunk;
  const lower = text.toLowerCase();
  let date    = null;
  let timeRaw = null;

  const r1 = new RegExp(
    `(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+(\\d{4}))?`, 'i'
  );
  let m = text.match(r1);
  if (m) date = buildDate(m[1], m[2], m[3] ? parseInt(m[3]) : null);

  if (!date) {
    const r2 = new RegExp(
      `(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:[,\\s]+(\\d{4}))?`, 'i'
    );
    m = text.match(r2);
    if (m) date = buildDate(m[2], m[1], m[3] ? parseInt(m[3]) : null);
  }

  if (!date) {
    m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (m) {
      const y  = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : null;
      const mo = String(parseInt(m[1])).padStart(2, '0');
      const dy = String(parseInt(m[2])).padStart(2, '0');
      if (parseInt(m[1]) <= 12 && parseInt(m[2]) <= 31) {
        date = `${y || getYear()}-${mo}-${dy}`;
      }
    }
  }

  if (!date) {
    m = text.match(/\b(20\d{2})-(0?\d|1[0-2])-([0-2]?\d|3[01])\b/);
    if (m) date = `${m[1]}-${String(parseInt(m[2])).padStart(2,'0')}-${String(parseInt(m[3])).padStart(2,'0')}`;
  }

  if (!date) {
    const relMatch = lower.match(
      /\b(today|tomorrow|yesterday|(?:next|this)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
    );
    if (relMatch) date = resolveRelativeDate(relMatch[1]);
  }

  const timePatterns = [
    /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i,
    /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\b/i,
    /\b(\d{1,2}\s*(?:am|pm))\b/i,
  ];
  for (const tp of timePatterns) {
    const tm = text.match(tp);
    if (tm) { timeRaw = tm[1]; break; }
  }

  return { date, time: parseTime(timeRaw) };
}

// ─── Location extractor ───────────────────────────────────────────────────────

function extractLocation(chunk) {
  const patterns = [
    /\bat\s+([A-Z][^,.?\n]{2,40}(?:Room|Hall|Office|HQ|Building|Center|Centre|Campus|Street|Ave|Blvd|Floor|\d+)?)/,
    /\bin\s+(Conference\s+Room\s+[A-Z0-9]+)/i,
    /\b(Conference\s+Room\s+[A-Z0-9]+)/i,
    /\(([^)]{3,50}(?:Room|Hall|HQ|virtual|online|Zoom|Teams|Meet|remote)[^)]{0,20})\)/i,
    /\b(virtual|online|Zoom|Teams|Google Meet|remote)\b/i,
  ];
  for (const p of patterns) {
    const m = chunk.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

// ─── Emoji picker ─────────────────────────────────────────────────────────────

function pickEmoji(title, isEvent) {
  const t = title.toLowerCase();
  if (isEvent) {
    if (/flight|fly|departing|eurostar|train/.test(t)) return '✈️';
    if (/hotel|check.in|accommodation/.test(t))        return '🏨';
    if (/call|phone/.test(t))                          return '📞';
    if (/interview/.test(t))                           return '🤝';
    if (/presentation|present|demo/.test(t))           return '📊';
    if (/lunch|dinner|breakfast|coffee/.test(t))       return '🍽️';
    if (/birthday|anniversary|celebrat/.test(t))       return '🎉';
    if (/workshop|training/.test(t))                   return '🛠️';
    if (/standup|stand-up|sync|meeting/.test(t))       return '🤝';
    if (/review/.test(t))                              return '🔍';
    if (/launch/.test(t))                              return '🚀';
    if (/webinar|virtual|online/.test(t))              return '💻';
    if (/all.hands|town.hall/.test(t))                 return '🏛️';
    if (/roundtable|panel/.test(t))                    return '🎙️';
    if (/gym|workout|exercise|fitness/.test(t))        return '💪';
    return '📅';
  } else {
    if (/submit|deliver|send/.test(t)) return '📤';
    if (/report/.test(t))             return '📋';
    if (/deadline|due/.test(t))       return '⏰';
    if (/review/.test(t))             return '🔍';
    if (/deploy|release/.test(t))     return '🚀';
    if (/fix|bug/.test(t))            return '🐛';
    if (/email|reply|respond/.test(t))return '📧';
    if (/call|phone/.test(t))         return '📞';
    if (/design/.test(t))             return '🎨';
    if (/pay|invoice|payment/.test(t))return '💰';
    if (/confirm|book|register/.test(t))return '📌';
    return '✅';
  }
}

// ─── Title cleaner (v2) ───────────────────────────────────────────────────────
// FIX: after removing date/time, strip leading dangling prepositions/articles

// Strip leading intro phrases / dangling prepositions after date removal
const LEADING_JUNK = /^(?:on\s+|at\s+|in\s+|by\s+|for\s+|the\s+|a\s+|an\s+|and\s+|also\s+|there(?:'s|'s|\s+is|\s+are)?\s+|we\s+(?:also\s+)?(?:have|kick\s+off\s+with|open\s+the\s+month\s+with)\s+|i\s+(?:will|'ll|fly|take|need|want)\s+|please\s+|don'?t\s+forget\s+(?:to\s+)?|right\s+after[,.]?\s*|back.to.back\s+(?:that\s+\w+)?[,:]?\s*|that\s+evening[,:]?\s*|also[,]?\s+(?:on\s+)?|final\s+stretch[,:]?\s*)/i;

function cleanTitle(chunk) {
  let title = chunk
    // Remove dates
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, '')
    // Remove times (after explicit "at" and standalone)
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    // Remove relative date words
    .replace(/\b(?:today|tomorrow|yesterday|next\s+\w+|this\s+\w+)\b/gi, '')
    // Remove recurring words
    .replace(/\bevery\s+(?:day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:and|,)\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*/gi, '')
    .replace(/\b(?:daily|weekly|monthly|yearly|annually)\b/gi, '')
    // Remove trailing prepositions
    .replace(/\bby\s*$/gi, '')
    .replace(/\bon\s*$/gi, '')
    .replace(/\bat\s*$/gi, '')
    // FIX: remove "is via X", "is at X", "is in X" dangling after date removal
    .replace(/\bis\s+(?:via|at|in)\b.*/gi, '')
    // FIX: remove trailing "via Platform — ...", "dial-in link ...", "link shared ..."
    .replace(/\s+via\s+(?:Zoom|Teams|Meet|Google\s+Meet|Webex|Skype|phone)\b.*/gi, '')
    .replace(/\s+(?:dial.?in\s+link|link\s+shared|link\s+to\s+follow|id\s+will).*$/gi, '')
    // FIX: remove "is the", "is a", "are the" anywhere in string after date removal
    // (e.g. "Final stretch: is the hard code freeze" → "hard code freeze")
    .replace(/\bis\s+(?:the|a|an)\s+/gi, ' ')
    .replace(/\bare\s+(?:the|a|an)\s+/gi, ' ')
    .replace(/\bwas\s+(?:the|a|an)\s+/gi, ' ')
    // FIX: remove " on in", " on at" artifacts (double preposition after date removal)
    .replace(/\s+on\s+(?:in|at|the)\s+/gi, ' ')
    // FIX: remove "with the" when it starts the title after leading junk stripping
    .replace(/^with\s+the\s+/i, '')
    // FIX: remove EOD / morning / evening when they appear alone at end
    .replace(/\s+(?:EOD|morning|evening|noon|midnight)\s*$/gi, '')
    // Normalize em-dashes, bullets
    .replace(/[-\u2013\u2014\u00b7\u2022*\u25b8\u25ba]+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,!?;:]+\s*$/, '')
    .trim();

  // Strip leading dangling prepositions / phrases (loop up to 4 times for chained cases)
  for (let i = 0; i < 4; i++) {
    const stripped = title.replace(LEADING_JUNK, '');
    if (stripped === title) break;
    title = stripped.trim();
  }

  return title;
}

function extractTitle(chunk) {
  const clean = cleanTitle(chunk);
  if (clean.length <= 60) return clean;
  const cut       = clean.substring(0, 60);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.substring(0, lastSpace) : cut).trim();
}

// ─── Public helper for ResultsPanel "add from miss" flow ──────────────────────
// Lets the UI analyze a raw chunk without re-running the full extraction.

export function analyzeChunk(chunk) {
  const { date, time } = extractDateFromChunk(chunk);
  return {
    date,
    time,
    title:   extractTitle(chunk),
    isEvent: classify(chunk, !!date) === 'event',
  };
}

// ─── Classify: event vs todo (v3) ────────────────────────────────────────────
// FIX v3: use word-boundary regex matching — lower.includes('check') wrongly fires
//         on 'checkpoint', 'checkout', 'schedule', 'double-check', etc.
//         Pre-compile keyword patterns once for performance.

const EVENT_KW_RX = EVENT_KEYWORDS.map(kw =>
  new RegExp(`\\b${kw.replace(/[-\s]+/g, '[\\s\\-]+')}\\b`, 'i')
);
const TODO_KW_RX = TODO_KEYWORDS.map(kw =>
  new RegExp(`\\b${kw.replace(/[-\s]+/g, '[\\s\\-]+')}\\b`, 'i')
);

function classify(chunk, hasDate) {
  // Strong override — certain patterns always mean event
  for (const pat of STRONG_EVENT_PATTERNS) {
    if (pat.test(chunk)) return 'event';
  }

  let eventScore = 0;
  let todoScore  = 0;

  // FIX: word-boundary matching instead of substring includes()
  for (const rx of EVENT_KW_RX) if (rx.test(chunk)) eventScore++;
  for (const rx of TODO_KW_RX)  if (rx.test(chunk)) todoScore++;

  if (/(?:reminder|remind\s+me|don'?t forget|need to|have to|must|make sure)/i.test(chunk)) todoScore += 3;
  if (/(?:deadline|due\s+(?:by|on|date)|submit\s+by|deliver\s+by)/i.test(chunk))            todoScore += 3;
  if (/(?:meeting|call|session|conference)\s+(?:on|at|in)/i.test(chunk))                    eventScore += 3;
  if (/(?:with\s+\w+|in\s+Conference\s+Room|via\s+(?:Zoom|Teams|Meet))/i.test(chunk))       eventScore += 2;

  // If no date AND event score is weak, classify as todo (avoids "Date TBD" junk)
  if (!hasDate && eventScore < 2) return 'todo';

  // Tie → favor todo (action words should win over vague event words)
  return eventScore > todoScore ? 'event' : 'todo';
}

// ─── Priority detector ────────────────────────────────────────────────────────

function detectPriority(chunk) {
  if (/urgent|asap|critical|immediately|high\s+priority|blocker/i.test(chunk)) return 'high';
  if (/low\s+priority|when\s+possible|nice\s+to\s+have/i.test(chunk))          return 'low';
  return 'medium';
}

// ─── Sub-clause deadline extractor ───────────────────────────────────────────
// Extracts embedded "confirm X by DATE" clauses from inside longer event sentences
// Returns array of { text } sub-clauses to be classified as todos

function extractSubclauseDeadlines(chunk) {
  const results = [];
  const regex = new RegExp(DEADLINE_SUBCLAUSE.source, 'gi');
  let m;
  while ((m = regex.exec(chunk)) !== null) {
    const sub = m[0].trim();
    // Only add if it's meaningfully different from the main chunk (i.e. it's a fragment)
    if (sub.length > 15 && sub.length < chunk.length - 10) {
      results.push(sub);
    }
  }
  return results;
}

// ─── Main extraction function ─────────────────────────────────────────────────

let _idCounter = 0;
function nextId(prefix) { return `${prefix}${++_idCounter}`; }

export function extractFromText(rawText) {
  if (!rawText.trim()) return { events: [], todos: [], sourceMappings: [] };
  _idCounter = 0;

  const chunks = splitIntoChunks(rawText);
  const events = [];
  const todos  = [];
  const seen   = new Set();

  // Track which chunk produced which item (pass=0 only — original sentences)
  const chunkTypeMap = new Map(); // chunk → { type, title }

  // First pass — extract sub-clause deadlines from all chunks
  const extraTodoClauses = [];
  for (const chunk of chunks) {
    const subclauses = extractSubclauseDeadlines(chunk);
    for (const sub of subclauses) extraTodoClauses.push(sub);
  }

  // Track last-seen event date for continuation phrases ("Right after", "Then", "that evening", etc.)
  // We explicitly track the last EVENT date, so intervening todo deadlines don't hijack the timeline.
  let lastEventDate = null;
  const CONTINUATION_PHRASE = /^(?:and|right\s+after|immediately\s+after|straight\s+after|right\s+before|just\s+before|then|following\s+that|after\s+that|next|afterwards|subsequently|back.to.back(?:\s+that\s+\w+)?|that\s+(?:evening|morning|afternoon|night|day)|later\s+that\s+(?:day|morning|afternoon|evening))[,.:;]?\s/i;

  // Second pass — process chunks + extra todo sub-clauses
  // Sub-clauses are ALWAYS todos — they start with an action verb by definition
  for (let pass = 0; pass < 2; pass++) {
  const allChunks = pass === 0 ? chunks : extraTodoClauses;

  for (let ci = 0; ci < allChunks.length; ci++) {
    const chunk = allChunks[ci];
    if (chunk.length < 5) continue;

    let { date, time } = extractDateFromChunk(chunk);

    // Inherit date from previous event chunk if this one uses a continuation phrase
    if (!date && lastEventDate && CONTINUATION_PHRASE.test(chunk)) {
      date = lastEventDate;
    }

    // Sub-clauses skip the classifier — they are always todos
    const type  = pass === 1 ? 'todo' : classify(chunk, !!date);
    const title = extractTitle(chunk);

    // Skip if title is too short or empty after cleaning
    if (!title || title.length < 3) continue;

    // Skip if title is suspiciously short with no date — likely a junk fragment
    if (!date && title.length < 10 && type === 'event') continue;

    // Drop todos with no date that lack explicit action/deadline language
    // This kills intro sentences, transition phrases, and vague context lines
    if (type === 'todo' && !date) {
      const hasExplicitAction = /\b(submit|send|confirm|book|register|upload|finalize|push|notify|remind|remind me|deadline|due by|eod|don'?t forget|make sure|need to|have to|must|please|action required|action item)\b/i.test(chunk);
      if (!hasExplicitAction) continue;
    }

    const normKey = title.toLowerCase().replace(/\s+/g, '').substring(0, 30);
    if (seen.has(normKey)) continue;
    seen.add(normKey);

    const description = chunk.length > title.length + 5
      ? chunk.replace(title, '').replace(/^\s*[-–—:·]\s*/, '').trim().substring(0, 120)
      : '';

    const location  = type === 'event' ? extractLocation(chunk) : null;
    const emoji     = pickEmoji(title, type === 'event');
    const recurring = type === 'event' ? detectRecurring(chunk) : null;

    if (type === 'event') {
      events.push({
        id: nextId('e'),
        title,
        date,
        time,
        endTime: null,
        location,
        description,
        emoji,
        rrule:          recurring ? recurring.rrule  : null,
        recurringLabel: recurring ? recurring.label  : null,
      });
      if (pass === 0) chunkTypeMap.set(chunk, { type: 'event', title });
      if (date) lastEventDate = date;  // Track for continuation phrases
    } else {
      todos.push({
        id: nextId('t'),
        title,
        dueDate:  date,
        dueTime:  time,
        priority: detectPriority(chunk),
        description,
        emoji,
      });
      if (pass === 0) chunkTypeMap.set(chunk, { type: 'todo', title });
      // We explicitly DO NOT update lastEventDate here so todos don't hijack the event timeline.
    }
  } // end inner chunk loop
  } // end pass loop

  // ─── Source mappings — annotate every original sentence ──────────────────
  // Used by the UI to show the annotated source view and flag possible misses.
  const MISS_SIGNALS = /\b(submit|send|confirm|book|register|upload|finalize|push|notify|deadline|due by|remind|must|don'?t forget|make sure)\b/i;

  const sourceMappings = chunks.map(chunk => {
    const result = chunkTypeMap.get(chunk);
    if (result) return { chunk, ...result };

    // Not extracted — decide: possible miss or genuinely ignored?
    const { date } = extractDateFromChunk(chunk);
    const hasAction = MISS_SIGNALS.test(chunk);
    if ((date || hasAction) && chunk.length > 18) {
      return { chunk, type: 'possible-miss' };
    }
    return { chunk, type: 'ignored' };
  });

  return { events, todos, sourceMappings };
}

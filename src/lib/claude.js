/**
 * Claude API wrapper for SmartSync
 * Handles both text extraction and image (Vision) extraction
 */

const SYSTEM_PROMPT = (today) => `Today is ${today}.

You are a smart extraction assistant. Extract ALL calendar events, meetings, appointments, deadlines, flights, and todo/reminder items from the user's input.

Return ONLY a valid JSON object (no markdown, no backticks, no extra text):
{
  "events": [
    {
      "id": "e1",
      "title": "Short descriptive title (e.g. 'United Flight 402', 'Lunch with Nexus')",
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM (24h) or null",
      "endTime": "HH:MM (24h) or null",
      "location": "location string or null",
      "description": "brief context",
      "emoji": "relevant emoji"
    }
  ],
  "todos": [
    {
      "id": "t1",
      "title": "Short actionable title (e.g. 'Finalize Q4 budget')",
      "dueDate": "YYYY-MM-DD or null",
      "dueTime": "HH:MM (24h) or null",
      "priority": "high|medium|low",
      "description": "brief context",
      "emoji": "relevant emoji"
    }
  ]
}

CRITICAL RULES:
1. CONTEXT & COREFERENCE: Read the whole text! If a sentence says "lands at 11:30" right after a flight on "Thursday, Nov 12", the arrival inherits the SAME DATE.
2. GROUPING: Do not split a single event (like a flight's departure and arrival) into separate events/tasks. Combine them into one EVENT with a start/endTime or put the arrival in the description.
3. EVENTS vs TODOS:
   - EVENTS: Meetings, calls, appointments, presentations, flights, dinners (e.g. "Hold Q3 Retrospective", "Dentist appointment"). Things with a scheduled block of time.
   - TODOS: Tasks, deadlines, submissions, reminders, action items (e.g. "Review UI mockups", "Pick up dry cleaning"). Things you need to DO by a certain time.
4. DATE PARSING: Do not hallucinate dates. Interpret "Q3" or "Q4" as quarters, not a specific date like March 4. Use context clues like "by Wednesday evening" to infer dates from ${today}.
5. TITLES: Keep titles clean, short, and professional. NEVER include conversational filler like "First off, I'm flying out to", "Oh, and I need to", or "Aamir, don't forget to". Just use "Chicago Conference" or "Review UI mockups".
6. If a date is truly unknown, set it to null.
7. Extract every single actionable item — do not skip any.
8. Pick meaningful emojis (📅✈️🤝📞🎯✅📋🚀💡).`;

async function callClaude(messages, apiKey) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT(today),
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const raw = (data.content || []).map((b) => b.text || '').join('');

  // Robust JSON extraction
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');

  const parsed = JSON.parse(raw.substring(start, end + 1));
  return {
    events: parsed.events || [],
    todos: parsed.todos || [],
  };
}

/**
 * Extract events and todos from plain text
 */
export async function extractFromText(text, apiKey) {
  return callClaude(
    [{ role: 'user', content: text }],
    apiKey
  );
}

/**
 * Extract events and todos from an image (base64 encoded)
 * Uses Claude's vision capability
 */
export async function extractFromImage(base64Data, mimeType, apiKey) {
  return callClaude(
    [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: 'Please extract all calendar events, meetings, appointments, deadlines, and todos/reminders from this image.',
          },
        ],
      },
    ],
    apiKey
  );
}

import { useState } from 'react';

const SAMPLES = [
  {
    label: 'Work',
    text: `Team sync meeting on June 15th at 2 PM in Conference Room B.
Submit the Q2 report by June 22nd — need a reminder for this.
Quarterly all-hands on June 28th at 10 AM (virtual, Teams link).
Design review on July 5th at 3 PM with the product team.
Final project deadline: July 20th — must notify client.
Client presentation on July 10 at 9 AM at Midtown HQ, Floor 12.
Code freeze for v2.0 on July 18th — reminder needed.`,
  },
  {
    label: 'Personal',
    text: `Doctor appointment on June 17th at 11 AM at City Medical Center.
Pick up prescription by June 18th.
Mom's birthday dinner on June 20th at 7 PM at Il Fornaio.
Gym session every Monday and Thursday at 7 AM.
Pay rent by July 1st.
Flight to New York on July 8th at 6:30 AM — check in online the day before.`,
  },
  {
    label: 'Projects',
    text: `Design mockups due by this Friday.
Review pull request #42 — urgent.
Client call on next Tuesday at 3 PM via Zoom.
Deploy to staging by tomorrow EOD.
Send invoice to Acme Corp by June 30th.
Sprint retrospective on July 2nd at 2:30 PM.`,
  },
];

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d}d ago`;
}

export default function InputPanel({ error, onExtract, history = [], onLoadHistory }) {
  const [text,          setText]          = useState('');
  const [activeSample,  setActiveSample]  = useState(null);
  const [showHistory,   setShowHistory]   = useState(false);
  const [pulsing,       setPulsing]       = useState(false);
  const canExtract = text.trim().length > 10;

  const handleSample = (s, idx) => { setText(s.text); setActiveSample(idx); };

  const handleExtract = () => {
    if (!canExtract) return;
    // Button flash — makes speed feel intentional
    setPulsing(true);
    setTimeout(() => setPulsing(false), 200);
    onExtract(text.trim());
  };

  const handleKeyDown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleExtract();
  };

  return (
    <div className="input-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon">✨</div>
        <h1 className="panel-title">Paste Your Text</h1>
      </div>
      <p className="panel-sub">
        Drop in a chat, email, meeting notes, or bullet list.
        SmartSync instantly finds every date, event, and task — no API, no account, zero delay.
      </p>

      {/* Sample buttons */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>Try a sample:</span>
        {SAMPLES.map((s, idx) => (
          <button
            key={s.label}
            className="btn-secondary"
            style={{
              padding: '6px 13px', fontSize: 12.5, fontWeight: 700,
              ...(activeSample === idx ? {
                background: 'var(--blue-dim)',
                borderColor: 'rgba(10,132,255,0.3)',
                color: 'var(--blue-light)',
              } : {}),
            }}
            onClick={() => handleSample(s, idx)}
            id={`sample-${idx}-btn`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Textarea with animated glow border */}
      <div className="glow-wrapper">
        <div className="glow-inner">
          <textarea
            id="main-paste-input"
            className="main-textarea"
            value={text}
            onChange={e => { setText(e.target.value); setActiveSample(null); }}
            onKeyDown={handleKeyDown}
            placeholder={`Paste any text with dates and tasks, e.g.:\n\n• Team sync on June 15th at 2 PM in Conference Room B\n• Submit Q2 report by June 22nd — reminder needed\n• Client presentation July 10 at 9 AM at Midtown HQ\n• Design review on July 5th at 3 PM`}
            aria-label="Paste your text here"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {text.length > 0 && `${text.trim().split(/\s+/).filter(Boolean).length} words`}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>⌘↵ to extract</span>
      </div>

      {/* Error */}
      {error && (
        <div className="error-box" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Extract button */}
      <div className="action-row">
        <button
          id="extract-btn"
          className={`btn-extract${pulsing ? ' btn-flash' : ''}`}
          onClick={handleExtract}
          disabled={!canExtract}
          aria-label="Extract events and todos from text"
        >
          ✨ Extract Instantly
        </button>
        {text.trim() && (
          <button
            className="btn-secondary"
            onClick={() => { setText(''); setActiveSample(null); }}
            id="clear-btn"
          >
            Clear
          </button>
        )}
      </div>

      {/* History (Feature 5) */}
      {history.length > 0 && (
        <div className="history-section">
          <button
            className="history-toggle"
            onClick={() => setShowHistory(h => !h)}
            aria-expanded={showHistory}
          >
            <span>🕐 Recent Extractions ({history.length})</span>
            <span className="history-chevron">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="history-list">
              {history.map(entry => (
                <button
                  key={entry.id}
                  className="history-entry"
                  onClick={() => { onLoadHistory(entry); setShowHistory(false); }}
                >
                  <div className="history-entry-meta">
                    <span className="history-time">{relativeTime(entry.timestamp)}</span>
                    <span className="history-counts">
                      {entry.events.length > 0 && `${entry.events.length} event${entry.events.length > 1 ? 's' : ''}`}
                      {entry.events.length > 0 && entry.todos.length > 0 && ' · '}
                      {entry.todos.length > 0 && `${entry.todos.length} todo${entry.todos.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="history-snippet">{entry.snippet}{entry.snippet?.length >= 120 ? '…' : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="how-it-works" style={{ marginTop: 28 }}>
        {[
          ['💬', 'Paste Anything',    'Chat, emails, notes, bullet lists, even Slack threads'],
          ['⚡', 'Instant Results',   'Zero delay — pure local regex, no API call, no spinner'],
          ['📅', 'Smart Separation',  'Events go to Calendar, tasks go to Reminders — edit inline'],
          ['📤', 'Export Anywhere',   'macOS · Windows · Google · .ics with timezone & RRULE'],
        ].map(([icon, title, desc]) => (
          <div key={title} className="how-item">
            <span className="how-icon">{icon}</span>
            <div>
              <div className="how-item-title">{title}</div>
              <div className="how-item-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

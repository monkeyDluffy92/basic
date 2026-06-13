import { useState, useEffect } from 'react';
import {
  detectPlatform, canWebShare,
  downloadICS, downloadTasksCSV,
  openGoogleCalendarEvent, openOutlookWebEvent,
  nativeShare, shareICSFile, generateShareableLink,
  makeSlackMessage, makeEmailMessage, makeReminderText,
  fmtDate, fmtTime,
  COMMON_TIMEZONES, getBrowserTimezone,
} from '../lib/calendar.js';

function CopyBtn({ text, label = 'Copy', id, onSuccess }) {
  const [done, setDone] = useState(false);
  const handle = async () => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setDone(true);
    onSuccess?.();
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <button className={`export-btn ${done ? 'export-btn-green done' : 'export-btn-slate'}`} onClick={handle} id={id}>
      <span className="export-btn-icon">{done ? '✅' : '📋'}</span>
      <span className="export-btn-text"><span className="export-btn-label">{done ? 'Copied!' : label}</span></span>
    </button>
  );
}

export default function ExportModal({ mode, selectedEvents, selectedTodos, onClose }) {
  const [timezone, setTimezone] = useState(() => {
    const browser = getBrowserTimezone();
    return COMMON_TIMEZONES.some(tz => tz.value === browser) ? browser : 'UTC';
  });

  const [exportDone, setExportDone] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareLink, setShareLink] = useState(null);

  const handleSuccess = () => {
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    setShareLink(null);
    try {
      const link = await generateShareableLink(events, timezone);
      setShareLink(link);
      handleSuccess();
    } catch (err) {
      alert("Failed to generate link. Please try downloading the file instead.");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleOverlay = e => { if (e.target === e.currentTarget) onClose(); };

  const showEvents = mode !== 'reminders' && selectedEvents.length > 0;
  const showTodos  = mode !== 'calendar'  && selectedTodos.length  > 0;
  const events = showEvents ? selectedEvents : [];
  const todos  = showTodos  ? selectedTodos  : [];

  const modalTitle = mode === 'calendar' ? '📅 Add to Calendar' : mode === 'reminders' ? '✅ Add Reminders' : '📤 Export & Share';

  return (
    <div className="modal-overlay" onClick={handleOverlay} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className={`modal-header${exportDone ? ' modal-header--done' : ''}`}>
          <div>
            <h2 className="modal-title">{modalTitle}</h2>
            {exportDone ? (
              <div className="modal-done-badge">✅ Exported successfully!</div>
            ) : (
              <p className="modal-sub">
                {events.length > 0 && `${events.length} event${events.length > 1 ? 's' : ''}`}
                {events.length > 0 && todos.length > 0 && ' · '}
                {todos.length  > 0 && `${todos.length} reminder${todos.length > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <div className="timezone-row">
            <label className="tz-label" htmlFor="timezone-select">🌍 Timezone</label>
            <select id="timezone-select" className="tz-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
              {COMMON_TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
            </select>
          </div>

          <div className="export-btns" style={{ marginTop: 24 }}>
            {events.length > 0 && (
              <>
                <div className="export-section-label">📅 Export Calendar Events</div>
                <button className="export-btn export-btn-cyan" id="apple-dl-ics-btn"
                  onClick={() => { downloadICS(events, 'smartsync-events.ics', timezone); handleSuccess(); }}>
                  <span className="export-btn-icon">📥</span>
                  <span className="export-btn-text">
                    <span className="export-btn-label">Download .ics File</span>
                    <span className="export-btn-hint">Double-click file to import all events natively</span>
                  </span>
                  <span className="export-btn-arrow">↓</span>
                </button>
                
                {shareLink ? (
                  <div style={{ background: 'rgba(94,92,230,0.1)', border: '1px solid rgba(94,92,230,0.3)', borderRadius: 12, padding: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✅</span> Link ready! Share this with iOS users:
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="text" 
                        readOnly 
                        value={shareLink} 
                        style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-1)', fontSize: 13 }}
                        onClick={(e) => e.target.select()}
                      />
                      <CopyBtn text={shareLink} label="Copy" id="copy-ios-link-btn" />
                    </div>
                  </div>
                ) : (
                  <button className="export-btn export-btn-indigo" onClick={handleGenerateLink} disabled={isGeneratingLink}>
                    <span className="export-btn-icon">{isGeneratingLink ? '⏳' : '🔗'}</span>
                    <span className="export-btn-text">
                      <span className="export-btn-label">{isGeneratingLink ? 'Generating...' : 'Generate iOS Share Link'}</span>
                      <span className="export-btn-hint">Creates a 1-click install link for other iPhones</span>
                    </span>
                    <span className="export-btn-arrow">→</span>
                  </button>
                )}
                
                {canWebShare() && (
                  <button className="export-btn export-btn-indigo" id="apple-share-btn" onClick={() => { shareICSFile(events, 'SmartSync Events'); handleSuccess(); }}>
                    <span className="export-btn-icon">📲</span>
                    <span className="export-btn-text">
                      <span className="export-btn-label">Share via Airdrop</span>
                      <span className="export-btn-hint">Use native system share sheet</span>
                    </span>
                    <span className="export-btn-arrow">→</span>
                  </button>
                )}

                <div className="export-section-label" style={{ marginTop: 24 }}>🌐 Open in Web Calendar</div>
                <div className="event-list">
                  {events.map(ev => (
                    <button key={ev.id} className="event-list-item" onClick={() => { openGoogleCalendarEvent(ev); handleSuccess(); }} title={`Add "${ev.title}" to Google Calendar`}>
                      <span className="event-list-emoji">{ev.emoji || '📅'}</span>
                      <span className="event-list-info">
                        <span className="event-list-title">{ev.title}</span>
                        <span className="event-list-date">{fmtDate(ev.date)}{fmtTime(ev.time)}{ev.recurringLabel && <em> · {ev.recurringLabel}</em>}</span>
                      </span>
                      <span className="event-list-arrow">↗</span>
                    </button>
                  ))}
                  <button className="export-btn export-btn-slate" style={{ marginTop: 8 }} onClick={() => { events.forEach(ev => openOutlookWebEvent(ev)); handleSuccess(); }}>
                    <span className="export-btn-icon">📧</span>
                    <span className="export-btn-text">
                      <span className="export-btn-label">Open in Outlook Web</span>
                      <span className="export-btn-hint">Opens outlook.live.com for each event</span>
                    </span>
                    <span className="export-btn-arrow">↗</span>
                  </button>
                </div>
              </>
            )}

            {todos.length > 0 && (
              <>
                <div className="export-section-label" style={{ marginTop: 24 }}>✅ Export Reminders & Tasks</div>
                
                {typeof window !== 'undefined' && window.electronAPI ? (
                  <button className="export-btn export-btn-indigo" style={{ marginBottom: 8 }} onClick={async () => {
                    try { 
                      await window.electronAPI.addReminders(todos); 
                      handleSuccess(); 
                    } catch (e) {
                      await navigator.clipboard.writeText(makeReminderText(todos)).catch(() => {});
                      handleSuccess();
                    }
                  }}>
                    <span className="export-btn-icon">📤</span>
                    <span className="export-btn-text">
                      <span className="export-btn-label">Push to Apple Reminders</span>
                      <span className="export-btn-hint">Instantly adds tasks directly to your Mac's Reminders app</span>
                    </span>
                    <span className="export-btn-arrow">→</span>
                  </button>
                ) : canWebShare() && (
                  <button className="export-btn export-btn-indigo" style={{ marginBottom: 8 }} onClick={async () => {
                    try { await nativeShare({ title: 'Reminders from SmartSync', text: makeReminderText(todos) }); handleSuccess(); }
                    catch (e) {
                      if (e.name !== 'AbortError') {
                        await navigator.clipboard.writeText(makeReminderText(todos)).catch(() => {});
                        handleSuccess();
                      }
                    }
                  }}>
                    <span className="export-btn-icon">📤</span>
                    <span className="export-btn-text">
                      <span className="export-btn-label">Share to Apple Reminders</span>
                      <span className="export-btn-hint">Use native share sheet to add to Reminders or Notes</span>
                    </span>
                    <span className="export-btn-arrow">→</span>
                  </button>
                )}

                <button className="export-btn export-btn-orange" onClick={() => { downloadTasksCSV(todos); handleSuccess(); }}>
                  <span className="export-btn-icon">📊</span>
                  <span className="export-btn-text">
                    <span className="export-btn-label">Download Tasks (.csv)</span>
                    <span className="export-btn-hint">Import into Microsoft To Do, Excel, etc.</span>
                  </span>
                  <span className="export-btn-arrow">↓</span>
                </button>
                <CopyBtn text={makeReminderText(todos)} label="Copy Tasks as Text" onSuccess={handleSuccess} />
              </>
            )}

            <div className="export-section-label" style={{ marginTop: 24 }}>📤 Copy & Paste Everywhere</div>
            <CopyBtn text={makeSlackMessage(events, todos)} label="Copy Formatted Text" onSuccess={handleSuccess} />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useRef } from 'react';
import InputPanel from './components/InputPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import ExportModal from './components/ExportModal.jsx';
import { extractFromText, stripNoise } from './lib/parser.js';

const MAX_HISTORY = 5;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('smartsync_history') || '[]'); }
  catch { return []; }
}

export default function App() {
  const appRef = useRef(null);
  const [phase,          setPhase]          = useState('input');
  const [events,         setEvents]         = useState([]);
  const [todos,          setTodos]          = useState([]);
  const [selEvents,      setSelEvents]      = useState(new Set());
  const [selTodos,       setSelTodos]       = useState(new Set());
  const [error,          setError]          = useState('');
  const [showExport,     setShowExport]     = useState(false);
  const [exportMode,     setExportMode]     = useState('all');
  const [history,        setHistory]        = useState(loadHistory);
  const [sourceText,     setSourceText]     = useState('');
  const [sourceMappings, setSourceMappings] = useState([]);

  const flashlightRef = useRef(null);

  /* ── Extract ──────────────────────────────────────────────── */
  const handleExtract = useCallback((text) => {
    setError('');
    const clean  = stripNoise(text);
    const result = extractFromText(clean);
    const evs = result.events;
    const tds = result.todos;

    if (evs.length === 0 && tds.length === 0) {
      setError('No events or tasks found. Try adding dates, times, or action words like "meeting on June 15" or "submit report by Friday".');
      return;
    }

    setEvents(evs);
    setTodos(tds);
    setSelEvents(new Set(evs.map(e => e.id)));
    setSelTodos(new Set(tds.map(t => t.id)));
    setSourceMappings(result.sourceMappings || []);
    // Store full source text for the split-pane highlighter
    setSourceText(text);
    setPhase('review');

    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      snippet: text.trim().substring(0, 120),
      events: evs,
      todos: tds,
    };
    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      try { localStorage.setItem('smartsync_history', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  /* ── History ──────────────────────────────────────────────── */
  const handleLoadHistory = useCallback((entry) => {
    setEvents(entry.events);
    setTodos(entry.todos);
    setSelEvents(new Set(entry.events.map(e => e.id)));
    setSelTodos(new Set(entry.todos.map(t => t.id)));
    setSourceText(entry.snippet || '');
    setPhase('review');
    setError('');
  }, []);

  /* ── CRUD — returns new item so ResultsPanel can open drawer ─ */
  const handleUpdateEvent = useCallback((id, fields) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...fields } : e));
  }, []);

  const handleUpdateTodo = useCallback((id, fields) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
  }, []);

  const handleAddEvent = useCallback((prefill = {}) => {
    const id = `e${Date.now()}`;
    const newEv = {
      id,
      title:          prefill.title       || '',
      date:           prefill.date        || null,
      time:           prefill.time        || null,
      endTime:        null,
      location:       prefill.location    || null,
      description:    prefill.description || '',
      emoji:          prefill.emoji       || '📅',
      rrule:          null,
      recurringLabel: null,
      isNew:          true,
    };
    setEvents(prev => [...prev, newEv]);
    setSelEvents(prev => new Set([...prev, id]));
    return newEv;
  }, []);

  const handleAddTodo = useCallback((prefill = {}) => {
    const id = `t${Date.now()}`;
    const newTodo = {
      id,
      title:       prefill.title    || '',
      dueDate:     prefill.dueDate  || null,
      dueTime:     prefill.dueTime  || null,
      priority:    prefill.priority || 'medium',
      description: prefill.description || '',
      emoji:       prefill.emoji    || '✅',
      isNew:       true,
    };
    setTodos(prev => [...prev, newTodo]);
    setSelTodos(prev => new Set([...prev, id]));
    return newTodo;
  }, []);

  const handleRemoveEvent = useCallback((id) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelEvents(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const handleRemoveTodo = useCallback((id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    setSelTodos(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  /* ── Navigation ───────────────────────────────────────────── */
  const handleReset = () => {
    setPhase('input');
    setEvents([]); setTodos([]);
    setSelEvents(new Set()); setSelTodos(new Set());
    setError(''); setShowExport(false); setSourceText('');
    setSourceMappings([]);
  };

  const openExport = (mode) => { setExportMode(mode); setShowExport(true); setPhase('export'); };

  const selectedEvents = events.filter(e => selEvents.has(e.id));
  const selectedTodos  = todos.filter(t => selTodos.has(t.id));

  const handleMouseMove = useCallback((e) => {
    if (flashlightRef.current) {
      flashlightRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }
  }, []);

  return (
    <div 
      ref={appRef}
      className={`app view-${phase === 'input' ? 'centered' : 'split'}`}
      onMouseMove={handleMouseMove}
    >
      <div className="flashlight" ref={flashlightRef}></div>
      <header className="header" data-tauri-drag-region>
        <img src="./app_icon.png" alt="SmartSync" className="header-logo" />
        <div style={{ flex: 1 }}>
          <div className="header-title">SmartSync</div>
          <div className="header-subtitle">
            Paste any text · Extract events &amp; todos · Export to any calendar
          </div>
        </div>
        {phase !== 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <button className="header-back-btn" onClick={handleReset}>← New Extract</button>
            <div className="results-actions">
              <button className="btn-sm btn-sm-blue" onClick={() => { setSelEvents(new Set(events.map(e => e.id))); setSelTodos(new Set(todos.map(t => t.id))); }}>
                Select All
              </button>
              <button className="btn-sm btn-sm-ghost" onClick={() => { setSelEvents(new Set()); setSelTodos(new Set()); }}>
                Clear
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="main-content">
        {phase === 'input' && (
          <InputPanel
            error={error}
            onExtract={handleExtract}
            history={history}
            onLoadHistory={handleLoadHistory}
          />
        )}

        {(phase === 'review' || phase === 'export') && (
          <ResultsPanel
            events={events}
            todos={todos}
            selEvents={selEvents}
            selTodos={selTodos}
            onToggleEvent={id => { const s = new Set(selEvents); s.has(id) ? s.delete(id) : s.add(id); setSelEvents(s); }}
            onToggleTodo={id  => { const s = new Set(selTodos);  s.has(id) ? s.delete(id) : s.add(id); setSelTodos(s); }}
            onSelectAllEvents={() => setSelEvents(new Set(events.map(e => e.id)))}
            onClearEvents={()     => setSelEvents(new Set())}
            onSelectAllTodos={() => setSelTodos(new Set(todos.map(t => t.id)))}
            onClearTodos={()     => setSelTodos(new Set())}
            selectedEvents={selectedEvents}
            selectedTodos={selectedTodos}
            onOpenExport={openExport}
            onUpdateEvent={handleUpdateEvent}
            onUpdateTodo={handleUpdateTodo}
            onAddEvent={handleAddEvent}
            onAddTodo={handleAddTodo}
            onRemoveEvent={handleRemoveEvent}
            onRemoveTodo={handleRemoveTodo}
            sourceText={sourceText}
            sourceMappings={sourceMappings}
          />
        )}
      </main>

      {showExport && (
        <ExportModal
          mode={exportMode}
          selectedEvents={selectedEvents}
          selectedTodos={selectedTodos}
          onClose={() => { setShowExport(false); setPhase('review'); }}
        />
      )}

    </div>
  );
}

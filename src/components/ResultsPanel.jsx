import { useState, useEffect, useRef } from 'react';
import { fmtDate, fmtTime } from '../lib/calendar.js';
import { analyzeChunk } from '../lib/parser.js';


/* ── Edit Drawer ──────────────────────────────────────────────── */
function EditDrawer({ item, isEvent, isNew, onSave, onCancel, onDelete }) {
  const [draft, setDraft] = useState({
    title:    item.title    || '',
    date:     (isEvent ? item.date    : item.dueDate) || '',
    time:     (isEvent ? item.time    : item.dueTime) || '',
    location: item.location || '',
    priority: item.priority || 'medium',
  });
  const titleRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const handleSave = () => {
    if (!draft.title.trim()) { onDelete(item.id); return; }
    const fields = isEvent
      ? { title: draft.title.trim(), date: draft.date || null, time: draft.time || null, location: draft.location || null }
      : { title: draft.title.trim(), dueDate: draft.date || null, dueTime: draft.time || null, priority: draft.priority };
    onSave(item.id, fields);
  };

  const accentColor = isEvent ? 'rgba(10,132,255,0.45)' : 'rgba(255,159,10,0.4)';

  return (
    <>
      <div className="drawer-backdrop" onClick={onCancel} />
      <div
        className="edit-drawer"
        role="dialog" aria-modal="true"
        aria-label={isNew ? (isEvent ? 'New event' : 'New task') : (isEvent ? 'Edit event' : 'Edit task')}
        style={{ borderTopColor: accentColor }}
      >
        <div className="drawer-handle" />

        <div className="drawer-header">
          <h3 className="drawer-title">
            {isNew ? (isEvent ? '＋ New Event' : '＋ New Task') : (isEvent ? '✏️ Edit Event' : '✏️ Edit Task')}
          </h3>
          <button className="drawer-delete-btn" onClick={() => onDelete(item.id)} title="Delete" aria-label="Delete item">🗑</button>
        </div>

        <div className="drawer-body">
          <input
            ref={titleRef}
            className="edit-field edit-title"
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder={isEvent ? 'Event title…' : 'Task title…'}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />

          <div className="edit-row">
            <div className="edit-field-group">
              <label className="edit-label">Date</label>
              <input className="edit-field edit-date" type="date" value={draft.date || ''}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value || null }))} />
            </div>
            <div className="edit-field-group">
              <label className="edit-label">Time</label>
              <input className="edit-field edit-time" type="time" value={draft.time || ''}
                onChange={e => setDraft(d => ({ ...d, time: e.target.value || null }))} />
            </div>
          </div>

          {isEvent ? (
            <input className="edit-field" value={draft.location}
              onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
              placeholder="Location (optional)…" />
          ) : (
            <div className="edit-priority-row">
              <span className="edit-label">Priority</span>
              <div className="edit-priority-btns">
                {[
                  { key: 'high',   dot: '🔴', label: 'High'   },
                  { key: 'medium', dot: '🟡', label: 'Medium' },
                  { key: 'low',    dot: '🟢', label: 'Low'    },
                ].map(p => (
                  <button key={p.key} type="button"
                    className={`edit-priority-btn ${draft.priority === p.key ? `ep-active-${p.key}` : ''}`}
                    onClick={() => setDraft(d => ({ ...d, priority: p.key }))}>
                    {p.dot} {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="drawer-actions">
          <button className="edit-cancel" type="button" onClick={onCancel}>Cancel</button>
          <button className="edit-save"   type="button" onClick={handleSave}>
            {isNew ? (isEvent ? 'Add Event' : 'Add Task') : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Item Card ────────────────────────────────────────────────── */
function ItemCard({ item, isSelected, isEvent, onToggle, onEdit, isActiveEdit, staggerIndex = 0, hasConflict }) {
  return (
    <div
      className={`item-card ${isSelected ? 'selected' : 'unselected'} ${isEvent ? 'event' : 'todo'} ${isActiveEdit ? 'is-active-edit' : ''}`}
      style={{ '--stagger': staggerIndex }}
      onClick={() => onToggle(item.id)}
      role="checkbox" aria-checked={isSelected}
      tabIndex={0} onKeyDown={e => e.key === 'Enter' && onToggle(item.id)}
    >
      <div className={`item-card-check ${!isSelected ? 'check-empty' : isEvent ? 'check-event' : 'check-todo'}`}>
        {isSelected && '✓'}
      </div>

      <button className="item-edit-btn" onClick={e => { e.stopPropagation(); onEdit(); }}
        title="Edit" aria-label="Edit item">✏️</button>

      {isEvent && item.recurringLabel && (
        <div className="recurring-badge">↻ {item.recurringLabel}</div>
      )}

      {hasConflict && (
        <div className="conflict-badge">⚠️ Conflict</div>
      )}

      <div className="item-title">
        <span className="item-emoji">{item.emoji}</span>
        {item.title || <em style={{ opacity: 0.35 }}>Untitled</em>}
      </div>

      {isEvent ? (
        <div className="item-date date-event">{fmtDate(item.date)}{fmtTime(item.time)}</div>
      ) : (
        <div className="item-date date-todo">
          {item.dueDate && item.dueDate !== 'null'
            ? `Due: ${fmtDate(item.dueDate)}${fmtTime(item.dueTime)}`
            : 'No due date'}
          {item.priority && (
            <span className={`priority-pill priority-${item.priority}`}>{item.priority.toUpperCase()}</span>
          )}
        </div>
      )}

      {isEvent && item.location && item.location !== 'null' && (
        <div className="item-location">📍 {item.location}</div>
      )}

      {item.description && (
        <div className="item-desc">{item.description}</div>
      )}
    </div>
  );
}

/* ── ResultsPanel ─────────────────────────────────────────────── */
export default function ResultsPanel({
  events, todos,
  selEvents, selTodos,
  onToggleEvent, onToggleTodo,
  onSelectAllEvents, onClearEvents,
  onSelectAllTodos,  onClearTodos,
  selectedEvents, selectedTodos,
  onOpenExport,
  onUpdateEvent, onUpdateTodo,
  onAddEvent,    onAddTodo,
  onRemoveEvent, onRemoveTodo,
  sourceText,
  sourceMappings,
}) {
  const [editingItem, setEditingItem] = useState(null);

  const totalSelected = selectedEvents.length + selectedTodos.length;
  const total         = events.length + todos.length;
  const progressPct   = total > 0 ? (totalSelected / total) * 100 : 0;

  // Completeness signal from sourceMappings
  const missCount  = (sourceMappings || []).filter(m => m.type === 'possible-miss').length;
  const isClean    = sourceMappings?.length > 0 && missCount === 0;
  const hasMisses  = missCount > 0;

  /* ── Edit / Add handlers ────────────────────────────────────── */
  const openEdit = (item, isEvent) => setEditingItem({ item, isEvent, isNew: false });

  const handleAddEventClick = () => {
    const newItem = onAddEvent();
    setEditingItem({ item: newItem, isEvent: true, isNew: true });
  };

  const handleAddTodoClick = () => {
    const newItem = onAddTodo();
    setEditingItem({ item: newItem, isEvent: false, isNew: true });
  };

  // "Add from miss" — analyzes the raw chunk, pre-fills drawer
  const handleAddFromMiss = (chunk) => {
    const { date, time, title, isEvent } = analyzeChunk(chunk);
    if (isEvent) {
      const newItem = onAddEvent({ title, date, time });
      setEditingItem({ item: newItem, isEvent: true, isNew: true });
    } else {
      const newItem = onAddTodo({ title, dueDate: date, dueTime: time });
      setEditingItem({ item: newItem, isEvent: false, isNew: true });
    }
    setShowSource(false); // collapse source view after adding
  };

  const handleDrawerSave = (id, fields) => {
    if (editingItem.isEvent) onUpdateEvent(id, fields);
    else                     onUpdateTodo(id, fields);
    setEditingItem(null);
  };

  const handleDrawerCancel = () => {
    if (editingItem?.isNew) {
      if (editingItem.isEvent) onRemoveEvent(editingItem.item.id);
      else                     onRemoveTodo(editingItem.item.id);
    }
    setEditingItem(null);
  };

  const handleDrawerDelete = id => {
    if (editingItem?.isEvent) onRemoveEvent(id);
    else                      onRemoveTodo(id);
    setEditingItem(null);
  };

  /* ── Layout ─────────────────────────────────────────────────── */
  const showEvents = events.length > 0;
  const showTodos  = todos.length  > 0;
  const gridStyle  = showEvents && showTodos ? {} : { gridTemplateColumns: '1fr' };

  /* ── Conflict Detection ─────────────────────────────────────── */
  const getConflictingEventIds = () => {
    const timeMap = new Map();
    const conflicts = new Set();
    
    events.forEach(ev => {
      if (!ev.date || !ev.time) return;
      const key = `${ev.date}-${ev.time}`;
      if (timeMap.has(key)) {
        conflicts.add(ev.id);
        conflicts.add(timeMap.get(key));
      } else {
        timeMap.set(key, ev.id);
      }
    });
    return conflicts;
  };
  
  const conflictingEventIds = getConflictingEventIds();

  return (
    <div className="split-layout">
      {/* ── Left Pane: Title + Smart Document Highlighter ── */}
      <div className="split-left">
        {/* ── Header ── */}
        <div className="results-header" style={{ marginTop: 0, marginBottom: 16 }}>
          <div>
            <h2 className="results-title">Extracted Items</h2>
            <p className="results-sub">
              {total} item{total !== 1 ? 's' : ''} found · {totalSelected} selected
            </p>
          </div>
        </div>

        <div className="source-highlighter">
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, fontSize: 13, fontWeight: 600 }}>
            <span style={{ color: 'var(--cyan-500)' }}>■ Event</span>
            <span style={{ color: 'var(--orange-500)' }}>■ Reminder</span>
            <span style={{ color: 'var(--text-3)' }}>■ Ignored</span>
          </div>
          
          {sourceMappings && sourceMappings.map((m, i) => {
            const isEvent = m.type === 'event';
            const isTodo = m.type === 'todo';
            return (
              <div key={i} className={`hl-line ${isEvent ? 'hl-event' : isTodo ? 'hl-todo' : ''}`}>
                {m.chunk}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Pane: Both tile columns inline ── */}
      <div className="split-right">
        {/* ── Grid ── */}
      <div className="results-grid" style={gridStyle}>

        {showEvents && (
          <div className="results-column">
            <div className="column-header">
              <span className="column-badge badge-blue">📅 Calendar Events</span>
              <span className="column-count">{selEvents.size}/{events.length}</span>
            </div>

            {conflictingEventIds.size > 0 && (
              <div className="conflict-banner">
                ⚠️ {Math.ceil(conflictingEventIds.size / 2)} scheduling conflicts detected. Review times before exporting.
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button className="btn-sm btn-sm-blue"  style={{ fontSize: 11 }} onClick={onSelectAllEvents}>All</button>
              <button className="btn-sm btn-sm-ghost" style={{ fontSize: 11 }} onClick={onClearEvents}>None</button>
            </div>
            <div className="items-list">
              {events.map((ev, i) => (
                <ItemCard key={ev.id} item={ev} isSelected={selEvents.has(ev.id)}
                  isEvent={true} isActiveEdit={editingItem?.item.id === ev.id}
                  staggerIndex={i} onToggle={onToggleEvent} onEdit={() => openEdit(ev, true)}
                  hasConflict={conflictingEventIds.has(ev.id)} />
              ))}
            </div>
            <button className="add-item-btn add-item-event" id="add-event-btn" onClick={handleAddEventClick}>
              ＋ Add Event
            </button>
          </div>
        )}

        {showTodos && (
          <div className="results-column">
            <div className="column-header">
              <span className="column-badge badge-orange">✅ Reminders &amp; Todos</span>
              <span className="column-count">{selTodos.size}/{todos.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button className="btn-sm btn-sm-ghost" style={{ fontSize: 11, background: 'var(--amber-dim)', color: 'var(--amber-light)' }} onClick={onSelectAllTodos}>All</button>
              <button className="btn-sm btn-sm-ghost" style={{ fontSize: 11 }} onClick={onClearTodos}>None</button>
            </div>
            <div className="items-list">
              {todos.map((todo, i) => (
                <ItemCard key={todo.id} item={todo} isSelected={selTodos.has(todo.id)}
                  isEvent={false} isActiveEdit={editingItem?.item.id === todo.id}
                  staggerIndex={showEvents ? i + events.length : i}
                  onToggle={onToggleTodo} onEdit={() => openEdit(todo, false)} />
              ))}
            </div>
            <button className="add-item-btn add-item-todo" id="add-todo-btn" onClick={handleAddTodoClick}>
              ＋ Add Task
            </button>
          </div>
        )}

        {!showEvents && !showTodos && (
          <div className="empty-col" style={{ padding: 48 }}>
            All items removed. Use ＋ Add buttons or go back to paste new text.
          </div>
        )}
        </div>
      </div>

      {/* ── Sticky action bar ────────────────────────────────────── */}
      {totalSelected > 0 && (
        <div className="action-bar">
          <div className="action-bar-inner">
            <div className="action-bar-info">
              <span className="sel-count">{totalSelected}</span>
              <span>/{total} selected</span>
              {selectedEvents.length > 0 && (
                <>&nbsp;·&nbsp;<span className="ev-count">{selectedEvents.length} event{selectedEvents.length > 1 ? 's' : ''}</span></>
              )}
              {selectedTodos.length > 0 && (
                <>&nbsp;·&nbsp;<span className="todo-count">{selectedTodos.length} task{selectedTodos.length > 1 ? 's' : ''}</span></>
              )}
            </div>
            <div className="action-bar-btns">
              {selectedEvents.length > 0 && (
                <button id="export-calendar-btn" className="btn-cal" onClick={() => onOpenExport('calendar')}>
                  📅 Calendar
                </button>
              )}
              {selectedTodos.length > 0 && (
                <button id="export-reminders-btn" className="btn-reminder" onClick={() => onOpenExport('reminders')}>
                  ✅ Reminders
                </button>
              )}
              <button id="share-btn" className="btn-share" onClick={() => onOpenExport('all')}>
                📤 Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit drawer ───────────────────────────────────────────── */}
      {editingItem && (
        <EditDrawer
          item={editingItem.item}
          isEvent={editingItem.isEvent}
          isNew={editingItem.isNew}
          onSave={handleDrawerSave}
          onCancel={handleDrawerCancel}
          onDelete={handleDrawerDelete}
        />
      )}
    </div>
  );
}

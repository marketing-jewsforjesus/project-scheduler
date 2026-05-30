/**
 * UI.JS — All rendering, modal management, and event handling.
 *
 * Sections
 * ────────
 *  1. State & DOM helpers
 *  2. Toast
 *  3. Tab management
 *  4. Main content routing
 *  5. Project toolbar & owners bar
 *  6. Steps panel  (insert-between, double-click to edit)
 *  7. Schedule table
 *  8. Calendar view
 *  9. Step modal   (owner picker, insert-context)
 * 10. New-project modal
 * 11. Holidays modal (global)
 * 12. Project holidays modal (per-project)
 * 13. Event wiring & init
 */

'use strict';

const UI = (() => {
  const H   = window.Holidays;
  const D   = window.Data;
  const Sch = window.Scheduler;
  const Exp = window.Export;
  const Tpl = window.Templates;

  // ═══════════════════════════════════════════════════════
  //  1. STATE & DOM HELPERS
  // ═══════════════════════════════════════════════════════

  const State = {
    projects:      [],      // Project[]
    activeId:      null,    // string | null
    results:       {},      // { [projectId]: { dates, order } }
    scheduleView:  'table', // 'table' | 'calendar'
  };

  // Pending insert context: set when user clicks an insert-between button
  let _insertContext = null;
  // {
  //   insertAtIndex: number,   // position in p.steps to splice
  //   priorStepId:   string,   // new step will dependOn this
  //   nextStepId:    string,   // update this step's dependsOn if it == priorStepId
  // }

  // Currently selected owner names in the step-modal owner picker
  let _stepOwnerSelection = new Set();

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const escHtml = s =>
    String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                   .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Pastel palette ───────────────────────────────────
  const PASTEL_COLORS = [
    '#FFD0D0','#FFDCBA','#FFFAC8','#D0F0D0',
    '#C8E0FF','#E8D0FF','#FFD0EC','#C8FFF0',
    '#FFE4C0','#ECD0FF','#C8E8FF','#D0FFD8',
  ];

  function activeProject() {
    return State.projects.find(p => p.id === State.activeId) || null;
  }

  function saveActive() {
    const p = activeProject();
    if (p) D.saveProject(p);
  }

  function _ownerColorFor(project, ownerName) {
    if (!ownerName) return '#E0E0E0';
    const norm  = ownerName.trim().toLowerCase();
    const owner = (project.owners || []).find(o => o.name.toLowerCase() === norm);
    if (owner) return owner.color;
    // Deterministic fallback
    let hash = 0;
    for (let i = 0; i < norm.length; i++) hash = (hash * 31 + norm.charCodeAt(i)) & 0xffffffff;
    return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
  }

  function _nextOwnerColor(project) {
    const used = new Set((project.owners || []).map(o => o.color));
    for (const c of PASTEL_COLORS) if (!used.has(c)) return c;
    return PASTEL_COLORS[(project.owners || []).length % PASTEL_COLORS.length];
  }

  // Render a comma-separated owners string as colored pill HTML
  function _ownerPillsHtml(project, ownersStr, cls) {
    if (!ownersStr) return '';
    return ownersStr.split(',')
      .map(o => o.trim()).filter(Boolean)
      .map(name => {
        const c = _ownerColorFor(project, name);
        return `<span class="${escHtml(cls)}" style="background:${c};border-color:${c}88;">${escHtml(name)}</span>`;
      })
      .join(' ');
  }

  // ═══════════════════════════════════════════════════════
  //  2. TOAST
  // ═══════════════════════════════════════════════════════

  let _toastTimer;
  function toast(msg, type = '') {
    const el = $('#toast');
    $('#toast-message').textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  // ═══════════════════════════════════════════════════════
  //  3. TAB MANAGEMENT
  // ═══════════════════════════════════════════════════════

  function renderTabs() {
    const container = $('#tabs-container');
    container.innerHTML = '';
    for (const p of State.projects) {
      const tab = document.createElement('div');
      tab.className = 'tab' + (p.id === State.activeId ? ' active' : '');
      tab.dataset.id = p.id;
      tab.innerHTML = `
        <span class="tab-name" title="${escHtml(p.name)}">${escHtml(p.name)}</span>
        <button class="tab-close" title="Delete project">&times;</button>`;
      tab.addEventListener('click', e => {
        if (!e.target.classList.contains('tab-close')) setActive(p.id);
      });
      tab.querySelector('.tab-close').addEventListener('click', e => {
        e.stopPropagation(); deleteProject(p.id);
      });
      container.appendChild(tab);
    }
  }

  function setActive(id) {
    State.activeId = id;
    renderTabs();
    renderMain();
  }

  function deleteProject(id) {
    const p = State.projects.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    D.deleteProject(id);
    State.projects = State.projects.filter(x => x.id !== id);
    delete State.results[id];
    if (State.activeId === id) {
      State.activeId = State.projects.length
        ? State.projects[State.projects.length - 1].id : null;
    }
    renderTabs();
    renderMain();
  }

  // ═══════════════════════════════════════════════════════
  //  4. MAIN CONTENT ROUTING
  // ═══════════════════════════════════════════════════════

  function renderMain() {
    const p = activeProject();
    $('#empty-state').classList.toggle('hidden', !!p);
    $('#project-view').classList.toggle('hidden', !p);
    if (p) renderProjectView(p);
  }

  // ═══════════════════════════════════════════════════════
  //  5. PROJECT TOOLBAR & OWNERS BAR
  // ═══════════════════════════════════════════════════════

  function renderProjectView(p) {
    $('#project-name-input').value  = p.name;
    _populateAnchorSelect(p);
    $('#anchor-date-type').value    = p.anchorDateType || 'end';
    $('#anchor-date-input').value   = p.anchorDate || '';
    renderOwnersBar(p);
    renderStepsList(p);
    _renderScheduleView(p);
  }

  function _populateAnchorSelect(p) {
    const sel = $('#anchor-task-select');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— select task —</option>';
    for (const s of p.steps) {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name || '(unnamed step)';
      sel.appendChild(opt);
    }
    sel.value = p.anchorStepId || cur || '';
  }

  function renderOwnersBar(p) {
    const chipsEl = $('#owner-chips');
    chipsEl.innerHTML = '';
    const owners = p.owners || [];
    for (const owner of owners) {
      const chip = document.createElement('div');
      chip.className = 'owner-chip';
      chip.dataset.id = owner.id;
      chip.innerHTML = `
        <span class="owner-chip-swatch" title="Click to change color"
              style="background:${escHtml(owner.color)};" data-owner-id="${escHtml(owner.id)}"></span>
        <span class="owner-chip-name">${escHtml(owner.name)}</span>
        <button class="owner-chip-remove" title="Remove owner" data-owner-id="${escHtml(owner.id)}">&times;</button>`;
      chipsEl.appendChild(chip);
    }
    if (!owners.length) {
      chipsEl.innerHTML = '<span style="font-size:12px;color:var(--clr-text-muted);padding:0 4px;">No owners yet</span>';
    }
  }

  // ═══════════════════════════════════════════════════════
  //  6. STEPS PANEL
  // ═══════════════════════════════════════════════════════

  function renderStepsList(p) {
    const list = $('#steps-list');
    list.innerHTML = '';

    if (!p.steps.length) {
      list.innerHTML = '<p style="padding:16px;color:var(--clr-text-muted);font-size:13px;">No steps yet. Click <strong>+ Add Step</strong> to begin.</p>';
      return;
    }

    const byId     = Object.fromEntries(p.steps.map(s => [s.id, s]));
    const parallel = Sch.getParallelStepIds(p.steps);

    p.steps.forEach((step, i) => {
      // ── Insert-between button (before each step except the first) ──
      if (i > 0) {
        const insertRow = document.createElement('div');
        insertRow.className = 'step-insert-row';
        const insertBtn = document.createElement('button');
        insertBtn.className = 'btn-insert-step';
        insertBtn.textContent = '+ Insert Step Here';
        insertBtn.addEventListener('click', () => {
          _insertContext = {
            insertAtIndex: i,
            priorStepId:   p.steps[i - 1].id,
            nextStepId:    p.steps[i].id,
          };
          openStepModal(null);
        });
        insertRow.appendChild(insertBtn);
        list.appendChild(insertRow);
      }

      // ── Step row ──
      const row = document.createElement('div');
      row.className = 'step-row';
      row.dataset.id = step.id;

      let depLabel = '';
      if (step.dependsOn && byId[step.dependsOn]) {
        depLabel = `after: ${byId[step.dependsOn].name}`;
      } else if (step.anchorOffset != null) {
        const sign = step.anchorOffset >= 0 ? '+' : '';
        depLabel = `anchor ${sign}${step.anchorOffset} wd`;
      }

      const durLabel = step.durationUnit === 'calendar_weeks'
        ? `${step.workingDays} wks` : `${step.workingDays} wd`;

      const ownerPills = _ownerPillsHtml(p, step.owners, 'owner-badge');

      row.innerHTML = `
        <span class="step-row-number">${i + 1}</span>
        <div class="step-row-info">
          <div class="step-row-name">${escHtml(step.name || '(unnamed)')}</div>
          <div class="step-row-meta">
            ${ownerPills}
            <span class="step-badge days">${escHtml(durLabel)}</span>
            ${depLabel ? `<span class="step-badge">${escHtml(depLabel)}</span>` : ''}
            ${step.id === p.anchorStepId ? '<span class="step-badge" style="background:var(--clr-primary-lt);color:var(--clr-primary)">⚓ anchor</span>' : ''}
            ${parallel.has(step.id) ? '<span class="step-badge" style="background:var(--clr-warn-lt);color:var(--clr-warn)">parallel</span>' : ''}
            ${step.notifications ? `<span class="step-badge notify">notify: ${escHtml(step.notifications)}</span>` : ''}
          </div>
        </div>
        <div class="step-row-actions">
          <button class="btn-icon" data-action="edit" data-id="${step.id}" title="Edit step">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${step.id}" title="Delete step">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>`;

      // Double-click to edit
      row.addEventListener('dblclick', e => {
        if (!e.target.closest('[data-action]')) openStepModal(step.id);
      });

      list.appendChild(row);
    });

    // Delegate action button clicks
    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { id, action } = btn.dataset;
        if (action === 'edit')   openStepModal(id);
        if (action === 'delete') _deleteStep(id);
      });
    });
  }

  function _deleteStep(stepId) {
    const p    = activeProject();
    const step = p.steps.find(s => s.id === stepId);
    if (!step) return;
    if (!confirm(`Delete step "${step.name}"?`)) return;
    D.deleteStep(p, stepId);
    delete State.results[p.id];
    saveActive();
    renderProjectView(p);
    renderTabs();
  }

  // ═══════════════════════════════════════════════════════
  //  7. SCHEDULE TABLE
  // ═══════════════════════════════════════════════════════

  function renderScheduleTable(p, result) {
    const wrap = $('#schedule-table-wrap');
    wrap.innerHTML = '';
    $('#schedule-hint').textContent = `${result.order.length} steps calculated`;

    if (!result.order.length) {
      wrap.innerHTML = '<p style="padding:16px;color:var(--clr-text-muted);">No dates calculated.</p>';
      return;
    }

    const { dates, order } = result;
    const byId     = Object.fromEntries(p.steps.map(s => [s.id, s]));
    const parallel = Sch.getParallelStepIds(p.steps);

    const table = document.createElement('table');
    table.className = 'schedule-table';
    table.innerHTML = `
      <thead><tr>
        <th class="col-num">#</th>
        <th class="col-task">Task</th>
        <th class="col-owner">Owner(s)</th>
        <th class="col-date">Start</th>
        <th class="col-date">End</th>
        <th class="col-days">Duration</th>
        <th class="col-dep">Depends On</th>
        <th class="col-notify">Notify</th>
        <th class="col-notes">Notes</th>
      </tr></thead>
      <tbody id="schedule-tbody"></tbody>`;

    const tbody = table.querySelector('tbody');

    order.forEach((id, i) => {
      const step = byId[id];
      if (!step) return;
      const d        = dates[id];
      const isAnchor = id === p.anchorStepId;
      const isPar    = parallel.has(id);

      let depStr = '—';
      if (step.dependsOn && byId[step.dependsOn]) depStr = byId[step.dependsOn].name;
      else if (step.anchorOffset != null) {
        const sign = step.anchorOffset >= 0 ? '+' : '';
        depStr = `Anchor ${sign}${step.anchorOffset} wd`;
      }

      const durStr   = step.durationUnit === 'calendar_weeks'
        ? `${step.workingDays} wks` : `${step.workingDays} wd`;
      const startStr = d ? H.fmtDisplay(d.start) : '—';
      const endStr   = d ? H.fmtDisplay(d.end)   : '—';
      const ownerCell = step.owners
        ? _ownerPillsHtml(p, step.owners, 'owner-pill')
        : '<span style="color:var(--clr-text-muted)">—</span>';

      const tr = document.createElement('tr');
      if (isPar)    tr.classList.add('is-parallel');
      if (isAnchor) tr.classList.add('is-anchor');
      tr.innerHTML = `
        <td class="col-num">${i + 1}</td>
        <td class="col-task">
          <span class="col-task-name">${escHtml(step.name)}</span>
          ${isAnchor ? ' <span title="Anchor" style="color:var(--clr-primary);font-size:11px">⚓</span>' : ''}
          ${isPar    ? ' <span title="Parallel" style="color:var(--clr-warn);font-size:11px">⇉</span>'   : ''}
        </td>
        <td class="col-owner">${ownerCell}</td>
        <td class="col-date" style="color:var(--clr-text-2)">${escHtml(startStr)}</td>
        <td class="col-date" style="color:var(--clr-text-muted)">${escHtml(endStr)}</td>
        <td class="col-days" style="text-align:center;font-family:var(--font-mono);font-size:12px">${escHtml(durStr)}</td>
        <td class="col-dep">${escHtml(depStr)}</td>
        <td class="col-notify" style="color:${step.notifications ? 'var(--clr-warn)' : 'var(--clr-text-muted)'}">
          ${escHtml(step.notifications || '—')}
        </td>
        <td class="col-notes">${escHtml(step.notes || '')}</td>`;
      tbody.appendChild(tr);
    });

    wrap.appendChild(table);
  }

  // ═══════════════════════════════════════════════════════
  //  8. CALENDAR VIEW
  // ═══════════════════════════════════════════════════════

  function renderCalendarView(p, result) {
    const wrap = $('#cal-view-wrap');
    wrap.innerHTML = '';
    $('#schedule-hint').textContent = `${result.order.length} steps — calendar view`;

    const { dates } = result;
    const byId = Object.fromEntries(p.steps.map(s => [s.id, s]));

    // Build event list
    let minDate = null, maxDate = null;
    const events = [];

    for (const id of result.order) {
      const d    = dates[id];
      const step = byId[id];
      if (!step || !d) continue;

      // Normalize to midnight
      const start = new Date(d.start); start.setHours(0,0,0,0);
      const end   = new Date(d.end);   end.setHours(0,0,0,0);

      // Pick color from first owner
      const firstOwner = (step.owners || '').split(',')[0]?.trim();
      const color = _ownerColorFor(p, firstOwner);

      events.push({ id, step, start, end, color });

      if (!minDate || start < minDate) minDate = new Date(start);
      if (!maxDate || end   > maxDate) maxDate = new Date(end);
    }

    if (!minDate) {
      wrap.innerHTML = '<p style="padding:16px;color:var(--clr-text-muted);">No dates to display.</p>';
      return;
    }

    const calEl = document.createElement('div');
    calEl.className = 'cal-view';

    // Render one full calendar month per month in range
    let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const lastMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    while (curr <= lastMonth) {
      calEl.appendChild(_renderCalMonth(curr.getFullYear(), curr.getMonth(), events));
      curr.setMonth(curr.getMonth() + 1);
    }

    wrap.appendChild(calEl);
  }

  function _renderCalMonth(year, month, events) {
    const el = document.createElement('div');
    el.className = 'cal-month';

    // Title
    const title = document.createElement('div');
    title.className = 'cal-month-title';
    title.textContent = new Date(year, month, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    el.appendChild(title);

    // Day-of-week headers
    const headers = document.createElement('div');
    headers.className = 'cal-day-headers';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
      const h = document.createElement('div');
      h.className = 'cal-day-header-cell';
      h.textContent = d;
      headers.appendChild(h);
    });
    el.appendChild(headers);

    // Grid bounds
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth  = new Date(year, month + 1, 0);

    // Start from the Sunday on or before the 1st
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    // End on the Saturday on or after the last day
    const gridEnd = new Date(lastOfMonth);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

    const today = new Date(); today.setHours(0,0,0,0);

    // Render week rows
    let curr = new Date(gridStart);
    while (curr <= gridEnd) {
      const weekStart = new Date(curr);
      const weekEnd   = new Date(curr);
      weekEnd.setDate(weekEnd.getDate() + 6);
      el.appendChild(_renderCalWeek(weekStart, weekEnd, year, month, events, today));
      curr.setDate(curr.getDate() + 7);
    }

    return el;
  }

  function _renderCalWeek(weekStart, weekEnd, year, month, events, today) {
    const weekEl = document.createElement('div');
    weekEl.className = 'cal-week';

    // ── Day cells ──
    const daysRow = document.createElement('div');
    daysRow.className = 'cal-week-days';

    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);

      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (date.getMonth() !== month)                     cell.classList.add('outside-month');
      if (date.getDay() === 0 || date.getDay() === 6)    cell.classList.add('weekend');
      if (date.getTime() === today.getTime())             cell.classList.add('today');

      const num = document.createElement('span');
      num.className  = 'cal-day-num';
      num.textContent = date.getDate();
      cell.appendChild(num);
      daysRow.appendChild(cell);
    }
    weekEl.appendChild(daysRow);

    // ── Event bars ──
    // Find events overlapping [weekStart, weekEnd]
    const ws = weekStart.getTime();
    const we = weekEnd.getTime();
    const overlapping = events.filter(e => e.start.getTime() <= we && e.end.getTime() >= ws);

    if (!overlapping.length) return weekEl;

    // Clamp each event to the week and sort by clamped start
    const items = overlapping
      .map(ev => {
        const barStart = new Date(Math.max(ev.start.getTime(), ws));
        const barEnd   = new Date(Math.min(ev.end.getTime(),   we));
        return { ev, barStart, barEnd, lane: -1 };
      })
      .sort((a, b) => a.barStart - b.barStart || a.ev.step.name.localeCompare(b.ev.step.name));

    // Greedy lane assignment — laneEnds[i] = timestamp when lane i becomes free
    const laneEnds = [];
    for (const item of items) {
      let laneIdx = laneEnds.findIndex(end => end < item.barStart.getTime());
      if (laneIdx === -1) laneIdx = laneEnds.length;
      laneEnds[laneIdx] = item.barEnd.getTime() + 1; // +1 ms so same-end / same-start don't stack
      item.lane = laneIdx;
    }

    const maxLane = items.reduce((m, it) => Math.max(m, it.lane), 0);
    const LANE_H  = 23; // px per lane

    const evLayer = document.createElement('div');
    evLayer.className = 'cal-events-layer';
    evLayer.style.height = `${(maxLane + 1) * LANE_H + 2}px`;

    for (const { ev, barStart, barEnd, lane } of items) {
      const startDow = barStart.getDay(); // 0 = Sun
      const endDow   = barEnd.getDay();

      // Does the bar start/end within this week or does it continue from/to adjacent week?
      const continuesLeft  = ev.start.getTime() < ws;
      const continuesRight = ev.end.getTime()   > we;

      const leftPct  = (startDow / 7) * 100;
      const widthPct = ((endDow - startDow + 1) / 7) * 100;

      const bar = document.createElement('div');
      bar.className = 'cal-event-bar'
        + (continuesLeft  ? ' continues-left'  : '')
        + (continuesRight ? ' continues-right' : '');

      bar.style.left       = `calc(${leftPct}% + 2px)`;
      bar.style.width      = `calc(${widthPct}% - 4px)`;
      bar.style.top        = `${lane * LANE_H}px`;
      bar.style.background = ev.color;
      bar.style.borderColor= ev.color + '99';

      // Show name only when the event actually starts this week
      const isEventStart = !continuesLeft;
      bar.textContent = isEventStart ? ev.step.name : '';
      bar.title = `${ev.step.name}\n${H.fmtDisplay(ev.start)} – ${H.fmtDisplay(ev.end)}`
        + `  (${ev.step.workingDays} ${ev.step.durationUnit === 'calendar_weeks' ? 'wk' : 'wd'})`;

      evLayer.appendChild(bar);
    }

    weekEl.appendChild(evLayer);
    return weekEl;
  }

  // ── Schedule view manager ─────────────────────────────
  function _renderScheduleView(p) {
    const result     = State.results[p.id];
    const toggleBtn  = $('#btn-toggle-cal-view');
    const tableWrap  = $('#schedule-table-wrap');
    const calWrap    = $('#cal-view-wrap');

    if (!result) {
      toggleBtn.classList.add('hidden');
      tableWrap.innerHTML = '';
      calWrap.innerHTML   = '';
      $('#schedule-hint').textContent = 'Set anchor date and click Calculate';
      return;
    }

    toggleBtn.classList.remove('hidden');

    if (State.scheduleView === 'calendar') {
      tableWrap.classList.add('hidden');
      calWrap.classList.remove('hidden');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="9" x2="9" y2="21"/>
          <line x1="15" y1="9" x2="15" y2="21"/>
        </svg> Table`;
      renderCalendarView(p, result);
    } else {
      calWrap.classList.add('hidden');
      tableWrap.classList.remove('hidden');
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg> Calendar`;
      renderScheduleTable(p, result);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  9. STEP MODAL (add / edit)
  // ═══════════════════════════════════════════════════════

  // Render the owner picker inside #step-owner-picker.
  // If initialNames is a Set/iterable, reset _stepOwnerSelection to it.
  // If initialNames is null, keep _stepOwnerSelection as-is (re-render after adding owner).
  function _renderOwnerPicker(p, initialNames) {
    if (initialNames !== null) {
      _stepOwnerSelection = initialNames instanceof Set
        ? new Set(initialNames)
        : new Set(initialNames || []);
    }

    // Auto-add any selected owners not yet in p.owners
    let ownerAdded = false;
    for (const name of _stepOwnerSelection) {
      if (!(p.owners || []).find(o => o.name.toLowerCase() === name.toLowerCase())) {
        p.owners = p.owners || [];
        p.owners.push({ id: D.uid(), name, color: _nextOwnerColor(p) });
        ownerAdded = true;
      }
    }
    if (ownerAdded) { saveActive(); renderOwnersBar(p); }

    const picker = $('#step-owner-picker');
    if (!picker) return;
    picker.innerHTML = '';

    // ── Chips for existing project owners ──
    if ((p.owners || []).length === 0) {
      const hint = document.createElement('span');
      hint.className  = 'owner-picker-empty';
      hint.textContent = 'No team members yet — add one below';
      picker.appendChild(hint);
    } else {
      for (const owner of p.owners) {
        const isSel = [..._stepOwnerSelection]
          .some(n => n.toLowerCase() === owner.name.toLowerCase());
        const chip = document.createElement('span');
        chip.className   = 'owner-picker-chip' + (isSel ? ' selected' : '');
        chip.dataset.name = owner.name;
        chip.style.background = owner.color;
        chip.textContent = owner.name;
        chip.addEventListener('click', () => {
          const nowSel = chip.classList.toggle('selected');
          if (nowSel) _stepOwnerSelection.add(owner.name);
          else        _stepOwnerSelection.delete(owner.name);
        });
        picker.appendChild(chip);
      }
    }

    // ── "Add new owner" inline input ──
    const newWrap = document.createElement('span');
    newWrap.className = 'owner-picker-new-wrap';

    const newInput = document.createElement('input');
    newInput.type         = 'text';
    newInput.className    = 'owner-picker-new-input';
    newInput.placeholder  = 'New owner…';
    newInput.autocomplete = 'off';
    newInput.maxLength    = 40;

    const addBtn = document.createElement('button');
    addBtn.type      = 'button';
    addBtn.className = 'owner-picker-add-btn';
    addBtn.title     = 'Add new owner to project';
    addBtn.textContent = '+';

    const doAddNew = () => {
      const name = newInput.value.trim();
      if (!name) return;
      p.owners = p.owners || [];
      const existing = p.owners.find(o => o.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        _stepOwnerSelection.add(existing.name);
      } else {
        p.owners.push({ id: D.uid(), name, color: _nextOwnerColor(p) });
        _stepOwnerSelection.add(name);
        saveActive();
        renderOwnersBar(p);
      }
      newInput.value = '';
      _renderOwnerPicker(p, null); // re-render keeping current selection
    };

    addBtn.addEventListener('click', doAddNew);
    newInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doAddNew(); }
    });

    newWrap.appendChild(newInput);
    newWrap.appendChild(addBtn);
    picker.appendChild(newWrap);
  }

  function openStepModal(editId) {
    const p    = activeProject();
    const step = editId ? p.steps.find(s => s.id === editId) : null;

    $('#step-modal-title').textContent = step ? 'Edit Step' : 'Add Step';
    $('#step-edit-id').value = editId || '';

    // Populate Depends On dropdown
    const depSel = $('#step-depends-on');
    depSel.innerHTML = '<option value="">— none (independent / anchor step) —</option>';
    for (const s of p.steps) {
      if (s.id === editId) continue;
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name || '(unnamed step)';
      depSel.appendChild(opt);
    }

    if (step) {
      $('#step-name').value          = step.name;
      $('#step-working-days').value  = step.workingDays;
      $('#step-notifications').value = step.notifications;
      $('#step-notes').value         = step.notes;
      $('#step-duration-unit').value = step.durationUnit || 'working';
      depSel.value = step.dependsOn || '';
      _toggleAnchorOffsetRow(step.dependsOn ? null : (step.anchorOffset ?? ''));
      // Populate owner picker from step
      const names = (step.owners || '').split(',').map(s => s.trim()).filter(Boolean);
      _renderOwnerPicker(p, new Set(names));
    } else {
      // New step — possibly from insert-context
      $('#step-name').value          = '';
      $('#step-working-days').value  = '';
      $('#step-notifications').value = '';
      $('#step-notes').value         = '';
      $('#step-duration-unit').value = 'working';
      _renderOwnerPicker(p, new Set());

      if (_insertContext) {
        depSel.value = _insertContext.priorStepId;
        _toggleAnchorOffsetRow(null); // has a dependency → hide anchor offset
      } else {
        depSel.value = '';
        _toggleAnchorOffsetRow('');
      }
    }

    showModal('#step-modal-overlay');
    setTimeout(() => $('#step-name').focus(), 60);
  }

  function _toggleAnchorOffsetRow(value) {
    let row = $('#anchor-offset-row');
    if (!row) {
      const formBody = $('#step-modal .modal-body');
      row = document.createElement('div');
      row.id = 'anchor-offset-row';
      row.className = 'form-group';
      row.innerHTML = `
        <label for="step-anchor-offset">
          Working-day offset from project anchor
          <span style="font-size:11px;color:var(--clr-text-muted);font-weight:400;">
            (negative = before anchor ends, e.g. -60)
          </span>
        </label>
        <input type="number" id="step-anchor-offset" class="input-text"
               placeholder="e.g. -60" style="max-width:160px;">`;
      formBody.insertBefore(row, formBody.lastElementChild);
    }
    if (value === null) {
      row.classList.add('hidden');
      $('#step-anchor-offset').value = '';
    } else {
      row.classList.remove('hidden');
      if (value !== '') $('#step-anchor-offset').value = value;
    }
  }

  function _saveStep() {
    const p      = activeProject();
    const editId = $('#step-edit-id').value;

    const name = $('#step-name').value.trim();
    const days = parseInt($('#step-working-days').value, 10);

    if (!name)          { toast('Step name is required.', 'error'); $('#step-name').focus(); return; }
    if (!days || days < 1) { toast('Duration must be at least 1.', 'error'); $('#step-working-days').focus(); return; }

    const dependsOn    = $('#step-depends-on').value || null;
    const anchorOffRow = $('#anchor-offset-row');
    const anchorOffset = (!dependsOn && anchorOffRow && !anchorOffRow.classList.contains('hidden'))
      ? (parseInt($('#step-anchor-offset').value, 10) || null) : null;

    // Collect owners from picker selection
    const owners = [..._stepOwnerSelection].join(', ');

    const fields = {
      name, owners,
      workingDays:   days,
      dependsOn,     anchorOffset,
      durationUnit:  $('#step-duration-unit').value,
      notifications: $('#step-notifications').value.trim(),
      notes:         $('#step-notes').value.trim(),
    };

    if (editId) {
      D.updateStep(p, editId, fields);
    } else if (_insertContext) {
      // Insert at specific index instead of appending
      const ctx     = _insertContext;
      const newStep = D.createStep(fields);
      p.steps.splice(ctx.insertAtIndex, 0, newStep);

      // If the step immediately after depended on the prior step, re-wire it
      const nextStep = p.steps.find(s => s.id === ctx.nextStepId);
      if (nextStep && nextStep.dependsOn === ctx.priorStepId) {
        nextStep.dependsOn = newStep.id;
      }

      _insertContext = null;
    } else {
      D.addStep(p, fields);
    }

    delete State.results[p.id];
    saveActive();
    closeModal('#step-modal-overlay');
    renderProjectView(p);
    _populateAnchorSelect(p);
    toast(editId ? 'Step updated.' : 'Step added.', 'success');
  }

  // ═══════════════════════════════════════════════════════
  // 10. NEW-PROJECT MODAL
  // ═══════════════════════════════════════════════════════

  function openNewProjectModal() {
    $('#new-project-name').value = '';
    $$('input[name="anchor-type-new"]').forEach(r => { r.checked = r.value === 'end'; });
    showModal('#project-modal-overlay');
    setTimeout(() => $('#new-project-name').focus(), 60);
  }

  function _confirmNewProject() {
    const name = $('#new-project-name').value.trim();
    if (!name) { toast('Please enter a project name.', 'error'); $('#new-project-name').focus(); return; }
    const type = $('input[name="anchor-type-new"]:checked').value;
    _addProject(D.createProject(name, type));
    closeModal('#project-modal-overlay');
  }

  function _addProject(project) {
    D.saveProject(project);
    State.projects.push(project);
    setActive(project.id);
    toast(`"${project.name}" created.`, 'success');
  }

  // ═══════════════════════════════════════════════════════
  // 11. HOLIDAYS MODAL (global reference)
  // ═══════════════════════════════════════════════════════

  function openHolidaysModal() {
    const yearSel = $('#holiday-year-select');
    const current = new Date().getFullYear();
    if (!yearSel.options.length) {
      for (let y = current - 1; y <= current + 6; y++) {
        const opt = document.createElement('option');
        opt.value = opt.textContent = y;
        yearSel.appendChild(opt);
      }
      yearSel.value = current;
      yearSel.addEventListener('change', _renderHolidayList);
    }
    _renderHolidayList();
    showModal('#holidays-modal-overlay');
  }

  function _renderHolidayList() {
    const year     = parseInt($('#holiday-year-select').value, 10);
    const holidays = H.getHolidaysForYear(year);
    const list     = $('#holidays-list');
    list.innerHTML = '';
    for (const h of holidays) {
      const d   = H.parseDate(h.date);
      const day = d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : '';
      const item = document.createElement('div');
      item.className = 'holiday-item';
      item.innerHTML = `
        <span class="holiday-date">${escHtml(h.date)} ${escHtml(day)}</span>
        <span class="holiday-name">${escHtml(h.name)}</span>`;
      list.appendChild(item);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 12. PROJECT HOLIDAYS MODAL (per-project overrides)
  // ═══════════════════════════════════════════════════════

  let _projHolidaysTarget = null;

  function openProjectHolidaysModal(p) {
    _projHolidaysTarget = p;
    const yearSel = $('#proj-holiday-year-select');
    const current = new Date().getFullYear();
    yearSel.innerHTML = '';
    for (let y = current - 1; y <= current + 6; y++) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = y;
      yearSel.appendChild(opt);
    }
    yearSel.value = current;
    $('#custom-holiday-date').value  = '';
    $('#custom-holiday-label').value = '';
    _renderProjHolidayList(p, current);
    _renderCustomHolidaysList(p);
    showModal('#project-holidays-modal-overlay');
  }

  function _renderProjHolidayList(p, year) {
    const holidays = H.getHolidaysForYear(year);
    const list     = $('#proj-holidays-list');
    const removed  = new Set(p.removedHolidays || []);
    list.innerHTML = '';

    if (!holidays.length) {
      list.innerHTML = '<p style="font-size:12px;color:var(--clr-text-muted);">No standard holidays for this year.</p>';
      return;
    }

    for (const h of holidays) {
      const checked  = !removed.has(h.date);
      const d        = H.parseDate(h.date);
      const dayLabel = d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : '';
      const item = document.createElement('label');
      item.className = 'holiday-check-item';
      item.innerHTML = `
        <input type="checkbox" class="proj-holiday-check" data-date="${escHtml(h.date)}" ${checked ? 'checked' : ''}>
        <span class="holiday-date">${escHtml(h.date)} ${escHtml(dayLabel)}</span>
        <span class="holiday-name">${escHtml(h.name)}</span>`;
      list.appendChild(item);
    }

    list.querySelectorAll('.proj-holiday-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const pp = _projHolidaysTarget;
        if (!pp) return;
        pp.removedHolidays = pp.removedHolidays || [];
        const date = cb.dataset.date;
        if (cb.checked) pp.removedHolidays = pp.removedHolidays.filter(d => d !== date);
        else if (!pp.removedHolidays.includes(date)) pp.removedHolidays.push(date);
      });
    });
  }

  function _renderCustomHolidaysList(p) {
    const container = $('#custom-holidays-list');
    container.innerHTML = '';
    const customs = p.customHolidays || [];

    if (!customs.length) {
      container.innerHTML = '<p style="font-size:12px;color:var(--clr-text-muted);">No custom non-working days added.</p>';
      return;
    }

    for (const entry of customs) {
      const date  = typeof entry === 'string' ? entry : entry.date;
      const label = typeof entry === 'string' ? ''    : (entry.label || '');
      const d     = H.parseDate(date);
      const dayLabel = d
        ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : date;

      const item = document.createElement('div');
      item.className = 'custom-holiday-item';
      item.innerHTML = `
        <span class="custom-holiday-date">${escHtml(dayLabel)}</span>
        ${label ? `<span class="custom-holiday-label">${escHtml(label)}</span>` : ''}
        <button class="btn-icon btn-icon-danger btn-remove-custom-holiday"
                data-date="${escHtml(date)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      container.appendChild(item);
    }

    container.querySelectorAll('.btn-remove-custom-holiday').forEach(btn => {
      btn.addEventListener('click', () => {
        const pp = _projHolidaysTarget;
        if (!pp) return;
        const date = btn.dataset.date;
        pp.customHolidays = (pp.customHolidays || []).filter(e =>
          (typeof e === 'string' ? e : e.date) !== date
        );
        _renderCustomHolidaysList(pp);
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  // 13. IMPORT MODAL
  // ═══════════════════════════════════════════════════════

  let _importParsedSteps = [];

  function openImportModal() {
    _importParsedSteps = [];
    $('#import-project-name').value = '';
    $('#import-paste-area').value   = '';
    $('#import-preview-wrap').classList.add('hidden');
    $('#btn-confirm-import').classList.add('hidden');
    _resetDropZone();

    // Activate File tab
    $$('.import-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'file'));
    $('#import-panel-file').classList.remove('hidden');
    $('#import-panel-paste').classList.add('hidden');

    showModal('#import-modal-overlay');
    setTimeout(() => $('#import-project-name').focus(), 60);
  }

  function _resetDropZone() {
    const dz = $('#file-drop-zone');
    dz.className = 'file-drop-zone';
    dz.innerHTML = `
      <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17,8 12,3 7,8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p class="drop-primary">Drop a CSV or Excel file here</p>
      <p class="drop-secondary">or</p>
      <button class="btn btn-ghost btn-sm" id="btn-browse-file" type="button">Browse files</button>
      <input type="file" id="import-file-input" accept=".csv,.xlsx,.xls" style="display:none">`;

    // Re-wire the browse button (inner HTML was replaced)
    $('#btn-browse-file').addEventListener('click', () => $('#import-file-input').click());
    $('#import-file-input').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) _handleImportFile(f);
      e.target.value = '';
    });
  }

  async function _handleImportFile(file) {
    const suggestedName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    try {
      let rows;
      if (/\.xlsx?$/i.test(file.name)) {
        if (!window.XLSX) {
          toast('Excel support failed to load — please save as CSV and try again.', 'error');
          return;
        }
        const buf = await file.arrayBuffer();
        rows = Import.parseExcel(buf);
      } else {
        const text = await file.text();
        rows = Import.parseCSV(text);
      }

      _processImportRows(rows, suggestedName);

      // Update drop zone to show success state
      const dz = $('#file-drop-zone');
      dz.classList.add('file-loaded');
      dz.querySelector('.drop-icon').style.cssText = 'color:var(--clr-success)';
      dz.querySelector('.drop-primary').textContent  = file.name;
      dz.querySelector('.drop-secondary').textContent = 'File loaded — review steps below';
      const browseBtn = dz.querySelector('#btn-browse-file');
      if (browseBtn) browseBtn.textContent = 'Choose a different file';

    } catch (err) {
      toast('Could not read file: ' + err.message, 'error');
    }
  }

  function _handleImportPaste(text) {
    if (!text.trim()) return;
    // Auto-detect: tabs → TSV (Excel/Sheets paste), otherwise → CSV
    const rows = text.includes('\t') ? Import.parsePaste(text) : Import.parseCSV(text);
    _processImportRows(rows, '');
  }

  function _processImportRows(rows, suggestedName) {
    const { steps, warnings } = Import.rowsToSteps(rows);
    _importParsedSteps = steps;

    // Warnings
    const warnEl = $('#import-warnings-list');
    warnEl.innerHTML = '';
    if (warnings.length) {
      const box = document.createElement('div');
      box.className = 'import-warnings';
      warnings.forEach(w => {
        const p = document.createElement('p');
        p.textContent = '⚠ ' + w;
        box.appendChild(p);
      });
      warnEl.appendChild(box);
    }

    // Preview table
    const inner = $('#import-preview-inner');
    inner.innerHTML = '';

    if (!steps.length) {
      inner.innerHTML = '<p style="font-size:13px;color:var(--clr-danger);padding:4px 0;">No valid steps found. Check that your first row contains column headers.</p>';
      $('#btn-confirm-import').classList.add('hidden');
    } else {
      const heading = document.createElement('p');
      heading.className = 'import-preview-heading';
      heading.textContent = `${steps.length} step${steps.length !== 1 ? 's' : ''} ready to import`;
      inner.appendChild(heading);

      const scroll = document.createElement('div');
      scroll.className = 'import-preview-scroll';

      const byId = Object.fromEntries(steps.map(s => [s.id, s]));
      const tbl  = document.createElement('table');
      tbl.className = 'import-preview-table';
      tbl.innerHTML = `<thead><tr>
        <th>#</th><th>Step Name</th><th>Duration</th>
        <th>Owner(s)</th><th>Depends On</th><th>Notes</th>
      </tr></thead>`;
      const tbody = document.createElement('tbody');

      steps.forEach((s, i) => {
        const depName = s.dependsOn ? (byId[s.dependsOn]?.name || '—') : '—';
        const dur     = s.durationUnit === 'calendar_weeks'
          ? `${s.workingDays} wk` : `${s.workingDays} wd`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td title="${escHtml(s.name)}">${escHtml(s.name)}</td>
          <td style="text-align:center;font-family:var(--font-mono)">${escHtml(dur)}</td>
          <td title="${escHtml(s.owners || '')}">${escHtml(s.owners || '—')}</td>
          <td title="${escHtml(depName)}">${escHtml(depName)}</td>
          <td title="${escHtml(s.notes || '')}">${escHtml(s.notes || '')}</td>`;
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      scroll.appendChild(tbl);
      inner.appendChild(scroll);

      $('#btn-confirm-import').classList.remove('hidden');
    }

    // Auto-fill name if blank
    if (suggestedName && !$('#import-project-name').value.trim()) {
      $('#import-project-name').value = suggestedName;
    }

    $('#import-preview-wrap').classList.remove('hidden');
  }

  function _confirmImport() {
    const name = $('#import-project-name').value.trim();
    if (!name) {
      toast('Please enter a project name.', 'error');
      $('#import-project-name').focus();
      return;
    }
    if (!_importParsedSteps.length) {
      toast('No steps to import.', 'error');
      return;
    }

    const p  = D.createProject(name, 'end');
    p.steps  = _importParsedSteps;

    // Auto-populate owners from step data
    const seen = new Set();
    const ownerList = [];
    for (const step of p.steps) {
      if (!step.owners) continue;
      for (const raw of step.owners.split(',')) {
        const n = raw.trim();
        if (n && !seen.has(n.toLowerCase())) {
          seen.add(n.toLowerCase());
          ownerList.push({
            id:    D.uid(),
            name:  n,
            color: PASTEL_COLORS[ownerList.length % PASTEL_COLORS.length],
          });
        }
      }
    }
    p.owners = ownerList;

    closeModal('#import-modal-overlay');
    _addProject(p);
    toast(`"${name}" imported — ${p.steps.length} steps.`, 'success');
  }

  // ═══════════════════════════════════════════════════════
  //  GENERIC MODAL HELPERS
  // ═══════════════════════════════════════════════════════

  function showModal(sel)  { $(sel).classList.remove('hidden'); }
  function closeModal(sel) { $(sel).classList.add('hidden'); }

  function _attachOverlayClose(overlayId, modalId) {
    $(overlayId).addEventListener('click', e => {
      if (!$(modalId).contains(e.target)) closeModal(overlayId);
    });
  }

  // ═══════════════════════════════════════════════════════
  // 13. EVENT WIRING & INIT
  // ═══════════════════════════════════════════════════════

  function init() {
    State.projects = D.getAllProjects();
    State.activeId = State.projects.length ? State.projects[0].id : null;
    renderTabs();
    renderMain();

    // ── New project ──────────────────────────────────────
    $('#btn-new-project').addEventListener('click', openNewProjectModal);
    $('#btn-new-project-empty').addEventListener('click', openNewProjectModal);
    $('#btn-confirm-new-project').addEventListener('click', _confirmNewProject);
    $('#btn-close-project-modal').addEventListener('click',  () => closeModal('#project-modal-overlay'));
    $('#btn-cancel-project-modal').addEventListener('click', () => closeModal('#project-modal-overlay'));
    $('#btn-import-from-new-project').addEventListener('click', () => {
      closeModal('#project-modal-overlay');
      openImportModal();
    });
    $('#new-project-name').addEventListener('keydown', e => { if (e.key === 'Enter') _confirmNewProject(); });

    // ── Load template ────────────────────────────────────
    $('#btn-load-template').addEventListener('click', () => _addProject(Tpl.getPrintAppealTemplate()));

    // ── Project name ─────────────────────────────────────
    $('#project-name-input').addEventListener('input', () => {
      const p = activeProject(); if (!p) return;
      p.name = $('#project-name-input').value;
      saveActive(); renderTabs();
    });

    // ── Anchor controls ──────────────────────────────────
    $('#anchor-task-select').addEventListener('change', () => {
      const p = activeProject(); if (!p) return;
      p.anchorStepId = $('#anchor-task-select').value || null;
      delete State.results[p.id]; saveActive();
    });
    $('#anchor-date-type').addEventListener('change', () => {
      const p = activeProject(); if (!p) return;
      p.anchorDateType = $('#anchor-date-type').value;
      delete State.results[p.id]; saveActive();
    });
    $('#anchor-date-input').addEventListener('change', () => {
      const p = activeProject(); if (!p) return;
      p.anchorDate = $('#anchor-date-input').value;
      delete State.results[p.id]; saveActive();
    });

    // ── Calculate ────────────────────────────────────────
    $('#btn-calculate').addEventListener('click', () => {
      const p = activeProject(); if (!p) return;
      p.anchorStepId   = $('#anchor-task-select').value || null;
      p.anchorDateType = $('#anchor-date-type').value;
      p.anchorDate     = $('#anchor-date-input').value;
      const { valid, errors } = Sch.validate(p);
      if (!valid) { toast(errors[0], 'error'); return; }
      const result = Sch.schedule(p);
      State.results[p.id] = result;
      saveActive();
      _renderScheduleView(p);
      toast(`Schedule calculated — ${result.order.length} steps.`, 'success');
    });

    // ── Calendar / table toggle ───────────────────────────
    $('#btn-toggle-cal-view').addEventListener('click', () => {
      const p = activeProject(); if (!p || !State.results[p.id]) return;
      State.scheduleView = State.scheduleView === 'table' ? 'calendar' : 'table';
      _renderScheduleView(p);
    });

    // ── Add step ─────────────────────────────────────────
    $('#btn-add-step').addEventListener('click', () => {
      _insertContext = null;
      openStepModal(null);
    });

    // ── Depends-on change → toggle anchor-offset row ─────
    $('#step-depends-on').addEventListener('change', () => {
      _toggleAnchorOffsetRow($('#step-depends-on').value ? null : '');
    });

    // ── Step modal save / cancel ─────────────────────────
    $('#btn-save-step').addEventListener('click', _saveStep);
    $('#btn-cancel-step-modal').addEventListener('click', () => {
      _insertContext = null;
      closeModal('#step-modal-overlay');
    });
    $('#btn-close-step-modal').addEventListener('click', () => {
      _insertContext = null;
      closeModal('#step-modal-overlay');
    });

    // ── Delete project ────────────────────────────────────
    $('#btn-delete-project').addEventListener('click', () => {
      if (State.activeId) deleteProject(State.activeId);
    });

    // ── Export ───────────────────────────────────────────
    $('#btn-export-csv').addEventListener('click', () => {
      const p = activeProject(), r = State.results[p?.id];
      if (!p || !r) { toast('Calculate the schedule first.', 'error'); return; }
      Exp.downloadCSV(p, r); toast('CSV downloaded.', 'success');
    });
    $('#btn-copy-table').addEventListener('click', async () => {
      const p = activeProject(), r = State.results[p?.id];
      if (!p || !r) { toast('Calculate the schedule first.', 'error'); return; }
      try {
        await Exp.copyAsTable(p, r);
        toast('Table copied to clipboard — paste into Google Docs or Sheets.', 'success');
      } catch { toast('Clipboard access denied. Try CSV instead.', 'error'); }
    });

    // ── Global holidays modal ─────────────────────────────
    $('#btn-manage-holidays').addEventListener('click', openHolidaysModal);
    $('#btn-close-holidays-modal').addEventListener('click', () => closeModal('#holidays-modal-overlay'));
    $('#btn-close-holidays-ok').addEventListener('click',   () => closeModal('#holidays-modal-overlay'));

    // ── Per-project holidays modal ────────────────────────
    $('#btn-project-holidays').addEventListener('click', () => {
      const p = activeProject(); if (!p) return;
      openProjectHolidaysModal(p);
    });
    $('#btn-close-proj-holidays').addEventListener('click', () => closeModal('#project-holidays-modal-overlay'));

    $('#proj-holiday-year-select').addEventListener('change', () => {
      const p = _projHolidaysTarget; if (!p) return;
      _renderProjHolidayList(p, parseInt($('#proj-holiday-year-select').value, 10));
    });

    $('#btn-add-custom-holiday').addEventListener('click', () => {
      const p = _projHolidaysTarget; if (!p) return;
      const date  = $('#custom-holiday-date').value;
      const label = $('#custom-holiday-label').value.trim();
      if (!date) { toast('Please select a date.', 'error'); return; }
      p.customHolidays = p.customHolidays || [];
      const exists = p.customHolidays.some(e => (typeof e === 'string' ? e : e.date) === date);
      if (exists) { toast('That date is already added.', 'error'); return; }
      p.customHolidays.push(label ? { date, label } : date);
      $('#custom-holiday-date').value  = '';
      $('#custom-holiday-label').value = '';
      _renderCustomHolidaysList(p);
    });

    ['#custom-holiday-date', '#custom-holiday-label'].forEach(sel => {
      $(sel).addEventListener('keydown', e => {
        if (e.key === 'Enter') $('#btn-add-custom-holiday').click();
      });
    });

    $('#btn-proj-holidays-done').addEventListener('click', () => {
      const p = _projHolidaysTarget;
      if (!p) { closeModal('#project-holidays-modal-overlay'); return; }
      saveActive();
      closeModal('#project-holidays-modal-overlay');
      if (State.results[p.id]) {
        const { valid, errors } = Sch.validate(p);
        if (!valid) { toast(errors[0], 'error'); return; }
        State.results[p.id] = Sch.schedule(p);
        _renderScheduleView(p);
        toast('Holidays updated — schedule recalculated.', 'success');
      } else {
        renderProjectView(p);
        toast('Holidays updated.', 'success');
      }
    });

    $('#btn-proj-holidays-cancel').addEventListener('click', () => {
      if (_projHolidaysTarget) {
        const fresh = D.getProject(_projHolidaysTarget.id);
        if (fresh) {
          const idx = State.projects.findIndex(x => x.id === fresh.id);
          if (idx >= 0) State.projects[idx] = fresh;
        }
      }
      closeModal('#project-holidays-modal-overlay');
    });

    // ── Owners bar: add ───────────────────────────────────
    function _addOwner() {
      const p = activeProject();
      const input = $('#add-owner-input');
      const name  = input.value.trim();
      if (!p || !name) return;
      p.owners = p.owners || [];
      if (p.owners.some(o => o.name.toLowerCase() === name.toLowerCase())) {
        toast(`"${name}" is already on the team.`, 'error'); return;
      }
      p.owners.push({ id: D.uid(), name, color: _nextOwnerColor(p) });
      input.value = '';
      saveActive();
      renderOwnersBar(p);
      renderStepsList(p);
      const result = State.results[p.id];
      if (result) _renderScheduleView(p);
    }
    $('#btn-add-owner').addEventListener('click', _addOwner);
    $('#add-owner-input').addEventListener('keydown', e => { if (e.key === 'Enter') _addOwner(); });

    // ── Owners bar: remove / color-cycle ─────────────────
    $('#owner-chips').addEventListener('click', e => {
      const p = activeProject(); if (!p) return;
      const removeBtn = e.target.closest('.owner-chip-remove');
      if (removeBtn) {
        p.owners = p.owners.filter(o => o.id !== removeBtn.dataset.ownerId);
        saveActive(); renderOwnersBar(p); renderStepsList(p);
        const result = State.results[p.id]; if (result) _renderScheduleView(p);
        return;
      }
      const swatch = e.target.closest('.owner-chip-swatch');
      if (swatch) {
        const owner = (p.owners || []).find(o => o.id === swatch.dataset.ownerId);
        if (!owner) return;
        const idx   = PASTEL_COLORS.indexOf(owner.color);
        owner.color = PASTEL_COLORS[(idx + 1) % PASTEL_COLORS.length];
        saveActive(); renderOwnersBar(p); renderStepsList(p);
        const result = State.results[p.id]; if (result) _renderScheduleView(p);
      }
    });

    // ── Import modal ─────────────────────────────────────
    $('#btn-import-project-empty')?.addEventListener('click', openImportModal);
    $('#btn-close-import-modal').addEventListener('click',  () => closeModal('#import-modal-overlay'));
    $('#btn-cancel-import').addEventListener('click',       () => closeModal('#import-modal-overlay'));
    $('#btn-confirm-import').addEventListener('click', _confirmImport);

    // Template download buttons (empty state + inside import modal)
    $('#btn-download-template').addEventListener('click',        () => Import.downloadTemplate());
    $('#btn-download-template-import').addEventListener('click', () => Import.downloadTemplate());

    // Import tab switching
    $$('.import-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.import-tab').forEach(t => t.classList.toggle('active', t === tab));
        $('#import-panel-file').classList.toggle('hidden',  tab.dataset.tab !== 'file');
        $('#import-panel-paste').classList.toggle('hidden', tab.dataset.tab !== 'paste');
      });
    });

    // File drop zone (initial wiring — _resetDropZone re-wires on open)
    _resetDropZone();

    const dropZone = $('#file-drop-zone');
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', e => {
      if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) _handleImportFile(f);
    });
    // Clicking the drop zone (not a button inside it) triggers file picker
    dropZone.addEventListener('click', e => {
      if (!e.target.closest('button')) {
        const fi = $('#import-file-input');
        if (fi) fi.click();
      }
    });

    // Paste panel
    $('#btn-parse-paste').addEventListener('click', () => {
      _handleImportPaste($('#import-paste-area').value);
    });
    // Auto-parse when user pastes into the textarea
    $('#import-paste-area').addEventListener('paste', () => {
      setTimeout(() => _handleImportPaste($('#import-paste-area').value), 60);
    });

    // ── Overlay backdrop closes ───────────────────────────
    _attachOverlayClose('#project-modal-overlay',          '#project-modal');
    _attachOverlayClose('#step-modal-overlay',             '#step-modal');
    _attachOverlayClose('#holidays-modal-overlay',         '#holidays-modal');
    _attachOverlayClose('#project-holidays-modal-overlay', '#project-holidays-modal');
    _attachOverlayClose('#import-modal-overlay',           '#import-modal');

    // ── Escape closes top modal ───────────────────────────
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // Also clear insert context on escape
      _insertContext = null;
      const modals = [
        '#step-modal-overlay',
        '#import-modal-overlay',
        '#project-holidays-modal-overlay',
        '#project-modal-overlay',
        '#holidays-modal-overlay',
      ];
      for (const m of modals) {
        if (!$(m).classList.contains('hidden')) { closeModal(m); break; }
      }
    });
  }

  return { init, toast };
})();

window.UI = UI;

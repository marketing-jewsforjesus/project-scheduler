/**
 * EXPORT.JS — CSV download + clipboard copy (tab-separated for Google Docs/Sheets).
 */

'use strict';

const Export = (() => {
  const H = window.Holidays;

  const HEADERS = ['#', 'Task', 'Owner(s)', 'Start Date', 'End Date',
                   'Duration', 'Depends On', 'Notify', 'Notes'];

  // ─── Build normalized row data from a scheduled project ───────
  function buildRows(project, result) {
    if (!result || !result.order || !result.order.length) return [];

    const { dates, order } = result;
    const byId = Object.fromEntries(project.steps.map(s => [s.id, s]));

    return order
      .map((id, i) => {
        const step = byId[id];
        if (!step) return null;

        const d = dates[id];

        // Depends On label
        let dep = '—';
        if (step.dependsOn && byId[step.dependsOn]) {
          dep = byId[step.dependsOn].name;
        } else if (step.anchorOffset != null) {
          const sign = step.anchorOffset >= 0 ? '+' : '';
          dep = `Anchor ${sign}${step.anchorOffset} wd`;
        }

        // Duration label
        const dur = step.durationUnit === 'calendar_weeks'
          ? `${step.workingDays} cal. wks`
          : `${step.workingDays} wd`;

        return {
          num:       i + 1,
          task:      step.name,
          owners:    step.owners     || '—',
          start:     d ? H.fmtDisplayFull(d.start) : '—',
          end:       d ? H.fmtDisplayFull(d.end)   : '—',
          dur,
          dep,
          notify:    step.notifications || '—',
          notes:     step.notes          || '',
        };
      })
      .filter(Boolean);
  }

  // ─── CSV (comma-separated, quoted) ───────────────────────────
  function _esc(val) {
    const s = String(val ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(project, result) {
    const rows  = buildRows(project, result);
    const lines = [HEADERS.map(_esc).join(',')];
    for (const r of rows) {
      lines.push([r.num, r.task, r.owners, r.start, r.end, r.dur, r.dep, r.notify, r.notes]
        .map(_esc).join(','));
    }
    return lines.join('\n');
  }

  function downloadCSV(project, result) {
    const csv  = toCSV(project, result);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `${project.name.replace(/[^a-z0-9]/gi, '_')}_schedule.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Clipboard (tab-separated → pastes as table in Google Docs) ─
  function copyAsTable(project, result) {
    const rows  = buildRows(project, result);
    const lines = [HEADERS.join('\t')];
    for (const r of rows) {
      lines.push([r.num, r.task, r.owners, r.start, r.end, r.dur, r.dep, r.notify, r.notes]
        .join('\t'));
    }
    return navigator.clipboard.writeText(lines.join('\n'));
  }

  return { buildRows, toCSV, downloadCSV, copyAsTable };
})();

window.Export = Export;

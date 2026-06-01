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

  // ─── Outlook Calendar CSV ─────────────────────────────────────────
  //
  //  Produces a file Outlook can import via File → Open & Export →
  //  Import/Export → Import from another program or file → CSV.
  //
  //  Columns: Subject | Start Date | Start Time | End Date | End Time
  //  Subject format: "<Project Name> - <Step Name>"
  //  Dates:  M/D/YYYY  (Outlook locale-safe format)
  //  Times:  "h:mm AM/PM" — pass "" to leave blank (all-day events)
  //
  function downloadOutlookCSV(project, result, startTime, endTime) {
    const { dates, order } = result;
    const byId = Object.fromEntries(project.steps.map(s => [s.id, s]));

    // Convert 24-h "HH:MM" (from <input type="time">) → "h:mm AM/PM"
    function _12h(t) {
      if (!t) return '';
      const [hStr, mStr] = t.split(':');
      const h = parseInt(hStr, 10);
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${mStr} ${period}`;
    }

    // M/D/YYYY  (no leading zeros — matches Outlook's expected locale)
    function _outlookDate(d) {
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }

    const HEADERS = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time'];
    const startFmt = _12h(startTime);
    const endFmt   = _12h(endTime);

    const rows = [HEADERS];
    for (const id of order) {
      const step = byId[id];
      const d    = dates[id];
      if (!step || !d) continue;
      rows.push([
        `${project.name} - ${step.name}`,
        _outlookDate(d.start),
        startFmt,
        _outlookDate(d.end),
        endFmt,
      ]);
    }

    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `${project.name.replace(/[^a-z0-9]/gi, '_')}_outlook.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Template CSV (importable format — step definitions, no dates) ─
  //
  //  Outputs the same column layout that import.js / the Download Template
  //  button expects, so this file can be re-uploaded to recreate the project.
  //
  function downloadProjectTemplate(project) {
    const byId = Object.fromEntries(project.steps.map(s => [s.id, s]));

    const TEMPL_HEADERS = [
      'Step Name','Working Days','Owner(s)','Notify',
      'Depends On','Duration Unit','Anchor Offset','Notes',
    ];

    const rows = [TEMPL_HEADERS];
    for (const step of project.steps) {
      const depName      = step.dependsOn && byId[step.dependsOn]
        ? byId[step.dependsOn].name : '';
      const durationUnit = step.durationUnit === 'calendar_weeks'
        ? 'calendar_weeks' : 'working';
      const anchorOffset = step.anchorOffset != null
        ? String(step.anchorOffset) : '';

      rows.push([
        step.name,
        String(step.workingDays),
        step.owners        || '',
        step.notifications || '',
        depName,
        durationUnit,
        anchorOffset,
        step.notes         || '',
      ]);
    }

    const csv = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `${project.name.replace(/[^a-z0-9]/gi, '_')}_template.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { buildRows, toCSV, downloadCSV, copyAsTable, downloadProjectTemplate, downloadOutlookCSV };
})();

window.Export = Export;

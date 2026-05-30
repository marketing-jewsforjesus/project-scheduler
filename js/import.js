/**
 * IMPORT.JS — CSV / Excel parsing and template download.
 *
 * Exports (window.Import):
 *   downloadTemplate()
 *   parseCSV(text)         → rows[][]
 *   parsePaste(text)       → rows[][] (tab-separated)
 *   parseExcel(arrayBuf)   → rows[][] (requires SheetJS / window.XLSX)
 *   rowsToSteps(rows)      → { steps[], warnings[] }
 */

'use strict';

const Import = (() => {

  // ── Template column definitions ──────────────────────
  const HEADERS = [
    'Step Name',
    'Working Days',
    'Owner(s)',
    'Notify',
    'Depends On',
    'Duration Unit',
    'Anchor Offset',
    'Notes',
  ];

  const HINTS = [
    'Required. Unique name for this step.',
    'Required. Number (working days, or calendar weeks if Duration Unit = calendar_weeks).',
    'Optional. Comma-separated names, e.g. Hunter, Arielle',
    'Optional. Who to notify when this step begins.',
    'Optional. Exact "Step Name" of the step this one depends on. Leave blank for root steps.',
    'Optional. "working" (default) or "calendar_weeks" (e.g. for a Mail Date).',
    'Optional. Offset from anchor if no Depends On. Negative = before anchor. e.g. -60',
    'Optional. Any notes or context.',
  ];

  const SAMPLES = [
    ['Appeal Ideation',             '1',  'Hunter, Jeffrey, Arielle', '',       '',                            'working',        '',    '~30 min meeting to decide topic, stories, and inserts.'],
    ['Approved Copy',               '15', 'Hunter, Arielle',          'Hunter', 'Appeal Ideation',             'working',        '',    ''],
    ['Agency Proofing & Versioning','5',  'Dickerson Bakker',         '',       'Approved Copy',               'working',        '',    ''],
    ['Appeal Briefing',             '3',  'Hunter, Designer(s)',      '',       'Agency Proofing & Versioning','working',        '',    'Hand-off to designers.'],
    ['R1 Design → Hunter',          '8',  'Designer(s)',              'Hunter', 'Appeal Briefing',             'working',        '',    ''],
    ['Files → DKB / Printer',       '3',  'Hunter, Designer(s)',      '',       'R1 Design → Hunter',          'working',        '',    'Lands around the 15th of each month.'],
    ['Mail Date',                   '6',  '',                         '',       'Files → DKB / Printer',       'calendar_weeks', '',    '6 calendar weeks after files are sent to printer.'],
    ['Specs to DKB',                '1',  'Hunter, Kristine',         '',       '',                            'working',        '-60', '60 working days before final date.'],
  ];

  // ── Template download ────────────────────────────────
  function downloadTemplate() {
    const rows = [HEADERS, HINTS, ...SAMPLES];
    const csv  = rows.map(row =>
      row.map(cell => {
        const s = String(cell ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"'
          : s;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'project-scheduler-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Column name → field key map ──────────────────────
  const COL_MAP = {
    'step name':    'name',          'name':          'name',
    'task':         'name',          'step':          'name',
    'task name':    'name',

    'working days': 'workingDays',   'days':          'workingDays',
    'duration':     'workingDays',   'wd':            'workingDays',
    'weeks':        'workingDays',   'working days/weeks': 'workingDays',

    'owner':        'owners',        'owners':        'owners',
    'owner(s)':     'owners',        'assigned to':   'owners',
    'assigned':     'owners',

    'notify':       'notifications', 'notifications': 'notifications',
    'notification': 'notifications', 'notify who':    'notifications',

    'depends on':   'dependsOn',     'dependency':    'dependsOn',
    'parent':       'dependsOn',     'predecessor':   'dependsOn',
    'after':        'dependsOn',

    'duration unit':'durationUnit',  'unit':          'durationUnit',
    'type':         'durationUnit',

    'anchor offset':'anchorOffset',  'offset':        'anchorOffset',
    'anchor':       'anchorOffset',

    'notes':        'notes',         'note':          'notes',
    'description':  'notes',         'comments':      'notes',
    'comment':      'notes',
  };

  function _headerToField(raw) {
    return COL_MAP[String(raw ?? '').toLowerCase().trim()] || null;
  }

  // ── CSV parser (RFC 4180) ────────────────────────────
  function parseCSV(text) {
    text = text.replace(/^﻿/, ''); // strip BOM
    const rows  = [];
    let row = [], field = '', inQ = false, i = 0;

    while (i < text.length) {
      const ch = text[i], nx = text[i + 1];
      if (inQ) {
        if (ch === '"' && nx === '"') { field += '"'; i += 2; continue; }
        if (ch === '"')               { inQ = false; i++;    continue; }
        field += ch;
      } else {
        if (ch === '"')  { inQ = true; i++; continue; }
        if (ch === ',')  { row.push(field); field = ''; i++; continue; }
        if (ch === '\r' && nx === '\n') {
          row.push(field); rows.push(row); row = []; field = ''; i += 2; continue;
        }
        if (ch === '\n' || ch === '\r') {
          row.push(field); rows.push(row); row = []; field = ''; i++; continue;
        }
        field += ch;
      }
      i++;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
  }

  // ── Tab-separated paste parser ───────────────────────
  function parsePaste(text) {
    text = text.replace(/^﻿/, '');
    return text
      .split(/\r?\n/)
      .map(line => line.split('\t').map(c => c.trim()))
      .filter(row => row.some(c => c));
  }

  // ── Excel parser (requires SheetJS on window.XLSX) ───
  function parseExcel(arrayBuffer) {
    if (!window.XLSX) throw new Error('Excel support requires the SheetJS library.');
    const wb   = window.XLSX.read(arrayBuffer, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils
      .sheet_to_json(ws, { header: 1, defval: '' })
      .filter(row => row.some(c => String(c ?? '').trim()));
  }

  // ── Convert raw rows → step objects ─────────────────
  // Returns { steps: Step[], warnings: string[] }
  function rowsToSteps(rows) {
    const warnings = [];

    if (!rows || rows.length < 2) {
      return { steps: [], warnings: ['File needs at least a header row and one data row.'] };
    }

    // Find header row — first row containing a recognisable "Step Name" column
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (rows[i].some(c => _headerToField(c) === 'name')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
      return { steps: [], warnings: ['Could not find a "Step Name" column. Make sure your first row is a header row.'] };
    }

    const fields = rows[headerIdx].map(h => _headerToField(h));

    // Skip hint rows immediately after the header (contain "Required." or "Optional.")
    const dataRows = rows.slice(headerIdx + 1).filter(row => {
      const nameIdx = fields.indexOf('name');
      if (nameIdx === -1) return false;
      const n = String(row[nameIdx] ?? '').trim();
      return n && !n.startsWith('Required') && !n.startsWith('Optional') && !n.startsWith('e.g.');
    });

    if (!dataRows.length) {
      return { steps: [], warnings: ['No data rows found after the header.'] };
    }

    // Build raw step objects (dependsOn still holds the name string)
    const rawSteps = [];
    for (const row of dataRows) {
      const obj = {};
      fields.forEach((key, i) => { if (key) obj[key] = String(row[i] ?? '').trim(); });
      if (!obj.name) continue;
      rawSteps.push(obj);
    }

    if (!rawSteps.length) {
      return { steps: [], warnings: ['No valid steps found — "Step Name" cells were all empty.'] };
    }

    // Assign IDs and build name→ID lookup
    const nameToId = {};
    const steps = rawSteps.map(raw => {
      const id = _uid();
      nameToId[raw.name.toLowerCase()] = id;

      const durationUnit = (raw.durationUnit || '').toLowerCase().includes('calendar')
        ? 'calendar_weeks' : 'working';

      const workingDays  = Math.max(1, parseInt(raw.workingDays,  10) || 1);
      const anchorOffset = raw.anchorOffset
        ? (parseInt(raw.anchorOffset, 10) || null) : null;

      return {
        id,
        name:            raw.name,
        owners:          raw.owners        || '',
        workingDays,
        dependsOn:       null,            // resolved below
        _depName:        raw.dependsOn    || '', // temp
        startOffset:     1,
        anchorOffset,
        durationUnit,
        notifications:   raw.notifications || '',
        notes:           raw.notes         || '',
      };
    });

    // Resolve dependsOn names → IDs
    for (const step of steps) {
      const depName = step._depName.trim().toLowerCase();
      if (depName) {
        if (nameToId[depName]) {
          step.dependsOn = nameToId[depName];
        } else {
          warnings.push(`"${step.name}": depends on "${step._depName}" — no matching step found, dependency ignored.`);
        }
      }
      delete step._depName;
    }

    return { steps, warnings };
  }

  // ── Minimal uid (mirrors Data.uid) ───────────────────
  function _uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  return { downloadTemplate, parseCSV, parsePaste, parseExcel, rowsToSteps, HEADERS };
})();

window.Import = Import;

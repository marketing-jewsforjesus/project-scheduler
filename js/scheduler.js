/**
 * SCHEDULER.JS — Dependency-graph date calculator.
 *
 * All working-day arithmetic uses project-specific holiday rules:
 *   - Standard US holidays (from holidays.js) minus project.removedHolidays
 *   - Plus project.customHolidays (extra non-working dates)
 *
 * BFS radiates from the anchor step in both directions:
 *   FORWARD  (children): child.start = addWD(parent.end, child.startOffset)
 *   BACKWARD (parents):  parent.end  = addWD(child.start, -child.startOffset)
 */

'use strict';

const Scheduler = (() => {
  const H = window.Holidays;

  // ─────────────────────────────────────────────────────────
  //  Build project-scoped working-day helpers
  // ─────────────────────────────────────────────────────────
  function _makeWDFns(project) {
    const customNWD = new Set(project.customHolidays  || []);
    const removed   = new Set(project.removedHolidays || []);

    function isWD(date) {
      const dow = date.getDay();
      if (dow === 0 || dow === 6) return false;
      const s   = H.fmt(date);
      if (customNWD.has(s)) return false;
      const std = H.getHolidaySet(date.getFullYear());
      return !(std.has(s) && !removed.has(s));
    }

    function addWD(date, n) {
      const d    = new Date(date);
      const step = n >= 0 ? 1 : -1;
      let   rem  = Math.abs(n);
      while (rem > 0) { d.setDate(d.getDate() + step); if (isWD(d)) rem--; }
      return d;
    }

    function nextWD(date) {
      const d = new Date(date); while (!isWD(d)) d.setDate(d.getDate() + 1); return d;
    }

    function prevWD(date) {
      const d = new Date(date); while (!isWD(d)) d.setDate(d.getDate() - 1); return d;
    }

    // End date of a task starting on `start` with `days` working days duration
    function calcEnd(start, days) {
      return days <= 0 ? new Date(start) : addWD(start, days - 1);
    }

    // Start date of a task ending on `end` with `days` working days duration
    function calcStart(end, days) {
      return days <= 0 ? new Date(end) : addWD(end, -(days - 1));
    }

    return { isWD, addWD, nextWD, prevWD, calcEnd, calcStart };
  }

  // ─────────────────────────────────────────────────────────
  //  Main entry point
  // ─────────────────────────────────────────────────────────
  function schedule(project) {
    const { steps, anchorStepId, anchorDateType, anchorDate } = project;
    if (!anchorStepId || !anchorDate || !steps.length) return _empty();

    const anchorParsed = H.parseDate(anchorDate);
    if (!anchorParsed) return _empty();

    const { addWD, nextWD, prevWD, calcEnd, calcStart } = _makeWDFns(project);

    // ── Lookup tables ──────────────────────────────────────
    const byId = {};
    for (const s of steps) byId[s.id] = s;

    const childrenOf = {};
    for (const s of steps) {
      if (s.dependsOn) {
        (childrenOf[s.dependsOn] = childrenOf[s.dependsOn] || []).push(s);
      }
    }

    const dates   = {};
    const visited = new Set();

    // ── BFS: radiate in both directions from a set of seeds ─
    // Seeds must already be placed in `dates` and marked visited.
    function propagate(seedIds) {
      const queue = [...seedIds];
      while (queue.length) {
        const id   = queue.shift();
        const d    = dates[id];
        const step = byId[id];

        // FORWARD: children that depend on this step
        for (const child of (childrenOf[id] || [])) {
          if (visited.has(child.id)) continue;
          visited.add(child.id);

          let cStart, cEnd;
          if (child.durationUnit === 'calendar_weeks') {
            cStart = H.addCalendarWeeks(d.end, child.workingDays);
            cEnd   = new Date(cStart);
          } else {
            cStart = addWD(d.end, child.startOffset);
            cEnd   = calcEnd(cStart, child.workingDays);
          }
          dates[child.id] = { start: cStart, end: cEnd };
          queue.push(child.id);
        }

        // BACKWARD: parent this step depends on
        if (step.dependsOn && !visited.has(step.dependsOn)) {
          const parent = byId[step.dependsOn];
          if (!parent) continue;
          visited.add(parent.id);
          const pEnd   = addWD(d.start, -(step.startOffset));
          const pStart = calcStart(pEnd, parent.workingDays);
          dates[parent.id] = { start: pStart, end: pEnd };
          queue.push(parent.id);
        }
      }
    }

    // ── Seed anchor, then radiate through its dependency graph ──
    const anchor = byId[anchorStepId];
    if (!anchor) return _empty();

    if (anchorDateType === 'end') {
      const end   = prevWD(anchorParsed);
      const start = calcStart(end, anchor.workingDays);
      dates[anchorStepId] = { start, end };
    } else {
      const start = nextWD(anchorParsed);
      const end   = calcEnd(start, anchor.workingDays);
      dates[anchorStepId] = { start, end };
    }
    visited.add(anchorStepId);
    propagate([anchorStepId]);

    // ── Anchor-offset steps (dependsOn=null, anchorOffset set) ──
    // Place each relative to the anchor's end, then radiate forward so
    // their downstream chains (children, grandchildren, …) also schedule.
    const anchorEnd  = dates[anchorStepId].end;
    const offsetSeeds = [];
    for (const s of steps) {
      if (!s.dependsOn && s.anchorOffset != null && !visited.has(s.id)) {
        const start = addWD(anchorEnd, s.anchorOffset);
        const end   = calcEnd(start, s.workingDays);
        dates[s.id] = { start, end };
        visited.add(s.id);
        offsetSeeds.push(s.id);
      }
    }
    if (offsetSeeds.length) propagate(offsetSeeds);

    return { dates, order: _sortedOrder(steps, dates) };
  }

  // ─────────────────────────────────────────────────────────
  //  Validation
  // ─────────────────────────────────────────────────────────
  function validate(project) {
    const errors = [];
    const ids = new Set(project.steps.map(s => s.id));

    if (!project.anchorStepId || !ids.has(project.anchorStepId))
      errors.push('No anchor step selected — pick a step to anchor the schedule to.');
    if (!project.anchorDate)
      errors.push('No anchor date set.');

    for (const s of project.steps) {
      if (s.dependsOn && !ids.has(s.dependsOn))
        errors.push(`"${s.name}" depends on a step that no longer exists.`);
    }

    if (_hasCycle(project.steps))
      errors.push('Circular dependency detected — check step relationships.');

    return { valid: errors.length === 0, errors };
  }

  // ─────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────
  function _empty() { return { dates: {}, order: [] }; }

  function _sortedOrder(steps, dates) {
    return [...steps]
      .sort((a, b) => {
        const da = dates[a.id], db = dates[b.id];
        if (!da && !db) return 0;
        if (!da) return  1;
        if (!db) return -1;
        const diff = da.start - db.start;
        return diff !== 0 ? diff : da.end - db.end;
      })
      .map(s => s.id);
  }

  function _hasCycle(steps) {
    const children = {};
    for (const s of steps) children[s.id] = [];
    for (const s of steps) {
      if (s.dependsOn && children[s.dependsOn]) children[s.dependsOn].push(s.id);
    }
    const color = Object.fromEntries(steps.map(s => [s.id, 0]));
    function dfs(id) {
      color[id] = 1;
      for (const c of (children[id] || [])) {
        if (color[c] === 1 || (color[c] === 0 && dfs(c))) return true;
      }
      color[id] = 2; return false;
    }
    return steps.some(s => color[s.id] === 0 && dfs(s.id));
  }

  /**
   * Returns a Set of step IDs that share their dependsOn —
   * i.e. they're part of a parallel branch.
   */
  function getParallelStepIds(steps) {
    const cnt = {};
    for (const s of steps) {
      if (s.dependsOn) cnt[s.dependsOn] = (cnt[s.dependsOn] || 0) + 1;
    }
    const out = new Set();
    for (const s of steps) {
      if (s.dependsOn && cnt[s.dependsOn] > 1) out.add(s.id);
    }
    return out;
  }

  return { schedule, validate, getParallelStepIds };
})();

window.Scheduler = Scheduler;

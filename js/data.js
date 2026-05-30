/**
 * DATA.JS — Project & Step data model + localStorage persistence.
 *
 * Schema
 * ──────
 * Project  { id, name, created, modified, anchorStepId, anchorDateType, anchorDate, steps[] }
 * Step     { id, name, owners, workingDays, dependsOn, startOffset,
 *            anchorOffset, durationUnit, notifications, notes }
 *
 * startOffset  – working days between dependsOn.end and this step's start.
 *                Default 1 (next working day). Negative = starts before parent ends.
 * anchorOffset – if dependsOn is null, this step's start = anchor.end + N working days.
 *                Negative = before anchor. null = manual / computed via BFS chain.
 * durationUnit – "working" (default) | "calendar_weeks" (e.g. Mail Date).
 *                For calendar_weeks, workingDays holds the number of weeks.
 */

'use strict';

const Data = (() => {
  const STORAGE_KEY = 'proj_scheduler_v1';

  // ─── ID Generation ──────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  // ─── Storage helpers ────────────────────────────────────
  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { projects: [] };
    } catch {
      return { projects: [] };
    }
  }

  function _save(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  }

  // ─── Project CRUD ────────────────────────────────────────
  function getAllProjects() {
    return _load().projects;
  }

  function getProject(id) {
    return _load().projects.find(p => p.id === id) || null;
  }

  function saveProject(project) {
    const store = _load();
    project.modified = new Date().toISOString();
    const i = store.projects.findIndex(p => p.id === project.id);
    if (i >= 0) store.projects[i] = project;
    else         store.projects.push(project);
    return _save(store);
  }

  function deleteProject(id) {
    const store = _load();
    store.projects = store.projects.filter(p => p.id !== id);
    return _save(store);
  }

  function createProject(name = 'New Project', anchorDateType = 'end') {
    const now = new Date().toISOString();
    return {
      id:              uid(),
      name,
      created:         now,
      modified:        now,
      anchorStepId:    null,
      anchorDateType,        // "end" | "start"
      anchorDate:      '',   // "YYYY-MM-DD"
      steps:           [],
      owners:          [],   // [{ id, name, color }]
      customHolidays:  [],   // ["YYYY-MM-DD"]  — extra non-working days
      removedHolidays: [],   // ["YYYY-MM-DD"]  — standard holidays to skip
    };
  }

  // ─── Step factory ────────────────────────────────────────
  function createStep(f = {}) {
    return {
      id:            f.id            || uid(),
      name:          f.name          || '',
      owners:        f.owners        || '',
      workingDays:   f.workingDays  != null ? +f.workingDays  : 1,
      dependsOn:     f.dependsOn    || null,
      startOffset:   f.startOffset  != null ? +f.startOffset  : 1,
      anchorOffset:  f.anchorOffset != null ? +f.anchorOffset : null,
      durationUnit:  f.durationUnit || 'working',
      notifications: f.notifications || '',
      notes:         f.notes         || '',
    };
  }

  // ─── Step CRUD (mutates project in-place — call saveProject after) ──
  function addStep(project, fields) {
    const step = createStep(fields);
    project.steps.push(step);
    return step;
  }

  function updateStep(project, stepId, fields) {
    const i = project.steps.findIndex(s => s.id === stepId);
    if (i < 0) return null;
    // Merge fields; don't allow changing the id
    project.steps[i] = { ...project.steps[i], ...fields, id: project.steps[i].id };
    return project.steps[i];
  }

  function deleteStep(project, stepId) {
    project.steps = project.steps.filter(s => s.id !== stepId);
    // Clear dangling references
    for (const s of project.steps) {
      if (s.dependsOn === stepId) s.dependsOn = null;
    }
    if (project.anchorStepId === stepId) project.anchorStepId = null;
    return project;
  }

  function reorderStep(project, fromIdx, toIdx) {
    const arr = [...project.steps];
    arr.splice(toIdx, 0, arr.splice(fromIdx, 1)[0]);
    project.steps = arr;
    return project;
  }

  // ─── Export ──────────────────────────────────────────────
  return {
    uid,
    getAllProjects,
    getProject,
    saveProject,
    deleteProject,
    createProject,
    createStep,
    addStep,
    updateStep,
    deleteStep,
    reorderStep,
  };
})();

window.Data = Data;

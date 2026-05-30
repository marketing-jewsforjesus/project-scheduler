/**
 * TEMPLATES.JS — Pre-built project templates.
 *
 * Currently includes:
 *   getPrintAppealTemplate() → fully configured Print Appeal project
 *
 * Dependency map (from PDF):
 *
 *   Appeal Ideation ─────────────────────────────────────────────────────── (root of main chain)
 *     ├─ Approved Copy (15 wd) ──► Agency Proofing (5) ──► Appeal Briefing (3)
 *     │    ──► R1 Design (8) ──► DKB Review (2) ──► R1 Feedback Call (1)
 *     │    ──► R2 Design (3) ──► R2 Review (2) ──► R3 Design (3)
 *     │              ├─ R3 Production & Proofing Review (2)  ← parallel
 *     │              └─ R3 Review / Final Notes (3)  ← parallel (critical path)
 *     │                   ──► Final Approval (2) ──► Final File Packaging (2)
 *     │                   ──► Files → DKB/Printer (3)  ← ANCHOR (end date)
 *     │                   ──► Mail Date  (6 calendar weeks after anchor)
 *     └─ Preliminary Specs (15 wd, parallel with Approved Copy)
 *
 *   Specs to DKB  (1 wd, independent — anchored 60 wd before Files → DKB/Printer end)
 */

'use strict';

const Templates = (() => {

  function getPrintAppealTemplate() {
    const project = Data.createProject('Print Appeal', 'end');

    // Pre-assign IDs so we can cross-reference in dependsOn fields
    const ID = {
      ideation:      Data.uid(),
      specsDKB:      Data.uid(),
      approvedCopy:  Data.uid(),
      prelimSpecs:   Data.uid(),
      agencyProof:   Data.uid(),
      briefing:      Data.uid(),
      r1Design:      Data.uid(),
      dkbReview:     Data.uid(),
      r1Feedback:    Data.uid(),
      r2Design:      Data.uid(),
      r2Review:      Data.uid(),
      r3Design:      Data.uid(),
      r3ProdProof:   Data.uid(),
      r3ReviewFinal: Data.uid(),
      finalApproval: Data.uid(),
      finalFilePkg:  Data.uid(),
      filesToDKB:    Data.uid(),  // ← ANCHOR
      mailDate:      Data.uid(),
    };

    project.steps = [

      // ── ROOT: Appeal Ideation ──────────────────────────────
      // No dependsOn (root of main chain).
      // Computed via backward BFS from the anchor through the chain.
      Data.createStep({
        id:            ID.ideation,
        name:          'Appeal Ideation',
        owners:        'Hunter, Jeffrey, Arielle',
        workingDays:   1,
        dependsOn:     null,
        anchorOffset:  null,
        notifications: '',
        notes:         'Deciding on topic, stories, inserts, etc. ~30 min meeting on the 10th of each month.',
      }),

      // ── INDEPENDENT: Specs to DKB ─────────────────────────
      // Not in the main chain — anchored directly to 60 wd before Files → DKB/Printer.
      Data.createStep({
        id:            ID.specsDKB,
        name:          'Specs to DKB',
        owners:        'Hunter, Kristine',
        workingDays:   1,
        dependsOn:     null,
        anchorOffset:  -60,   // 60 working days before anchor (Files → DKB/Printer) ends
        notifications: '',
        notes:         '60 working days before final date.',
      }),

      // ── PARALLEL BRANCH 1: from Appeal Ideation ───────────
      Data.createStep({
        id:            ID.approvedCopy,
        name:          'Approved Copy',
        owners:        'Hunter, Arielle',
        workingDays:   15,
        dependsOn:     ID.ideation,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.prelimSpecs,
        name:          'Preliminary Specs',
        owners:        'Hunter, Kristine',
        workingDays:   15,
        dependsOn:     ID.ideation,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with Approved Copy.',
      }),

      // ── MAIN CHAIN: Agency → Briefing → Rounds ────────────
      Data.createStep({
        id:            ID.agencyProof,
        name:          'Agency Proofing & Versioning',
        owners:        'Dickerson Bakker',
        workingDays:   5,
        dependsOn:     ID.approvedCopy,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.briefing,
        name:          'Appeal Briefing',
        owners:        'Hunter, Designer(s)',
        workingDays:   3,
        dependsOn:     ID.agencyProof,
        startOffset:   1,
        notifications: '',
        notes:         'Hand-off to designers.',
      }),
      Data.createStep({
        id:            ID.r1Design,
        name:          'R1 Design → Hunter',
        owners:        'Designer(s)',
        workingDays:   8,
        dependsOn:     ID.briefing,
        startOffset:   1,
        notifications: 'Hunter, Designer',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.dkbReview,
        name:          'DKB Review',
        owners:        'Designer(s)',
        workingDays:   2,
        dependsOn:     ID.r1Design,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r1Feedback,
        name:          'R1 Feedback Call',
        owners:        'Hunter, DKB, Designer(s)',
        workingDays:   1,
        dependsOn:     ID.dkbReview,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r2Design,
        name:          'R2 Design → Hunter',
        owners:        'Designer(s)',
        workingDays:   3,
        dependsOn:     ID.r1Feedback,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r2Review,
        name:          'R2 Review',
        owners:        'Arielle, Hunter',
        workingDays:   2,
        dependsOn:     ID.r2Design,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r3Design,
        name:          'R3 Design → Hunter',
        owners:        'Designer(s)',
        workingDays:   3,
        dependsOn:     ID.r2Review,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

      // ── PARALLEL BRANCH 2: from R3 Design ─────────────────
      Data.createStep({
        id:            ID.r3ProdProof,
        name:          'R3 Production & Proofing Review',
        owners:        'DKB',
        workingDays:   2,
        dependsOn:     ID.r3Design,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with R3 Review (Final Notes).',
      }),
      Data.createStep({
        id:            ID.r3ReviewFinal,
        name:          'R3 Review (Final Notes)',
        owners:        'Aaron, Arielle',
        workingDays:   3,
        dependsOn:     ID.r3Design,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with R3 Production & Proofing Review. Critical path.',
      }),

      // ── FINAL CHAIN ────────────────────────────────────────
      Data.createStep({
        id:            ID.finalApproval,
        name:          'Final Approval',
        owners:        'Aaron',
        workingDays:   2,
        dependsOn:     ID.r3ReviewFinal,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.finalFilePkg,
        name:          'Final File Packaging',
        owners:        'Designer(s)',
        workingDays:   2,
        dependsOn:     ID.finalApproval,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

      // ── ANCHOR ─────────────────────────────────────────────
      Data.createStep({
        id:            ID.filesToDKB,
        name:          'Files → DKB / Printer',
        owners:        'Hunter, Designer(s)',
        workingDays:   3,
        dependsOn:     ID.finalFilePkg,
        startOffset:   1,
        notifications: '',
        notes:         'Lands around the 15th of each month.',
      }),

      // ── POST-ANCHOR: Mail Date ─────────────────────────────
      // 6 calendar weeks after files are sent. Uses durationUnit = "calendar_weeks"
      // so the scheduler treats workingDays as the number of calendar-week offset.
      Data.createStep({
        id:            ID.mailDate,
        name:          'Mail Date',
        owners:        '',
        workingDays:   6,          // 6 calendar weeks
        dependsOn:     ID.filesToDKB,
        startOffset:   0,          // not used for calendar_weeks steps
        durationUnit:  'calendar_weeks',
        notifications: '',
        notes:         '6 calendar weeks after files are sent to printer.',
      }),

    ];

    // Point the anchor at Files → DKB/Printer (end date anchor)
    project.anchorStepId   = ID.filesToDKB;
    project.anchorDateType = 'end';
    project.anchorDate     = '';   // user fills in the target date before calculating

    // ── Auto-populate owners from step data ───────────────
    const PASTELS = [
      '#FFD0D0','#FFDCBA','#FFFAC8','#D0F0D0',
      '#C8E0FF','#E8D0FF','#FFD0EC','#C8FFF0',
      '#FFE4C0','#ECD0FF','#C8E8FF','#D0FFD8',
    ];
    const seen = new Set();
    const ownerList = [];
    for (const step of project.steps) {
      if (!step.owners) continue;
      for (const raw of step.owners.split(',')) {
        const name = raw.trim();
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          ownerList.push({
            id:    Data.uid(),
            name,
            color: PASTELS[ownerList.length % PASTELS.length],
          });
        }
      }
    }
    project.owners = ownerList;

    return project;
  }

  return { getPrintAppealTemplate };
})();

window.Templates = Templates;

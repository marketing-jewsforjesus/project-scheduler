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

  // ── Digital Appeal Template ───────────────────────────────────────
  //
  //  Based on the standard Digital Appeal workflow.
  //
  //  Dependency map:
  //
  //  Appeal Ideation (root)
  //    └─ Approved Copy & Design (5)
  //         ├─ Hand-off to Irina (1) ──► Copy Proofing (2) ──► Check/Stet (1)
  //         │    ──► Email Building (2)
  //         │         ├─ Email Preview to HC, JS (1) ──► Email Preview to CEO/COO (1)
  //         │         └─ QA Emails (2) ──► Send Internally (1)
  //         │                        └──► Scheduling Emails (1)  ← ANCHOR
  //         └─ Viewspark Building (10) ──► Viewspark Approval (5)
  //
  function getDigitalAppealTemplate() {
    const project = Data.createProject('Digital Appeal', 'end');

    const ID = {
      ideation:       Data.uid(),
      approvedCopy:   Data.uid(),
      handOff:        Data.uid(),
      copyProofing:   Data.uid(),
      checkStet:      Data.uid(),
      emailBuilding:  Data.uid(),
      previewHCJS:    Data.uid(),
      previewCEO:     Data.uid(),
      qaEmails:       Data.uid(),
      sendInternally: Data.uid(),
      scheduling:     Data.uid(),   // ← ANCHOR
      viewsparkBuild: Data.uid(),
      viewsparkApprv: Data.uid(),
    };

    project.steps = [

      // ── ROOT ──────────────────────────────────────────────
      Data.createStep({
        id:            ID.ideation,
        name:          'Appeal Ideation',
        owners:        'Hunter, Jeffrey',
        workingDays:   5,
        dependsOn:     null,
        anchorOffset:  null,
        notifications: '',
        notes:         'JS & HC meet to decide on copy, images, CTAs, etc.',
      }),

      // ── MAIN CHAIN ────────────────────────────────────────
      Data.createStep({
        id:            ID.approvedCopy,
        name:          'Approved Copy & Design',
        owners:        'Arielle, Aaron',
        workingDays:   5,
        dependsOn:     ID.ideation,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         'JS sends previews to ELT for approval.',
      }),
      Data.createStep({
        id:            ID.handOff,
        name:          'Hand-off to Irina',
        owners:        'Jeffrey, Hunter',
        workingDays:   1,
        dependsOn:     ID.approvedCopy,
        startOffset:   1,
        notifications: '',
        notes:         'JS sends Irina brief with folder of assets and previews.',
      }),
      Data.createStep({
        id:            ID.copyProofing,
        name:          'Copy Proofing',
        owners:        'Proofreading',
        workingDays:   2,
        dependsOn:     ID.handOff,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         'Irina sends email doc to proofreading; JS & HC to check/stet changes.',
      }),
      Data.createStep({
        id:            ID.checkStet,
        name:          'Check / Stet Changes',
        owners:        'Irina',
        workingDays:   1,
        dependsOn:     ID.copyProofing,
        startOffset:   1,
        notifications: '',
        notes:         'If only small spelling/grammar changes, Irina can just accept all changes.',
      }),
      Data.createStep({
        id:            ID.emailBuilding,
        name:          'Email Building',
        owners:        'Irina, Vladimir',
        workingDays:   2,
        dependsOn:     ID.checkStet,
        startOffset:   1,
        notifications: '',
        notes:         'CC Graham for oversight.',
      }),

      // ── PARALLEL BRANCH 1: Preview chain ──────────────────
      Data.createStep({
        id:            ID.previewHCJS,
        name:          'Email Preview to HC, JS',
        owners:        'Irina, Hunter, Jeffrey',
        workingDays:   1,
        dependsOn:     ID.emailBuilding,
        startOffset:   1,
        notifications: '',
        notes:         'JS sends final email to ELT in WhatsApp.',
      }),
      Data.createStep({
        id:            ID.previewCEO,
        name:          'Email Preview to CEO/COO',
        owners:        'Jeffrey, Hunter, Arielle, Aaron',
        workingDays:   1,
        dependsOn:     ID.previewHCJS,
        startOffset:   1,
        notifications: '',
        notes:         'Not an approval — just letting them see it.',
      }),

      // ── PARALLEL BRANCH 2: QA chain ───────────────────────
      Data.createStep({
        id:            ID.qaEmails,
        name:          'QA Emails',
        owners:        'Tim M, Mark G',
        workingDays:   2,
        dependsOn:     ID.emailBuilding,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.sendInternally,
        name:          'Send Internally',
        owners:        'Mark G',
        workingDays:   1,
        dependsOn:     ID.qaEmails,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

      // ── ANCHOR: Scheduling Emails ─────────────────────────
      Data.createStep({
        id:            ID.scheduling,
        name:          'Scheduling Emails',
        owners:        'Irina',
        workingDays:   1,
        dependsOn:     ID.qaEmails,
        startOffset:   1,
        notifications: '',
        notes:         'Second Tuesday of every month — 1st email.',
      }),

      // ── PARALLEL BRANCH 3: Viewspark (from Approved Copy) ─
      Data.createStep({
        id:            ID.viewsparkBuild,
        name:          'Viewspark Building',
        owners:        'Hunter, Bill',
        workingDays:   10,
        dependsOn:     ID.approvedCopy,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.viewsparkApprv,
        name:          'Viewspark Approval',
        owners:        'Arielle, Aaron',
        workingDays:   5,
        dependsOn:     ID.viewsparkBuild,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

    ];

    project.anchorStepId   = ID.scheduling;
    project.anchorDateType = 'end';
    project.anchorDate     = '';

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

  return { getPrintAppealTemplate, getDigitalAppealTemplate };
})();

window.Templates = Templates;

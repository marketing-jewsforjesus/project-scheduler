/**
 * TEMPLATES.JS — Pre-built project templates.
 *
 * Includes:
 *   getPrintAppealTemplate()   → Print Appeal project
 *   getDigitalAppealTemplate() → Digital Appeal project
 *
 * ── Print Appeal dependency map ─────────────────────────────────────
 *
 *   Mail Date  ← ANCHOR (end date, 0-day milestone)
 *   Appeal Ideation  (anchored 70 working days before Mail Date)
 *     ├─ Specs to Printer (5, parallel)
 *     └─ Approved Copy (10) ──► Proofing (5) ──► Appeal Briefing (1)
 *          ──► R1 Design (8) ──► R1 Review (3) ──► R1 Feedback Call (1)
 *          ──► R2 Design (3) ──► R2 Review (2) ──► R3 Design (3)
 *                 ├─ R3 Production Review (3)  ← parallel
 *                 ├─ R3 Final Proof (3)        ← parallel
 *                 └─ R3 ELT Review (3)         ← parallel (critical path)
 *                      ──► Final Approval (3) ──► Final File Packaging (1)
 *                      ──► Files → Kristine / Printer (1)
 */

'use strict';

const Templates = (() => {

  // Shared pastel palette used to auto-assign owner colors
  const PASTELS = [
    '#FFD0D0','#FFDCBA','#FFFAC8','#D0F0D0',
    '#C8E0FF','#E8D0FF','#FFD0EC','#C8FFF0',
    '#FFE4C0','#ECD0FF','#C8E8FF','#D0FFD8',
  ];

  // Walk a project's steps and populate project.owners (unique, colored)
  function _populateOwners(project) {
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
  }

  function getPrintAppealTemplate() {
    const project = Data.createProject('Print Appeal', 'end');

    // Pre-assign IDs so we can cross-reference in dependsOn fields
    const ID = {
      mailDate:      Data.uid(),  // ← ANCHOR (0-day milestone)
      ideation:      Data.uid(),  // anchored 70 wd before Mail Date
      specsPrinter:  Data.uid(),
      approvedCopy:  Data.uid(),
      proofing:      Data.uid(),
      briefing:      Data.uid(),
      r1Design:      Data.uid(),
      r1Review:      Data.uid(),
      r1Feedback:    Data.uid(),
      r2Design:      Data.uid(),
      r2Review:      Data.uid(),
      r3Design:      Data.uid(),
      r3Production:  Data.uid(),
      r3FinalProof:  Data.uid(),
      r3EltReview:   Data.uid(),
      finalApproval: Data.uid(),
      finalFilePkg:  Data.uid(),
      filesToPrinter:Data.uid(),
    };

    project.steps = [

      // ── ANCHOR: Mail Date ──────────────────────────────────
      // 0-day milestone. Everything else is scheduled relative to this.
      Data.createStep({
        id:            ID.mailDate,
        name:          'Mail Date',
        owners:        'Printer',
        workingDays:   0,
        dependsOn:     null,
        anchorOffset:  null,
        notifications: '',
        notes:         'Target in-home / mail date. Anchor for the whole schedule.',
      }),

      // ── ROOT: Appeal Ideation ──────────────────────────────
      // Anchored 70 working days before the Mail Date; its downstream
      // chain radiates forward from here.
      Data.createStep({
        id:            ID.ideation,
        name:          'Appeal Ideation',
        owners:        'Hunter, Jeffrey, Arielle',
        workingDays:   3,
        dependsOn:     null,
        anchorOffset:  -70,   // 70 working days before Mail Date
        notifications: '',
        notes:         'Deciding on topic, stories, inserts, etc. ~30 min meeting on the 10th of each month. Starts ~70 working days before the Mail Date.',
      }),

      // ── PARALLEL off Ideation ──────────────────────────────
      Data.createStep({
        id:            ID.specsPrinter,
        name:          'Specs to Printer',
        owners:        'Hunter, Kristine',
        workingDays:   5,
        dependsOn:     ID.ideation,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with Approved Copy.',
      }),
      Data.createStep({
        id:            ID.approvedCopy,
        name:          'Approved Copy',
        owners:        'Hunter, Arielle, Aaron',
        workingDays:   10,
        dependsOn:     ID.ideation,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         '',
      }),

      // ── MAIN CHAIN ─────────────────────────────────────────
      Data.createStep({
        id:            ID.proofing,
        name:          'Proofing',
        owners:        'Proofreading',
        workingDays:   5,
        dependsOn:     ID.approvedCopy,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.briefing,
        name:          'Appeal Briefing',
        owners:        'Hunter, Design',
        workingDays:   1,
        dependsOn:     ID.proofing,
        startOffset:   1,
        notifications: '',
        notes:         'Hand-off to designers.',
      }),
      Data.createStep({
        id:            ID.r1Design,
        name:          'R1 Design → Hunter',
        owners:        'Design',
        workingDays:   8,
        dependsOn:     ID.briefing,
        startOffset:   1,
        notifications: 'Hunter, Design',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r1Review,
        name:          'R1 Review',
        owners:        'Hunter, Arielle, Jeffrey, Philanthropy',
        workingDays:   3,
        dependsOn:     ID.r1Design,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r1Feedback,
        name:          'R1 Feedback Call',
        owners:        'Hunter, Design',
        workingDays:   1,
        dependsOn:     ID.r1Review,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r2Design,
        name:          'R2 Design → Hunter',
        owners:        'Design',
        workingDays:   3,
        dependsOn:     ID.r1Feedback,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r2Review,
        name:          'R2 Review',
        owners:        'Arielle, Hunter, Jeffrey',
        workingDays:   2,
        dependsOn:     ID.r2Design,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.r3Design,
        name:          'R3 Design → Hunter',
        owners:        'Design',
        workingDays:   3,
        dependsOn:     ID.r2Review,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

      // ── PARALLEL BRANCH off R3 Design ──────────────────────
      Data.createStep({
        id:            ID.r3Production,
        name:          'R3 Production Review',
        owners:        'Kristine, Printer',
        workingDays:   3,
        dependsOn:     ID.r3Design,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with R3 Final Proof and R3 ELT Review.',
      }),
      Data.createStep({
        id:            ID.r3FinalProof,
        name:          'R3 Final Proof',
        owners:        'Proofreading',
        workingDays:   3,
        dependsOn:     ID.r3Design,
        startOffset:   1,
        notifications: '',
        notes:         'Runs in parallel with R3 Production Review and R3 ELT Review.',
      }),
      Data.createStep({
        id:            ID.r3EltReview,
        name:          'R3 ELT Review',
        owners:        'Aaron, Arielle',
        workingDays:   3,
        dependsOn:     ID.r3Design,
        startOffset:   1,
        notifications: '',
        notes:         'Critical path — Final Approval depends on this.',
      }),

      // ── FINAL CHAIN ────────────────────────────────────────
      Data.createStep({
        id:            ID.finalApproval,
        name:          'Final Approval',
        owners:        'Aaron',
        workingDays:   3,
        dependsOn:     ID.r3EltReview,
        startOffset:   1,
        notifications: 'Hunter',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.finalFilePkg,
        name:          'Final File Packaging',
        owners:        'Design',
        workingDays:   1,
        dependsOn:     ID.finalApproval,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.filesToPrinter,
        name:          'Files → Kristine / Printer',
        owners:        'Hunter, Design, Kristine',
        workingDays:   1,
        dependsOn:     ID.finalFilePkg,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

    ];

    // Anchor on the Mail Date (end-date milestone)
    project.anchorStepId   = ID.mailDate;
    project.anchorDateType = 'end';
    project.anchorDate     = '';   // user fills in the target date before calculating

    _populateOwners(project);
    return project;
  }

  // ── Digital Appeal Template ───────────────────────────────────────
  //
  //  Appeal Ideation (5, root)
  //    └─ Approved Copy & Design (5)
  //         ├─ Viewspark Building (5) ──► Viewspark Approval (2)
  //         └─ Hand-off to Irina (1) ──► Copy Proofing (2) ──► Check/Stet (1)
  //              ──► Landing Page Build (1) ──► Email Building (2)
  //                   ├─ Email Preview to HC, JS (1) ──► Email Preview to CEO/COO (1)
  //                   └─ QA Emails (2)
  //                        ├─ Send Internally (1)
  //                        └─ Scheduling Emails (1)  ← ANCHOR
  //                             ├─ Email 1 - Send date (7 wd → 2nd Tuesday)
  //                             ├─ Viewspark - Send date (15 wd → 3rd Wednesday)
  //                             └─ Email 2 - Send date (23 wd → 4th Thursday)
  //
  function getDigitalAppealTemplate() {
    const project = Data.createProject('Digital Appeal', 'end');

    const ID = {
      ideation:       Data.uid(),
      approvedCopy:   Data.uid(),
      viewsparkBuild: Data.uid(),
      viewsparkApprv: Data.uid(),
      handOff:        Data.uid(),
      copyProofing:   Data.uid(),
      checkStet:      Data.uid(),
      landingPage:    Data.uid(),
      emailBuilding:  Data.uid(),
      previewHCJS:    Data.uid(),
      previewCEO:     Data.uid(),
      qaEmails:       Data.uid(),
      sendInternally: Data.uid(),
      scheduling:     Data.uid(),   // ← ANCHOR
      email1Send:     Data.uid(),
      viewsparkSend:  Data.uid(),
      email2Send:     Data.uid(),
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
        notifications: '',
        notes:         'JS sends previews to ELT for approval.',
      }),

      // ── PARALLEL: Viewspark build/approve (from Approved Copy) ─
      Data.createStep({
        id:            ID.viewsparkBuild,
        name:          'Viewspark Building',
        owners:        'Hunter, Bill',
        workingDays:   5,
        dependsOn:     ID.approvedCopy,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),
      Data.createStep({
        id:            ID.viewsparkApprv,
        name:          'Viewspark Approval',
        owners:        'Arielle, Aaron',
        workingDays:   2,
        dependsOn:     ID.viewsparkBuild,
        startOffset:   1,
        notifications: '',
        notes:         '',
      }),

      // ── EMAIL PRODUCTION CHAIN (from Approved Copy) ────────
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
        notifications: '',
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
        id:            ID.landingPage,
        name:          'Landing Page Build',
        owners:        'Graham',
        workingDays:   1,
        dependsOn:     ID.checkStet,
        startOffset:   1,
        notifications: '',
        notes:         'Give link to Irina.',
      }),
      Data.createStep({
        id:            ID.emailBuilding,
        name:          'Email Building',
        owners:        'Irina, Vladimir',
        workingDays:   2,
        dependsOn:     ID.landingPage,
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
        notes:         'Plan to schedule the first Tuesday of the month. Anchor for the send dates below.',
      }),

      // ── SEND DATES (parallel, from Scheduling Emails) ─────
      // Durations are chosen so each end date lands on its target send day.
      Data.createStep({
        id:            ID.email1Send,
        name:          'Email 1 - Send date',
        owners:        'Irina',
        workingDays:   7,
        dependsOn:     ID.scheduling,
        startOffset:   1,
        notifications: '',
        notes:         'Sent on the second Tuesday of the month.',
      }),
      Data.createStep({
        id:            ID.viewsparkSend,
        name:          'Viewspark - Send date',
        owners:        'Hunter',
        workingDays:   15,
        dependsOn:     ID.scheduling,
        startOffset:   1,
        notifications: '',
        notes:         'Sent on the third Wednesday of the month.',
      }),
      Data.createStep({
        id:            ID.email2Send,
        name:          'Email 2 - Send date',
        owners:        'Irina',
        workingDays:   23,
        dependsOn:     ID.scheduling,
        startOffset:   1,
        notifications: '',
        notes:         'Sent on the fourth Thursday of the month.',
      }),

    ];

    project.anchorStepId   = ID.scheduling;
    project.anchorDateType = 'end';
    project.anchorDate     = '';

    _populateOwners(project);
    return project;
  }

  return { getPrintAppealTemplate, getDigitalAppealTemplate };
})();

window.Templates = Templates;

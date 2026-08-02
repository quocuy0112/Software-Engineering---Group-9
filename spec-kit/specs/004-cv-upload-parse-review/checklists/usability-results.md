# Feature 004 Representative-User Usability Gate

**Recorded:** 2026-08-02  
**Release decision:** **P0 BLOCKED**  
**Reason:** The required moderated study with at least 30 representative
participants has not been executed. Automated component, accessibility, and
Playwright results are engineering evidence, not participant evidence.

## Predeclared Protocol

Each participant must complete one uninterrupted first attempt using only a
purpose-built synthetic CV fixture:

1. upload the assigned PDF or DOCX;
2. understand processing/failure/consent status without moderator assistance;
3. review every proposal and provenance-availability indicator;
4. correct at least one proposed value;
5. select only the requested subset;
6. save and confirm; and
7. verify that the Profile received only the selected values.

A successful first attempt requires completion without moderator intervention,
an unintended Profile overwrite, a restart, or a second attempt. The study must
collect only anonymized aggregate counts, viewport, assigned fixture category,
completion outcome, safe error category, and whether assistance was required.
It must not retain participant CVs, proposal text, names, contact details,
screenshots containing Profile data, or session identifiers.

## Required Assignment Matrix

| Cohort  | Minimum participants | Viewport                    | Required fixture coverage                                  |
| ------- | -------------------: | --------------------------- | ---------------------------------------------------------- |
| Desktop |                   15 | Representative desktop      | PDF and DOCX; Vietnamese, English, and bilingual           |
| Mobile  |                   15 | Exactly 320 CSS pixels wide | PDF and DOCX; Vietnamese, English, and bilingual           |
| Total   |                   30 | Both cohorts                | Every format/language category represented in both cohorts |

The acceptance threshold is at least 27 of 30 participants (90%) completing on
their first uninterrupted attempt without assistance and with zero unintended
Profile overwrites.

## Evidence Collected

| Measure                                      | Required |       Recorded |
| -------------------------------------------- | -------: | -------------: |
| Representative participants                  |     >=30 |              0 |
| Desktop participants                         |     >=15 |              0 |
| 320-pixel participants                       |     >=15 |              0 |
| PDF assignments                              | Required |              0 |
| DOCX assignments                             | Required |              0 |
| Vietnamese assignments                       | Required |              0 |
| English assignments                          | Required |              0 |
| Bilingual assignments                        | Required |              0 |
| First-attempt completions without assistance |    >=90% | Not measurable |
| Unintended Profile overwrites                |        0 | Not measurable |

No participant recruitment, informed study session, anonymized observation log,
or aggregate moderator report is present in the project workspace. Therefore
SC-005 is unverified and no completion percentage is inferred.

## Unblock Conditions

P0 remains blocked until an authorized study owner executes the predeclared
protocol, records at least 15 valid desktop and 15 valid 320-pixel observations
covering the required fixture matrix, and appends anonymized aggregate results
showing the threshold is met. If fewer than 90% succeed, or any unintended
Profile overwrite occurs, remediation and a new predeclared study run are
required; failed observations must not be discarded from the reported cohort.

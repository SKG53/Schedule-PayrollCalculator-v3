# FC-00051 — Punctuality flags on the review tab; per-person stats on screen and in a Stats tab

**Date:** 2026-10-19 · **Slice:** L · **Risk:** Low · **Status:** done · **Affected entities:** All

## What
1. **Flags per day on the review tab,** comparing each person's punches with the loaded schedule:
   - late clock-in;
   - clock-out off the shift end;
   - a scheduled day with no approved punches;
   - punches on a day off;
   - an odd number of punches.
2. **Per-person weekly stats:**
   - expected vs worked hours;
   - late days;
   - early arrivals and staying late, with their minutes and their cost;
   - break minutes;
   - the 40 h+ flag.

   Each entity also gets a roll-up of the same stats.
3. **Where the stats show:** on a **Stats** sub-tab of the Payroll tab, and as a **Stats** tab in the Combined payroll Excel.

## Why
- **The owner wants accountability numbers he doesn't have today:** "adherence to schedule", "How many hours were we expecting and how many hours did we actually work?", and the share of days someone was late.
- **Early arrivals:** "Early clock-ins should be held to a similar statistical analysis… However there will be no… penalizations… I still need to know metrics on how early someone is showing up."
- **A missing day goes unseen.** On a real week, a scheduled day had no approved punches. Nothing on the review tab said so, and the shift went unpaid. The "scheduled, no punches" flag would have caught it.
- **Time Card Data moves here.** The owner dropped the Time Card Data file (FC-00050) and asked for its break minutes and OT flag to move into the Stats tab.

## Where in UI
- **Review tab:** a colored pill on each row's day, matching the existing flag pills.
- **Review tab, each employee's sub-tab:** a header line that lists any scheduled day with no punches.
- **Payroll tab:** a new **Stats** sub-tab next to Time Card Data and Payroll Calculation, with one table per entity, people first and then the entity total.
- **Combined payroll Excel:** a new **Stats** sheet after the payroll sheet.

## Touches
intake, display, exports

## Risk
Low. Read-only: flags and stats never change hours, approvals or pay. The Combined Excel gains a sheet, and its payroll sheet is unchanged.

## Reversibility
Fully reversible via one revert commit.

## Definition of Done
1. **Clock-in flags,** comparing the first clock-in of the day with the shift start:

   | Clock-in | Flag |
   |---|---|
   | On time or early | none (early minutes are tracked, never flagged) |
   | Late 1–5 min | yellow "Late 0:03" |
   | Late more than 5 min | red "Late 0:12" |

2. **Clock-out flags,** comparing the last clock-out of the day with the shift end:

   | Clock-out | Flag |
   |---|---|
   | Within 1 min | none |
   | 1–10 min early or late | yellow "Out 0:07 early" or "Out 0:07 late" |
   | More than 10 min early or late | red, same wording |

3. **Other day flags:**
   - "Scheduled, no punches": a scheduled day with no approved row. It is red, and it shows on the employee's tab header and in the Payroll grid's day cell.
   - "Worked a day off": approved punches on an OFF day. It is yellow.
   - "Odd punches": an unpaired clock-in or clock-out. It reuses the existing "Check clock-in" and "Check clock-out" flags, so nothing new is added.
4. **Overnight shifts** count against the shift that starts that day; a 1:00 AM clock-out belongs to the previous day's shift, as pay already does. A day with no loaded schedule gets no punctuality flags.
5. **Stats per person per week.** Every percentage shows its count next to it, e.g. `3/6 · 50%`. All times are h:mm, and money is to the cent.

   | Stat | Definition |
   |---|---|
   | Expected | scheduled hours |
   | Worked | paid hours |
   | Worked % | worked ÷ expected |
   | Late days | days with any late clock-in ÷ scheduled days worked |
   | Late >5 | days late more than 5 min ÷ scheduled days worked |
   | Avg late | average minutes late, over the late days |
   | Early days | days clocked in before the shift start |
   | Early min | total, average and largest early minutes |
   | Early cost | early minutes ÷ 60 × rate |
   | Stayed late | days clocked out after the shift end, and the minutes past the end |
   | Stayed-late cost | minutes past the end ÷ 60 × rate |
   | Break | expected and actual break, h:mm |
   | 40 h+ | the OT flag, as on the Time Card Data screen |

6. **What the cost lines cover:** hourly people only. Flat-paid people show minutes but no cost.
7. **Entity roll-up:** the same stats summed or averaged across the entity, with counts.
8. **The Stats sheet in the Combined Excel** mirrors the screen: one block per entity in the payroll sheet's entity order and colors, with names printed per the Names on exports choice.
9. **Pay is identical.** On five real weeks plus Oct 4–10:
   - the payroll sheet and every pay figure are identical to the live version;
   - the private harness checks the Oct 4–10 stats against figures computed by hand from the real files.

## Built
- **Flags.** `punctualityFlags(row,ent)` compares the first clock-in and the last clock-out of all of the person's review rows that day (`_punctGroups`) with the loaded shift.
  - Pairs are read against the shift start (`_anchoredSpan`), so a night shift split at midnight, on one row or two, reads as one shift. An independent review caught this: it was flagged red as "early out".
  - The pills (`.punct-pill`) sit next to the row flags and never change `flags`, `needsReview` or approval.
  - Clock-out is flagged from 2 minutes off the end: 1 minute is treated as on time.
- **Other hours.** A day more than 2 hours off the shift at either end is shown as "Other hours than scheduled" (yellow). It is counted as "Other hours days", not as late, early or stayed late. On a real week, scheduled evenings worked as mornings had been counted as 8 hours early.
- **Scheduled, no punches.** `scheduledNoPunchDays(ent,name)` puts a red line on the employee tab. The Payroll grid's existing NO SHOW cell shows the same day.
- **Stats.**
  - `entityStats(idx)` works from the paid actuals (approved rows) per person, plus an entity total.
  - "Expected" is the scheduled hours less the entity's minimum break, the same figure the Payroll grid compares against.
  - Late percentages are over the scheduled days worked; a scheduled day with no punches counts as missed.
  - Cost lines are for hourly people only.
- **Screen and Excel.** The Payroll tab gets a Stats sub-tab. `_writeStatsSheet` adds the Stats sheet to the Combined Excel, with hours as real `[h]:mm` durations, money and percent formats, and the entity's colors.

## Verification
- `npm test`: all pass, including `tests/fc00051_punctuality_stats.test.js` (11 tests).
- **One real week, against figures worked out by hand from the real files:** expected and worked hours, worked %, late days, late over 5 min, early minutes and cost, and minutes past the shift end all match. One cost line differs by 1¢, because each person's cost is rounded before summing.
- **Real browser:** the pills, the Stats tab and the Stats sheet render with no errors.

## Out of scope
- Labor cost by day and hour (card 5).
- Any penalty or automatic pay change from a flag.
- Coverage or staffing rules.

## Assumptions
- **Clock-out flags apply both ways:** early or late, the same thresholds. The owner didn't contest this.
- "Scheduled days worked" is the denominator for late percentages. A scheduled day with no punches counts as missed, not late.
- The stats are only as good as the loaded schedule. A person with no schedule this week shows worked hours only.

## Open questions
None.

## Tests
`tests/fc00051_punctuality_stats.test.js`:
- `test_late_in_yellow_up_to_5_red_after`
- `test_early_in_never_flagged_but_counted`
- `test_out_flags_both_directions_10_min`
- `test_scheduled_day_no_punches_red`
- `test_worked_day_off_yellow`
- `test_overnight_shift_attributed_to_start_day`
- `test_stats_counts_and_percents`
- `test_early_and_stayed_late_cost_hourly_only`
- `test_entity_rollup`
- `test_stats_sheet_in_combined_excel_payroll_sheet_unchanged`
- `test_pay_identical`

## Slice
L

## Affected entities
All

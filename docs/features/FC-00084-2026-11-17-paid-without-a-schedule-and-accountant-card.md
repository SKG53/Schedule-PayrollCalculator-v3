# FC-00084 — People paid without a schedule; the accountant section moves to the Register tab and the Exports card

**Date:** 2026-11-17 · **Slice:** M · **Risk:** Medium · **Status:** drafting · **Affected entities:** All

## What

### Part 1: People paid without a schedule
Some people are paid every week but are on no schedule, for example Management. Today the tool pays only people with a schedule row, so they are paid outside it.

1. **Where they live.** The Employee Register tab gets a section, **Paid without a schedule**, with one row per person per entity:
   - name and entity;
   - pay method: Deposit, Cash, Deposit + Cash, or Contract;
   - the Management tick;
   - **this week's amount**, with the deposit part for Deposit + Cash.
   - "+ Add person" adds a row. Each person gets a TNG ID and a former ID like anyone else.
   - The same person can also be on a schedule at another entity. They link by TNG ID, as today.
2. **Amounts carry over.** The register remembers what each person was paid in its week. When next week's register is loaded:
   - each row starts at last week's amount, shown as **"Same as last week ($X)"**;
   - the owner keeps it or types a new amount;
   - a changed row shows **"Changed from $X"**;
   - **"Not paid this week"** pays $0 for the week and keeps the person and their amount for later.
3. **A reminder, not a block.** Until each row is either kept or changed, the Register tab and the Payroll tab show "N people paid without a schedule not yet checked this week". Exports still work.
4. **Where they appear.**
   - **Payroll tab and payroll report:** in their entity's block, under Management when ticked, otherwise under Employees. Hours are blank, and the amount is in the Flat / Salary column.
   - **Excel:** their Total, Deposit and Cash are live formulas from the amount, like every other row.
   - **Accountant file:** their deposit part is listed as Salary when the pay method includes Deposit.
   - **Week-over-week check:** a changed amount is flagged like any other pay change.
   - **Timecards:** none; they have no punches.
5. **Saved with the register.**
   - The Payroll Settings sheet marks them as **Paid without a schedule: Yes**.
   - Each row also carries **Last paid** (amount and week).
   - The snapshot keeps them exactly, like everything else.

### Part 2: The accountant section goes away
Who is on the accountant file stays automatic: everyone with a deposit. A manual tick could fall out of step with how people are actually paid, and the file would stop matching the deposits.

6. **Per-person details move to the Employee Register tab** as editable columns:
   - Accountant name;
   - Employment type, which is already there;
   - Standing note.
7. **Per-week items move onto the Accountant file card on Exports:**
   - the Deposit pay date, and the Cash and Contract Check pay date;
   - the ✓ / ✗ self-check lines;
   - **"Notes for the accountant this week"**, a link that opens the deposit people with a note box each.
8. **The Accountant file section on the page is removed.** Nothing it held is lost.

## Why
The owner, 2026-11-17:
- "do we actually need this section? Can't we just designate certain people with a checkmark or something as appearing on the accountant file and then just have an export card for it?"
- "The Management folks are not on any schedule."
- On amounts: "I need their amounts to be remembered each week (as in, what was paid last week) and then I get to choose if i want to change it or keep it the same for the current week."

## Where in UI
- The Employee Register tab: the new section, and the accountant columns.
- The Payroll tab: the rows and the reminder.
- The Exports tab: the Accountant file card.
- The page section "Accountant file", which is removed.

## Touches
roster records, register file (save and load), payroll rows, the payroll report (screen, Excel, PDF), the accountant file, week-over-week, snapshot

## Risk
Medium. These are new rows in every pay output. The guards:
- pay is unchanged on all 6 real weeks, which have no such people;
- the payroll report and the accountant file still tie out, and the accountant self-check passes with these people included;
- the register and the snapshot round-trip them exactly.

## Reversibility
One revert commit. An older version ignores the new column and does not pay these people.

## Definition of Done
1. **Adding and paying:** a person added with no schedule is paid their amount on the Payroll tab, in the payroll report (Excel formulas live), and, when paid by deposit, in the accountant file.
2. **Management:** a ticked person prints under Management.
3. **Carry-over:**
   - save the register, then load it with next week's schedules: the amount is last week's, marked "Same as last week";
   - change it: "Changed from $X";
   - "Not paid this week": $0 that week, and the person is still there the week after.
4. **Reminder:** shown until every row is kept or changed. Exports still work.
5. **Accountant:**
   - the page section is gone;
   - the Register tab edits the accountant name, type and standing note;
   - the card carries the pay dates, the check and the week's notes;
   - the file is identical to before on all real weeks.
6. **Pay:** unchanged on all real weeks.

## Out of scope
- Overtime for cash-paid people (later).
- Paying a person without a schedule by the hour.

## Assumptions
- Their amount is a weekly amount, not hours × rate.
- Contract-paid people without a schedule are not on the accountant file, as today.
- A row marked "Not paid this week" prints nowhere that week.

## Open questions
None.

## Tests
`tests/fc00084_paid_without_a_schedule.test.js`:
- add a person and pay them by each method;
- the Management block;
- carry-over: kept, changed, not paid;
- the reminder;
- register and snapshot round trips;
- the accountant file with them in it;
- the accountant columns on the Register tab;
- the Exports card's dates, check and notes;
- the page section removed.

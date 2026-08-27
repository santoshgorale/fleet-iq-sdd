# Driver scorecard

> `001-driver-scorecard` · flow `feature` · tier `standard` · created 2026-08-14
>
> **What and why.** Owned by Product Management and UX.

## Problem

Fleet managers cannot tell which drivers need coaching. Today they export raw
telemetry to a spreadsheet and build their own rankings — 23 of our 41 enterprise
accounts have done this, and four have sent us their spreadsheets asking us to
"just build this". Support has logged 61 tickets in six months asking how to
compare drivers.

The workaround is expensive and wrong: the spreadsheets rank on raw event counts,
so drivers with longer routes always look worse. Two accounts have run coaching
programmes off rankings that were mostly a proxy for distance driven.

## Users and jobs

| User | What they are trying to do | Today's friction |
| --- | --- | --- |
| Fleet manager | Pick the five drivers to coach this month | Manual export, then a ranking that penalises long routes |
| Safety officer | Show quarter-on-quarter improvement to an insurer | Rebuilds the spreadsheet each quarter; numbers are not comparable |
| Driver | Understand why they were flagged | No visibility at all; hears it in a meeting |

## Scope

**In scope**

- A per-driver score, 0–100, over a selectable period (7 / 30 / 90 days)
- Component breakdown: harsh braking, harsh acceleration, cornering, speeding
- Normalisation per 100 km, so route length does not distort the score
- Ranked list for a fleet, with the period comparison
- CSV export of the ranked list

**Out of scope**

- Coaching workflows, assignments or reminders
- Driver-facing views — drivers see this via their manager for now
- Real-time or in-cab alerting
- Configurable score weightings; v1 ships one fixed model
- Fuel efficiency and idling, which are a separate scorecard

## Acceptance criteria

| # | Criterion |
| --- | --- |
| AC1 | A fleet manager can see a ranked list of drivers with a score of 0–100 for a selected period of 7, 30 or 90 days |
| AC2 | Each score breaks down into four components, each showing its own sub-score and the raw event count |
| AC3 | All event rates are normalised per 100 km; two drivers with identical rates and different distances receive identical scores |
| AC4 | A driver with fewer than 100 km in the period shows "insufficient data" rather than a score |
| AC5 | The list shows each driver's change versus the immediately preceding period of the same length |
| AC6 | A manager can export the current ranked list as CSV, matching what is on screen |
| AC7 | A manager sees only drivers in fleets they are authorised for |
| AC8 | The scorecard loads within 2 seconds at p95 for a fleet of 500 drivers over 90 days |
| AC9 | When the telemetry service is unavailable, the page shows the last computed scores with their age, not an error |

## Success measures

| Measure | Baseline today | Target | How it is instrumented |
| --- | --- | --- | --- |
| Accounts maintaining their own ranking spreadsheet | 23 of 41 | Under 8 within two quarters | Quarterly account survey |
| Support tickets asking how to compare drivers | 61 in 6 months | Under 10 per 6 months | Zendesk tag `driver-comparison` |
| Weekly active use of the scorecard | 0 | 60% of enterprise accounts weekly | `scorecard.viewed` event, unique account per week |
| Time to identify coaching candidates | ~40 min (self-reported) | Under 2 min | `scorecard.viewed` → `scorecard.exported` interval |

## Experience

### Primary journey

1. Manager opens **Fleet → Safety → Scorecard**.
2. Page loads with the last 30 days for their default fleet, drivers ranked
   worst score first — the people needing attention are the reason for the visit.
3. Manager switches the period to 90 days; the ranking and deltas update.
4. Manager expands a driver row to see the four components and raw counts.
5. Manager clicks **Export CSV** and gets the list as displayed.

### States

| State | What the user sees | What they can do next |
| --- | --- | --- |
| Empty (no drivers) | "No drivers in this fleet yet." Plus a link to driver setup. | Add drivers |
| Empty (no telemetry) | "No telemetry in the last 30 days. Scores appear once vehicles report." | Change period |
| Loading | Skeleton rows for 8 drivers; period selector stays interactive | Change period |
| Partial data | Rows render; drivers under 100 km show "insufficient data" with a tooltip | Expand a row |
| Error | "We could not load scores. Showing the last available data from {age}." Retry button. | Retry, or read stale data |
| Permission denied | "You do not have access to this fleet." Fleet switcher stays available. | Switch fleet |
| Offline | Banner: "You are offline. Showing data from {timestamp}." | Read cached data |

### Accessibility

- Full keyboard path: period selector → fleet selector → table → per-row expand
  → export. Focus order matches visual order.
- Table is a real `<table>` with `<th scope="col">`; sort state announced via
  `aria-sort`.
- Row expansion is a `<button>` with `aria-expanded`, and the panel is
  `aria-controls`-linked.
- Contrast: WCAG 2.2 AA, 4.5:1 minimum. Score bands never rely on colour alone —
  each carries a text label.
- Smallest viewport: 360 px. Below 768 px the table becomes stacked cards.
- Standard held to: WCAG 2.2 AA.

### Content

- Insufficient data tooltip: "Needs at least 100 km in the period to score
  fairly."
- Stale banner: "Showing scores from {relative time}. We are retrying."
- Error: "We could not load scores just now. Try again, or contact support if it
  keeps happening."
- Score band labels: "Needs attention" (0–49), "Fair" (50–74), "Good" (75–100).
- Export filename: `scorecard-{fleet-slug}-{period}-{yyyy-mm-dd}.csv`.

## Known issues

- Score weightings are fixed in v1. Accounts wanting to weight speeding more
  heavily cannot; this is the most likely follow-up request.
- Drivers sharing a vehicle without driver ID assignment are attributed to the
  vehicle's default driver. Affects 3 known accounts.
- Deltas are unavailable for a driver's first period; the column shows "—".

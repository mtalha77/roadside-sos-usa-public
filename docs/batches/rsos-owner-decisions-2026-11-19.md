# Owner decisions, 2026-11-19

The owner's answers to the four questions in the batch 4.6 end-of-run summary
(`docs/reports/batch-4-6.md`), kept as the specification for the work they start.

1. **RSOS-107**: read `rsos-ad-sync-107.md`, copy it into the repo as
   `docs/batches/rsos-ad-sync-107.md` and build it next. All ad platforms stay off until keys exist;
   everything tested with fakes.
2. **Test funnel rows**: delete the 15 test rows from staging's funnel table after exporting them
   to `docs/reports/test-funnel-rows.csv`. Also add a test-traffic marker: any session started with
   `?rsos_test=1`, or from a device or IP on an admin-managed test list, or from a signed-in staff
   account, is tagged `is_test=true` and excluded from all analytics and ad conversions in every
   environment. Show an "Include test traffic" toggle on staging only.
3. **Flagging**: yes, both sides. Customer: a "Report a problem" link on the tracking page and
   after completion (reasons: provider didn't arrive, price changed, poor service, safety concern,
   other + optional note). Provider: "Flag this request" on the offer and job screens (reasons:
   fake or prank, wrong location, customer unreachable, unsafe, other + note). One tap plus reason,
   no long forms. Flags go to the admin Inbox with priority (safety = urgent), feed the fraud
   signals and reliability scores from RSOS-117, and are visible on the request and on both
   profiles.
4. **Mobile Safari CI timing**: investigate before production, time-boxed to one working day. If it
   is a real bug in the booking flow, fix it. If it is test flakiness only, stabilise the test (wait
   on real UI state, not fixed timeouts) or quarantine it with a tracked issue and a manual iPhone
   Safari check in the release QA list.

Note: RSOS-117 (fraud signals and reliability scores) has no specification in the repository or
in Downloads; flags are stored so it can use them when it is specified.

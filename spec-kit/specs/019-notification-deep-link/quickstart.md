# Quickstart Validation

1. Run the notification contract and resolver tests.
2. Create candidate and recruiter notifications for the same application context and verify different served hrefs.
3. Change the target state after creation and retrieve notifications again; confirm a context-specific destination or the notification-inbox fallback.
4. Test grouped messages/applications and verify list query includes context and `since`.
5. In the notification center test, force read API 500 and verify navigation plus next-fetch unread reconciliation.
6. Run accessibility tests for focus, names, Enter and Space.
7. Check the administrator notification list, company invitations, support, connections, reports, and membership notifications; each must return a non-empty href without exposing invitation tokens.
8. Make a profile form dirty, then click an internal navigation item and a notification: confirm the SmartHire dialog can cancel or continue navigation. Refresh or close the tab and confirm the browser-native warning remains.

# Quickstart Validation

1. Run the notification contract and resolver tests.
2. Create candidate and recruiter notifications for the same application context and verify different served hrefs.
3. Change the target state after creation and retrieve notifications again; confirm new destination/null result.
4. Test grouped messages/applications and verify list query includes context and `since`.
5. In the notification center test, force read API 500 and verify navigation plus next-fetch unread reconciliation.
6. Run accessibility tests for focus, names, Enter and Space.

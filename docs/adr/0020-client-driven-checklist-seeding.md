# Checklist seeding is client-driven: POST /bookings always receives the item set

`POST /bookings` requires a `checklistItems` array. The server seeds exactly what the client sends — it never auto-derives from the musician's template. The conventional alternative (server reads `UserProfile.preferences.checklistDefaults`, filters by starting stage, seeds automatically) was rejected for two reasons.

First, the new booking flow includes a checklist customisation step where the musician reviews the default items, toggles any off, and optionally adds custom ones before the booking is created. The server cannot know the result of that interaction; the client must send it.

Second, making seeding purely client-driven eliminates a class of conditional logic on the server (detect creation status → filter stages → read preferences → seed) and makes the creation operation atomic and transparent: the booking and its checklist are created in one call with exactly the items specified. The frontend fetches the musician's defaults from `GET /me` (`preferences.checklistDefaults`), filters by starting stage, presents the customisation screen, and sends the final set.

The `checklistItems` field is required, not optional — this prevents a future caller from omitting it and getting a booking with no checklist.

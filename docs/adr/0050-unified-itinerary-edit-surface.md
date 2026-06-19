# Unified Itinerary edit surface (retire "Performance")

**Status:** accepted — supersedes the "itinerary vs packages" guidance in ADR-0046's wake.

When the itinerary was first built, a separate **"Performance"** card/edit-surface was kept distinct from the operational **Itinerary** view because [[Package]]s were then coupled to the music form and carried a commercial lens, and because organising the itinerary to include package grouping without tangling the hierarchy was hard at the time. ADR-0046 then severed that coupling: the booking-owned Package is now a non-binding, hierarchy-free, no-teeth grouping convenience. With the Package defanged, the original reason for the split is gone.

Usability testing confirmed the split actively harms users: musicians do not perceive a "Performance" concept sitting above the itinerary — from their point of view they are simply *editing the itinerary*, and having to edit "Performance" to change the running order was one of the most confusing aspects of the UI.

**Decision:** retire "Performance" as a concept, card, and edit surface. The **Itinerary** is the single admin concern for a booking's performance structure — sets, the packages that group them, their times and their order are read and edited together in one place. Packages remain a non-binding grouping device *within* the itinerary (and the same grouping vocabulary continues to section music-form key moments). The client [[Portal]] keeps its own presentational rendering of the same sets as named segments — that is an audience-driven *display*, not a second edit surface.

**Consequences:** the `PerformanceEditor` / "Performance" naming is removed; its editing capability merges into the Itinerary surface. This reverses the earlier "two lenses must not be conflated" guidance, which a future reader would otherwise find contradicted by the code — hence this record.

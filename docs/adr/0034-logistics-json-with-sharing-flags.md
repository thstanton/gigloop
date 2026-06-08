# ADR-0034 — Booking logistics as a sharing-aware JSON column

## Status
Accepted

## Context

Issue #170 introduces a range of "on the day" operational fields for a Booking: arrival time, soundcheck time, finish time, dress code, performance space, food provided, green room, equipment required, and user-defined custom fields. These are all nullable, purely informational, and the set is expected to grow as more requirements emerge from real usage.

Two design pressures were in tension:

1. **Schema stability** — each new field as a flat column requires a migration. With a field set that is explicitly expected to grow, this is a maintenance burden that offers no compensating benefit: none of these fields will ever appear in a WHERE clause or JOIN.

2. **Future sharing** — the band member portal (#174) and potential client portal enhancements will need to surface a subset of this information to other stakeholders. A plain `String?` column per field provides no mechanism to express that "arrival time is visible to the band but not the client" without a parallel set of boolean columns.

## Decision

All "on the day" fields are stored in a single `logistics: Json?` column on `Booking`. Every entry in the object — system-defined or user-defined — shares a uniform shape:

```ts
type LogisticsEntry = {
  value: string;
  icon?: string;         // Lucide icon key; system fields have a constant default
  shareWithBand: boolean;
  shareWithClient: boolean;
};

type CustomLogisticsEntry = LogisticsEntry & {
  label: string;         // display name, stored because the key is machine-generated
};
```

System-defined keys: `arrivalTime`, `soundCheckTime`, `finishTime`, `dressCode`, `performanceSpace`, `foodProvided`, `greenRoom`, `equipmentRequired`. Their display labels are derived from the key via a constants map; they do not store `label` in the JSON. Custom fields use machine-generated keys (`customField1`, `customField2`, …) and carry `label` in the entry.

Both sharing flags default to `false` (opt-in). The flags are inert at MVP — no band or portal rendering uses them yet — but they are the foundation for both the band member portal (#174) and any future client portal logistics sharing.

## Consequences

- One migration adds a single nullable JSON column to `Booking`. No further migrations are needed to add new system or custom fields.
- Adding a new system-defined field requires: a new key in the constants map, an icon default, and a form field in `section=onTheDay` in the edit sheet. No schema change.
- The TypeScript type for `logistics` (in `apps/web/src/types/api.ts` and the API DTO) is the effective schema for this feature area.
- The sharing flags are inert until band/portal features consume them. They impose a minor read overhead (two booleans per field) that is negligible at this scale.
- `dressCode` drives an extensible select: system defaults in `constants.ts`, user additions in `UserProfile.preferences.customDressCodeOptions`.

## Alternatives considered

- **Flat columns per field:** Rejected — zero querying benefit, and each new field requires a migration. With an explicitly extensible field set, this is the wrong trade-off.
- **JSON with plain string values:** Considered as a simpler shape (`Record<string, string>`). Rejected because it forecloses the sharing capability without any mechanism to add it later without a data migration to reshape existing entries.
- **Separate `BookingLogisticsItem` table:** Rejected as significant over-engineering for what is essentially a key-value store with two extra boolean flags. A table adds joins, cascade rules, and ordering concerns for no benefit over JSON at this scale.

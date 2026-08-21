// The valid Contact.primaryRole values (#787's String-over-enum convention). Single declaration
// shared by CreateContactDto and UpdateContactDto — previously hand-duplicated in both, which is
// the "one declaration per vocabulary" failure mode CLAUDE.md warns about (a value added to one
// copy and silently missed in the other).
export const PRIMARY_ROLES = ['CUSTOMER', 'VENUE', 'BOOKING_AGENT', 'BAND_MEMBER'] as const;

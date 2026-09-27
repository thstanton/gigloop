// The DocumentType vocabulary (#893, ADR-0073 §4) — declared once here for the Prisma-touching
// side of the codebase (documents.repository.ts, documents.service.ts), now that `Document.type`
// is a plain TEXT column rather than a Prisma enum (CONTEXT.md's "enums for closed lifecycles
// only" rule — a document type list is open). `portal-visibility.ts` hand-mirrors this same list
// as its own local `DocumentTypeValue` rather than importing it — that module stays dependency-free
// by design (see its file header), so this is a disclosed second declaration, not an oversight.
export const DOCUMENT_TYPES = ['CONTRACT', 'INVOICE', 'SONG_LIST', 'UPLOAD', 'CALL_SHEET'] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

import path from 'path';

// Where the signed-in Clerk session is persisted by the setup project and
// reused by every spec (ADR-0048 §3).
export const STORAGE_STATE = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json');

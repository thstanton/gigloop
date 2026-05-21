# Application-level encryption for bankDetails

`UserProfile.bankDetails` is encrypted at rest using AES-256-GCM before being written to the database, and decrypted on read in the repository layer. The encryption key is stored in the `ENCRYPTION_KEY` environment variable and never committed to source control.

Database-level encryption (e.g. Postgres `pgcrypto`) was considered but rejected — it would require managing keys inside the DB and complicates Prisma's query model. Application-level encryption keeps the key management in the app layer alongside other secrets and is transparent to the ORM. The trade-off is that the field is opaque to direct DB queries, which is acceptable since `bankDetails` is freeform text that is only ever read through the API.

# Custom portal e-signature instead of third-party service

E-signature on the contract is an MVP feature. We chose to build it into the existing client Portal rather than integrate a third-party service (DocuSign, HelloSign, Signable, etc.).

The Portal already exists as a client-facing interface and the contract is already generated server-side via `@react-pdf/renderer`. The client reads the contract on the Portal, draws or types their signature on a canvas, submits it, and the API regenerates the signed PDF with the signature embedded and stores it in R2. `Booking.contractSignedAt` is set at that point.

The main alternative — a third-party e-sign service — would add per-document cost, an external dependency, and a separate integration, while the custom approach fits the existing architecture without new services. Legal validity of the signature is comparable; the signed PDF plus the `contractSignedAt` timestamp serve as the audit record.

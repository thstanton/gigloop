# Container/presentational split for feature components

Feature components that mix mutation logic with UI (e.g. `BookingEditDrawer`, `ComposeEmailSheet`) cannot be rendered in isolation — they require a live API and a TanStack Query provider. We adopted a container/presentational split as a formal convention: the container owns data fetching and mutations; the presentational component renders purely from props and is independently storiable in Storybook. `ContactForm` is the canonical example of the presentational layer. The alternative — keeping mutation logic co-located — is simpler to write but makes UI components invisible to Storybook and harder to develop in isolation.

The split is applied opportunistically: new feature components always start split; existing coupled components are refactored when next touched, not in a sweep.

# Tailwind CSS + shadcn/ui for the frontend component system

The frontend needs a styling and component foundation. We chose Tailwind CSS with shadcn/ui over pre-built component libraries (MUI, Mantine, Ant Design).

Pre-built libraries were rejected because fighting their default aesthetics to achieve the "clean, premium, personal" visual tone — needed for both the admin app and the musician-branded Portal — would require extensive overrides. They also create version-lock on component APIs.

shadcn/ui provides accessible, composable primitives (Dialog, Combobox, DatePicker, etc.) as copied-in source files that the project owns outright. Combined with Tailwind, this gives full visual control across both the admin app and the Portal without a third-party component dependency. The trade-off is slightly more initial setup and that component updates require manual re-copy — acceptable given the aesthetic requirements.

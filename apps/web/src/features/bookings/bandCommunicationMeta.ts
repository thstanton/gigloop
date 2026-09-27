export const BAND_COMMUNICATION_META = {
  'call-sheet': {
    label: 'call sheet',
    title: 'Call sheet',
    emailTemplateType: 'band_call_sheet',
    messageTemplateType: 'band_call_sheet_message',
    attachmentLabel: 'Email includes call sheet PDF',
  },
  'final-details': {
    label: 'final details',
    title: 'Final details',
    emailTemplateType: 'band_final_details',
    messageTemplateType: 'band_final_details_message',
    attachmentLabel: null,
  },
} as const;

export type BandCommunicationKind = keyof typeof BAND_COMMUNICATION_META;

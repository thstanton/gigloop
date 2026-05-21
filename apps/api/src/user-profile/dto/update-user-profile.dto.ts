export class UpdateUserProfileDto {
  address?: string;
  bankDetails?: string | null;
  vatNumber?: string;
  defaultPaymentTermsDays?: number;
  depositTrackingMode?: string;
}

export class UpdatePublicProfileDto {
  displayName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  logoUrl?: string;
  brandColour?: string;
  photo?: string;
  website?: string;
  socials?: Record<string, string>;
  portalTheme?: string;
}

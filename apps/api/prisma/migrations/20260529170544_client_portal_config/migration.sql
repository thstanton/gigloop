-- Add new clientPortalConfig column
ALTER TABLE "PublicProfile" ADD COLUMN "clientPortalConfig" JSONB NOT NULL DEFAULT '{}';

-- Migrate existing flat fields into the JSON column
UPDATE "PublicProfile"
SET "clientPortalConfig" = jsonb_build_object(
  'theme',            COALESCE("portalTheme", 'LIGHT_MODERN'),
  'brandColour',      COALESCE("brandColour", '#1a1a1a'),
  'heroImage',        "portalHeroImage",
  'showContactPhoto', "showContactPhoto",
  'showContactEmail', "showContactEmail",
  'showContactPhone', "showContactPhone"
);

-- Drop the now-redundant flat columns
ALTER TABLE "PublicProfile" DROP COLUMN "portalTheme";
ALTER TABLE "PublicProfile" DROP COLUMN "brandColour";
ALTER TABLE "PublicProfile" DROP COLUMN "portalHeroImage";
ALTER TABLE "PublicProfile" DROP COLUMN "showContactPhoto";
ALTER TABLE "PublicProfile" DROP COLUMN "showContactEmail";
ALTER TABLE "PublicProfile" DROP COLUMN "showContactPhone";

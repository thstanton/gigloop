-- Migrate Booking.eventType from EventType enum to TEXT
ALTER TABLE "Booking" ALTER COLUMN "eventType" TYPE TEXT USING "eventType"::TEXT;

-- Migrate Song.genre from SongGenre enum to TEXT
ALTER TABLE "Song" ALTER COLUMN "genre" TYPE TEXT USING "genre"::TEXT;

-- Migrate MusicFormConfig.enabledGenres from SongGenre[] to TEXT[]
ALTER TABLE "MusicFormConfig" ALTER COLUMN "enabledGenres" TYPE TEXT[] USING "enabledGenres"::TEXT[];

-- Drop the now-unused enum types
DROP TYPE IF EXISTS "EventType";
DROP TYPE IF EXISTS "SongGenre";

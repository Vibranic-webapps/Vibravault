-- Optional display name ("Hey Kilian"). Nullable: existing users are untouched.
ALTER TABLE "User" ADD COLUMN "name" TEXT;

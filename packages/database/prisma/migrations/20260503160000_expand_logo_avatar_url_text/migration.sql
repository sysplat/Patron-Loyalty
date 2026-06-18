-- Base64 data URLs and CDN URLs can exceed 500 chars; Prisma P2000 otherwise.
ALTER TABLE "organizations" ALTER COLUMN "logo_url" TYPE TEXT;
ALTER TABLE "users" ALTER COLUMN "avatar_url" TYPE TEXT;

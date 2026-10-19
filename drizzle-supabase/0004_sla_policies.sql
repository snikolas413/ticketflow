CREATE TABLE IF NOT EXISTS "public"."slaPolicies" (
  "priority" varchar(20) PRIMARY KEY NOT NULL,
  "firstResponseHours" real NOT NULL,
  "resolutionHours" real NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
INSERT INTO "public"."slaPolicies" ("priority", "firstResponseHours", "resolutionHours")
VALUES
  ('low', 24, 120),
  ('medium', 8, 72),
  ('high', 4, 24),
  ('urgent', 1, 8)
ON CONFLICT ("priority") DO NOTHING;

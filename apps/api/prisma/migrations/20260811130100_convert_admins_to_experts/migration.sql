-- Convert legacy Expert accounts that used the ADMIN enum value.
UPDATE "User" SET "role" = 'EXPERT' WHERE "role" = 'ADMIN';

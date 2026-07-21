UPDATE "Quote"
SET "expiresAt" = NULL,
    "reminderSentAt" = NULL
WHERE "status" IN ('ACCEPTED', 'DECLINED', 'CONVERTED_TO_ORDER');

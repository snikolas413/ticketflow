-- Safety fix: this historical migration used to delete all tickets, comments,
-- attachments, approvals, teams, departments, and related user assignments.
-- Never execute destructive cleanup as part of an automatic production deploy.
-- Keep the journal entry for compatibility, but make the migration a no-op.
SELECT 1;

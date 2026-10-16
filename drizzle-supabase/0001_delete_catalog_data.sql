-- Clean all departments, teams, queues, ticket types and dependent tickets
UPDATE "users" SET "departmentId" = NULL, "teamId" = NULL;
UPDATE "userInvitations" SET "departmentId" = NULL, "teamId" = NULL;

DELETE FROM "managerScopes";
DELETE FROM "userRoles";

DELETE FROM "aiAssistanceRequests";
DELETE FROM "ticketEvents";
DELETE FROM "ticketAttachments";
DELETE FROM "ticketComments";
DELETE FROM "ticketApprovals";
DELETE FROM "tickets";

DELETE FROM "services";
DELETE FROM "serviceCategories";

DELETE FROM "ticketTypes";
DELETE FROM "queues";
DELETE FROM "teams";
DELETE FROM "departments";

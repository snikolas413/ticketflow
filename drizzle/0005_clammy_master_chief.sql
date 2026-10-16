CREATE TABLE `managerScopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`departmentId` int,
	`teamId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `managerScopes_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_scopes_unique` UNIQUE(`userId`,`departmentId`,`teamId`)
);
--> statement-breakpoint
ALTER TABLE `userInvitations` MODIFY COLUMN `profile` enum('requester','agent','approver','manager') NOT NULL DEFAULT 'requester';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `profile` enum('requester','agent','approver','manager') NOT NULL DEFAULT 'requester';--> statement-breakpoint
ALTER TABLE `userInvitations` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `managerScopes` ADD CONSTRAINT `managerScopes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `managerScopes` ADD CONSTRAINT `managerScopes_departmentId_departments_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `managerScopes` ADD CONSTRAINT `managerScopes_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `manager_scopes_user_idx` ON `managerScopes` (`userId`);--> statement-breakpoint
CREATE INDEX `manager_scopes_department_idx` ON `managerScopes` (`departmentId`);--> statement-breakpoint
CREATE INDEX `manager_scopes_team_idx` ON `managerScopes` (`teamId`);--> statement-breakpoint
ALTER TABLE `userInvitations` ADD CONSTRAINT `userInvitations_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE no action ON UPDATE no action;
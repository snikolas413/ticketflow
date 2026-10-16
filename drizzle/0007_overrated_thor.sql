ALTER TABLE `userInvitations` ADD `passwordHash` varchar(220);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(220);
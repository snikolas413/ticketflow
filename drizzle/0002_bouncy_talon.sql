CREATE TABLE `ticketAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`commentId` int,
	`uploadedById` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`contentType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`storageUrl` varchar(600) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketAttachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticketAttachments_storageKey_unique` UNIQUE(`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `ticketAttachments` ADD CONSTRAINT `ticketAttachments_ticketId_tickets_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketAttachments` ADD CONSTRAINT `ticketAttachments_uploadedById_users_id_fk` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ticket_attachments_ticket_idx` ON `ticketAttachments` (`ticketId`,`createdAt`);
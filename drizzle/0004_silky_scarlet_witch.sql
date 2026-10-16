CREATE TABLE `serviceCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentId` int,
	`name` varchar(120) NOT NULL,
	`code` varchar(60) NOT NULL,
	`description` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `serviceCategories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(60) NOT NULL,
	`description` varchar(500),
	`defaultTicketTypeId` int,
	`defaultQueueId` int,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `tickets` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `serviceId` int;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_categoryId_serviceCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `serviceCategories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_defaultTicketTypeId_ticketTypes_id_fk` FOREIGN KEY (`defaultTicketTypeId`) REFERENCES `ticketTypes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_defaultQueueId_queues_id_fk` FOREIGN KEY (`defaultQueueId`) REFERENCES `queues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `service_categories_parent_idx` ON `serviceCategories` (`parentId`,`active`);--> statement-breakpoint
CREATE INDEX `services_category_idx` ON `services` (`categoryId`,`active`);--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_categoryId_serviceCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `serviceCategories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;
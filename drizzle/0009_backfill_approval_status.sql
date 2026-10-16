UPDATE `tickets` t
SET `approvalStatus` = CASE
  WHEN EXISTS (SELECT 1 FROM `ticketApprovals` a WHERE a.`ticketId` = t.`id` AND a.`status` = 'pending') THEN 'pending'
  WHEN EXISTS (SELECT 1 FROM `ticketApprovals` a WHERE a.`ticketId` = t.`id` AND a.`status` = 'approved') THEN 'approved'
  WHEN EXISTS (SELECT 1 FROM `ticketApprovals` a WHERE a.`ticketId` = t.`id` AND a.`status` = 'rejected') THEN 'rejected'
  ELSE 'approved'
END;

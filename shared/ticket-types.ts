export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_requester",
  "resolved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  waiting_requester: "Aguardando solicitante",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const STATUS_ORDER: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_requester",
  "resolved",
  "closed",
];

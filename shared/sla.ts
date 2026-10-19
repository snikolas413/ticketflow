import type { TicketPriority, TicketStatus } from "./ticket-types";

export type SlaPolicy = {
  firstResponseHours: number;
  resolutionHours: number;
};

export type SlaState = "on_track" | "at_risk" | "breached" | "completed";

export type SlaDeadline = {
  dueAt: Date;
  state: SlaState;
  remainingMs: number;
};

export type TicketSla = {
  firstResponse: SlaDeadline | null;
  resolution: SlaDeadline | null;
};

const ACTIVE_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_requester"];

function validHours(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 24 * 365;
}

function makeDeadline(startMs: number, hours: number, nowMs: number): SlaDeadline {
  const dueMs = startMs + hours * 3_600_000;
  const remainingMs = dueMs - nowMs;
  const state: SlaState =
    remainingMs <= 0 ? "breached" : remainingMs <= 3_600_000 ? "at_risk" : "on_track";

  return { dueAt: new Date(dueMs), state, remainingMs };
}

/**
 * Calculates SLA deadlines from a ticket's creation time and a configured policy.
 * This is a calendar-hours calculation, not a business-hours calendar.
 * First-response SLA is omitted until a response timestamp is available.
 */
export function calculateTicketSla(input: {
  createdAt: Date | string;
  status: TicketStatus;
  priority: TicketPriority;
  policy: SlaPolicy;
  firstRespondedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  now?: Date | number;
}): TicketSla | null {
  const createdMs = new Date(input.createdAt).getTime();
  const nowMs = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();

  if (!Number.isFinite(createdMs) || !Number.isFinite(nowMs)) return null;
  if (!validHours(input.policy.firstResponseHours) || !validHours(input.policy.resolutionHours)) return null;

  const completed = input.status === "resolved" || input.status === "closed";
  const firstRespondedMs = input.firstRespondedAt ? new Date(input.firstRespondedAt).getTime() : null;
  const resolvedMs = input.resolvedAt ? new Date(input.resolvedAt).getTime() : null;

  const firstResponse =
    firstRespondedMs !== null && Number.isFinite(firstRespondedMs)
      ? null
      : completed
        ? null
        : makeDeadline(createdMs, input.policy.firstResponseHours, nowMs);

  const resolution =
    completed || !ACTIVE_STATUSES.includes(input.status)
      ? null
      : makeDeadline(createdMs, input.policy.resolutionHours, nowMs);

  return { firstResponse, resolution };
}

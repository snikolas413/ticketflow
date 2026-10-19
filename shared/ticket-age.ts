import type { TicketStatus } from "./ticket-types";

export type TicketAgeTone = "normal" | "warning" | "critical";

export function getTicketAge(createdAt: Date | string, status: TicketStatus, now = Date.now()) {
  if (status === "resolved" || status === "closed") return null;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  const elapsedHours = Math.max(0, Math.floor((now - created) / 3_600_000));
  const label =
    elapsedHours < 1
      ? "Aberto há menos de 1h"
      : elapsedHours < 24
        ? `Aberto há ${elapsedHours}h`
        : elapsedHours % 24
          ? `Aberto há ${Math.floor(elapsedHours / 24)}d ${elapsedHours % 24}h`
          : `Aberto há ${Math.floor(elapsedHours / 24)}d`;
  const tone: TicketAgeTone = elapsedHours >= 72 ? "critical" : elapsedHours >= 24 ? "warning" : "normal";
  return { label, tone, elapsedHours };
}

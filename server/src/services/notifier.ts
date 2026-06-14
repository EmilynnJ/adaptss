import { EventEmitter } from "node:events";
import type { Response } from "express";

// Server -> client push for session/billing events via SSE.
// (Agora handles ALL reading media; this channel is only control events.)
type Event =
  | { kind: "reading_request"; readingId: number; clientName: string; type: string }
  | { kind: "reading_accepted"; readingId: number }
  | { kind: "billing_tick"; readingId: number; clientBalance: number; totalPrice: number; duration: number }
  | { kind: "low_balance"; readingId: number; remaining: number }
  | { kind: "session_ended"; readingId: number; reason: string; totalPrice: number; duration: number }
  | { kind: "partner_disconnected"; readingId: number; graceSeconds: number }
  | { kind: "partner_reconnected"; readingId: number };

const bus = new EventEmitter();
bus.setMaxListeners(0);

const channel = (userId: number) => `user:${userId}`;

export function emitToUser(userId: number, event: Event) {
  bus.emit(channel(userId), event);
}

// Attach an SSE stream for a user. Returns a cleanup function.
export function subscribe(userId: number, res: Response): () => void {
  const handler = (event: Event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  bus.on(channel(userId), handler);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  return () => {
    clearInterval(keepAlive);
    bus.off(channel(userId), handler);
  };
}

import { z } from "zod";
export const states = [
  "available",
  "greeting",
  "listening",
  "understanding",
  "working",
  "needs approval",
  "needs information",
  "completed",
  "error",
  "offline",
  "paused",
  "sleeping",
] as const;
export type PetState = (typeof states)[number];
export const taskEvent = z.object({
  version: z.literal(1).optional(),
  taskId: z.string().optional(),
  eventId: z.string().optional(),
  runId: z.string().optional(),
  seq: z.number().int().optional(),
  at: z.string().optional(),
  state: z.string(),
  summary: z.string(),
  text: z.string().optional(),
});
export type TaskEvent = z.infer<typeof taskEvent>;
export interface Grant {
  id: string;
  folder: string;
  write: boolean;
  expires: number;
}
export interface Task {
  id: string;
  prompt: string;
  state: string;
  text: string;
  steps: string[];
  at: number;
}
// Late observations must not reopen a stopped/completed task or undo a user pause.
export function observedTaskState(previous: string, incoming: string): string {
  const terminal = ["completed", "cancelled", "error"];
  if (terminal.includes(previous)) return previous;
  if (previous === "paused" && !terminal.includes(incoming)) return "paused";
  return incoming;
}

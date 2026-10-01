import { randomUUID } from "node:crypto";
// Projections only: events never dispatch tools or imply permission.
export class EventProjection {
  constructor() {
    this.runs = new Map();
    this.sequences = new Map();
    this.stopped = new Set();
  }
  bind(run, task) {
    this.runs.set(run, task);
  }
  stop(task) {
    this.stopped.add(task);
  }
  project(frame) {
    const p = frame.payload;
    if (!p || typeof p !== "object") return null;
    const task = this.runs.get(p.runId);
    if (!task) return null;
    if (Number.isInteger(p.seq)) {
      const sequenceKey = frame.event + ":" + p.runId;
      const last = this.sequences.get(sequenceKey) || 0;
      if (p.seq <= last) return null;
      this.sequences.set(sequenceKey, p.seq);
    }
    let state = "working",
      summary = "",
      text;
    if (frame.event === "agent") {
      if (p.stream === "assistant") {
        text = p.data?.text;
        summary = "Writing a response";
      } else if (p.stream === "tool") {
        summary = `${p.data?.name || "File operation"} · ${p.data?.phase || "working"}`;
      } else if (p.stream === "lifecycle") {
        if (p.data?.phase === "error") {
          state = "error";
          summary =
            "The runtime reported an error. Check the connection and try again.";
        } else return null;
      } else return null;
    } else if (frame.event === "chat") {
      if (p.state === "status") {
        state = "understanding";
        summary =
          {
            preparing_workspace: "Preparing the task workspace",
            preparing_context: "Preparing the selected context",
            starting_model: "Waiting for the selected model",
          }[p.phase] || "Preparing your task";
      } else if (p.state === "final") {
        state = this.stopped.has(task) ? "cancelled" : "completed";
        summary =
          state === "completed"
            ? "Response received"
            : "Stopped; a late response was received";
      } else if (p.state === "aborted") {
        state = "cancelled";
        summary = "Stopped. Completed file changes remain on disk.";
      } else if (p.state === "error") {
        state = "error";
        summary = "The AI request failed. No automatic retry was made.";
      } else summary = "Writing a response";
      const content = p.message?.content;
      text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .filter((x) => x.type === "text")
                .map((x) => x.text)
                .join("\n")
            : undefined;
    } else return null;
    return {
      version: 1,
      eventId: randomUUID(),
      taskId: task,
      runId: p.runId,
      seq: p.seq,
      at: new Date().toISOString(),
      source: "openclaw",
      state,
      summary,
      ...(typeof text === "string" ? { text } : {}),
    };
  }
}

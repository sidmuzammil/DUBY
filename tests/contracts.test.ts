import { describe, it, expect } from "vitest";
import {
  runtimeConfig,
  deniedTools,
  allowedTools,
} from "../packages/runtime-bridge/config.mjs";
import { EventProjection } from "../packages/runtime-bridge/events.mjs";
import { observedTaskState } from "../packages/contracts/src";
const options = { data: "/tmp/duby-test", port: 20000, plugin: "/tmp/plugin" };
describe("provider boundaries", () => {
  for (const [provider, api] of [
    ["openai", "openai-responses"],
    ["anthropic", "anthropic-messages"],
    ["google", "google-generative-ai"],
    ["ollama", "ollama"],
    ["custom", "openai-completions"],
  ])
    it(`configures ${provider} through its selected adapter`, () => {
      const { config } = runtimeConfig(
        {
          provider,
          model: "test-model",
          ...(provider === "custom"
            ? { endpoint: "https://example.com/v1" }
            : {}),
        },
        options,
      );
      expect(config.models.providers[provider].api).toBe(api);
      expect(config.tools.allow).toEqual(allowedTools);
      expect(config.tools.deny).toEqual(deniedTools);
      expect(JSON.stringify(config)).not.toContain("actual-secret");
    });
  it("blocks credential URLs, remote plaintext, cloud Ollama and endpoint substitution", () => {
    for (const c of [
      {
        provider: "custom",
        model: "model",
        endpoint: "http://remote.example/v1",
      },
      {
        provider: "custom",
        model: "model",
        endpoint: "https://user:password@example.com",
      },
      { provider: "ollama", model: "test:cloud" },
      {
        provider: "ollama",
        model: "test",
        endpoint: "http://127.0.0.1:11434/v1",
      },
      { provider: "openai", model: "model", endpoint: "https://evil.example" },
    ])
      expect(() => runtimeConfig(c, options)).toThrow();
  });
  it("rejects extra permission-like configuration", () =>
    expect(() =>
      runtimeConfig(
        { provider: "ollama", model: "test", allowShell: true },
        options,
      ),
    ).toThrow());
});
describe("grounded events", () => {
  it("keeps stop, pause and terminal state when late observations arrive", () => {
    expect(observedTaskState("cancelled", "working")).toBe("cancelled");
    expect(observedTaskState("cancelled", "completed")).toBe("cancelled");
    expect(observedTaskState("completed", "understanding")).toBe("completed");
    expect(observedTaskState("paused", "understanding")).toBe("paused");
    expect(observedTaskState("paused", "completed")).toBe("completed");
  });
  it("deduplicates sequences and ignores unknown runs", () => {
    const p = new EventProjection();
    p.bind("run", "task");
    const e = {
      event: "agent",
      payload: {
        runId: "run",
        seq: 1,
        stream: "assistant",
        data: { text: "hello" },
      },
    };
    expect(p.project(e)?.text).toBe("hello");
    expect(p.project(e)).toBeNull();
    expect(
      p.project({ ...e, payload: { ...e.payload, runId: "foreign" } }),
    ).toBeNull();
  });
  it("keeps chat and agent sequence cursors separate", () => {
    const p = new EventProjection();
    p.bind("r", "t");
    p.project({
      event: "agent",
      payload: {
        runId: "r",
        seq: 10,
        stream: "assistant",
        data: { text: "hello" },
      },
    });
    expect(
      p.project({
        event: "chat",
        payload: { runId: "r", seq: 3, state: "final" },
      })?.state,
    ).toBe("completed");
  });
  it("never marks a tool event as task completion", () => {
    const p = new EventProjection();
    p.bind("r", "t");
    expect(
      p.project({
        event: "agent",
        payload: {
          runId: "r",
          seq: 1,
          stream: "tool",
          data: { phase: "result", name: "duby_save" },
        },
      })?.state,
    ).toBe("working");
  });
  it("keeps cancellation truthful when a late response arrives", () => {
    const p = new EventProjection();
    p.bind("r", "t");
    p.stop("t");
    expect(
      p.project({
        event: "chat",
        payload: {
          runId: "r",
          state: "final",
          message: { content: [{ type: "text", text: "done" }] },
        },
      })?.state,
    ).toBe("cancelled");
  });
});

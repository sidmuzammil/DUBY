import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import net from "node:net";
import { GatewayClient } from "@openclaw/gateway-client";
import { runtimeConfig, providerSchema } from "./config.mjs";
import { EventProjection } from "./events.mjs";
export class Runtime {
  constructor(notify = () => {}) {
    this.notify = notify;
    this.projection = new EventProjection();
    this.active = new Map();
    this.child = null;
    this.client = null;
    this.ready = false;
    this.secretValues = [];
    this.stopping = false;
  }
  safeError(error) {
    let message = String(error?.message || error);
    for (const secret of this.secretValues)
      message = message.split(secret).join("[redacted]");
    return message.slice(0, 700);
  }
  async init(args) {
    this.settings = args;
    await mkdir(args.data, { recursive: true, mode: 0o700 });
  }
  async connect(input) {
    if (this.active.size)
      throw Error(
        "Stop or finish the current task before changing AI connection",
      );
    const c = providerSchema.parse(input);
    await this.shutdown();
    this.stopping = false;
    const port = await new Promise((res, rej) => {
      const s = net.createServer();
      s.once("error", rej);
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => res(p));
      });
    });
    const { data, socket, token } = this.settings;
    const plugin = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../duby-tools",
    );
    const { key, config } = runtimeConfig(c, { data, port, plugin });
    // A test harness can inject only into its own Runtime instance; there is no renderer switch.
    let credential = this.testCredential;
    if (!credential && c.provider !== "ollama") {
      try {
        credential = execFileSync(
          "secret-tool",
          ["lookup", "application", "duby", "provider", c.provider],
          {
            encoding: "utf8",
            timeout: 5000,
            stdio: ["ignore", "pipe", "ignore"],
          },
        ).trim();
      } catch {}
      if (!credential)
        throw Error(
          `No unlocked credential for ${c.provider}. In a terminal run: duby credentials ${c.provider}. No plaintext fallback is used.`,
        );
    }
    await mkdir(data + "/workspace", { recursive: true, mode: 0o700 });
    const configPath = data + "/openclaw.json";
    await writeFile(configPath, JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
    const gatewayToken = randomBytes(32).toString("hex");
    this.secretValues = [credential, gatewayToken, token].filter(Boolean);
    const env = {
      PATH: process.env.PATH,
      HOME: data,
      XDG_CONFIG_HOME: data + "/config",
      XDG_CACHE_HOME: data + "/cache",
      OPENCLAW_STATE_DIR: data,
      OPENCLAW_CONFIG_PATH: configPath,
      OPENCLAW_DISABLE_BONJOUR: "1",
      OPENCLAW_EXEC_SHELL_SNAPSHOT: "0",
      OPENCLAW_NO_RESPAWN: "1",
      OPENCLAW_SKIP_CHANNELS: "1",
      DUBY_GATEWAY_TOKEN: gatewayToken,
      DUBY_BROKER_SOCKET: socket,
      DUBY_BROKER_TOKEN: token,
      [key]: credential || "ollama-local",
    };
    // Preserve only explicit transport trust settings, never ambient provider credentials.
    for (const k of [
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "NO_PROXY",
      "NODE_EXTRA_CA_CERTS",
      "SSL_CERT_FILE",
    ])
      if (process.env[k]) env[k] = process.env[k];
    const entry = resolve(
      dirname(fileURLToPath(import.meta.resolve("openclaw"))),
      "../openclaw.mjs",
    );
    this.child = spawn(
      process.execPath,
      [entry, "gateway", "--port", String(port)],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    // Gateway logs are drained but never forwarded to renderer or persisted with secrets.
    this.child.stdout.on("data", () => {});
    this.child.stderr.on("data", () => {});
    this.child.on("error", () => {
      this.ready = false;
    });
    let initialHello = true;
    let failedConnections = 0;
    const hello = await new Promise((res, rej) => {
      const timer = setTimeout(
        () =>
          rej(
            Error(
              "Gateway did not complete authentication within 70 seconds. Check the managed configuration and runtime dependencies.",
            ),
          ),
        70000,
      );
      this.child.once("exit", (code) => {
        this.ready = false;
        clearTimeout(timer);
        rej(
          Error(
            `Gateway exited (${code}). Configuration or runtime prerequisites failed.`,
          ),
        );
        if (!this.stopping)
          this.notify({
            state: "offline",
            summary: "Gateway exited. Pending outcomes need reconciliation.",
          });
      });
      this.client = new GatewayClient({
        url: `ws://127.0.0.1:${port}`,
        token: gatewayToken,
        clientName: "gateway-client",
        clientDisplayName: "Duby native bridge",
        mode: "backend",
        clientVersion: "0.1.0",
        minProtocol: 4,
        maxProtocol: 4,
        scopes: ["operator.read", "operator.write"],
        caps: ["tool-events"],
        onHelloOk: (h) => {
          clearTimeout(timer);
          this.ready = true;
          failedConnections = 0;
          if (initialHello) {
            initialHello = false;
            res(h);
          } else {
            for (const [task] of this.active) {
              void this.history({ task })
                .then((history) => {
                  this.notify({
                    taskId: task,
                    state: "paused",
                    summary: history.inFlightRun
                      ? "Reconnected. The model turn is still active; file operations remain paused."
                      : "Reconnected. Check the recovered response before starting another task.",
                    text: history.inFlightRun?.text,
                  });
                })
                .catch(() =>
                  this.notify({
                    taskId: task,
                    state: "paused",
                    summary:
                      "Reconnected but history could not be reconciled. No task was replayed.",
                  }),
                );
            }
          }
        },
        onEvent: (e) => {
          this.testEventObserver?.(e);
          const p = this.projection.project(e);
          if (p) {
            if (["completed", "cancelled", "error"].includes(p.state))
              this.active.delete(p.taskId);
            this.notify(p);
          }
        },
        onClose: () => {
          this.ready = false;
          if (!this.stopping && !initialHello) {
            this.notify({
              state: "offline",
              summary:
                "Runtime disconnected. File operations are paused; uncertain tasks will not be replayed.",
            });
            for (const [task] of this.active)
              this.notify({
                taskId: task,
                state: "paused",
                summary: "Connection lost. New file operations are paused.",
              });
          }
        },
        onGap: () => {
          this.notify({
            state: "offline",
            summary:
              "Runtime event gap. History must be reconciled; no task will be resent.",
          });
        },
        onConnectError: () => {
          failedConnections++;
          if (failedConnections >= 5) {
            this.client?.stop();
            clearTimeout(timer);
            rej(
              Error(
                "Runtime connection failed after five attempts. Reconnect from Settings.",
              ),
            );
          }
        },
      });
      this.client.start();
    }).catch(async (e) => {
      await this.shutdown();
      throw e;
    });
    // Protocol authentication is distinct from a billable inference test.
    return {
      ready: true,
      protocol: hello.protocol,
      provider: c.provider,
      model: c.model,
      inferenceTested: false,
      summary:
        "Runtime connected. Model inference is checked when you send a task.",
    };
  }
  async send({ task, prompt }) {
    if (!this.ready) throw Error("Connect an AI runtime in Settings first");
    if (this.active.size) throw Error("Finish or stop the current task first");
    const runId = randomUUID();
    this.projection.bind(runId, task);
    this.active.set(task, runId);
    try {
      const result = await this.client.request("chat.send", {
        sessionKey: task,
        message: prompt,
        idempotencyKey: runId,
      });
      if (result?.runId && result.runId !== runId) {
        this.projection.bind(result.runId, task);
        this.active.set(task, result.runId);
      }
      return { taskId: task, runId: result?.runId || runId };
    } catch (e) {
      this.active.delete(task);
      throw e;
    }
  }
  async abort({ task }) {
    this.projection.stop(task);
    const runId = this.active.get(task);
    if (!runId)
      return { state: "cancelled", summary: "No active runtime turn" };
    const result = await this.client.request("chat.abort", {
      sessionKey: task,
      runId,
    });
    this.active.delete(task);
    return result;
  }
  async history({ task }) {
    if (!this.ready) throw Error("Runtime disconnected");
    return this.client.request("chat.history", {
      sessionKey: task,
      limit: 100,
    });
  }
  async shutdown() {
    this.stopping = true;
    this.ready = false;
    this.client?.stop();
    this.client = null;
    if (this.child) {
      const child = this.child;
      this.child = null;
      child.kill("SIGTERM");
      await new Promise((res) => {
        const t = setTimeout(() => {
          child.kill("SIGKILL");
          res();
        }, 4000);
        child.once("exit", () => {
          clearTimeout(t);
          res();
        });
      });
    }
    this.active.clear();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const send = (v) => process.stdout.write(JSON.stringify(v) + "\n");
  const runtime = new Runtime((data) => send({ event: "task", data }));
  let chain = Promise.resolve();
  createInterface({ input: process.stdin })
    .on("line", (line) => {
      chain = chain.then(async () => {
        let req;
        try {
          req = JSON.parse(line);
          if (
            ![
              "init",
              "connect",
              "send",
              "abort",
              "history",
              "shutdown",
            ].includes(req.method)
          )
            throw Error("Unknown bridge method");
          const result = await runtime[req.method](req.args);
          send({ id: req.id, result: result ?? null });
          if (req.method === "shutdown") process.exit(0);
        } catch (e) {
          send({ id: req?.id, error: runtime.safeError(e) });
        }
      });
    })
    .on("close", async () => {
      await runtime.shutdown();
      process.exit(0);
    });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await runtime.shutdown();
      process.exit(0);
    });
}

import { z } from "zod";
export const providerSchema = z
  .object({
    provider: z.enum(["ollama", "openai", "anthropic", "google", "custom"]),
    model: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/),
    endpoint: z.string().url().optional(),
  })
  .strict();
export const allowedTools = ["duby_read", "duby_find", "duby_save"];
export const deniedTools = [
  "group:runtime",
  "group:fs",
  "group:web",
  "group:sessions",
  "group:memory",
  "group:ui",
  "group:automation",
  "group:messaging",
  "group:nodes",
  "group:agents",
  "group:media",
  "group:openclaw",
  "bundle-mcp",
  "transcripts",
  "github_publish",
  "github_identity_status",
];
export function runtimeConfig(input, { data, port, plugin }) {
  const c = providerSchema.parse(input);
  let baseUrl, api, key;
  const presets = {
    openai: ["https://api.openai.com/v1", "openai-responses", "OPENAI_API_KEY"],
    anthropic: [
      "https://api.anthropic.com",
      "anthropic-messages",
      "ANTHROPIC_API_KEY",
    ],
    google: [
      "https://generativelanguage.googleapis.com/v1beta",
      "google-generative-ai",
      "GEMINI_API_KEY",
    ],
    ollama: ["http://127.0.0.1:11434", "ollama", "OLLAMA_API_KEY"],
    custom: ["", "openai-completions", "DUBY_CUSTOM_KEY"],
  };
  [baseUrl, api, key] = presets[c.provider];
  baseUrl = c.endpoint || baseUrl;
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash)
    throw Error(
      "Endpoints cannot include credentials, query strings or fragments",
    );
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw Error("Remote endpoints require HTTPS");
  if (
    c.provider === "ollama" &&
    (!loopback ||
      url.pathname.replace(/\/$/, "") !== "" ||
      /:cloud(?:$|\/)/.test(c.model))
  )
    throw Error(
      "Duby’s local Ollama mode requires a loopback native endpoint and a non-cloud model. Model-server egress is not verified.",
    );
  if (
    !["ollama", "custom"].includes(c.provider) &&
    baseUrl !== presets[c.provider][0]
  )
    throw Error("Use Custom for a different endpoint");
  return {
    key,
    config: {
      gateway: {
        mode: "local",
        bind: "loopback",
        port,
        auth: {
          mode: "token",
          token: {
            source: "env",
            provider: "default",
            id: "DUBY_GATEWAY_TOKEN",
          },
        },
        controlUi: { enabled: false },
      },
      agents: {
        defaults: {
          workspace: data + "/workspace",
          model: { primary: c.provider + "/" + c.model },
          skipBootstrap: true,
          heartbeat: { every: "0m" },
        },
        entries: { duby: { name: "Duby" } },
      },
      models: {
        mode: "replace",
        providers: {
          [c.provider]: {
            baseUrl,
            api,
            apiKey: { source: "env", provider: "default", id: key },
            models: [
              {
                id: c.model,
                name: c.model,
                reasoning: false,
                input: ["text"],
                contextWindow: 32768,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
      tools: {
        toolSearch: false,
        allow: allowedTools,
        deny: deniedTools,
        exec: { security: "deny" },
        elevated: { enabled: false },
      },
      plugins: {
        allow: ["duby-tools"],
        load: { paths: [plugin] },
        entries: { "duby-tools": { enabled: true } },
        slots: { memory: "none" },
      },
      browser: { enabled: false },
      commands: {
        native: false,
        nativeSkills: false,
        text: false,
        restart: false,
      },
      discovery: { mdns: { mode: "off" } },
      update: { checkOnStart: false },
    },
  };
}

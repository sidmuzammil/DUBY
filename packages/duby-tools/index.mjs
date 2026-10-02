import net from "node:net";
const specs = [
  [
    "duby_read",
    "Read a UTF-8 text file within the folder granted for this task. Max 256 KiB.",
  ],
  [
    "duby_find",
    'List visible files inside the granted folder. Use path "." for the folder root.',
  ],
  [
    "duby_save",
    "Create a new UTF-8 file inside the granted folder. Never overwrites existing files.",
  ],
];
export function brokerRequest(request, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error("Cancelled"));
    const socket = net.createConnection(process.env.DUBY_BROKER_SOCKET);
    let buffer = "";
    const abort = () => socket.destroy(Error("Cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    socket.setTimeout(15000, () =>
      socket.destroy(
        Error("Broker timed out; inspect outcome before retrying"),
      ),
    );
    socket.on("connect", () =>
      socket.write(
        JSON.stringify({ token: process.env.DUBY_BROKER_TOKEN, request }) +
          "\n",
      ),
    );
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > 600000)
        return socket.destroy(Error("Broker response too large"));
      if (buffer.includes("\n")) {
        try {
          const v = JSON.parse(buffer.split("\n")[0]);
          v.error ? reject(Error(v.error)) : resolve(v.result);
        } catch (e) {
          reject(e);
        }
        socket.end();
      }
    });
    socket.on("error", reject);
    socket.on("close", () => {
      signal?.removeEventListener("abort", abort);
      if (!buffer.includes("\n"))
        reject(Error("Broker disconnected; outcome unknown"));
    });
  });
}
export default {
  id: "duby-tools",
  name: "Duby scoped files",
  register(api) {
    for (const [name, description] of specs) {
      api.registerTool(
        (ctx) => ({
          name,
          label: description,
          description,
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              path: { type: "string", maxLength: 4096 },
              ...(name === "duby_save"
                ? { content: { type: "string", maxLength: 262144 } }
                : {}),
            },
            required: name === "duby_save" ? ["path", "content"] : ["path"],
          },
          async execute(id, args, signal) {
            // Identity is supplied by OpenClaw's trusted factory context, never by model arguments.
            if (
              ctx.agentId !== "duby" ||
              !ctx.sessionKey?.startsWith("agent:duby:duby:")
            )
              throw Error("Unbound Duby invocation");
            if (
              Object.keys(args).some(
                (k) =>
                  ![
                    "path",
                    ...(name === "duby_save" ? ["content"] : []),
                  ].includes(k),
              )
            )
              throw Error("Unexpected tool arguments");
            ctx.assertInvocationCurrent?.();
            const result = await brokerRequest(
              {
                task: ctx.sessionKey,
                id,
                tool: name,
                path: args.path,
                content: args.content || "",
              },
              signal,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
              details: { verified: true },
            };
          },
        }),
        { name, optional: true },
      );
    }
  },
};

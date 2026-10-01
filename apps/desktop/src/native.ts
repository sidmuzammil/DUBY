import { invoke, isTauri } from "@tauri-apps/api/core";
export const native = isTauri();
export async function command<T = any>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!native)
    throw Error(
      "Open the Duby desktop app to use local files and AI. This browser view is for interface development.",
    );
  return invoke<T>(name, args);
}

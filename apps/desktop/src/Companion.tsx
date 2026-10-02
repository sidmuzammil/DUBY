import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Pet } from "../../../packages/pet/src/Pet";
import {
  states,
  taskEvent,
  type PetState,
} from "../../../packages/contracts/src";
import { command } from "./native";
export default function Companion() {
  const [state, setState] = useState<PetState>("available");
  const [error, setError] = useState("");
  const [reduced, setReduced] = useState(
    localStorage.getItem("duby.motion") === "reduced",
  );
  useEffect(() => {
    document.documentElement.classList.add("companion-document");
    const listener = listen("duby-event", (event) => {
      const parsed = taskEvent.safeParse(event.payload);
      if (!parsed.success) return;
      const s = parsed.data.state;
      setState(
        states.includes(s as PetState)
          ? (s as PetState)
          : s === "cancelled"
            ? "paused"
            : "available",
      );
    });
    const storage = () =>
      setReduced(localStorage.getItem("duby.motion") === "reduced");
    window.addEventListener("storage", storage);
    return () => {
      void listener.then((stop) => stop());
      window.removeEventListener("storage", storage);
    };
  }, []);
  return (
    <main className="desktop-companion">
      <Pet state={state} reduced={reduced} />
      <span className="companion-caption" aria-live="polite">
        {error || (state === "available" ? "A little help, close by" : state)}
      </span>
      <button
        className="companion-open"
        aria-label="Open Duby"
        onClick={() =>
          void command("show_main").catch((e) => setError(String(e)))
        }
      />
    </main>
  );
}

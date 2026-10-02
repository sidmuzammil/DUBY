import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Companion from "./Companion";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {(window as unknown as { __DUBY_COMPANION__?: boolean })
      .__DUBY_COMPANION__ ? (
      <Companion />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);

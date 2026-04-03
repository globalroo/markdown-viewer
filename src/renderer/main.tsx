import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Set platform class for CSS (macOS traffic light padding, etc.)
if (navigator.platform.includes("Mac")) {
  document.documentElement.classList.add("platform-darwin");
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

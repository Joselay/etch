import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Suppress the WebView's native context menu so our Radix ContextMenus are the
// only ones that appear. Allow it inside <input>/<textarea>/contenteditable so
// users can still cut/copy/paste.
if (typeof window !== "undefined") {
  window.addEventListener("contextmenu", (e) => {
    const t = e.target as HTMLElement | null;
    const editable =
      t?.closest("input, textarea, [contenteditable='true'], [contenteditable='']") != null;
    if (!editable) e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

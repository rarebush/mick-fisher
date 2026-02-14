import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import {
  configureDebugRuntime,
  registerDebugHelpers,
} from "./game/utils/debugFlags.js";
import "./styles/main.css";

// Note: StrictMode disabled for now to prevent PixiJS double-mount issues
// Re-enable once game loop is stable
configureDebugRuntime();
registerDebugHelpers();
ReactDOM.createRoot(document.getElementById("root")).render(<App />);

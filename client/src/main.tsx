import { Buffer } from 'buffer';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfill Buffer for @react-pdf/renderer which uses Node.js APIs
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);

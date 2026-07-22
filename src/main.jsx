import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Fallback: se por qualquer motivo o AuthContext demorar mais de 6s a resolver,
// removemos o splash mesmo assim para não travar a UI. O caminho normal é feito
// pelo <SplashController /> dentro de App.js (que reage ao `loading` do Auth).
setTimeout(() => {
  const s = document.getElementById("app-splash");
  if (s && !s.classList.contains("is-out")) {
    s.classList.add("is-out");
    setTimeout(() => s.remove(), 450);
  }
}, 6000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Guarda de segurança FINAL: se por qualquer motivo o React não montar
// (bundle quebrado, script bloqueado), removemos o splash em 1.5 s para
// evitar tela navy travada. O caminho normal é feito pelo
// <SplashController /> dentro de App.js — que já respeita um teto de 500 ms.
setTimeout(() => {
  const s = document.getElementById("app-splash");
  if (s && !s.classList.contains("is-out") && !s.classList.contains("is-seen")) {
    s.classList.add("is-out");
    setTimeout(() => s.remove(), 250);
  }
}, 1500);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

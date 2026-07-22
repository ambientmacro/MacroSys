import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Guarda de segurança: se por qualquer motivo o AuthContext travar (Firebase
// bloqueado, JS quebrou antes do mount), remove o splash em 8s para não
// deixar o usuário com a tela navy travada. O caminho normal é feito pelo
// <SplashController /> dentro de App.js (que reage ao `loading` e a
// `firebaseUser` do Auth).
setTimeout(() => {
  const s = document.getElementById("app-splash");
  if (s && !s.classList.contains("is-out") && !s.classList.contains("is-seen")) {
    s.classList.add("is-out");
    setTimeout(() => s.remove(), 450);
  }
}, 1500);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

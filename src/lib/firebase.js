import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Vite uses import.meta.env.VITE_* (legacy REACT_APP_* fallback for compatibility)
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.REACT_APP_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID || env.REACT_APP_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Firestore com persistência local (IndexedDB) — habilita cache entre sessões
// e entre abas. Efeitos:
//   • Navegações repetidas retornam do cache primeiro (Δ zero leituras).
//   • `onSnapshot` continua atualizando quando o dado muda no servidor.
//   • Se o usuário quiser forçar refresh do banco: limpar "Application data"
//     do site nas DevTools (ou clicar em "Update / Skip waiting" no PWA).
//   • O tabManager permite múltiplas abas simultâneas sem conflito de lock.
// Fallback: se persistência falhar (browser em modo privado, quota etc.),
// o Firestore volta para in-memory silenciosamente — o app continua
// funcionando, só sem economia de leituras.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);

// Secondary Firebase instance — used so admin can create users
// WITHOUT being logged out from their own session.
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

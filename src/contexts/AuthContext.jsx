import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, getDoc, getDocFromCache, setDoc, serverTimestamp, getDocs, collection, limit, query } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { ROLES, USER_STATUS } from "../lib/constants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      // IMPORTANTE: liberamos `loading=false` IMEDIATAMENTE assim que o
      // Firebase Auth resolve o estado (com ou sem usuário). Isso permite o
      // splash sumir em <100 ms na maioria dos casos (o Firebase Auth já
      // deixa o `currentUser` em cache local do próprio SDK).
      //
      // O profile do Firestore carrega EM PARALELO (não bloqueia a UI):
      //   1. Tenta ler do cache persistente do IndexedDB — retorno instantâneo.
      //   2. Se não houver no cache (primeira sessão) ou o cache estiver
      //      obsoleto, cai para `getDoc` normal (server → atualiza cache).
      setFirebaseUser(user);
      setLoading(false);
      if (!user) { setProfile(null); return; }

      const ref = doc(db, "users", user.uid);
      // Passo 1: cache-first (não bloqueia; falha silencioso se vazio).
      getDocFromCache(ref)
        .then((snap) => { if (snap.exists()) setProfile({ id: user.uid, ...snap.data() }); })
        .catch(() => { /* sem cache → passo 2 cuida */ });
      // Passo 2: leitura servidor+cache (padrão). Substitui o valor se o
      // servidor tiver dados mais atuais.
      getDoc(ref).then(async (snap) => {
        if (snap.exists()) {
          setProfile({ id: user.uid, ...snap.data() });
        } else {
          // Profile pode estar sendo escrito (race no register) — poll breve.
          let tries = 0;
          const retry = async () => {
            tries++;
            const s = await getDoc(ref);
            if (s.exists()) setProfile({ id: user.uid, ...s.data() });
            else if (tries < 5) setTimeout(retry, 400);
            else setProfile(null);
          };
          setTimeout(retry, 400);
        }
      }).catch((e) => {
         
        console.error("[Auth] loadProfile error:", e);
      });
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Bloqueia acesso de usuários inativados pelo Admin/DP.
      // status === "rejected" significa: cadastro rejeitado OU desativado depois.
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists() && snap.data().status === USER_STATUS.REJECTED) {
        await fbSignOut(auth);
        throw new Error("Acesso desativado. Procure o Departamento Pessoal.");
      }
    } catch (e) {
       
      console.error("[Auth] login error:", e);
      throw e;
    }
  };

  const register = async ({ email, password, name, role, phone }) => {
    try {
      // Create user FIRST so we are authenticated for subsequent Firestore reads
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Now authenticated — check if this is the first user
      let isFirstUser = false;
      try {
        const existing = await getDocs(query(collection(db, "users"), limit(2)));
        // We have just created our auth user but no users/{uid} doc yet. If 'users' collection is empty -> first user
        isFirstUser = existing.empty;
      } catch (e) {
         
        console.error("[Auth] users count check failed (assuming not first):", e);
        isFirstUser = false;
      }

      const userData = {
        email,
        name,
        role: isFirstUser ? ROLES.ADMIN : role,
        phone: phone || "",
        status: isFirstUser ? USER_STATUS.APPROVED : USER_STATUS.PENDING,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", cred.user.uid), userData);

      // Set profile immediately so navigation works without waiting for listener
      setProfile({ id: cred.user.uid, ...userData });

      return { isFirstUser };
    } catch (e) {
       
      console.error("[Auth] register error:", e);
      throw e;
    }
  };

  const logout = async () => {
    await fbSignOut(auth);
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      setProfile(snap.exists() ? { id: firebaseUser.uid, ...snap.data() } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

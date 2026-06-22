import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection, limit, query } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { ROLES, USER_STATUS } from "../lib/constants";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            setProfile({ id: user.uid, ...snap.data() });
          } else {
            // Profile may still be writing (race during register) — poll briefly
            let tries = 0;
            const retry = async () => {
              tries++;
              const s = await getDoc(doc(db, "users", user.uid));
              if (s.exists()) {
                setProfile({ id: user.uid, ...s.data() });
              } else if (tries < 5) {
                setTimeout(retry, 400);
              } else {
                setProfile(null);
              }
            };
            setTimeout(retry, 400);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("[Auth] loadProfile error:", e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
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
      // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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

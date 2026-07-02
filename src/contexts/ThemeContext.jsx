import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { applyTheme, THEME_SEEDS, DEFAULT_THEME } from "../lib/themeDefaults";

/**
 * ThemeProvider — decide qual tema aplicar assim que o usuário faz login.
 *
 * Fluxo:
 *  1. Ao logar, busca `theme_config/{role}` no Firestore.
 *  2. Se existir, aplica as cores/fonte configuradas pelo DP.
 *  3. Se não existir, cai no seed baseado no fluxograma (THEME_SEEDS[role]).
 *  4. Se nem seed existe (perfil desconhecido), usa DEFAULT_THEME neutro.
 *
 * Escuta em tempo real: se o DP publicar um novo tema, todos os usuários
 * daquele perfil recebem a mudança sem precisar re-logar.
 */
const ThemeContext = createContext({ theme: DEFAULT_THEME });

export function ThemeProvider({ children }) {
  const { profile } = useAuth();
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (!profile?.role) {
      applyTheme(DEFAULT_THEME);
      setTheme(DEFAULT_THEME);
      return;
    }
    const seed = THEME_SEEDS[profile.role] || DEFAULT_THEME;
    // Aplica o seed imediatamente para não haver "flash" enquanto o
    // Firestore responde.
    applyTheme(seed);
    setTheme(seed);
    // Depois escuta override do DP em tempo real.
    const unsub = onSnapshot(doc(db, "theme_config", profile.role), (snap) => {
      if (snap.exists()) {
        const t = { ...seed, ...snap.data() };
        applyTheme(t);
        setTheme(t);
      } else {
        applyTheme(seed);
        setTheme(seed);
      }
    });
    return () => unsub();
  }, [profile?.role]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

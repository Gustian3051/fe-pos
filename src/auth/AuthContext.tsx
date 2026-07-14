import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, json, newUUID, sessionStore } from "../lib/api";
import type { Session, User } from "../types/api";

interface LoginInput {
  username: string;
  password: string;
}

interface BootstrapInput extends LoginInput {
  full_name: string;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  bootstrap: (input: BootstrapInput) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

const deviceIdentity = () => {
  let id = localStorage.getItem("warungkasir.device_id");
  if (!id || id.replaceAll("-", "").length < 16) {
    id = newUUID();
    localStorage.setItem("warungkasir.device_id", id);
  }
  return {
    device_code: `web-${id.slice(0, 12)}`,
    device_name: "Komputer Kasir",
    device_fingerprint: id.replaceAll("-", "") + "web",
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(
    () => sessionStore.get()?.user ?? null,
  );
  const [loading, setLoading] = useState(Boolean(sessionStore.get()));

  const clear = useCallback(() => {
    sessionStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!sessionStore.get()) return setLoading(false);
      try {
        const active = await api<User>("/me");
        setUser(active);
      } catch {
        clear();
      } finally {
        setLoading(false);
      }
    };
    void verify();
    window.addEventListener("warungkasir:unauthorized", clear);
    return () => window.removeEventListener("warungkasir:unauthorized", clear);
  }, [clear]);

  const login = async (input: LoginInput) => {
    const session = await api<Session>(
      "/auth/login",
      json("POST", { ...input, ...deviceIdentity() }),
    );
    sessionStore.set(session);
    setUser(session.user);
  };

  const bootstrap = async ({ full_name, ...input }: BootstrapInput) => {
    await api(
      "/auth/bootstrap",
      json("POST", {
        username: input.username,
        full_name,
        password: input.password,
      }),
    );
    await login(input);
  };

  const logout = async () => {
    const refreshToken = sessionStore.get()?.refresh_token;
    try {
      if (refreshToken)
        await api(
          "/auth/logout",
          json("POST", { refresh_token: refreshToken }),
        );
    } finally {
      clear();
    }
  };

  const can = useCallback(
    (permission: string) => {
      const permissions = user?.permissions || [];
      if (permissions.includes("*") || permissions.includes(permission))
        return true;
      const [scope] = permission.split(".");
      return permissions.includes(`${scope}.*`);
    },
    [user],
  );

  const value = { user, loading, login, bootstrap, logout, can };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return value;
};

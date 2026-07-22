"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

type AvailableProviders = {
  credentials: boolean;
  google: boolean;
};

export default function LoginPage() {
  const [providers, setProviders] = useState<AvailableProviders | null>(null);

  useEffect(() => {
    let mounted = true;

    getProviders().then((availableProviders) => {
      if (!mounted) return;

      setProviders({
        credentials: Boolean(availableProviders?.credentials),
        google: Boolean(availableProviders?.google),
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="login">
      <section className="loginCard">
        <div className="eyebrow">Xepelin · Growth Engineering</div>
        <h1>Pipeline ejecutable para cada SDR</h1>
        <p className="subtitle">Valida, deduplica y enriquece batches de empresas antes del primer contacto.</p>
        {providers?.google && (
          <button className="button" onClick={() => signIn("google", { callbackUrl: "/batches" })}>
            Continuar con Google
          </button>
        )}
        {providers?.credentials && (
          <button
            className={`button${providers.google ? " buttonSecondary" : ""}`}
            onClick={() => signIn("credentials", { callbackUrl: "/batches" })}
          >
            Entrar al demo
          </button>
        )}
        {!providers && <button className="button" disabled>Cargando accesos…</button>}
        {providers?.credentials && <div className="notice">El acceso demo sólo contiene datos sintéticos.</div>}
      </section>
    </main>
  );
}

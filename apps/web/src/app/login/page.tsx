"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="login">
      <section className="loginCard">
        <div className="eyebrow">Xepelin · Growth Engineering</div>
        <h1>Pipeline ejecutable para cada SDR</h1>
        <p className="subtitle">Valida, deduplica y enriquece batches de empresas antes del primer contacto.</p>
        <button className="button" onClick={() => signIn("credentials", { callbackUrl: "/batches" })}>Entrar al demo</button>
        <div className="notice">El acceso demo sólo contiene datos sintéticos.</div>
      </section>
    </main>
  );
}

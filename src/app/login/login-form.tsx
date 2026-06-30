"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form className="form" action={formAction}>
      <label>
        Email
        <input className="input" name="email" type="email" defaultValue={defaultEmail} autoComplete="username" required />
      </label>
      <label>
        Password
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error ? <p className="error">{state.error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

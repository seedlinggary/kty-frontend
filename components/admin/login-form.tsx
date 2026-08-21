"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-md border border-line px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Password</label>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-line px-3 py-2"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}

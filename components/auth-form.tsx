"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim().toLowerCase();
    const password = String(data.get("password"));
    const name = String(data.get("name") ?? "").trim();
    if (register && !name) return setError("Please enter your name.");
    if (register && password !== data.get("confirmPassword")) {
      return setError("The passwords do not match.");
    }
    setPending(true);
    try {
      const result = register
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : register
            ? "Unable to create your account. Check your details or try logging in."
            : "Unable to log in. Check your email and password and try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again shortly.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{register ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-slate-600">{register ? "A clearer picture of your finances starts here." : "Log in to your My Finances account."}</p>
      <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={pending} aria-describedby={error ? "auth-error" : undefined}>
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
          {register && <div><label htmlFor="name" className="text-sm font-medium">Name</label><input id="name" name="name" autoComplete="name" required maxLength={100} className={inputClass} /></div>}
          <div><label htmlFor="email" className="text-sm font-medium">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className={inputClass} /></div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required className={inputClass} />
          </div>
          {register && <div><label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} /></div>}
          <button type="submit" className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait">{pending ? "Please wait…" : register ? "Create account" : "Log in"}</button>
        </fieldset>
        {error && <p id="auth-error" role="alert" className="text-sm text-red-700">{error}</p>}
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">{register ? "Already have an account? " : "New to My Finances? "}<Link href={register ? "/login" : "/register"} className="font-semibold text-emerald-700 underline underline-offset-4">{register ? "Log in" : "Create an account"}</Link></p>
    </>
  );
}

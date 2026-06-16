"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Login failed.");
      }

      const destination = searchParams.get("from") || "/";
      router.replace(destination);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-800 text-zinc-100 font-sans flex items-center justify-center relative px-4 py-10">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-28 pointer-events-none"
        style={{ backgroundImage: "url('/apartment-bg.jpg')" }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-xl">
        <div className="rounded-2xl border border-zinc-600/70 bg-zinc-900/85 backdrop-blur shadow-2xl shadow-black/40 p-8 sm:p-10">
          <div className="flex flex-col items-center text-center mb-8">
            <Image
              src="/hop2it-logo.png"
              alt="HOP2IT Property Manager"
              width={800}
              height={300}
              className="h-48 sm:h-60 w-auto max-w-full object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.25)]"
              priority
            />
            <h1 className="mt-5 text-xl font-semibold text-zinc-100">Property Manager</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="form-field"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="form-field"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-700 bg-red-950/50 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/logo";
import { acceptInvite, getAccessToken } from "@/lib/api";

type State =
  | { kind: "working" }
  | { kind: "login" }
  | { kind: "done"; name: string; role: string }
  | { kind: "error"; message: string };

export default function AcceptInvite() {
  const [state, setState] = useState<State>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // invites work once, and dev mode runs effects twice
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ kind: "error", message: "This invite link is missing its token." });
      return;
    }
    if (!getAccessToken()) {
      setState({ kind: "login" });
      return;
    }
    acceptInvite(token)
      .then((ws) => {
        localStorage.setItem("workspace_id", ws.id);
        setState({ kind: "done", name: ws.name, role: ws.role });
      })
      .catch((e) =>
        setState({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" }),
      );
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#EEF0FF] p-6 text-[#14142B]">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {state.kind === "working" && <p className="text-[#14142B]/60">Joining workspace...</p>}

        {state.kind === "login" && (
          <>
            <h1 className="text-2xl font-bold">You have been invited</h1>
            <p className="mt-2 text-sm text-[#14142B]/60">
              Log in or sign up with the email address the invite was sent to, then open this link again.
            </p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-[#4F46E5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4338CA]">
              Log in or sign up
            </Link>
          </>
        )}

        {state.kind === "done" && (
          <>
            <h1 className="text-2xl font-bold">Welcome to {state.name}</h1>
            <p className="mt-2 text-sm text-[#14142B]/60">You joined as {state.role}.</p>
            <a href="/dashboard" className="mt-6 inline-block rounded-xl bg-[#4F46E5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4338CA]">
              Open workspace
            </a>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-2xl font-bold">Could not join</h1>
            <p className="mt-2 text-sm text-[#B91C1C]">{state.message}</p>
            <a href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-[#4F46E5]">
              Go to dashboard
            </a>
          </>
        )}
      </div>
    </main>
  );
}

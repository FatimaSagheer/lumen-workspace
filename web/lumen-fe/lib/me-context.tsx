"use client";

import { createContext, useContext } from "react";
import type { Me } from "./api";

export type Workspace = Me["workspaces"][number];
type Ctx = { me: Me; workspace: Workspace };

export const MeContext = createContext<Ctx | null>(null);

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside the dashboard layout");
  return ctx;
}
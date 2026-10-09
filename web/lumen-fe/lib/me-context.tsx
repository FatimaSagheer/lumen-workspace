
"use client";

// WHY "use client"?
// This file uses React's createContext() and useContext() hooks.
// These are used here in the Client Component part of your Next.js app.
//
// Without this directive, Next.js treats the file as a Server Component
// by default, and you cannot use these React client APIs there.

import { createContext, useContext } from "react";

// WHY import Me as a type?
// Me describes the shape of the data returned by your API,
// such as the current user and their available workspaces.
//
// "import type" is only for TypeScript's type checking.
// It is not needed as a runtime JavaScript value.
//
// If the API's Me type changes, TypeScript can help you find
// places that need updating.
import type { Me } from "./api";


// WHAT IS THIS?
// Me["workspaces"] means: look at the "workspaces" property
// in the Me type.
//
// [number] means: get the type of one element in that array.
//
// For example, if Me contains:
//
// type Me = {
//   id: string;
//   email: string;
//   workspaces: {
//     id: string;
//     name: string;
//   }[];
// };
//
// Then Workspace becomes equivalent to:
//
// type Workspace = {
//   id: string;
//   name: string;
// };
//
// WHY do it this way?
// We reuse the existing API type instead of writing the workspace
// structure a second time. If the API type changes, Workspace
// automatically follows it.
//
// IMPORTANT:
// This is a TypeScript type, not an actual workspace object.
export type Workspace = Me["workspaces"][number];


// WHAT IS Ctx?
// Ctx is short for "Context".
// It describes the data that this context will provide.
//
// me: Me
//   The current user's information returned by the API.
//
// workspace: Workspace
//   The currently selected workspace.
//
// WHY define this type?
// It ensures consumers receive the expected data and helps
// TypeScript catch mistakes, such as accessing a nonexistent field.
//
// If you later add another shared value, such as permissions,
// you would normally update this type too.
type Ctx = {
  me: Me;
  workspace: Workspace;
};


// CREATE THE CONTEXT
// createContext() creates a shared channel through which React
// components can receive a value from an ancestor Provider.
//
// Why use null as the initial/default value?
// It signals that no context value has been supplied.
//
// IMPORTANT:
// This does not fetch the user, select a workspace, or create
// a real workspace. A Provider must supply the actual value.
//
// Why Ctx | null?
// Because the context may not have a Provider above the consumer.
// In that case, its value is null.
export const MeContext = createContext<Ctx | null>(null);


// CREATE A CUSTOM HOOK
// useMe() is a convenient wrapper around React's useContext().
// Components can call useMe() instead of importing MeContext
// and repeating the same context-reading logic.
export function useMe() {

  // Read the nearest MeContext Provider's value above this component.
  //
  // For example, the value might look like:
  //
  // {
  //   me: {
  //     id: "user-123",
  //     email: "user@example.com",
  //     workspaces: [...]
  //   },
  //   workspace: {
  //     id: "workspace-456",
  //     name: "My Workspace"
  //   }
  // }
  //
  // The actual fields depend on your Me type and API response.
  const ctx = useContext(MeContext);


  // GUARD / ERROR CHECK
  // If ctx is null, the component is not receiving a context value.
  //
  // This usually means it is rendered outside the relevant Provider,
  // or the Provider's value was explicitly set to null.
  //
  // Throwing an error makes the configuration problem visible
  // immediately instead of allowing a confusing error later,
  // such as trying to read workspace.id from undefined.
  if (!ctx) {
    throw new Error(
      "useMe must be used inside the dashboard layout"
    );
  }


  // RETURN THE SHARED DATA
  // Once the check passes, TypeScript knows ctx is a Ctx object,
  // not null.
  //
  // A component can now write:
  //
  // const { me, workspace } = useMe();
  //
  // Or, if it only needs the workspace:
  //
  // const { workspace } = useMe();
  //
  // Returning the whole context keeps this hook reusable.
  return ctx;
}
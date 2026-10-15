// Test loader: teaches Node the app's "@/" path alias.
//
// `@/*` resolved to the project root is a TypeScript/bundler convention
// (tsconfig `paths`, Next.js `baseUrl`). Node has no idea about it, so the pure
// modules under test import each other with "@/lib/..." and would otherwise fail
// to resolve when run directly by `node --test`.
//
// This hook rewrites those specifiers to file URLs before Node resolves them.
// It is only used by the test runner; the application itself is bundled by
// Next.js, which already understands the alias.
import { existsSync } from "node:fs";

const projectRoot = new URL("../", import.meta.url);

// Bare specifiers like "@/lib/supabase/client" carry no extension, and the file
// could be .ts or .tsx. Try the plausible candidates before handing the
// specifier back to Node.
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = new URL(specifier.slice(2), projectRoot);
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(candidate)) {
        return nextResolve(candidate.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

/**
 * Node strips types from .ts out of the box but does not know .tsx exists.
 * Telling it to read a .tsx as TypeScript is enough here: the modules under
 * test contain type annotations plus a little JSX-free TSX, and no JSX is
 * executed because the tests only import the pure helpers.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) {
    return nextLoad(url, { ...context, format: "module-typescript" });
  }
  return nextLoad(url, context);
}

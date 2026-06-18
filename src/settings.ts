/**
 * Helpers for wiring getreceipts into a Claude Code settings.json `Stop` hook,
 * without clobbering whatever the user already has configured.
 */

export const HOOK_COMMAND = "npx -y getreceipts hook";

interface HookCommand {
  type: string;
  command: string;
}
interface HookGroup {
  matcher?: string;
  hooks?: HookCommand[];
}
export interface Settings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

export function hasGetreceiptsHook(settings: Settings): boolean {
  const stop = settings.hooks?.Stop ?? [];
  return stop.some((group) =>
    (group.hooks ?? []).some((h) => typeof h.command === "string" && h.command.includes("getreceipts")),
  );
}

/** Returns a new settings object with our Stop hook added (idempotent, non-mutating). */
export function addStopHook(settings: Settings, command: string = HOOK_COMMAND): Settings {
  const next: Settings = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  const stop = Array.isArray(next.hooks!.Stop) ? [...next.hooks!.Stop] : [];

  if (!hasGetreceiptsHook(next)) {
    stop.push({ hooks: [{ type: "command", command }] });
  }

  next.hooks!.Stop = stop;
  return next;
}

export type DialogResourceStatus = "idle" | "loading" | "ready" | "refreshing" | "error";

export interface DialogResourceState<T> {
  status: DialogResourceStatus;
  data: T | null;
  error: string | null;
  updatedAt: number | null;
}

export type ActionStatus = "idle" | "running" | "success" | "error";

export interface ActionState {
  key: string | null;
  status: ActionStatus;
  error: string | null;
}

export const DIALOG_CACHE_TTL_MS = 30_000;

export function isDialogResourceFresh(updatedAt: number | null, now = Date.now()): boolean {
  return updatedAt !== null && now - updatedAt < DIALOG_CACHE_TTL_MS;
}


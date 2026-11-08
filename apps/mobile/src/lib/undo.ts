import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

/**
 * Delete with "Deshacer": the item disappears at once (optimistic cache
 * update), the server call waits for the undo window, and anything that fails
 * is restored. Only one pending action at a time (a new one commits the old);
 * leaving the app commits it too. Ids stay hidden until the server confirms,
 * so a refetch during the window never brings a deleted item back.
 */
export interface PendingUndo {
  id: number;
  label: string;
  undo: () => void;
}

interface Action {
  id: number;
  label: string;
  ids: readonly string[];
  restore: () => void;
  commit: () => Promise<void>;
  onError: () => void;
  timer: ReturnType<typeof setTimeout>;
}

export const UNDO_WINDOW_MS = 5000;
let current: Action | null = null;
let seq = 0;
const committing = new Map<number, readonly string[]>();
const listeners = new Set<() => void>();
let pendingSnapshot: PendingUndo | null = null;
let hiddenSnapshot: ReadonlySet<string> = new Set();

function emit() {
  pendingSnapshot = current ? { id: current.id, label: current.label, undo: undoCurrent } : null;
  hiddenSnapshot = new Set([...(current?.ids ?? []), ...[...committing.values()].flat()]);
  listeners.forEach((l) => l());
}

function run(action: Action) {
  committing.set(action.id, action.ids);
  emit();
  action
    .commit()
    .catch(() => {
      action.restore();
      action.onError();
    })
    .finally(() => {
      committing.delete(action.id);
      emit();
    });
}

function undoCurrent() {
  if (!current) return;
  clearTimeout(current.timer);
  current.restore();
  current = null;
  emit();
}

/** Commits the pending action now (window closed, app backgrounded, new action). */
export function flushPendingUndo(): void {
  if (!current) return;
  const action = current;
  clearTimeout(action.timer);
  current = null;
  run(action);
}

export function deleteWithUndo(args: {
  label: string;
  /** Ids hidden from lists until the deletion settles. */
  ids: readonly string[];
  /** Applies the optimistic change and returns how to revert it. */
  apply: () => () => void;
  commit: () => Promise<void>;
  onError: () => void;
}): void {
  flushPendingUndo();
  const restore = args.apply();
  const id = ++seq;
  current = {
    id,
    label: args.label,
    ids: args.ids,
    restore,
    commit: args.commit,
    onError: args.onError,
    timer: setTimeout(() => {
      if (current?.id === id) flushPendingUndo();
    }, UNDO_WINDOW_MS),
  };
  emit();
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushPendingUndo();
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function usePendingUndo(): PendingUndo | null {
  return useSyncExternalStore(subscribe, () => pendingSnapshot, () => pendingSnapshot);
}

/** Items being deleted (pending undo or awaiting the server). */
export function useHiddenIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => hiddenSnapshot, () => hiddenSnapshot);
}

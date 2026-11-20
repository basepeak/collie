import { useEffect, useRef } from "react";

import { ActionRow } from "@/components/action-sheet-rows";
import { Icon } from "@/components/icons/icon";
import { BottomSheet } from "@/components/ui/sheet";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { paneName } from "@/lib/pane-name";
import { paneRole, type TreeRelatives } from "@/lib/pane-tree";
import type { AgentView } from "@/lib/types";

// MOVING THROUGH THE TREE FROM AN OPEN PANE (lib/pane-tree.ts `treeRelatives`): up to the pane that started
// this one, down to the panes it started, and across to its siblings, in the order the tree order draws them.
// Two ways in, one move: the header's tree button opens `TreeNavSheet`, and on a keyboard Alt with an arrow
// moves at once (`useTreeNavKeys`). The move itself is the caller's: sideways, like the switcher (ADR 0067).

/** Whether a pane has any relative to move to, which is when the header offers the tree button. */
export function hasRelatives(r: TreeRelatives): boolean {
  return r.parent !== null || r.previous !== null || r.next !== null || r.children.length > 0;
}

/** A row's hint: the role its starter gave the pane, when it has one. */
function role(pane: AgentView): string | undefined {
  return paneRole(pane) ?? undefined;
}

/** The sheet the header's tree button opens: the parent, the siblings either side, and the children. */
export function TreeNavSheet({
  open,
  onClose,
  relatives,
  onMove,
}: {
  open: boolean;
  onClose: () => void;
  relatives: TreeRelatives;
  onMove: (pane: AgentView) => void;
}) {
  useLocale();
  const { parent, previous, next, children } = relatives;
  return (
    <BottomSheet open={open} onClose={onClose} title={t("treeNav.title")}>
      <div className="flex flex-col gap-1 pb-2">
        {parent !== null && (
          <ActionRow
            icon={<Icon name="folder-up" className="size-5 shrink-0 text-muted-foreground" />}
            label={t("treeNav.parent", { name: paneName(parent) })}
            hint={role(parent)}
            onClick={() => onMove(parent)}
          />
        )}
        {previous !== null && (
          <ActionRow
            icon={<Icon name="space-prev" className="size-5 shrink-0 text-muted-foreground" />}
            label={t("treeNav.previous", { name: paneName(previous) })}
            hint={role(previous)}
            onClick={() => onMove(previous)}
          />
        )}
        {next !== null && (
          <ActionRow
            icon={<Icon name="space-next" className="size-5 shrink-0 text-muted-foreground" />}
            label={t("treeNav.next", { name: paneName(next) })}
            hint={role(next)}
            onClick={() => onMove(next)}
          />
        )}
        {children.length > 0 && (
          <>
            <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{t("treeNav.children")}</p>
            {children.map((child) => (
              <ActionRow
                key={`${child.host ?? ""}/${child.paneId}`}
                icon={<Icon name="tree-child" className="size-5 shrink-0 text-muted-foreground" />}
                label={paneName(child)}
                hint={role(child)}
                onClick={() => onMove(child)}
              />
            ))}
          </>
        )}
        <p className="px-3 pt-2 text-xs text-muted-foreground">{t("treeNav.keys")}</p>
      </div>
    </BottomSheet>
  );
}

/** A key event typed into a field: the composer, direct typing's textarea, a search box. Never a move. */
function typedIntoField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable]") !== null;
}

/**
 * Alt with an arrow moves through the tree on a keyboard: Left to the parent, Right to the first child, Up and
 * Down to the previous and next sibling. Only the bare Alt combination, never while a field has the keys (the
 * composer and direct typing both type into one), and only when `enabled`. A key with nowhere to go does nothing
 * and lets the browser have it.
 */
export function useTreeNavKeys(relatives: TreeRelatives, onMove: (pane: AgentView) => void, enabled: boolean): void {
  const latest = useRef({ relatives, onMove });
  latest.current = { relatives, onMove };
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (typedIntoField(event.target)) return;
      const r = latest.current.relatives;
      const target =
        event.key === "ArrowLeft"
          ? r.parent
          : event.key === "ArrowRight"
            ? (r.children[0] ?? null)
            : event.key === "ArrowUp"
              ? r.previous
              : event.key === "ArrowDown"
                ? r.next
                : null;
      if (target === null) return;
      event.preventDefault();
      latest.current.onMove(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

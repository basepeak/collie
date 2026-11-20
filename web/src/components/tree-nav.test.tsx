import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { hasRelatives, TreeNavSheet, useTreeNavKeys } from "./tree-nav";
import type { TreeRelatives } from "@/lib/pane-tree";
import type { AgentView } from "@/lib/types";

function pane(paneId: string, role?: string): AgentView {
  const view: AgentView = {
    paneId,
    workspaceId: "w1",
    workspaceLabel: "work",
    workspaceNumber: 1,
    tabId: "w1:t1",
    agent: "claude",
    status: "idle",
    cwd: "/srv/work",
    focused: false,
    sessionName: paneId,
  };
  if (role !== undefined) view.tree = { id: paneId, role };
  return view;
}

const coord = pane("coord", "coordinator");
const prev = pane("left", "worker");
const next = pane("right", "worker");
const kid1 = pane("kid-one", "research");
const kid2 = pane("kid-two");
const ALL: TreeRelatives = { parent: coord, previous: prev, next, children: [kid1, kid2] };
const NONE: TreeRelatives = { parent: null, previous: null, next: null, children: [] };

describe("TreeNavSheet", () => {
  it("lists the parent, the siblings and the children, and moves on a tap", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<TreeNavSheet open onClose={vi.fn()} relatives={ALL} onMove={onMove} />);
    expect(screen.getByRole("button", { name: /Up to coord/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous: left/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next: right/ })).toBeInTheDocument();
    expect(screen.getByText("Started here")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /kid-one/ }));
    expect(onMove).toHaveBeenCalledWith(kid1);
  });

  it("leaves out a relative the pane does not have", () => {
    render(<TreeNavSheet open onClose={vi.fn()} relatives={{ ...NONE, parent: coord }} onMove={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Previous/ })).toBeNull();
    expect(screen.queryByText("Started here")).toBeNull();
  });

  it("offers the tree only to a pane with a relative", () => {
    expect(hasRelatives(NONE)).toBe(false);
    expect(hasRelatives({ ...NONE, next })).toBe(true);
  });
});

describe("useTreeNavKeys", () => {
  const press = (key: string, init: KeyboardEventInit = {}, target: Window | Element = window) =>
    fireEvent.keyDown(target, { key, altKey: true, ...init });

  it("Alt with an arrow moves to the parent, the first child and the siblings", () => {
    const onMove = vi.fn<(pane: AgentView) => void>();
    renderHook(() => useTreeNavKeys(ALL, onMove, true));
    press("ArrowLeft");
    press("ArrowRight");
    press("ArrowUp");
    press("ArrowDown");
    expect(onMove.mock.calls.map(([p]) => p.paneId)).toEqual(["coord", "kid-one", "left", "right"]);
  });

  it("stays out of a field, a key with another modifier, and a list it was told to leave alone", () => {
    const onMove = vi.fn();
    const { rerender } = renderHook(({ on }) => useTreeNavKeys(ALL, onMove, on), { initialProps: { on: true } });
    const field = document.createElement("textarea");
    document.body.append(field);
    press("ArrowLeft", {}, field);
    press("ArrowLeft", { ctrlKey: true });
    press("ArrowLeft", { shiftKey: true });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    rerender({ on: false });
    press("ArrowLeft");
    expect(onMove).not.toHaveBeenCalled();
    field.remove();
  });

  it("a key with nowhere to go does nothing", () => {
    const onMove = vi.fn();
    renderHook(() => useTreeNavKeys(NONE, onMove, true));
    press("ArrowLeft");
    expect(onMove).not.toHaveBeenCalled();
  });
});

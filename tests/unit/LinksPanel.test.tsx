import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { LinksPanel } from "../../src/renderer/components/LinksPanel";
import { useAppStore } from "../../src/renderer/store";

/**
 * Regression test for React #300 ("Rendered fewer hooks than expected") in
 * LinksPanel. The original bug: two `useAppStore` subscriptions lived AFTER
 * the `if (!linkGraph || !selectedFile)` early return, so the hook count
 * flipped between 4 and 6 as state transitioned — crashing the packaged app
 * on close-all-tabs.
 *
 * This test asserts that the full state transition
 *   (populated → empty → populated → empty)
 * completes without React logging any Rules-of-Hooks error. Static defence
 * is the new `react-hooks/rules-of-hooks` ESLint rule; this is the runtime
 * defence for the specific component and path that triggered the prod crash.
 */

function resetStore() {
  useAppStore.setState({
    linkGraph: null,
    linksFilterActive: false,
    selectedFile: null,
    projects: [],
    openTabs: [],
    activeTab: null,
  });
}

describe("LinksPanel — hook-order stability across state transitions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetStore();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  function hookOrderErrors() {
    return consoleErrorSpy.mock.calls
      .map((args) => String(args[0] ?? ""))
      .filter(
        (msg) =>
          /change in the order of Hooks/i.test(msg) ||
          /Rendered (more|fewer) hooks/i.test(msg) ||
          /Rules of Hooks/i.test(msg),
      );
  }

  it("handles selectedFile null → populated → null without hook-order error", () => {
    // Start in the empty branch (4 hooks), mount the component
    const { unmount } = render(<LinksPanel />);

    // Populate linkGraph + selectedFile — component now re-renders into the
    // "has data" branch. Before the fix this triggered the 2 extra hook
    // subscriptions, producing 6 hooks total.
    act(() => {
      useAppStore.setState({
        selectedFile: "/project/file-01.md",
        linkGraph: {
          outgoing: ["/project/file-02.md"],
          incoming: ["/project/file-03.md"],
          outgoingContexts: {},
          incomingContexts: {},
          outgoingStatus: {},
          staleTargets: {},
        },
      });
    });

    // Close all tabs: selectedFile goes back to null. Before the fix, React
    // now observed 4 hooks where it had previously seen 6 and threw #300
    // in prod (warned in dev). After the fix, hook count stays at 6 across
    // both branches.
    act(() => {
      useAppStore.setState({ selectedFile: null, linkGraph: null });
    });

    // Round-trip again to be thorough
    act(() => {
      useAppStore.setState({
        selectedFile: "/project/file-01.md",
        linkGraph: {
          outgoing: [],
          incoming: [],
          outgoingContexts: {},
          incomingContexts: {},
          outgoingStatus: {},
          staleTargets: {},
        },
      });
    });
    act(() => {
      useAppStore.setState({ selectedFile: null, linkGraph: null });
    });

    expect(hookOrderErrors()).toEqual([]);

    unmount();
  });

  it("toggles linksFilterActive without hook-order error", () => {
    useAppStore.setState({
      selectedFile: "/project/file-01.md",
      linkGraph: {
        outgoing: ["/project/file-02.md"],
        incoming: [],
        outgoingContexts: {},
        incomingContexts: {},
        outgoingStatus: {},
        staleTargets: {},
      },
    });

    const { unmount } = render(<LinksPanel />);

    act(() => {
      useAppStore.setState({ linksFilterActive: true });
    });
    act(() => {
      useAppStore.setState({ linksFilterActive: false });
    });

    expect(hookOrderErrors()).toEqual([]);

    unmount();
  });
});

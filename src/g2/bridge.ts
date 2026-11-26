import {
  StartUpPageCreateResult,
  waitForEvenAppBridge,
  type CreateStartUpPageContainer,
  type EvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

export interface G2BridgeHandle {
  mode: "even-g2" | "browser-preview";
  pushPage(page: CreateStartUpPageContainer): Promise<void>;
  onEvent(handler: (event: EvenHubEvent) => void): void;
}

function hasEvenHost(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.flutter_inappwebview || w.EvenAppBridge);
}

export async function connectG2Bridge(): Promise<G2BridgeHandle> {
  if (!hasEvenHost()) {
    return { mode: "browser-preview", async pushPage() {}, onEvent() {} };
  }
  const bridge: EvenAppBridge = await waitForEvenAppBridge();
  let created = false;
  return {
    mode: "even-g2",
    async pushPage(page: CreateStartUpPageContainer) {
      if (!created) {
        const res = await bridge.createStartUpPageContainer(page);
        if (res === StartUpPageCreateResult.success) created = true;
      } else {
        await bridge.rebuildPageContainer(page);
      }
    },
    onEvent(handler: (event: EvenHubEvent) => void) {
      bridge.onEvenHubEvent(handler);
    },
  };
}

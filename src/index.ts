import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

// @ts-ignore - Plugin instance is not typed
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  // Create addon instance
  const addonInstance = new Addon();

  // @ts-ignore
  _globalThis.addon = addonInstance;

  defineGlobal("ztoolkit", () => {
    // @ts-ignore
    return _globalThis.addon.data.ztoolkit;
  });

  // @ts-ignore - Plugin instance is not typed
  Zotero[config.addonInstance] = addonInstance;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}

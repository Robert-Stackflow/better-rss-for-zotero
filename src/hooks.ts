import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { ContentExtractor } from "./modules/contentExtractor";
import { FeedMenuManager } from "./modules/feedMenuManager";
import {
  getSettings,
  initPreference,
  registerPrefsScripts,
} from "./modules/preferenceScript";

export async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Initialize preferences
  initPreference();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win))
  );

  ztoolkit.log("Better RSS for Zotero started");
}

export async function onMainWindowLoad(
  win: _ZoteroTypes.MainWindow
): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  // @ts-ignore This is a moz feature
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-addon.ftl`
  );

  // Register menu items
  registerMenuItems();

  getSettings();
}

export async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

export function onShutdown(): void {
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * Register context menu items for feed items
 */
function registerMenuItems() {
  const menuManager = new FeedMenuManager();
  menuManager.register();
}

/**
 * Handle menu command - Extract full content
 */
export async function onExtractContent() {
  const items = Zotero.getActiveZoteroPane().getSelectedItems();

  if (!items || items.length === 0) {
    return;
  }

  const progressWindow = new ztoolkit.ProgressWindow(
    addon.data.config.addonName
  );
  progressWindow
    .createLine({
      text: getString("extract-progress-processing", {
        args: { count: items.length },
      }),
      type: "default",
      progress: 0,
    })
    .show();

  const extractor = new ContentExtractor();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await extractor.extractAndSave(item);
      successCount++;
    } catch (e) {
      ztoolkit.log(`Failed to process item ${item.id}: ${e}`);
      failCount++;
    }

    progressWindow.changeLine({
      progress: ((i + 1) / items.length) * 100,
      text: getString("extract-progress-current", {
        args: { current: i + 1, total: items.length },
      }),
    });
  }

  progressWindow.changeLine({
    text: getString("extract-progress-complete", {
      args: { success: successCount, failed: failCount },
    }),
    type: successCount > 0 ? "success" : "fail",
    progress: 100,
  });

  progressWindow.startCloseTimer(2000);
}

/**
 * This function is the dispatcher for Preference UI events.
 */
export async function onPrefsLoad(event: Event) {
  const window = (event.target as any).ownerGlobal as Window;
  registerPrefsScripts(window);
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onExtractContent,
  onPrefsLoad,
};

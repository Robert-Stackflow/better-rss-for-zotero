import { getString, initLocale } from "./utils/locale";
import { createZToolkit, selected } from "./utils/ztoolkit";
import { ContentExtractor } from "./modules/contentExtractor";
import { FeedMenuManager } from "./modules/feedMenuManager";
import { FeedObserver } from "./modules/feedObserver";
import { KeywordFilter } from "./modules/keywordFilter";
import {
  getSettings,
  initPreference,
  registerPrefsScripts,
} from "./modules/preferenceScript";

let feedObserver: FeedObserver | null = null;

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

  // Start feed observer
  feedObserver = new FeedObserver();
  feedObserver.register();

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

  // Stop feed observer
  if (feedObserver) {
    feedObserver.unregister();
    feedObserver = null;
  }

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
 * Handle menu command - Extract all articles from feed
 */
export async function onExtractAllFromFeed() {
  const { feed, isFeed } = selected();
  if (!isFeed || !feed) {
    ztoolkit.log("No feed selected");
    return;
  }
  ztoolkit.log(`Starting extraction for feed: ${feed.name}`);
  // Get all items in the feed
  let sql = `
  SELECT FI.itemID
  FROM feedItems FI
  JOIN items I USING (itemID)
  WHERE I.libraryID = ?
`;
  const itemIDs = (await Zotero.DB.columnQueryAsync(sql, [
    feed.libraryID,
  ])) as number[];
  const items = itemIDs
    .map((id) => Zotero.Items.get(id))
    .filter((item) => item);

  if (!items || items.length === 0) {
    ztoolkit.log("No feed items found");
    return;
  }

  ztoolkit.log(`Found ${items.length} feed items to extract`);

  // Get settings
  const { getPref } = await import("./utils/prefs");
  const batchInterval = (getPref("batchExtractInterval") as number) || 1000;
  const enableKeywordFilter = getPref("enableKeywordFilter") as boolean;
  const keywordFilterRules = (getPref("keywordFilterRules") as string) || "";

  // Filter items by keywords if enabled
  let itemsToExtract = items;
  if (enableKeywordFilter && keywordFilterRules) {
    itemsToExtract = items.filter((item) =>
      KeywordFilter.shouldExtractItem(item, keywordFilterRules)
    );
    ztoolkit.log(
      `Filtered: ${itemsToExtract.length}/${items.length} items match keyword rules`
    );
  }

  if (itemsToExtract.length === 0) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeTime: 2000,
    })
      .createLine({
        text: "No items match the filter criteria",
        type: "default",
      })
      .show();
    return;
  }

  const progressWindow = new ztoolkit.ProgressWindow(
    addon.data.config.addonName
  );
  progressWindow
    .createLine({
      text: getString("extract-feed-progress-processing", {
        args: { count: itemsToExtract.length },
      }),
      type: "default",
      progress: 0,
    })
    .show();

  const extractor = new ContentExtractor();
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < itemsToExtract.length; i++) {
    const item = itemsToExtract[i];

    // Apply batch interval delay
    if (i > 0 && batchInterval > 0) {
      await new Promise((resolve) => setTimeout(resolve, batchInterval));
    }

    try {
      await extractor.extractAndSave(item);
      successCount++;
    } catch (e) {
      const errorMsg = (e as Error).message;
      if (
        errorMsg.includes("already exists") ||
        errorMsg.includes("skipping")
      ) {
        skippedCount++;
        ztoolkit.log(`Skipped item ${item.id}: already processed`);
      } else {
        failCount++;
        ztoolkit.log(`Failed to process item ${item.id}: ${errorMsg}`);
      }
    }

    progressWindow.changeLine({
      progress: ((i + 1) / itemsToExtract.length) * 100,
      text: getString("extract-progress-current", {
        args: { current: i + 1, total: itemsToExtract.length },
      }),
    });
  }

  progressWindow.changeLine({
    text: getString("extract-feed-progress-complete", {
      args: { success: successCount, skipped: skippedCount, failed: failCount },
    }),
    type: successCount > 0 ? "success" : failCount > 0 ? "fail" : "default",
    progress: 100,
  });

  progressWindow.startCloseTimer(3000);
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
  onExtractAllFromFeed,
  onPrefsLoad,
};

// Feed Observer Module - Monitor feed updates and trigger auto extraction
import { ContentExtractor } from "./contentExtractor";
import { KeywordFilter } from "./keywordFilter";
import { getPref } from "../utils/prefs";
import { getString } from "../utils/locale";

export class FeedObserver {
  private notifierID: string | null = null;
  private processingQueue: Map<number, NodeJS.Timeout> = new Map();

  /**
   * Register the feed observer
   */
  register(): void {
    // Register Zotero notifier for feed item updates
    this.notifierID = Zotero.Notifier.registerObserver(
      {
        notify: async (
          event: string,
          type: string,
          ids: string[] | number[],
          extraData: any
        ) => {
          if (event === "add" && type === "item") {
            await this.handleNewItems(ids as number[]);
          }
        },
      },
      ["item"]
    );

    ztoolkit.log("Feed observer registered");
  }

  /**
   * Unregister the feed observer
   */
  unregister(): void {
    if (this.notifierID) {
      Zotero.Notifier.unregisterObserver(this.notifierID);
      this.notifierID = null;
    }

    // Clear all pending timers
    for (const timer of this.processingQueue.values()) {
      clearTimeout(timer);
    }
    this.processingQueue.clear();

    ztoolkit.log("Feed observer unregistered");
  }

  /**
   * Handle new feed items
   */
  private async handleNewItems(itemIDs: number[]): Promise<void> {
    // Check if auto-extract is enabled
    const autoExtract = getPref("autoExtract") as boolean;
    if (!autoExtract) {
      return;
    }

    const items = await Zotero.Items.getAsync(itemIDs);
    const feedItems = items.filter((item) => item.isFeedItem);

    if (feedItems.length === 0) {
      return;
    }

    ztoolkit.log(`Detected ${feedItems.length} new feed item(s)`);

    // Get settings
    const batchInterval = (getPref("batchExtractInterval") as number) || 1000;
    const enableKeywordFilter = getPref("enableKeywordFilter") as boolean;
    const keywordFilterRules = (getPref("keywordFilterRules") as string) || "";

    // Filter items by keywords if enabled
    let itemsToExtract = feedItems;
    if (enableKeywordFilter && keywordFilterRules) {
      itemsToExtract = feedItems.filter((item) =>
        KeywordFilter.shouldExtractItem(item, keywordFilterRules)
      );
      ztoolkit.log(
        `Filtered: ${itemsToExtract.length}/${feedItems.length} items match keyword rules`
      );
    }

    if (itemsToExtract.length === 0) {
      ztoolkit.log("No items to extract after filtering");
      return;
    }

    // Queue items for extraction with interval
    for (let i = 0; i < itemsToExtract.length; i++) {
      const item = itemsToExtract[i];
      const delay = i * batchInterval;

      const timer = setTimeout(async () => {
        try {
          ztoolkit.log(
            `Auto-extracting item ${i + 1}/${
              itemsToExtract.length
            }: ${item.getField("title")}`
          );
          const extractor = new ContentExtractor();
          await extractor.extractAndSave(item);
          ztoolkit.log(`Successfully auto-extracted item: ${item.id}`);
        } catch (e) {
          ztoolkit.log(
            `Failed to auto-extract item ${item.id}: ${(e as Error).message}`
          );
        } finally {
          this.processingQueue.delete(item.id);
        }
      }, delay);

      this.processingQueue.set(item.id, timer);
    }

    // Show notification
    if (itemsToExtract.length > 0) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName, {
        closeTime: 2000,
      })
        .createLine({
          text: getString("auto-extract-queued", {
            args: { count: itemsToExtract.length },
          }),
          type: "default",
        })
        .show();
    }
  }
}

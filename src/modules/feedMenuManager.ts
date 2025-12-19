// Feed Menu Manager Module
import { getString } from "../utils/locale";

export class FeedMenuManager {
  /**
   * Register context menu for feed items
   */
  register(): void {
    try {
      // Register menu for feed items
      ztoolkit.Menu.register("item", {
        tag: "menuitem",
        id: "zotero-itemmenu-betterrss-extract",
        label: getString("menuitem-extract-label"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
        commandListener: (ev) => addon.hooks.onExtractContent(),
        getVisibility: (elem, ev) => {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          return (
            items && items.length > 0 && items.some((item) => item.isFeedItem)
          );
        },
      });

      // Register menu for feeds (on feed itself)
      ztoolkit.Menu.register("collection", {
        tag: "menuitem",
        id: "zotero-collectionmenu-betterrss-extract-all",
        label: getString("menuitem-extract-all-label"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
        commandListener: (ev) => addon.hooks.onExtractAllFromFeed(),
        getVisibility: (elem, ev) => {
          const collection =
            Zotero.getActiveZoteroPane().getSelectedCollection();
          if (!collection) return true;
        },
      });

      ztoolkit.log("Feed menu registered successfully");
    } catch (e) {
      ztoolkit.log(`Failed to register menu: ${(e as Error).message}`);
    }
  }
}

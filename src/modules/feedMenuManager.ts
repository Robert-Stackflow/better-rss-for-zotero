// Feed Menu Manager Module
import { getString } from "../utils/locale";

export class FeedMenuManager {
  /**
   * Register context menu for feed items
   */
  register(): void {
    try {
      // Register using ztoolkit Menu helper
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

      ztoolkit.log("Feed menu registered successfully");
    } catch (e) {
      ztoolkit.log(`Failed to register menu: ${(e as Error).message}`);
    }
  }
}

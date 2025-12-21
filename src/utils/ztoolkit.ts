import { ZoteroToolkit } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

function createZToolkit() {
  const _ztoolkit = new ZoteroToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: ReturnType<typeof createZToolkit>) {
  const env = __env__;
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = env === "production";
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = __env__ === "development";
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = __env__ === "development";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
  // Use default Zotero icon
  _ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.png`
  );
}

export function selected(): {
  library?: Zotero.Group | null;
  collection?: Zotero.Collection | null;
  feed?: Zotero.Feed | null;
  isFeed?: boolean | null;
  isCollection?: boolean | null;
} {
  const zp = Zotero.getActiveZoteroPane();
  const cv = zp?.collectionsView;
  if (!cv) return {};

  return {
    library: cv.selectedTreeRow?.isLibrary(true)
      ? (Zotero.Libraries.get(
          zp.getSelectedLibraryID()
        ) as unknown as Zotero.Group) || null
      : null,
    collection:
      cv.selection?.count && cv.selectedTreeRow?.isCollection()
        ? zp.getSelectedCollection()
        : null,
    feed:
      cv.selection?.count && cv.selectedTreeRow?.isFeed()
        ? cv.selectedTreeRow?.ref
        : null,
    isFeed: cv.selectedTreeRow?.isFeed() || null,
    isCollection: cv.selectedTreeRow?.isCollection() || null,
  };
}

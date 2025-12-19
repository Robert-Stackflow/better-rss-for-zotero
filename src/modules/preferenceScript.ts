import { config, homepage } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref, hasPref } from "../utils/prefs";

const DEFAULT_PREFS: Record<string, any> = {
  autoExtract: true,
  saveToFolder: true,
  saveFolderPathTemplate: "Feeds/%feedName%",
  saveNote: true,
  saveSnapshot: true,
  addBetterRSSTag: true,
  addFeedNameTag: true,
};

export function getSettings(): {
  autoExtract: boolean;
  saveToFolder: boolean;
  saveFolderPathTemplate: string;
  saveNote: boolean;
  saveSnapshot: boolean;
  addBetterRSSTag: boolean;
  addFeedNameTag: boolean;
} {
  const autoExtract = getPref("autoExtract") as boolean;
  const saveToFolder = getPref("saveToFolder") as boolean;
  const saveFolderPathTemplate = getPref("saveFolderPathTemplate") as string;
  const saveNote = getPref("saveNote") as boolean;
  const saveSnapshot = getPref("saveSnapshot") as boolean;
  const addBetterRSSTag = getPref("addBetterRSSTag") as boolean;
  const addFeedNameTag = getPref("addFeedNameTag") as boolean;

  ztoolkit.log(
    `\nautoExtract: ${autoExtract} \n` +
      `saveToFolder: ${saveToFolder} \n` +
      `saveFolderPathTemplate: ${saveFolderPathTemplate} \n` +
      `saveNote: ${saveNote} \n` +
      `saveSnapshot: ${saveSnapshot} \n` +
      `addBetterRSSTag: ${addBetterRSSTag} \n` +
      `addFeedNameTag: ${addFeedNameTag}`
  );

  return {
    autoExtract,
    saveToFolder,
    saveFolderPathTemplate,
    saveNote,
    saveSnapshot,
    addBetterRSSTag,
    addFeedNameTag,
  };
}

export function initPreference() {
  Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${config.addonRef}/content/icons/favicon.png`,
    helpURL: homepage,
  });
}

export function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  addon.data.prefs.window = _window;
  bindPrefEvents();
  updatePrefsPaneUI();
}

function bindPrefEvents() {
  const doc = addon.data.prefs.window?.document;
  if (!doc) {
    return;
  }

  // Auto extract checkbox
  doc
    .querySelector(`#${makeId("auto-extract")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleAutoExtract");
    });

  // Save to folder checkbox
  doc
    .querySelector(`#${makeId("save-to-folder")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleSaveToFolder");
    });

  // Folder path template input
  doc
    .querySelector(`#${makeId("folder-path-template")}`)
    ?.addEventListener("input", (e: Event) => {
      onPrefsEvent("updateFolderPathTemplate");
    });

  // Save note checkbox
  doc
    .querySelector(`#${makeId("save-note")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleSaveNote");
    });

  // Save snapshot checkbox
  doc
    .querySelector(`#${makeId("save-snapshot")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleSaveSnapshot");
    });

  // Add Better RSS tag checkbox
  doc
    .querySelector(`#${makeId("add-better-rss-tag")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleBetterRSSTag");
    });

  // Add feed name tag checkbox
  doc
    .querySelector(`#${makeId("add-feed-name-tag")}`)
    ?.addEventListener("command", (e: Event) => {
      onPrefsEvent("toggleFeedNameTag");
    });

  ztoolkit.log("Preference event listeners bound");
}

function updatePrefsPaneUI() {
  for (const [key, defaultValue] of Object.entries(DEFAULT_PREFS)) {
    if (!hasPref(key)) {
      setPref(key, defaultValue);
      ztoolkit.log(
        `Preference ${key} not found. Setting default: ${defaultValue}`
      );
    } else {
      ztoolkit.log(`Preference ${key} exists. Current value: ${getPref(key)}`);
      setPref(key, getPref(key));
    }
  }
}

function onPrefsEvent(type: string, fromElement: boolean = true) {
  const doc = addon.data.prefs.window?.document;
  if (!doc) {
    return;
  }

  const setDisabled = (id: string, disabled: boolean) => {
    const elem = doc.querySelector(`#${makeId(id)}`) as XUL.Element & {
      disabled: boolean;
    };
    if (elem) {
      elem.disabled = disabled;
    }
  };

  switch (type) {
    case "toggleAutoExtract":
      {
        const autoExtract = getPref("autoExtract") as boolean;
        ztoolkit.log(`Auto extract toggled: ${autoExtract}`);
        setPref("autoExtract", autoExtract);
      }
      break;

    case "toggleSaveToFolder":
      {
        const saveToFolder = getPref("saveToFolder") as boolean;
        setDisabled("folder-path-template", !saveToFolder);
        ztoolkit.log(`Save to folder toggled: ${saveToFolder}`);
        setPref("saveToFolder", saveToFolder);
      }
      break;

    case "updateFolderPathTemplate":
      {
        const template = getPref("saveFolderPathTemplate") as string;
        ztoolkit.log(`Folder path template updated: ${template}`);
        setPref("saveFolderPathTemplate", template);
      }
      break;

    case "toggleSaveNote":
      {
        const saveNote = getPref("saveNote") as boolean;
        ztoolkit.log(`Note saving toggled: ${saveNote}`);
        setPref("saveNote", saveNote);
      }
      break;

    case "toggleSaveSnapshot":
      {
        const saveSnapshot = getPref("saveSnapshot") as boolean;
        ztoolkit.log(`Snapshot saving toggled: ${saveSnapshot}`);
        setPref("saveSnapshot", saveSnapshot);
      }
      break;

    case "toggleBetterRSSTag":
      {
        const addBetterRSSTag = getPref("addBetterRSSTag") as boolean;
        ztoolkit.log(`Better RSS tag toggled: ${addBetterRSSTag}`);
        setPref("addBetterRSSTag", addBetterRSSTag);
      }
      break;

    case "toggleFeedNameTag":
      {
        const addFeedNameTag = getPref("addFeedNameTag") as boolean;
        ztoolkit.log(`Feed name tag toggled: ${addFeedNameTag}`);
        setPref("addFeedNameTag", addFeedNameTag);
      }
      break;

    default:
      break;
  }
}

function makeId(type: string): string {
  return `${config.addonRef}-${type}`;
}

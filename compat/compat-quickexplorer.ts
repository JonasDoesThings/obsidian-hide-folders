import {DocumentSelectorCompatLayer} from "./compatlayer";
import {getFolderNameWithoutPrefix, HideFoldersPluginSettings} from "../main";

/**
 * Compatibility for https://github.com/pjeby/quick-explorer/
 */
export const CompatQuickExplorer: DocumentSelectorCompatLayer = {
  getAdditionalDocumentSelectorStringForFolder: function (folderName: string, pluginSettings: HideFoldersPluginSettings): string {
    if(folderName.toLowerCase().startsWith("endswith::")) {
      return `.is-qe-folder[data-file-path$="${getFolderNameWithoutPrefix(folderName)}"${pluginSettings.matchCaseInsensitive ? " i" : ""}]`;
    } else if(folderName.toLowerCase().startsWith("startswith::")) {
      return `.is-qe-folder[data-file-path^="${getFolderNameWithoutPrefix(folderName)}"${pluginSettings.matchCaseInsensitive ? " i" : ""}], .is-qe-folder[data-file-path*="/${getFolderNameWithoutPrefix(folderName)}"${pluginSettings.matchCaseInsensitive ? " i" : ""}]`;
    } else {
      return `.is-qe-folder[data-file-path$="/${folderName.trim()}"${pluginSettings.matchCaseInsensitive ? " i" : ""}], .is-qe-folder[data-file-path="${folderName.trim()}"${pluginSettings.matchCaseInsensitive ? " i" : ""}]`;
    }
  },

  shouldMutationRecordTriggerFolderReProcessing: (record) => {
    for (const addedNode of record.addedNodes) {
      // @ts-ignore
      if (!addedNode.tagName) continue; // not an element
      // @ts-ignore
      if(addedNode.classList.contains("qe-popup-menu")) {
        // only changing the position of the most top-level menu is enough
        const firstQePopUpMenu = document.getElementsByClassName("qe-popup-menu")[0] as HTMLElement;

        if(!firstQePopUpMenu) return true;
        firstQePopUpMenu.style.top = "";
        firstQePopUpMenu.style.bottom = "1.7rem";

        return true;
      }
    }

    if(record.target?.parentElement?.classList.contains("is-qe-folder")) {
      return true;
    }

    return false;
  },
};

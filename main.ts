import {App, Plugin, PluginSettingTab, setIcon, Setting, TFile, TFolder, debounce} from "obsidian";
import {CompatQuickExplorer} from "./compat/compat-quickexplorer";

export interface HideFoldersPluginSettings {
  areFoldersHidden: boolean;
  matchCaseInsensitive: boolean;
  addHiddenFoldersToObsidianIgnoreList: boolean;
  hideBottomStatusBarIndicatorText: boolean;
  hideEmptyFolders: boolean;
  enableCompatQuickExplorer: boolean;
  attachmentFolderNames: string[];
}

const DEFAULT_SETTINGS: HideFoldersPluginSettings = {
  areFoldersHidden: true,
  matchCaseInsensitive: true,
  addHiddenFoldersToObsidianIgnoreList: false,
  hideBottomStatusBarIndicatorText: false,
  hideEmptyFolders: false,
  enableCompatQuickExplorer: false,
  attachmentFolderNames: ["attachments"],
};

export default class HideFoldersPlugin extends Plugin {
  settings: HideFoldersPluginSettings;
  ribbonIconButton: HTMLElement;
  statusBarItem?: HTMLElement;
  mutationObserver: MutationObserver;
  recentlyEmptiedFolders: Map<string, number> = new Map();
  skipGracePeriod = false;

  private processFolders = debounce(async (recheckPreviouslyHiddenFolders?: boolean) => {
    if(this.settings.attachmentFolderNames.length === 0 && !this.settings.hideEmptyFolders) return;

    if(recheckPreviouslyHiddenFolders) {
      document.querySelectorAll<HTMLElement>(".obsidian-hide-folders--hidden, .obsidian-hide-folders--empty-hidden").forEach((folder) => {
        folder.style.height = "";
        folder.style.overflow = "";
        folder.style.display = "";
        folder.removeClass("obsidian-hide-folders--hidden");
        folder.removeClass("obsidian-hide-folders--empty-hidden");
      });
    }

    this.settings.attachmentFolderNames.forEach(folderName => {
      if(getFolderNameWithoutPrefix(folderName) === "") return;

      const folderElements = document.querySelectorAll<HTMLElement>([
        this.getQuerySelectorStringForFolderName(folderName),
        this.settings.enableCompatQuickExplorer ? CompatQuickExplorer.getAdditionalDocumentSelectorStringForFolder?.(folderName, this.settings) : null,
      ].filter((o) => o != null).join(", "));

      folderElements.forEach((folder) => {
        if (!folder) {
          return;
        }

        folder.addClass("obsidian-hide-folders--hidden");
        folder.style.height = this.settings.areFoldersHidden ? "0" : "";
        folder.style.display = this.settings.areFoldersHidden ? "none" : "";
        folder.style.overflow = this.settings.areFoldersHidden ? "hidden" : "";
      });
    });

    // Hide empty folders
    if (this.settings.hideEmptyFolders) {
      document.querySelectorAll<HTMLElement>(".nav-folder-title[data-path]").forEach((titleEl) => {
        const folderEl = titleEl.parentElement;
        if (!folderEl) return;

        // Skip folders already handled by the explicit hide list
        if (folderEl.hasClass("obsidian-hide-folders--hidden")) return;

        const folderPath = titleEl.getAttribute("data-path");
        if (!folderPath) return;

        // Skip folders currently being renamed
        if (folderEl.querySelector("input, .nav-folder-title-content[contenteditable]")) return;

        if (this.isFolderEmpty(folderPath)) {
          // Only apply grace period when actively hiding and not explicitly toggled
          if (this.settings.areFoldersHidden && !this.skipGracePeriod) {
            // Start a grace period before hiding, so the user has time to add files
            if (!this.recentlyEmptiedFolders.has(folderPath)) {
              this.recentlyEmptiedFolders.set(folderPath, Date.now());
              window.setTimeout(() => {
                this.processFolders();
              }, 10000);
              return;
            }
            // Still within grace period, skip hiding
            if (Date.now() - this.recentlyEmptiedFolders.get(folderPath)! < 10000) return;
            this.recentlyEmptiedFolders.delete(folderPath);
          }

          folderEl.addClass("obsidian-hide-folders--empty-hidden");
          folderEl.style.height = this.settings.areFoldersHidden ? "0" : "";
          folderEl.style.display = this.settings.areFoldersHidden ? "none" : "";
          folderEl.style.overflow = this.settings.areFoldersHidden ? "hidden" : "";
        } else {
          // Folder is no longer empty, clear grace period and make sure it's visible
          this.recentlyEmptiedFolders.delete(folderPath);
          if (folderEl.hasClass("obsidian-hide-folders--empty-hidden")) {
            folderEl.style.height = "";
            folderEl.style.display = "";
            folderEl.style.overflow = "";
            folderEl.removeClass("obsidian-hide-folders--empty-hidden");
          }
        }
      });
    }
    this.skipGracePeriod = false;
  }, 10, false);

  getQuerySelectorStringForFolderName(folderName: string) {
    if(folderName.toLowerCase().startsWith("endswith::")) {
      return `*:has(> [data-path$="${getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    } else if(folderName.toLowerCase().startsWith("startswith::")) {
      return `*:has(> .nav-folder-title[data-path^="${getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}]), *:has(> .nav-folder-title[data-path*="/${getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    } else {
      return `*:has(> [data-path$="/${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}]), *:has(> [data-path="${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    }
  }

  isFolderEmpty(folderPath: string): boolean {
    const abstractFile = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(abstractFile instanceof TFolder)) return false;

    for (const child of abstractFile.children) {
      if (child instanceof TFile) return false;
      if (child instanceof TFolder && !this.isFolderEmpty(child.path)) return false;
    }

    return true;
  }

  async toggleFunctionality() {
    this.settings.areFoldersHidden = !this.settings.areFoldersHidden;
    this.recentlyEmptiedFolders.clear();
    this.skipGracePeriod = true;
    this.ribbonIconButton.ariaLabel = this.settings.areFoldersHidden ? "Show hidden folders" : "Hide hidden folders again";
    setIcon(this.ribbonIconButton, this.settings.areFoldersHidden ? "eye" : "eye-off");
    if(this.statusBarItem) {
      this.statusBarItem.innerHTML = this.settings.areFoldersHidden ? "Configured folders are hidden" : "";
    }
    await this.processFolders();
    await this.saveSettings();
    await this.updateObsidianIgnoreList();
  }

  createIgnoreListRegExpForFolderName(rawFolderName: string) {
    const folderName = this.settings.matchCaseInsensitive
      ? getFolderNameWithoutPrefix(rawFolderName).split("").map(c => c.toLowerCase() != c.toUpperCase() ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c).join("")
      : getFolderNameWithoutPrefix(rawFolderName);

    if(rawFolderName.toLowerCase().startsWith("endswith::")) {
      return `/(${folderName}$)|(${folderName}/)/`;
    } else if(rawFolderName.toLowerCase().startsWith("startswith::")) {
      return `/(^${folderName})|(/${folderName})/`;
    } else {
      return `/${folderName}/`;
    }
  }

  async updateObsidianIgnoreList(processFeatureDisabling?: boolean) {
    if(!this.settings.addHiddenFoldersToObsidianIgnoreList && !processFeatureDisabling) return;

    // @ts-ignore
    let ignoreList = (this.app.vault.getConfig("userIgnoreFilters") ?? []) as string[];

    if (this.settings.areFoldersHidden && !processFeatureDisabling) {
      this.settings.attachmentFolderNames.forEach(folderName => {
        if(getFolderNameWithoutPrefix(folderName).trim() === "") return;
        if(ignoreList.contains(this.createIgnoreListRegExpForFolderName(folderName))) return;
        ignoreList.push(this.createIgnoreListRegExpForFolderName(folderName));
      });
    } else {
      const folderNameRegexes = this.settings.attachmentFolderNames.map(folderName => this.createIgnoreListRegExpForFolderName(folderName));
      ignoreList = ignoreList.filter((s) => !folderNameRegexes.includes(s));
    }

    // @ts-ignore
    this.app.vault.setConfig("userIgnoreFilters", ignoreList);
  }

  async removeSpecificFoldersFromObsidianIgnoreList(folderNames: string[]) {
    folderNames.forEach(folderName => {
      // @ts-ignore
      this.app.vault.config.userIgnoreFilters?.remove(this.createIgnoreListRegExpForFolderName(folderName));
      this.app.vault.trigger("config-changed");
    });
  }

  createBottomStatusBarIndicatorTextItem() {
    if(this.statusBarItem) return; // prevent multiple instantiations

    // This adds a status bar item to the bottom of the app.
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText(this.settings.areFoldersHidden ? "Configured folders are hidden" : "");
  }

  async onload() {
    console.log("loading plugin hide-folders");

    await this.loadSettings();

    // This creates an icon in the left ribbon.
    this.ribbonIconButton = this.addRibbonIcon(this.settings.areFoldersHidden ? "eye" : "eye-off", this.settings.areFoldersHidden ? "Show hidden folders" : "Hide hidden folders again", (evt: MouseEvent) => {
      this.toggleFunctionality();
    });

    if(!this.settings.hideBottomStatusBarIndicatorText) {
      this.createBottomStatusBarIndicatorTextItem();
    }

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: "toggle-attachment-folders",
      name: "Toggle visibility of hidden folders",
      callback: () => {
        this.toggleFunctionality();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new HideFoldersPluginSettingTab(this.app, this));

    // used for re-processing folders when a folder is expanded in the file-navigator
    this.mutationObserver = new MutationObserver((mutationRecord) => {
      const feClasses = [
        "nav-folder",
        "nav-files-container",
      ];

      // check if any of the mutationRecords fulfills the conditions for us to call processFolders
      const shouldTriggerProcessFolders = mutationRecord.some((record) => {
        if(feClasses.some(c => record.target?.parentElement?.classList.contains(c))) return true;
        if(this.settings.enableCompatQuickExplorer && CompatQuickExplorer.shouldMutationRecordTriggerFolderReProcessing?.(record)) return true;

        return false;
      });

      if(!shouldTriggerProcessFolders) return;
      this.processFolders();
    });
    this.mutationObserver.observe(window.document, {childList: true, subtree: true});

    // used for re-processing folders when a folder is newly created, renamed, or files are added/removed
    this.registerEvent(this.app.vault.on("rename", () => {
      window.setTimeout(() => {
        this.processFolders();
      }, 10);
    }));

    this.registerEvent(this.app.vault.on("create", () => {
      window.setTimeout(() => {
        this.processFolders();
      }, 10);
    }));

    this.registerEvent(this.app.vault.on("delete", () => {
      window.setTimeout(() => {
        this.processFolders();
      }, 10);
    }));

    this.app.workspace.onLayoutReady(() => {
      if(!this.settings.areFoldersHidden) return;
      window.setTimeout(() => {
        this.processFolders();
      }, 1000);
    });
  }

  onunload() {
    this.mutationObserver.disconnect();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    await this.processFolders(true);
  }
}

class HideFoldersPluginSettingTab extends PluginSettingTab {
  plugin: HideFoldersPlugin;

  constructor(app: App, plugin: HideFoldersPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const {containerEl} = this;
    containerEl.empty();

    const experimentalSettingsContainerEl = document.createElement("details");
    const experimentalSettingsTitleEl = document.createElement("summary");
    experimentalSettingsTitleEl.innerText = "Experimental & Unstable Settings";
    experimentalSettingsContainerEl.appendChild(experimentalSettingsTitleEl);

    new Setting(containerEl)
      .setName("Folders to hide")
      .setDesc("The names of the folders to hide, one per line. Either exact folder-names, startsWith::FOLDERPREFIX, or endsWith::FOLDERSUFFIX")
      .addTextArea(text => text
        .setPlaceholder("attachments\nendsWith::_attachments")
        .setValue(this.plugin.settings.attachmentFolderNames.join("\n"))
        .onChange(async (value) => {
          const newSettingsValue = value.split("\n");
          // remove removed folders from exclude list too
          await this.plugin.removeSpecificFoldersFromObsidianIgnoreList(this.plugin.settings.attachmentFolderNames.filter(e => !newSettingsValue.includes(e)));
          this.plugin.settings.attachmentFolderNames = newSettingsValue;
          await this.plugin.saveSettings();
          await this.plugin.updateObsidianIgnoreList();
      }));

    new Setting(containerEl)
      .setName("Ignore Upper/lowercase")
      .setDesc("If enabled, 'SOMEFOLDER', 'someFolder', or 'sOmeFoldEr' will all be treated the same and matched.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.matchCaseInsensitive)
        .onChange(async (value) => {
          // remove all folders and re-add them later in the update function
          await this.plugin.removeSpecificFoldersFromObsidianIgnoreList(this.plugin.settings.attachmentFolderNames);
          this.plugin.settings.matchCaseInsensitive = value;
          await this.plugin.saveSettings();
          await this.plugin.updateObsidianIgnoreList();
      }));

    new Setting(containerEl)
      .setName("Hide folders")
      .setDesc("If the configured folders should be hidden or not")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.areFoldersHidden)
        .onChange(async (value) => {
          this.plugin.settings.areFoldersHidden = value;
          await this.plugin.saveSettings();
          await this.plugin.updateObsidianIgnoreList();
      }));

    new Setting(containerEl)
      .setName("Hide empty folders")
      .setDesc("Automatically hide folders that contain no files. They will reappear when files are added. Folders in the explicit hide list above are always hidden regardless.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.hideEmptyFolders)
        .onChange(async (value) => {
          this.plugin.settings.hideEmptyFolders = value;
          await this.plugin.saveSettings();
      }));

   new Setting(containerEl)
      .setName("Add Hidden Folders to Obsidian Exclusion-List")
      .setDesc("Excluded files will be hidden in Search, Graph View, and Unlinked Mentions, less noticeable in Quick Switcher and link suggestions.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.addHiddenFoldersToObsidianIgnoreList)
        .onChange(async (value) => {
          this.plugin.settings.addHiddenFoldersToObsidianIgnoreList = value;
          await this.plugin.saveSettings();
          await this.plugin.updateObsidianIgnoreList(!value);
      }));

   new Setting(containerEl)
      .setName("Hide bottom status-bar \"Folders are Hidden\" indicator")
      .setDesc("If enable there will be no bottom-bar indicator-text telling you if this plugin is active.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.hideBottomStatusBarIndicatorText)
        .onChange(async (value) => {
          this.plugin.settings.hideBottomStatusBarIndicatorText = value;
          if(value) {
            this.plugin.statusBarItem?.remove();
            this.plugin.statusBarItem = undefined;
          } else {
            this.plugin.createBottomStatusBarIndicatorTextItem();
          }
          await this.plugin.saveSettings();
      }));

    new Setting(experimentalSettingsContainerEl)
      .setName("[EXPERIMENTAL] Compatibility: quick-explorer by pjeby")
      .setDesc("[WARNING: UNSTABLE] Also hide hidden folders in the https://github.com/pjeby/quick-explorer plugin. Not affiliated with quick-explorer's author.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableCompatQuickExplorer)
        .onChange(async (value) => {
          this.plugin.settings.enableCompatQuickExplorer = value;
          await this.plugin.saveSettings();
        }));

    containerEl.appendChild(document.createElement("br"));

    new Setting(containerEl)
      .setName("GitHub (Fork)")
      .setDesc("This is a fork of JonasDoesThings/obsidian-hide-folders. Report issues for this fork here:")
      .addButton(button =>  button
        .buttonEl.innerHTML = '<a href="https://github.com/titandrive/obsidian-hide-folders" target="_blank">titandrive/obsidian-hide-folders</a>'
      );

    new Setting(containerEl)
      .setName("Original Plugin")
      .setDesc("The original plugin by JonasDoesThings:")
      .addButton(button =>  button
        .buttonEl.innerHTML = '<a href="https://github.com/JonasDoesThings/obsidian-hide-folders" target="_blank">JonasDoesThings/obsidian-hide-folders</a>'
      );

    containerEl.appendChild(document.createElement("br"));
    containerEl.appendChild(experimentalSettingsContainerEl);
  }
}

export function getFolderNameWithoutPrefix(folderName: string) {
  if (folderName.toLowerCase().startsWith("endswith::")) {
    return folderName.substring("endsWith::".length).trim();
  } else if (folderName.toLowerCase().startsWith("startswith::")) {
    return folderName.substring("startsWith::".length).trim();
  } else {
    return folderName;
  }
}

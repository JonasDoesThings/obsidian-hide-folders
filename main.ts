import {App, Plugin, PluginSettingTab, setIcon, Setting} from "obsidian";

interface HideFoldersPluginSettings {
  areFoldersHidden: boolean;
  matchCaseInsensitive: boolean;
  addHiddenFoldersToObsidianIgnoreList: boolean;
  attachmentFolderNames: string[];
}

const DEFAULT_SETTINGS: HideFoldersPluginSettings = {
  areFoldersHidden: true,
  matchCaseInsensitive: true,
  addHiddenFoldersToObsidianIgnoreList: false,
  attachmentFolderNames: ["attachments"],
};

export default class HideFoldersPlugin extends Plugin {
  settings: HideFoldersPluginSettings;
  ribbonIconButton: HTMLElement;
  statusBarItem: HTMLElement;
  mutationObserver: MutationObserver;

  async processFolders(recheckPreviouslyHiddenFolders?: boolean) {
    if(this.settings.attachmentFolderNames.length === 0) return;

    if(recheckPreviouslyHiddenFolders) {
      document.querySelectorAll<HTMLElement>(".obsidian-hide-folders--hidden").forEach((folder) => {
        folder.style.height = "";
        folder.style.overflow = "";
        folder.removeClass("obsidian-hide-folders--hidden");
      });
    }

    this.settings.attachmentFolderNames.forEach(folderName => {
      if(this.getFolderNameWithoutPrefix(folderName) === "") return;

      const folderElements = document.querySelectorAll<HTMLElement>([
        this.getQuerySelectorStringForFolderName(folderName),
      ].filter((o) => o != null).join(", "));

      folderElements.forEach((folder) => {
        if (!folder) {
          return;
        }

        folder.addClass("obsidian-hide-folders--hidden");
        folder.style.height = this.settings.areFoldersHidden ? "0" : "";
        folder.style.overflow = this.settings.areFoldersHidden ? "hidden" : "";
      });
    });
  }

  getFolderNameWithoutPrefix(folderName: string) {
    if (folderName.toLowerCase().startsWith("endswith::")) {
      return folderName.substring("endsWith::".length).trim();
    } else if (folderName.toLowerCase().startsWith("startswith::")) {
      return folderName.substring("startsWith::".length).trim();
    } else {
      return folderName;
    }
  }

  getQuerySelectorStringForFolderName(folderName: string) {
    if(folderName.toLowerCase().startsWith("endswith::")) {
      return `*:has(> [data-path$="${this.getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    } else if(folderName.toLowerCase().startsWith("startswith::")) {
      return `*:has(> .nav-folder-title[data-path^="${this.getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}]), *:has(> .nav-folder-title[data-path*="/${this.getFolderNameWithoutPrefix(folderName)}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    } else {
      return `*:has(> [data-path$="/${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}]), *:has(> [data-path="${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}])`;
    }
  }

  async toggleFunctionality() {
    this.settings.areFoldersHidden = !this.settings.areFoldersHidden;
    this.ribbonIconButton.ariaLabel = this.settings.areFoldersHidden ? "Show hidden folders" : "Hide hidden folders again";
    setIcon(this.ribbonIconButton, this.settings.areFoldersHidden ? "eye" : "eye-off");
    this.statusBarItem.innerHTML = this.settings.areFoldersHidden ? "Configured folders are hidden" : "";
    await this.processFolders();
    await this.saveSettings();
    await this.updateObsidianIgnoreList();
  }

  createIgnoreListRegExpForFolderName(rawFolderName: string) {
    const folderName = this.settings.matchCaseInsensitive
      ? this.getFolderNameWithoutPrefix(rawFolderName).split("").map(c => c.toLowerCase() != c.toUpperCase() ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c).join("")
      : this.getFolderNameWithoutPrefix(rawFolderName);

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

  async onload() {
    console.log("loading plugin hide-folders");

    await this.loadSettings();

    // This creates an icon in the left ribbon.
    this.ribbonIconButton = this.addRibbonIcon(this.settings.areFoldersHidden ? "eye" : "eye-off", this.settings.areFoldersHidden ? "Show hidden folders" : "Hide hidden folders again", (evt: MouseEvent) => {
      this.toggleFunctionality();
    });

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText(this.settings.areFoldersHidden ? "Attachment folders are hidden" : "");

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
      mutationRecord.forEach(record => {
        if(record.target?.parentElement?.classList.contains("nav-folder")) {
          this.processFolders();
        }
      });
    });
    this.mutationObserver.observe(window.document, {childList: true, subtree: true});

    // used for re-processing folders when a folder is newly created or renamed
    this.registerEvent(this.app.vault.on("rename", () => {
      // small delay is needed, otherwise the new folder won't get picked-up yet when calling processFolders
      window.setTimeout(() => {
        this.processFolders();
      }, 10);
    }));
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
      .setName("GitHub")
      .setDesc("Report Issues or Ideas, see the Source Code and Contribute.")
      .addButton(button =>  button
        .buttonEl.innerHTML = '<a href="https://github.com/JonasDoesThings/obsidian-hide-folders" target="_blank">obsidian-hide-folders</a>'
      );

    new Setting(containerEl)
      .setName("Donate")
      .setDesc("If you like this open-source plugin, consider a small tip to support my unpaid work.")
      .addButton((button) => button
        .buttonEl.outerHTML = "<a href='https://www.buymeacoffee.com/jonasdoesthings' target='_blank'><img src='https://cdn.buymeacoffee.com/buttons/default-orange.png' alt='Buy Me A Coffee' height='27' width='116'></a>"
      );
  }
}

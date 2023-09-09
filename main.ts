import {App, Plugin, PluginSettingTab, setIcon, Setting} from "obsidian";

interface HideFoldersPluginSettings {
  areFoldersHidden: boolean;
  matchCaseInsensitive: boolean;
  attachmentFolderNames: string[];
}

const DEFAULT_SETTINGS: HideFoldersPluginSettings = {
  areFoldersHidden: true,
  matchCaseInsensitive: true,
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
      document.querySelectorAll(".obsidian-hide-folders--hidden").forEach((folder) => {
        folder.parentElement!.style.display = "";
        folder.removeClass("obsidian-hide-folders--hidden");
      })
    }

    this.settings.attachmentFolderNames.forEach(folderName => {
      if(folderName.trim() === "") return;

      const folderElements = document.querySelectorAll(this.getQuerySelectorStringForFolderName(folderName));

      folderElements.forEach((folder) => {
        if (!folder || !folder.parentElement) {
          return;
        }

        folder.addClass("obsidian-hide-folders--hidden");
        folder.parentElement.style.display = this.settings.areFoldersHidden ? "none" : "";
      });
    });
  }

  getQuerySelectorStringForFolderName(folderName: string) {
    if(folderName.toLowerCase().startsWith("endswith::")) {
      return `[data-path$="${folderName.substring("endsWith::".length).trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}]`;
    } else {
      return `[data-path$="/${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}], [data-path="${folderName.trim()}"${this.settings.matchCaseInsensitive ? " i" : ""}]`;
    }
  }

  async toggleFunctionality() {
    this.settings.areFoldersHidden = !this.settings.areFoldersHidden;
    this.ribbonIconButton.ariaLabel = this.settings.areFoldersHidden ? "Show hidden folders" : "Hide hidden folders again";
    setIcon(this.ribbonIconButton, this.settings.areFoldersHidden ? "eye" : "eye-off");
    this.statusBarItem.innerHTML = this.settings.areFoldersHidden ? "Configured folders are hidden" : "";
    await this.processFolders();
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
    }))
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
      .setDesc("The names of the folders to hide, one per line. Either exact folder-names or endsWith::FOLDERSUFFIX")
      .addTextArea(text => text
        .setPlaceholder("attachments\nendsWith::_attachments")
        .setValue(this.plugin.settings.attachmentFolderNames.join("\n"))
        .onChange(async (value) => {
          this.plugin.settings.attachmentFolderNames = value.split("\n");
          await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Ignore Upper/lowercase")
      .setDesc("If enabled, 'SOMEFOLDER', 'someFolder', or 'sOmeFoldEr' will all be treated the same and matched.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.matchCaseInsensitive)
        .onChange(async (value) => {
          this.plugin.settings.matchCaseInsensitive = value;
          await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Hide folders")
      .setDesc("If the configured folders should be hidden or not")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.areFoldersHidden)
        .onChange(async (value) => {
          this.plugin.settings.areFoldersHidden = value;
          await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("GitHub")
      .setDesc("Report Issues or Ideas, see the Source Code and Contribute.")
      .addButton(button =>  button
        .buttonEl.innerHTML = '<a href="https://github.com/JonasDoesThings/obsidian-hide-folders" target="_blank">obsidian-hide-folders</a>'
      )
  }
}

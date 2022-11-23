import {App, Plugin, PluginSettingTab, setIcon, Setting} from "obsidian";

interface HideFoldersPluginSettings {
  areFoldersHidden: boolean;
  attachmentFolderNames: string[];
}

const DEFAULT_SETTINGS: HideFoldersPluginSettings = {
  areFoldersHidden: true,
  attachmentFolderNames: ["attachments"],
};

export default class HideFoldersPlugin extends Plugin {
  settings: HideFoldersPluginSettings;
  ribbonIconButton: HTMLElement;
  statusBarItem: HTMLElement;
  mutationObserver: MutationObserver;

  async processFolders() {
    this.settings.attachmentFolderNames.forEach(folderName => {
      const folderElements = document.querySelectorAll(`[data-path$="/${folderName.trim()}"]`);
      folderElements.forEach((folder) => {
        if (!folder || !folder.parentElement) {
          return;
        }

        folder.parentElement.style.display = this.settings.areFoldersHidden ? "none" : "";
      });
    });
  }

  async toggleFunctionality() {
    this.settings.areFoldersHidden = !this.settings.areFoldersHidden;
    this.ribbonIconButton.ariaLabel = this.settings.areFoldersHidden ? "Show Hidden Folders" : "Hide Hidden Folders Again";
    setIcon(this.ribbonIconButton, this.settings.areFoldersHidden ? "eye" : "eye-off");
    this.statusBarItem.innerHTML = this.settings.areFoldersHidden ? "Configured Folders are Hidden" : "";
    await this.processFolders();
  }

  async onload() {
    console.log("loading plugin obsidian-hide-folders");

    await this.loadSettings();

    // This creates an icon in the left ribbon.
    this.ribbonIconButton = this.addRibbonIcon(this.settings.areFoldersHidden ? "eye" : "eye-off", this.settings.areFoldersHidden ? "Show Hidden Folders" : "Hide Hidden Folders Again", (evt: MouseEvent) => {
      this.toggleFunctionality();
    });

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.setText(this.settings.areFoldersHidden ? "Attachment Folders are Hidden" : "");

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

    this.mutationObserver = new MutationObserver((mutationRecord) => {
      mutationRecord.forEach(record => {
        if(record.target?.parentElement?.classList.contains("nav-folder")) {
          this.processFolders();
        }
      });
    });
    this.mutationObserver.observe(window.document, {childList: true, subtree: true});

  }

  onunload() {
    this.mutationObserver.disconnect();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    containerEl.createEl("h2", {text: "Settings for obsidian-hide-folders."});

    new Setting(containerEl)
      .setName("Folders to Hide")
      .setDesc("The name of the folders to hide, seperated by new lines")
      .addTextArea(text => text
        .setPlaceholder("attachments")
        .setValue(this.plugin.settings.attachmentFolderNames.join("\n"))
        .onChange(async (value) => {
          this.plugin.settings.attachmentFolderNames = value.split("\n");
          await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("Hide Folders")
      .setDesc("If the configured folders should be hidden or not")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.areFoldersHidden)
        .onChange(async (value) => {
          this.plugin.settings.areFoldersHidden = value;
          await this.plugin.saveSettings();
      }));
  }
}

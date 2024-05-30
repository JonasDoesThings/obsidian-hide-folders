import {HideFoldersPluginSettings} from "../main";

export interface DocumentSelectorCompatLayer {
  getAdditionalDocumentSelectorStringForFolder?: (folderName: string, pluginSettings: HideFoldersPluginSettings) => string
  shouldMutationRecordTriggerFolderReProcessing?: (mutationRecord: MutationRecord) => boolean;
}

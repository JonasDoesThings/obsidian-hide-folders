# obsidian-hide-folders

A simple plugin for [obsidian.md](https://obsidian.md) that hides configured folders, with the ability to toggle their visibility.  
This can be used for hiding attachments folders when you don't need them.

## Configuration
Enter the list of folder names to hide in the settings menu, **one folder per line**.

![Screenshot of the Plugin Settings Screen in Obsidian.md](./docs/assets/settings-screenshot.png)  

You can then also use a sidebar button to quickly toggle the visibility without having to enter the settings menu:  
![Screenshot of the Plugin's Sidebar Button in Obsidian.md](docs/assets/sidebar-screenshot.png)

Using the command palette is also supported:
![Screenshot of the Plugin's Command Palette Action in Obsidian..md](docs/assets/command-palette-screenshot.png)

## Development
### Setup
- Clone this repo.
- `npm i` or `yarn` to install dependencies
- `npm run dev` to start compilation in watch mode.

### Building
- `npm run build` to do a one-off build of the project, which produces the files needed for manually installing the plugin.

### Manually installing the plugin
- Copy over the outputted `main.js`, `manifest.json` from the `dist/` folder to your vault `VaultFolder/.obsidian/plugins/obsidian-hide-folders/`.  
-> Watch Out! You cannot copy-over the raw *main.**ts***. You need to run a build first and then copy over the produced *main.**js***.

## License
MIT License, see [LICENSE.md](./LICENSE.md)

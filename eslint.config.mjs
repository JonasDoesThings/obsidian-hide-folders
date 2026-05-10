import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"eslint.config.js",
						"manifest.json",
					],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
    rules: {
      "semi": [
        "error",
        "always",
      ],
      "comma-dangle": [
        "error",
        "always-multiline",
      ],
      "quotes": [
        "error",
        "double",
        {"avoidEscape": true},
      ],
    },
	},
	...obsidianmd.configs.recommended,
	globalIgnores([
		"node_modules",
		"dist",
		"build",
		"fixtures",
		//"esbuild.config.mjs",
    //"eslint.config.js",
    //"version-bump.mjs",
    //"versions.json",
    "main.js",
	]),
);

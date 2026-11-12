import { reactLibraryConfig } from "@rsos/config/eslint/next";

const config = [{ ignores: ["!.storybook"] }, ...reactLibraryConfig];

export default config;

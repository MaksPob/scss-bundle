import * as Contracts from "./contracts";
export declare class Launcher {
    private config;
    constructor(config: Contracts.Config);
    Bundle(): Promise<void>;
    private renderScss;
    private tildeImporter;
    private getArchyData;
    /**
     * TODO: Rewrite this in major version.
     */
    private bundleResultForEach;
    private countSavedBytesByDeduping;
    private exitWithError;
}

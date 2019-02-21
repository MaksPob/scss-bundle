import * as yargs from "yargs";
export interface Config {
    Entry: string;
    Destination: string;
    Verbosity: Verbosity;
    ProjectDirectory?: string;
    DedupeGlobs?: string[];
    IncludePaths?: string[];
    IgnoredImports?: string[];
}
export declare enum Verbosity {
    None = 0,
    Errors = 8,
    Verbose = 256
}
export interface ArgumentsCli {
    config?: string;
    entry: string;
    dest: string;
    watch: string;
    verbosity: Verbosity;
    dedupe?: string[];
    includePaths?: string[];
    ignoredImports?: string[];
    project?: string;
}
export declare type ArgumentsValues = {
    [key in keyof yargs.Arguments<ArgumentsCli>]: yargs.Arguments<ArgumentsCli>[key];
};

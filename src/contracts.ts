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

export enum Verbosity {
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

export type ArgumentsValues = { [TKey in keyof yargs.Arguments<ArgumentsCli>]: yargs.Arguments<ArgumentsCli>[TKey] };

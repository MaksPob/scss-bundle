"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const globs = require("globs");
const Helpers = require("./helpers");
const IMPORT_PATTERN = /@import\s+['"](.+)['"];/g;
const COMMENT_PATTERN = /\/\/.*$/gm;
const MULTILINE_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const DEFAULT_FILE_EXTENSION = ".scss";
const ALLOWED_FILE_EXTENSIONS = [".scss", ".css"];
const NODE_MODULES = "node_modules";
const TILDE = "~";
class Bundler {
    constructor(fileRegistry = {}, projectDirectory) {
        this.fileRegistry = fileRegistry;
        this.projectDirectory = projectDirectory;
        // Full paths of used imports and their count
        this.usedImports = {};
        // Imports dictionary by file
        this.importsByFile = {};
    }
    BundleAll(files, dedupeGlobs = []) {
        return __awaiter(this, void 0, void 0, function* () {
            const resultsPromises = files.map((file) => __awaiter(this, void 0, void 0, function* () { return this.Bundle(file, dedupeGlobs); }));
            return Promise.all(resultsPromises);
        });
    }
    Bundle(file, dedupeGlobs = [], includePaths = [], ignoredImports = []) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.projectDirectory != null) {
                    file = path.resolve(this.projectDirectory, file);
                }
                yield fs.access(file);
                const contentPromise = fs.readFile(file, "utf-8");
                const dedupeFilesPromise = this.globFilesOrEmpty(dedupeGlobs);
                // Await all async operations and extract results
                const [content, dedupeFiles] = yield Promise.all([contentPromise, dedupeFilesPromise]);
                // Convert string array into regular expressions
                const ignoredImportsRegEx = ignoredImports.map(ignoredImport => new RegExp(ignoredImport));
                return this.bundle(file, content, dedupeFiles, includePaths, ignoredImportsRegEx);
            }
            catch (_a) {
                return {
                    filePath: file,
                    found: false
                };
            }
        });
    }
    isExtensionExists(importName) {
        return ALLOWED_FILE_EXTENSIONS.some((extension => importName.indexOf(extension) !== -1));
    }
    bundle(filePath, content, dedupeFiles, includePaths, ignoredImports) {
        return __awaiter(this, void 0, void 0, function* () {
            // Remove commented imports
            content = this.removeImportsFromComments(content);
            // Resolve path to work only with full paths
            filePath = path.resolve(filePath);
            const dirname = path.dirname(filePath);
            if (this.fileRegistry[filePath] == null) {
                this.fileRegistry[filePath] = content;
            }
            // Resolve imports file names (prepend underscore for partials)
            const importsPromises = Helpers.getAllMatches(content, IMPORT_PATTERN).map((match) => __awaiter(this, void 0, void 0, function* () {
                let importName = match[1];
                // Append extension if it's absent
                if (!this.isExtensionExists(importName)) {
                    importName += DEFAULT_FILE_EXTENSION;
                }
                // Determine if import should be ignored
                const ignored = ignoredImports.findIndex(ignoredImportRegex => ignoredImportRegex.test(importName)) !== -1;
                let fullPath;
                // Check for tilde import.
                const tilde = importName.startsWith(TILDE);
                if (tilde && this.projectDirectory != null) {
                    importName = `./${NODE_MODULES}/${importName.substr(TILDE.length, importName.length)}`;
                    fullPath = path.resolve(this.projectDirectory, importName);
                }
                else {
                    fullPath = path.resolve(dirname, importName);
                }
                const importData = {
                    importString: match[0],
                    tilde: tilde,
                    path: importName,
                    fullPath: fullPath,
                    found: false,
                    ignored: ignored
                };
                yield this.resolveImport(importData, includePaths);
                return importData;
            }));
            // Wait for all imports file names to be resolved
            const imports = yield Promise.all(importsPromises);
            const bundleResult = {
                filePath: filePath,
                found: true
            };
            const shouldCheckForDedupes = dedupeFiles != null && dedupeFiles.length > 0;
            // Bundle all imports
            const currentImports = [];
            for (const imp of imports) {
                let contentToReplace;
                let currentImport;
                // If neither import file, nor partial is found
                if (!imp.found) {
                    // Add empty bundle result with found: false
                    currentImport = {
                        filePath: imp.fullPath,
                        tilde: imp.tilde,
                        found: false,
                        ignored: imp.ignored
                    };
                }
                else if (this.fileRegistry[imp.fullPath] == null) {
                    // If file is not yet in the registry
                    // Read
                    const impContent = yield fs.readFile(imp.fullPath, "utf-8");
                    // and bundle it
                    const bundledImport = yield this.bundle(imp.fullPath, impContent, dedupeFiles, includePaths, ignoredImports);
                    // Then add its bundled content to the registry
                    this.fileRegistry[imp.fullPath] = bundledImport.bundledContent;
                    // Add it to used imports, if it's not there
                    if (this.usedImports != null && this.usedImports[imp.fullPath] == null) {
                        this.usedImports[imp.fullPath] = 1;
                    }
                    // And whole BundleResult to current imports
                    currentImport = bundledImport;
                }
                else {
                    // File is in the registry
                    // Increment it's usage count
                    if (this.usedImports != null) {
                        this.usedImports[imp.fullPath]++;
                    }
                    // Resolve child imports, if there are any
                    let childImports = [];
                    if (this.importsByFile != null) {
                        childImports = this.importsByFile[imp.fullPath];
                    }
                    // Construct and add result to current imports
                    currentImport = {
                        filePath: imp.fullPath,
                        tilde: imp.tilde,
                        found: true,
                        imports: childImports
                    };
                }
                if (imp.ignored) {
                    if (this.usedImports[imp.fullPath] > 1) {
                        contentToReplace = "";
                    }
                    else {
                        contentToReplace = imp.importString;
                    }
                }
                else {
                    // Take contentToReplace from the fileRegistry
                    contentToReplace = this.fileRegistry[imp.fullPath];
                    // If the content is not found
                    if (contentToReplace == null) {
                        // Indicate this with a comment for easier debugging
                        contentToReplace = `/*** IMPORTED FILE NOT FOUND ***/${os.EOL}${imp.importString}/*** --- ***/`;
                    }
                    // If usedImports dictionary is defined
                    if (shouldCheckForDedupes && this.usedImports != null) {
                        // And current import path should be deduped and is used already
                        const timesUsed = this.usedImports[imp.fullPath];
                        if (dedupeFiles.indexOf(imp.fullPath) !== -1 && timesUsed != null && timesUsed > 1) {
                            // Reset content to replace to an empty string to skip it
                            contentToReplace = "";
                            // And indicate that import was deduped
                            currentImport.deduped = true;
                        }
                    }
                }
                // Finally, replace import string with bundled content or a debug message
                content = this.replaceLastOccurance(content, imp.importString, contentToReplace);
                // And push current import into the list
                currentImports.push(currentImport);
            }
            // Set result properties
            bundleResult.bundledContent = content;
            bundleResult.imports = currentImports;
            if (this.importsByFile != null) {
                this.importsByFile[filePath] = currentImports;
            }
            return bundleResult;
        });
    }
    replaceLastOccurance(content, importString, contentToReplace) {
        const index = content.lastIndexOf(importString);
        return content.slice(0, index) + content.slice(index).replace(importString, contentToReplace);
    }
    removeImportsFromComments(text) {
        const patterns = [COMMENT_PATTERN, MULTILINE_COMMENT_PATTERN];
        for (const pattern of patterns) {
            text = text.replace(pattern, x => x.replace(IMPORT_PATTERN, ""));
        }
        return text;
    }
    resolveImport(importData, includePaths) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.access(importData.fullPath);
                importData.found = true;
            }
            catch (error) {
                const underscoredDirname = path.dirname(importData.fullPath);
                const underscoredBasename = path.basename(importData.fullPath);
                const underscoredFilePath = path.join(underscoredDirname, `_${underscoredBasename}`);
                try {
                    yield fs.access(underscoredFilePath);
                    importData.fullPath = underscoredFilePath;
                    importData.found = true;
                }
                catch (underscoreErr) {
                    // If there are any includePaths
                    if (includePaths.length) {
                        // Resolve fullPath using its first entry
                        importData.fullPath = path.resolve(includePaths[0], importData.path);
                        // Try resolving import with the remaining includePaths
                        const remainingIncludePaths = includePaths.slice(1);
                        return this.resolveImport(importData, remainingIncludePaths);
                    }
                }
            }
            return importData;
        });
    }
    globFilesOrEmpty(globsList) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (globsList == null || globsList.length === 0) {
                    resolve([]);
                    return;
                }
                globs(globsList, (err, files) => {
                    // Reject if there's an error
                    if (err) {
                        reject(err);
                    }
                    // Resolve full paths
                    const result = files.map(file => path.resolve(file));
                    // Resolve promise
                    resolve(result);
                });
            });
        });
    }
}
exports.Bundler = Bundler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9idW5kbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwrQkFBK0I7QUFDL0IseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QiwrQkFBK0I7QUFFL0IscUNBQXFDO0FBRXJDLE1BQU0sY0FBYyxHQUFHLDBCQUEwQixDQUFDO0FBQ2xELE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQztBQUNwQyxNQUFNLHlCQUF5QixHQUFHLG1CQUFtQixDQUFDO0FBQ3RELE1BQU0sc0JBQXNCLEdBQUcsT0FBTyxDQUFDO0FBQ3ZDLE1BQU0sdUJBQXVCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEQsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQ3BDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQztBQTJCbEIsTUFBYSxPQUFPO0lBTWhCLFlBQW9CLGVBQTZCLEVBQUUsRUFBbUIsZ0JBQXlCO1FBQTNFLGlCQUFZLEdBQVosWUFBWSxDQUFtQjtRQUFtQixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQVM7UUFML0YsNkNBQTZDO1FBQ3JDLGdCQUFXLEdBQThCLEVBQUUsQ0FBQztRQUNwRCw2QkFBNkI7UUFDckIsa0JBQWEsR0FBc0MsRUFBRSxDQUFDO0lBRXFDLENBQUM7SUFFdkYsU0FBUyxDQUFDLEtBQWUsRUFBRSxjQUF3QixFQUFFOztZQUM5RCxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQU0sSUFBSSxFQUFDLEVBQUUsZ0RBQUMsT0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztZQUNoRixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDeEMsQ0FBQztLQUFBO0lBRVksTUFBTSxDQUNmLElBQVksRUFDWixjQUF3QixFQUFFLEVB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QyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDckUsdURBQXVEO3dCQUN2RCxNQUFNLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3BELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUscUJBQXFCLENBQUMsQ0FBQztxQkFDaEU7aUJBQ0o7YUFDSjtZQUVELE9BQU8sVUFBVSxDQUFDO1FBQ3RCLENBQUM7S0FBQTtJQUVhLGdCQUFnQixDQUFDLFNBQW1COztZQUM5QyxPQUFPLElBQUksT0FBTyxDQUFXLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUM3QyxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQzdDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDWixPQUFPO2lCQUNWO2dCQUNELEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQyxHQUFVLEVBQUUsS0FBZSxFQUFFLEVBQUU7b0JBQzdDLDZCQUE2QjtvQkFDN0IsSUFBSSxHQUFHLEVBQUU7d0JBQ0wsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3FCQUNmO29CQUVELHFCQUFxQjtvQkFDckIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFFckQsa0JBQWtCO29CQUNsQixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3BCLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO0tBQUE7Q0FDSjtBQW5SRCwwQkFtUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnMtZXh0cmFcIjtcclxuaW1wb3J0ICogYXMgb3MgZnJvbSBcIm9zXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgZ2xvYnMgZnJvbSBcImdsb2JzXCI7XHJcblxyXG5pbXBvcnQgKiBhcyBIZWxwZXJzIGZyb20gXCIuL2hlbHBlcnNcIjtcclxuXHJcbmNvbnN0IElNUE9SVF9QQVRURVJOID0gL0BpbXBvcnRcXHMrWydcIl0oLispWydcIl07L2c7XHJcbmNvbnN0IENPTU1FTlRfUEFUVEVSTiA9IC9cXC9cXC8uKiQvZ207XHJcbmNvbnN0IE1VTFRJTElORV9DT01NRU5UX1BBVFRFUk4gPSAvXFwvXFwqW1xcc1xcU10qP1xcKlxcLy9nO1xyXG5jb25zdCBERUZBVUxUX0ZJTEVfRVhURU5TSU9OID0gXCIuc2Nzc1wiO1xyXG5jb25zdCBBTExPV0VEX0ZJTEVfRVhURU5TSU9OUyA9IFtcIi5zY3NzXCIsIFwiLmNzc1wiXTtcclxuY29uc3QgTk9ERV9NT0RVTEVTID0gXCJub2RlX21vZHVsZXNcIjtcclxuY29uc3QgVElMREUgPSBcIn5cIjtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVJlZ2lzdHJ5IHtcclxuICAgIFtpZDogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEltcG9ydERhdGEge1xyXG4gICAgaW1wb3J0U3RyaW5nOiBzdHJpbmc7XHJcbiAgICB0aWxkZTogYm9vbGVhbjtcclxuICAgIHBhdGg6IHN0cmluZztcclxuICAgIGZ1bGxQYXRoOiBzdHJpbmc7XHJcbiAgICBmb3VuZDogYm9vbGVhbjtcclxuICAgIGlnbm9yZWQ/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJ1bmRsZVJlc3VsdCB7XHJcbiAgICAvLyBDaGlsZCBpbXBvcnRzIChpZiBhbnkpXHJcbiAgICBpbXBvcnRzPzogQnVuZGxlUmVzdWx0W107XHJcbiAgICB0aWxkZT86IGJvb2xlYW47XHJcbiAgICBkZWR1cGVkPzogYm9vbGVhbjtcclxuICAgIC8vIEZ1bGwgcGF0aCBvZiB0aGUgZmlsZVxyXG4gICAgZmlsZVBhdGg6IHN0cmluZztcclxuICAgIGJ1bmRsZWRDb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZm91bmQ6IGJvb2xlYW47XHJcbiAgICBpZ25vcmVkPzogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEJ1bmRsZXIge1xyXG4gICAgLy8gRnVsbCBwYXRocyBvZiB1c2VkIGltcG9ydHMgYW5kIHRoZWlyIGNvdW50XHJcbiAgICBwcml2YXRlIHVzZWRJbXBvcnRzOiB7IFtrZXk6IHN0cmluZ106IG51bWJlciB9ID0ge307XHJcbiAgICAvLyBJbXBvcnRzIGRpY3Rpb25hcnkgYnkgZmlsZVxyXG4gICAgcHJpdmF0ZSBpbXBvcnRzQnlGaWxlOiB7IFtrZXk6IHN0cmluZ106IEJ1bmRsZVJlc3VsdFtdIH0gPSB7fTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIGZpbGVSZWdpc3RyeTogRmlsZVJlZ2lzdHJ5ID0ge30sIHByaXZhdGUgcmVhZG9ubHkgcHJvamVjdERpcmVjdG9yeT86IHN0cmluZykgeyB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIEJ1bmRsZUFsbChmaWxlczogc3RyaW5nW10sIGRlZHVwZUdsb2JzOiBzdHJpbmdbXSA9IFtdKTogUHJvbWlzZTxCdW5kbGVSZXN1bHRbXT4ge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdHNQcm9taXNlcyA9IGZpbGVzLm1hcChhc3luYyBmaWxlID0+IHRoaXMuQnVuZGxlKGZpbGUsIGRlZHVwZUdsb2JzKSk7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHJlc3VsdHNQcm9taXNlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIEJ1bmRsZShcclxuICAgICAgICBmaWxlOiBzdHJpbmcsXHJcbiAgICAgICAgZGVkdXBlR2xvYnM6IHN0cmluZ1tdID0gW10sXHJcbiAgICAgICAgaW5jbHVkZVBhdGhzOiBzdHJpbmdbXSA9IFtdLFxyXG4gICAgICAgIGlnbm9yZWRJbXBvcnRzOiBzdHJpbmdbXSA9IFtdXHJcbiAgICApOiBQcm9taXNlPEJ1bmRsZVJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb2plY3REaXJlY3RvcnkgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgZmlsZSA9IHBhdGgucmVzb2x2ZSh0aGlzLnByb2plY3REaXJlY3RvcnksIGZpbGUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBhd2FpdCBmcy5hY2Nlc3MoZmlsZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRQcm9taXNlID0gZnMucmVhZEZpbGUoZmlsZSwgXCJ1dGYtOFwiKTtcclxuICAgICAgICAgICAgY29uc3QgZGVkdXBlRmlsZXNQcm9taXNlID0gdGhpcy5nbG9iRmlsZXNPckVtcHR5KGRlZHVwZUdsb2JzKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEF3YWl0IGFsbCBhc3luYyBvcGVyYXRpb25zIGFuZCBleHRyYWN0IHJlc3VsdHNcclxuICAgICAgICAgICAgY29uc3QgW2NvbnRlbnQsIGRlZHVwZUZpbGVzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtjb250ZW50UHJvbWlzZSwgZGVkdXBlRmlsZXNQcm9taXNlXSk7XHJcblxyXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHN0cmluZyBhcnJheSBpbnRvIHJlZ3VsYXIgZXhwcmVzc2lvbnNcclxuICAgICAgICAgICAgY29uc3QgaWdub3JlZEltcG9ydHNSZWdFeCA9IGlnbm9yZWRJbXBvcnRzLm1hcChpZ25vcmVkSW1wb3J0ID0+IG5ldyBSZWdFeHAoaWdub3JlZEltcG9ydCkpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYnVuZGxlKGZpbGUsIGNvbnRlbnQsIGRlZHVwZUZpbGVzLCBpbmNsdWRlUGF0aHMsIGlnbm9yZWRJbXBvcnRzUmVnRXgpO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgZmlsZVBhdGg6IGZpbGUsXHJcbiAgICAgICAgICAgICAgICBmb3VuZDogZmFsc2VcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpc0V4dGVuc2lvbkV4aXN0cyhpbXBvcnROYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gQUxMT1dFRF9GSUxFX0VYVEVOU0lPTlMuc29tZSgoZXh0ZW5zaW9uID0+IGltcG9ydE5hbWUuaW5kZXhPZihleHRlbnNpb24pICE9PSAtMSkpO1xyXG4gICAgfVxyXG4gICAgcHJpdmF0ZSBhc3luYyBidW5kbGUoXHJcbiAgICAgICAgZmlsZVBhdGg6IHN0cmluZyxcclxuICAgICAgICBjb250ZW50OiBzdHJpbmcsXHJcbiAgICAgICAgZGVkdXBlRmlsZXM6IHN0cmluZ1tdLFxyXG4gICAgICAgIGluY2x1ZGVQYXRoczogc3RyaW5nW10sXHJcbiAgICAgICAgaWdub3JlZEltcG9ydHM6IFJlZ0V4cFtdXHJcbiAgICApOiBQcm9taXNlPEJ1bmRsZVJlc3VsdD4ge1xyXG4gICAgICAgIC8vIFJlbW92ZSBjb21tZW50ZWQgaW1wb3J0c1xyXG4gICAgICAgIGNvbnRlbnQgPSB0aGlzLnJlbW92ZUltcG9ydHNGcm9tQ29tbWVudHMoY29udGVudCk7XHJcblxyXG4gICAgICAgIC8vIFJlc29sdmUgcGF0aCB0byB3b3JrIG9ubHkgd2l0aCBmdWxsIHBhdGhzXHJcbiAgICAgICAgZmlsZVBhdGggPSBwYXRoLnJlc29sdmUoZmlsZVBhdGgpO1xyXG5cclxuICAgICAgICBjb25zdCBkaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVQYXRoKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZmlsZVJlZ2lzdHJ5W2ZpbGVQYXRoXSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZmlsZVJlZ2lzdHJ5W2ZpbGVQYXRoXSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBSZXNvbHZlIGltcG9ydHMgZmlsZSBuYW1lcyAocHJlcGVuZCB1bmRlcnNjb3JlIGZvciBwYXJ0aWFscylcclxuICAgICAgICBjb25zdCBpbXBvcnRzUHJvbWlzZXMgPSBIZWxwZXJzLmdldEFsbE1hdGNoZXMoY29udGVudCwgSU1QT1JUX1BBVFRFUk4pLm1hcChhc3luYyBtYXRjaCA9PiB7XHJcbiAgICAgICAgICAgIGxldCBpbXBvcnROYW1lID0gbWF0Y2hbMV07XHJcbiAgICAgICAgICAgIC8vIEFwcGVuZCBleHRlbnNpb24gaWYgaXQncyBhYnNlbnRcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmlzRXh0ZW5zaW9uRXhpc3RzKGltcG9ydE5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnROYW1lICs9IERFRkFVTFRfRklMRV9FWFRFTlNJT047XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIERldGVybWluZSBpZiBpbXBvcnQgc2hvdWxkIGJlIGlnbm9yZWRcclxuICAgICAgICAgICAgY29uc3QgaWdub3JlZCA9IGlnbm9yZWRJbXBvcnRzLmZpbmRJbmRleChpZ25vcmVkSW1wb3J0UmVnZXggPT4gaWdub3JlZEltcG9ydFJlZ2V4LnRlc3QoaW1wb3J0TmFtZSkpICE9PSAtMTtcclxuXHJcbiAgICAgICAgICAgIGxldCBmdWxsUGF0aDogc3RyaW5nO1xyXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgdGlsZGUgaW1wb3J0LlxyXG4gICAgICAgICAgICBjb25zdCB0aWxkZTogYm9vbGVhbiA9IGltcG9ydE5hbWUuc3RhcnRzV2l0aChUSUxERSk7XHJcbiAgICAgICAgICAgIGlmICh0aWxkZSAmJiB0aGlzLnByb2plY3REaXJlY3RvcnkgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgaW1wb3J0TmFtZSA9IGAuLyR7Tk9ERV9NT0RVTEVTfS8ke2ltcG9ydE5hbWUuc3Vic3RyKFRJTERFLmxlbmd0aCwgaW1wb3J0TmFtZS5sZW5ndGgpfWA7XHJcbiAgICAgICAgICAgICAgICBmdWxsUGF0aCA9IHBhdGgucmVzb2x2ZSh0aGlzLnByb2plY3REaXJlY3RvcnksIGltcG9ydE5hbWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZnVsbFBhdGggPSBwYXRoLnJlc29sdmUoZGlybmFtZSwgaW1wb3J0TmFtZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGltcG9ydERhdGE6IEltcG9ydERhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnRTdHJpbmc6IG1hdGNoWzBdLFxyXG4gICAgICAgICAgICAgICAgdGlsZGU6IHRpbGRlLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogaW1wb3J0TmFtZSxcclxuICAgICAgICAgICAgICAgIGZ1bGxQYXRoOiBmdWxsUGF0aCxcclxuICAgICAgICAgICAgICAgIGZvdW5kOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGlnbm9yZWQ6IGlnbm9yZWRcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVzb2x2ZUltcG9ydChpbXBvcnREYXRhLCBpbmNsdWRlUGF0aHMpO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGltcG9ydERhdGE7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBpbXBvcnRzIGZpbGUgbmFtZXMgdG8gYmUgcmVzb2x2ZWRcclxuICAgICAgICBjb25zdCBpbXBvcnRzID0gYXdhaXQgUHJvbWlzZS5hbGwoaW1wb3J0c1Byb21pc2VzKTtcclxuXHJcbiAgICAgICAgY29uc3QgYnVuZGxlUmVzdWx0OiBCdW5kbGVSZXN1bHQgPSB7XHJcbiAgICAgICAgICAgIGZpbGVQYXRoOiBmaWxlUGF0aCxcclxuICAgICAgICAgICAgZm91bmQ6IHRydWVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCBzaG91bGRDaGVja0ZvckRlZHVwZXMgPSBkZWR1cGVGaWxlcyAhPSBudWxsICYmIGRlZHVwZUZpbGVzLmxlbmd0aCA+IDA7XHJcblxyXG4gICAgICAgIC8vIEJ1bmRsZSBhbGwgaW1wb3J0c1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRJbXBvcnRzOiBCdW5kbGVSZXN1bHRbXSA9IFtdO1xyXG4gICAgICAgIGZvciAoY29uc3QgaW1wIG9mIGltcG9ydHMpIHtcclxuICAgICAgICAgICAgbGV0IGNvbnRlbnRUb1JlcGxhY2U7XHJcblxyXG4gICAgICAgICAgICBsZXQgY3VycmVudEltcG9ydDogQnVuZGxlUmVzdWx0O1xyXG5cclxuICAgICAgICAgICAgLy8gSWYgbmVpdGhlciBpbXBvcnQgZmlsZSwgbm9yIHBhcnRpYWwgaXMgZm91bmRcclxuICAgICAgICAgICAgaWYgKCFpbXAuZm91bmQpIHtcclxuICAgICAgICAgICAgICAgIC8vIEFkZCBlbXB0eSBidW5kbGUgcmVzdWx0IHdpdGggZm91bmQ6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50SW1wb3J0ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBpbXAuZnVsbFBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgdGlsZGU6IGltcC50aWxkZSxcclxuICAgICAgICAgICAgICAgICAgICBmb3VuZDogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgaWdub3JlZDogIGltcC5pZ25vcmVkXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZmlsZVJlZ2lzdHJ5W2ltcC5mdWxsUGF0aF0gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgLy8gSWYgZmlsZSBpcyBub3QgeWV0IGluIHRoZSByZWdpc3RyeVxyXG4gICAgICAgICAgICAgICAgLy8gUmVhZFxyXG4gICAgICAgICAgICAgICAgY29uc3QgaW1wQ29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGltcC5mdWxsUGF0aCwgXCJ1dGYtOFwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBhbmQgYnVuZGxlIGl0XHJcbiAgICAgICAgICAgICAgICBjb25zdCBidW5kbGVkSW1wb3J0ID0gYXdhaXQgdGhpcy5idW5kbGUoaW1wLmZ1bGxQYXRoLCBpbXBDb250ZW50LCBkZWR1cGVGaWxlcywgaW5jbHVkZVBhdGhzLCBpZ25vcmVkSW1wb3J0cyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gVGhlbiBhZGQgaXRzIGJ1bmRsZWQgY29udGVudCB0byB0aGUgcmVnaXN0cnlcclxuICAgICAgICAgICAgICAgIHRoaXMuZmlsZVJlZ2lzdHJ5W2ltcC5mdWxsUGF0aF0gPSBidW5kbGVkSW1wb3J0LmJ1bmRsZWRDb250ZW50O1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIEFkZCBpdCB0byB1c2VkIGltcG9ydHMsIGlmIGl0J3Mgbm90IHRoZXJlXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VkSW1wb3J0cyAhPSBudWxsICYmIHRoaXMudXNlZEltcG9ydHNbaW1wLmZ1bGxQYXRoXSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51c2VkSW1wb3J0c1tpbXAuZnVsbFBhdGhdID0gMTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBBbmQgd2hvbGUgQnVuZGxlUmVzdWx0IHRvIGN1cnJlbnQgaW1wb3J0c1xyXG4gICAgICAgICAgICAgICAgY3VycmVudEltcG9ydCA9IGJ1bmRsZWRJbXBvcnQ7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBGaWxlIGlzIGluIHRoZSByZWdpc3RyeVxyXG4gICAgICAgICAgICAgICAgLy8gSW5jcmVtZW50IGl0J3MgdXNhZ2UgY291bnRcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZWRJbXBvcnRzICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVzZWRJbXBvcnRzW2ltcC5mdWxsUGF0aF0rKztcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBSZXNvbHZlIGNoaWxkIGltcG9ydHMsIGlmIHRoZXJlIGFyZSBhbnlcclxuICAgICAgICAgICAgICAgIGxldCBjaGlsZEltcG9ydHM6IEJ1bmRsZVJlc3VsdFtdID0gW107XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbXBvcnRzQnlGaWxlICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjaGlsZEltcG9ydHMgPSB0aGlzLmltcG9ydHNCeUZpbGVbaW1wLmZ1bGxQYXRoXTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDb25zdHJ1Y3QgYW5kIGFkZCByZXN1bHQgdG8gY3VycmVudCBpbXBvcnRzXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50SW1wb3J0ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBpbXAuZnVsbFBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgdGlsZGU6IGltcC50aWxkZSxcclxuICAgICAgICAgICAgICAgICAgICBmb3VuZDogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBpbXBvcnRzOiBjaGlsZEltcG9ydHNcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChpbXAuaWdub3JlZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlZEltcG9ydHNbaW1wLmZ1bGxQYXRoXSA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50VG9SZXBsYWNlID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFRvUmVwbGFjZSA9IGltcC5pbXBvcnRTdHJpbmc7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gVGFrZSBjb250ZW50VG9SZXBsYWNlIGZyb20gdGhlIGZpbGVSZWdpc3RyeVxyXG4gICAgICAgICAgICAgICAgY29udGVudFRvUmVwbGFjZSA9IHRoaXMuZmlsZVJlZ2lzdHJ5W2ltcC5mdWxsUGF0aF07XHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgY29udGVudCBpcyBub3QgZm91bmRcclxuICAgICAgICAgICAgICAgIGlmIChjb250ZW50VG9SZXBsYWNlID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBJbmRpY2F0ZSB0aGlzIHdpdGggYSBjb21tZW50IGZvciBlYXNpZXIgZGVidWdnaW5nXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudFRvUmVwbGFjZSA9IGAvKioqIElNUE9SVEVEIEZJTEUgTk9UIEZPVU5EICoqKi8ke29zLkVPTH0ke2ltcC5pbXBvcnRTdHJpbmd9LyoqKiAtLS0gKioqL2A7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSWYgdXNlZEltcG9ydHMgZGljdGlvbmFyeSBpcyBkZWZpbmVkXHJcbiAgICAgICAgICAgICAgICBpZiAoc2hvdWxkQ2hlY2tGb3JEZWR1cGVzICYmIHRoaXMudXNlZEltcG9ydHMgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFuZCBjdXJyZW50IGltcG9ydCBwYXRoIHNob3VsZCBiZSBkZWR1cGVkIGFuZCBpcyB1c2VkIGFscmVhZHlcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW1lc1VzZWQgPSB0aGlzLnVzZWRJbXBvcnRzW2ltcC5mdWxsUGF0aF07XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlZHVwZUZpbGVzLmluZGV4T2YoaW1wLmZ1bGxQYXRoKSAhPT0gLTEgJiYgdGltZXNVc2VkICE9IG51bGwgJiYgdGltZXNVc2VkID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCBjb250ZW50IHRvIHJlcGxhY2UgdG8gYW4gZW1wdHkgc3RyaW5nIHRvIHNraXAgaXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudFRvUmVwbGFjZSA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFuZCBpbmRpY2F0ZSB0aGF0IGltcG9ydCB3YXMgZGVkdXBlZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50SW1wb3J0LmRlZHVwZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gRmluYWxseSwgcmVwbGFjZSBpbXBvcnQgc3RyaW5nIHdpdGggYnVuZGxlZCBjb250ZW50IG9yIGEgZGVidWcgbWVzc2FnZVxyXG4gICAgICAgICAgICBjb250ZW50ID0gdGhpcy5yZXBsYWNlTGFzdE9jY3VyYW5jZShjb250ZW50LCBpbXAuaW1wb3J0U3RyaW5nLCBjb250ZW50VG9SZXBsYWNlKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEFuZCBwdXNoIGN1cnJlbnQgaW1wb3J0IGludG8gdGhlIGxpc3RcclxuICAgICAgICAgICAgY3VycmVudEltcG9ydHMucHVzaChjdXJyZW50SW1wb3J0KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFNldCByZXN1bHQgcHJvcGVydGllc1xyXG4gICAgICAgIGJ1bmRsZVJlc3VsdC5idW5kbGVkQ29udGVudCA9IGNvbnRlbnQ7XHJcbiAgICAgICAgYnVuZGxlUmVzdWx0LmltcG9ydHMgPSBjdXJyZW50SW1wb3J0cztcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuaW1wb3J0c0J5RmlsZSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaW1wb3J0c0J5RmlsZVtmaWxlUGF0aF0gPSBjdXJyZW50SW1wb3J0cztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBidW5kbGVSZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZXBsYWNlTGFzdE9jY3VyYW5jZShjb250ZW50OiBzdHJpbmcsIGltcG9ydFN0cmluZzogc3RyaW5nLCBjb250ZW50VG9SZXBsYWNlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gY29udGVudC5sYXN0SW5kZXhPZihpbXBvcnRTdHJpbmcpO1xyXG4gICAgICAgIHJldHVybiBjb250ZW50LnNsaWNlKDAsIGluZGV4KSArIGNvbnRlbnQuc2xpY2UoaW5kZXgpLnJlcGxhY2UoaW1wb3J0U3RyaW5nLCBjb250ZW50VG9SZXBsYWNlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlbW92ZUltcG9ydHNGcm9tQ29tbWVudHModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBwYXR0ZXJucyA9IFtDT01NRU5UX1BBVFRFUk4sIE1VTFRJTElORV9DT01NRU5UX1BBVFRFUk5dO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgcGF0dGVybnMpIHtcclxuICAgICAgICAgICAgdGV4dCA9IHRleHQucmVwbGFjZShwYXR0ZXJuLCB4ID0+IHgucmVwbGFjZShJTVBPUlRfUEFUVEVSTiwgXCJcIikpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRleHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlSW1wb3J0KGltcG9ydERhdGEsIGluY2x1ZGVQYXRocyk6IFByb21pc2U8YW55PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgZnMuYWNjZXNzKGltcG9ydERhdGEuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICBpbXBvcnREYXRhLmZvdW5kID0gdHJ1ZTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zdCB1bmRlcnNjb3JlZERpcm5hbWUgPSBwYXRoLmRpcm5hbWUoaW1wb3J0RGF0YS5mdWxsUGF0aCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHVuZGVyc2NvcmVkQmFzZW5hbWUgPSBwYXRoLmJhc2VuYW1lKGltcG9ydERhdGEuZnVsbFBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCB1bmRlcnNjb3JlZEZpbGVQYXRoID0gcGF0aC5qb2luKHVuZGVyc2NvcmVkRGlybmFtZSwgYF8ke3VuZGVyc2NvcmVkQmFzZW5hbWV9YCk7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBmcy5hY2Nlc3ModW5kZXJzY29yZWRGaWxlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICBpbXBvcnREYXRhLmZ1bGxQYXRoID0gdW5kZXJzY29yZWRGaWxlUGF0aDtcclxuICAgICAgICAgICAgICAgIGltcG9ydERhdGEuZm91bmQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9IGNhdGNoICh1bmRlcnNjb3JlRXJyKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGluY2x1ZGVQYXRoc1xyXG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVQYXRocy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBSZXNvbHZlIGZ1bGxQYXRoIHVzaW5nIGl0cyBmaXJzdCBlbnRyeVxyXG4gICAgICAgICAgICAgICAgICAgIGltcG9ydERhdGEuZnVsbFBhdGggPSBwYXRoLnJlc29sdmUoaW5jbHVkZVBhdGhzWzBdLCBpbXBvcnREYXRhLnBhdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSByZXNvbHZpbmcgaW1wb3J0IHdpdGggdGhlIHJlbWFpbmluZyBpbmNsdWRlUGF0aHNcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZW1haW5pbmdJbmNsdWRlUGF0aHMgPSBpbmNsdWRlUGF0aHMuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZUltcG9ydChpbXBvcnREYXRhLCByZW1haW5pbmdJbmNsdWRlUGF0aHMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gaW1wb3J0RGF0YTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdsb2JGaWxlc09yRW1wdHkoZ2xvYnNMaXN0OiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nW10+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgaWYgKGdsb2JzTGlzdCA9PSBudWxsIHx8IGdsb2JzTGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoW10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGdsb2JzKGdsb2JzTGlzdCwgKGVycjogRXJyb3IsIGZpbGVzOiBzdHJpbmdbXSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gUmVqZWN0IGlmIHRoZXJlJ3MgYW4gZXJyb3JcclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBSZXNvbHZlIGZ1bGwgcGF0aHNcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGZpbGVzLm1hcChmaWxlID0+IHBhdGgucmVzb2x2ZShmaWxlKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gUmVzb2x2ZSBwcm9taXNlXHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==
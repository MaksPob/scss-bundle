#!/usr/bin/env node
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
const path = require("path");
const chokidar = require("chokidar");
// tslint:disable-next-line:no-require-imports
const debounce = require("lodash.debounce");
const Contracts = require("./contracts");
const arguments_1 = require("./arguments");
const launcher_1 = require("./launcher");
function resolveVerbosity(verbosity) {
    // Convert given value to an appropriate Verbosity enum value.
    // 'as any as number' is used because TypeScript thinks
    //  that we cast string to number, even though we get a number there
    return Contracts.Verbosity[verbosity];
}
function argumentsToConfig(argumentValues) {
    return {
        Destination: argumentValues.dest,
        Entry: argumentValues.entry,
        DedupeGlobs: argumentValues.dedupe,
        Verbosity: resolveVerbosity(argumentValues.verbosity),
        IncludePaths: argumentValues.includePaths,
        IgnoredImports: argumentValues.ignoredImports,
        ProjectDirectory: path.resolve(process.cwd(), argumentValues.project)
    };
}
function main(argumentValues) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = argumentsToConfig(argumentValues);
        const isWatching = argumentValues.watch != null;
        const bundler = new launcher_1.Launcher(config);
        if (argumentValues.verbosity !== Contracts.Verbosity.None && (argumentValues.entry == null || argumentValues.dest == null)) {
            console.error("[Error] 'entry' and 'dest' are required.");
            process.exit(1);
        }
        if (argumentValues.verbosity !== Contracts.Verbosity.None && isWatching && argumentValues.watch === "") {
            console.error("[Error] 'watch' must be defined.");
            process.exit(1);
        }
        if (isWatching) {
            const onFilesChange = debounce(() => __awaiter(this, void 0, void 0, function* () {
                if (config.Verbosity === Contracts.Verbosity.Verbose) {
                    console.info("[Watcher] File change detected.");
                }
                yield bundler.Bundle();
                if (config.Verbosity === Contracts.Verbosity.Verbose) {
                    console.info("[Watcher] Waiting for changes...");
                }
            }), 500);
            chokidar.watch(argumentValues.watch).on("change", onFilesChange);
        }
        yield bundler.Bundle();
        if (isWatching && config.Verbosity === Contracts.Verbosity.Verbose) {
            console.info("[Watcher] Waiting for changes...");
        }
    });
}
main(arguments_1.argv);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLWNsaS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9idW5kbGUtY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBRUEsNkJBQTZCO0FBQzdCLHFDQUFxQztBQUNyQyw4Q0FBOEM7QUFDOUMsNENBQTZDO0FBRTdDLHlDQUF5QztBQUN6QywyQ0FBbUM7QUFDbkMseUNBQXNDO0FBRXRDLFNBQVMsZ0JBQWdCLENBQUMsU0FBYztJQUNwQyw4REFBOEQ7SUFDOUQsdURBQXVEO0lBQ3ZELG9FQUFvRTtJQUNwRSxPQUFRLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFtQixDQUFDO0FBQzdELENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLGNBQXlDO0lBQ2hFLE9BQU87UUFDSCxXQUFXLEVBQUUsY0FBYyxDQUFDLElBQUk7UUFDaEMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxLQUFLO1FBQzNCLFdBQVcsRUFBRSxjQUFjLENBQUMsTUFBTTtRQUNsQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQztRQUNyRCxZQUFZLEVBQUUsY0FBYyxDQUFDLFlBQVk7UUFDekMsY0FBYyxFQUFFLGNBQWMsQ0FBQyxjQUFjO1FBQzdDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLGNBQWMsQ0FBQyxPQUFPLENBQUM7S0FDeEUsQ0FBQztBQUNOLENBQUM7QUFFRCxTQUFlLElBQUksQ0FBQyxjQUF5Qzs7UUFDekQsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakQsTUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUM7UUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxtQkFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXJDLElBQUksY0FBYyxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLGNBQWMsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7WUFDeEgsT0FBTyxDQUFDLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1lBQzFELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDbkI7UUFFRCxJQUFJLGNBQWMsQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLElBQUksVUFBVSxJQUFJLGNBQWMsQ0FBQyxLQUFLLEtBQUssRUFBRSxFQUFFO1lBQ3BHLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztZQUNsRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ25CO1FBRUQsSUFBSSxVQUFVLEVBQUU7WUFDWixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBUyxFQUFFO2dCQUN0QyxJQUFJLE1BQU0sQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7b0JBQ2xELE9BQU8sQ0FBQyxJQUFJLENBQUMsaUNBQWlDLENBQUMsQ0FBQztpQkFDbkQ7Z0JBQ0QsTUFBTSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksTUFBTSxDQUFDLFNBQVMsS0FBSyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRTtvQkFDbEQsT0FBTyxDQUFDLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO2lCQUNwRDtZQUNMLENBQUMsQ0FBQSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRVIsUUFBUSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsQ0FBQztTQUNwRTtRQUVELE1BQU0sT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3ZCLElBQUksVUFBVSxJQUFJLE1BQU0sQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUU7WUFDaEUsT0FBTyxDQUFDLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1NBQ3BEO0lBQ0wsQ0FBQztDQUFBO0FBRUQsSUFBSSxDQUFDLGdCQUFJLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuXHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgY2hva2lkYXIgZnJvbSBcImNob2tpZGFyXCI7XHJcbi8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpuby1yZXF1aXJlLWltcG9ydHNcclxuaW1wb3J0IGRlYm91bmNlID0gcmVxdWlyZShcImxvZGFzaC5kZWJvdW5jZVwiKTtcclxuXHJcbmltcG9ydCAqIGFzIENvbnRyYWN0cyBmcm9tIFwiLi9jb250cmFjdHNcIjtcclxuaW1wb3J0IHsgYXJndiB9IGZyb20gXCIuL2FyZ3VtZW50c1wiO1xyXG5pbXBvcnQgeyBMYXVuY2hlciB9IGZyb20gXCIuL2xhdW5jaGVyXCI7XHJcblxyXG5mdW5jdGlvbiByZXNvbHZlVmVyYm9zaXR5KHZlcmJvc2l0eTogYW55KTogbnVtYmVyIHtcclxuICAgIC8vIENvbnZlcnQgZ2l2ZW4gdmFsdWUgdG8gYW4gYXBwcm9wcmlhdGUgVmVyYm9zaXR5IGVudW0gdmFsdWUuXHJcbiAgICAvLyAnYXMgYW55IGFzIG51bWJlcicgaXMgdXNlZCBiZWNhdXNlIFR5cGVTY3JpcHQgdGhpbmtzXHJcbiAgICAvLyAgdGhhdCB3ZSBjYXN0IHN0cmluZyB0byBudW1iZXIsIGV2ZW4gdGhvdWdoIHdlIGdldCBhIG51bWJlciB0aGVyZVxyXG4gICAgcmV0dXJuIChDb250cmFjdHMuVmVyYm9zaXR5W3ZlcmJvc2l0eV0gYXMgYW55KSBhcyBudW1iZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFyZ3VtZW50c1RvQ29uZmlnKGFyZ3VtZW50VmFsdWVzOiBDb250cmFjdHMuQXJndW1lbnRzVmFsdWVzKTogQ29udHJhY3RzLkNvbmZpZyB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIERlc3RpbmF0aW9uOiBhcmd1bWVudFZhbHVlcy5kZXN0LFxyXG4gICAgICAgIEVudHJ5OiBhcmd1bWVudFZhbHVlcy5lbnRyeSxcclxuICAgICAgICBEZWR1cGVHbG9iczogYXJndW1lbnRWYWx1ZXMuZGVkdXBlLFxyXG4gICAgICAgIFZlcmJvc2l0eTogcmVzb2x2ZVZlcmJvc2l0eShhcmd1bWVudFZhbHVlcy52ZXJib3NpdHkpLFxyXG4gICAgICAgIEluY2x1ZGVQYXRoczogYXJndW1lbnRWYWx1ZXMuaW5jbHVkZVBhdGhzLFxyXG4gICAgICAgIElnbm9yZWRJbXBvcnRzOiBhcmd1bWVudFZhbHVlcy5pZ25vcmVkSW1wb3J0cyxcclxuICAgICAgICBQcm9qZWN0RGlyZWN0b3J5OiBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgYXJndW1lbnRWYWx1ZXMucHJvamVjdClcclxuICAgIH07XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG1haW4oYXJndW1lbnRWYWx1ZXM6IENvbnRyYWN0cy5Bcmd1bWVudHNWYWx1ZXMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbmZpZyA9IGFyZ3VtZW50c1RvQ29uZmlnKGFyZ3VtZW50VmFsdWVzKTtcclxuICAgIGNvbnN0IGlzV2F0Y2hpbmcgPSBhcmd1bWVudFZhbHVlcy53YXRjaCAhPSBudWxsO1xyXG4gICAgY29uc3QgYnVuZGxlciA9IG5ldyBMYXVuY2hlcihjb25maWcpO1xyXG5cclxuICAgIGlmIChhcmd1bWVudFZhbHVlcy52ZXJib3NpdHkgIT09IENvbnRyYWN0cy5WZXJib3NpdHkuTm9uZSAmJiAoYXJndW1lbnRWYWx1ZXMuZW50cnkgPT0gbnVsbCB8fCBhcmd1bWVudFZhbHVlcy5kZXN0ID09IG51bGwpKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltFcnJvcl0gJ2VudHJ5JyBhbmQgJ2Rlc3QnIGFyZSByZXF1aXJlZC5cIik7XHJcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChhcmd1bWVudFZhbHVlcy52ZXJib3NpdHkgIT09IENvbnRyYWN0cy5WZXJib3NpdHkuTm9uZSAmJiBpc1dhdGNoaW5nICYmIGFyZ3VtZW50VmFsdWVzLndhdGNoID09PSBcIlwiKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIltFcnJvcl0gJ3dhdGNoJyBtdXN0IGJlIGRlZmluZWQuXCIpO1xyXG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNXYXRjaGluZykge1xyXG4gICAgICAgIGNvbnN0IG9uRmlsZXNDaGFuZ2UgPSBkZWJvdW5jZShhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChjb25maWcuVmVyYm9zaXR5ID09PSBDb250cmFjdHMuVmVyYm9zaXR5LlZlcmJvc2UpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhcIltXYXRjaGVyXSBGaWxlIGNoYW5nZSBkZXRlY3RlZC5cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYXdhaXQgYnVuZGxlci5CdW5kbGUoKTtcclxuICAgICAgICAgICAgaWYgKGNvbmZpZy5WZXJib3NpdHkgPT09IENvbnRyYWN0cy5WZXJib3NpdHkuVmVyYm9zZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5pbmZvKFwiW1dhdGNoZXJdIFdhaXRpbmcgZm9yIGNoYW5nZXMuLi5cIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCA1MDApO1xyXG5cclxuICAgICAgICBjaG9raWRhci53YXRjaChhcmd1bWVudFZhbHVlcy53YXRjaCkub24oXCJjaGFuZ2VcIiwgb25GaWxlc0NoYW5nZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgYnVuZGxlci5CdW5kbGUoKTtcclxuICAgIGlmIChpc1dhdGNoaW5nICYmIGNvbmZpZy5WZXJib3NpdHkgPT09IENvbnRyYWN0cy5WZXJib3NpdHkuVmVyYm9zZSkge1xyXG4gICAgICAgIGNvbnNvbGUuaW5mbyhcIltXYXRjaGVyXSBXYWl0aW5nIGZvciBjaGFuZ2VzLi4uXCIpO1xyXG4gICAgfVxyXG59XHJcblxyXG5tYWluKGFyZ3YpO1xyXG4iXX0=
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const { path, only } = getCliParams();
const { dirs: rootDirs, files: rootFiles } = getDirContents(path);
const abnormalFiles = [];
let scannedCount = 0;
let changedCount = 0;
const dirStack = [...rootDirs.filter((x) => only.includes(x.name))];
const fileStack = [...((_a = rootFiles["php"]) !== null && _a !== void 0 ? _a : [])];
exploreRecursively(dirStack, fileStack);
console.log(`${scannedCount} file${scannedCount > 1 ? "s" : ""} scanned, ${changedCount} changed`);
if (abnormalFiles.length > 0) {
    console.log(`Some abnormal files found:`, abnormalFiles);
}
function exploreRecursively(dirStack, fileStack) {
    var _a;
    const currDir = dirStack.shift();
    if (!currDir)
        return;
    const { dirs, files } = getDirContents(currDir.parentPath + `\\${currDir.name}`);
    console.log("dir", currDir.name);
    dirStack.unshift(...dirs);
    exploreRecursively(dirStack, fileStack);
    fileStack.push(...((_a = files["php"]) !== null && _a !== void 0 ? _a : []));
    while (fileStack.length > 0) {
        const currFile = fileStack.pop();
        if (!currFile)
            break;
        console.log("file", currFile.name);
        scannedCount++;
        fixMalformedDoc(currFile);
    }
}
function getCliParams() {
    const [, , path, ...args] = process.argv;
    if (!fs.existsSync(path)) {
        console.error(`path ${path} does not exist`);
        process.exit(1);
    }
    return {
        path,
        only: args,
    };
}
function getDirContents(path) {
    const unsortedContents = fs.readdirSync(path, { withFileTypes: true });
    const contents = {
        dirs: [],
        files: {},
    };
    for (let item of unsortedContents) {
        let ext = "*";
        if (item.isDirectory()) {
            contents.dirs.push(item);
            continue;
        }
        const filenamePart = item.name.split(".");
        if (filenamePart.length >= 2) {
            ext = filenamePart[filenamePart.length - 1];
        }
        if (!contents.files[ext])
            contents.files[ext] = [];
        contents.files[ext].push(item);
    }
    return contents;
}
function setProcessError(msg) {
    console.error(msg);
    process.exitCode = 1;
}
function fixMalformedDoc(fileDirent) {
    const malformedRgx = /^\/\*[^*].+\*\/$/gm;
    const filepath = fileDirent.parentPath + `\\${fileDirent.name}`;
    let content = fs.readFileSync(filepath).toString();
    const pendingChanges = [];
    const matches = [...content.matchAll(malformedRgx)];
    if (matches.length === 0)
        return;
    // console.log(matches);
    // console.log(matches.map((x) => x[0]));
    for (let match of matches) {
        const components = match[0].split(" ");
        if (components[1].charAt(0) !== "@")
            continue;
        if (components[2].charAt(0) !== "$") {
            abnormalFiles.push(filepath);
            continue;
        }
        components[0] = components[0] + "*";
        [components[2], components[3]] = [components[3], components[2]];
        pendingChanges.push([match[0], components.join(" ")]);
    }
    // console.log(pendingChanges);
    for (let changes of pendingChanges) {
        content = content.replace(changes[0], changes[1]);
    }
    // console.log(content);
    fs.writeFileSync(filepath, content);
    changedCount++;
}

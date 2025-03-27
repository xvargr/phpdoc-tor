// dfs recursively through all files in directory
// read file
// find phpdoc comments and fix them
// save the file

import * as fs from "fs";

const { path, only } = getCliParams();
const { dirs: rootDirs, files: rootFiles } = getDirContents(path);
const abnormalFiles: string[] = [];
let scannedCount = 0;
let changedCount = 0;

const dirStack = [...rootDirs.filter((x) => only.includes(x.name))];
const fileStack = [...(rootFiles["php"] ?? [])];

exploreRecursively(dirStack, fileStack);

console.log(
  `${scannedCount} file${
    scannedCount > 1 ? "s" : ""
  } scanned, ${changedCount} changed`
);
if (abnormalFiles.length > 0) {
  console.log(`Some abnormal files found:`, abnormalFiles);
}

function exploreRecursively(
  dirStack: fs.Dirent[],
  fileStack: fs.Dirent[]
): void {
  const currDir = dirStack.shift();
  if (!currDir) return;

  const { dirs, files } = getDirContents(
    currDir.parentPath + `\\${currDir.name}`
  );

  console.log("dir", currDir.name);

  dirStack.unshift(...dirs);

  exploreRecursively(dirStack, fileStack);

  fileStack.push(...(files["php"] ?? []));

  while (fileStack.length > 0) {
    const currFile = fileStack.pop();
    if (!currFile) break;

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

function getDirContents(path: string) {
  const unsortedContents = fs.readdirSync(path, { withFileTypes: true });
  const contents = {
    dirs: [] as fs.Dirent[],
    files: {} as { [key: string]: fs.Dirent[] },
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

    if (!contents.files[ext]) contents.files[ext] = [];
    contents.files[ext].push(item);
  }

  return contents;
}

function setProcessError(msg: string): void {
  console.error(msg);
  process.exitCode = 1;
}

function fixMalformedDoc(fileDirent: fs.Dirent) {
  const malformedRgx = /^\/\*[^*].+\*\/$/gm;
  const filepath = fileDirent.parentPath + `\\${fileDirent.name}`;
  let content = fs.readFileSync(filepath).toString();
  const pendingChanges: [string, string][] = [];
  const matches = [...content.matchAll(malformedRgx)];

  if (matches.length === 0) return;
  // console.log(matches);
  // console.log(matches.map((x) => x[0]));

  for (let match of matches) {
    const components = match[0].split(" ");
    if (components[1].charAt(0) !== "@") continue;
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

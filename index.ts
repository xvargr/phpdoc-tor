// dfs recursively through all files in directory
// read file
// find phpdoc comments and fix them
// save the file

import * as fs from "fs";

const { path, only } = getCliParams();
const { dirs: rootDirs, files: rootFiles } = getDirContents(path);
let filecount = 0;

const dirStack = [...rootDirs.filter((x) => only.includes(x.name))];
const fileStack = [...(rootFiles["php"] ?? [])];

exploreRecursively(dirStack, fileStack);

console.log(`${filecount} file${filecount > 1 ? "s" : ""} affected`);

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

  // todo: check if doc malformed, if yes, push
  fileStack.push(...(files["php"] ?? []));

  while (fileStack.length > 0) {
    const currFile = fileStack.pop();
    if (!currFile) break;

    filecount++;
    console.log("file", currFile.name);
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

function fileHasMalformedDocs() {
  //
}

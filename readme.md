# phpdoc-tor

Script to mass fix non-standard phpdoc in php files of projects to make them recognizable to static checkers and IDEs.

## Arguments

_first argument:_ path to the project to fix

_subsequent arguments:_ directories to include in the search

## Usage

### TS version

```bash
npx tsx phpdoc-tor.ts path/to/project models controllers views
```

### JS version

```bash
node phpdoc-tor.js path/to/project models controllers views
```

## Build

If the JS file is missing or you need to rebuild it, run the following command in the project directory:

```bash
npm run build
```

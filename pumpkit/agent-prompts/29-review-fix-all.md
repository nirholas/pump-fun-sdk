# Agent Task 29: Review + Fix All Created Files

## Context

We're building **PumpKit** (`/workspaces/pump-fun-sdk/pumpkit/`). Multiple agents have been creating files in parallel. Your job is to review everything and fix inconsistencies.

## Task

### 1. Audit the file structure
List everything under `pumpkit/packages/core/src/` and verify:
- Every module has an `index.ts` barrel export
- The main `src/index.ts` re-exports everything that exists
- No circular dependencies
- Consistent import paths (using `.js` extensions for Node16 resolution)

### 2. Check type consistency
- Event types in `types/events.ts` should match what monitors emit
- Config schema types should match what bots consume
- Storage interfaces should match implementations
- Bot types should match grammy API

### 3. Fix cross-references
- All docs should have correct relative links
- README links should point to real files
- Package.json workspace references should be correct

### 4. Verify monorepo structure
- `turbo.json` pipeline references valid scripts
- Each package's `tsconfig.json` references are correct
- Workspace dependencies (`workspace:*`) are properly configured

### 5. Check for TODO/placeholder comments
- Find all `// TODO` comments and list them
- Find all placeholder/stub implementations
- Create a summary of what's incomplete

### 6. Create status report
Create `/workspaces/pump-fun-sdk/pumpkit/STATUS.md`:
- List every package and its completion status
- List every core module and whether it's implemented
- List discovered issues
- List suggested next steps

## Requirements

- Be thorough — check every file
- Fix issues directly (don't just report them)
- For TypeScript files, verify imports resolve to real modules
- For documentation, verify links point to real files

## Do NOT

- Don't rewrite working code (only fix bugs/inconsistencies)
- Don't add new features
- Don't delete files

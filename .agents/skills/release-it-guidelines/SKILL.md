---
name: release-it-guidelines
description: Guides setup, configuration, and execution of release-it version bumping and changelog workflows. Use when modifying release scripts, configuring release-it, running release commands, or adding conventional-changelog configurations. Key capabilities include configuring .release-it.json, running npm run release, and setting up release workflows. Do NOT use for general package installation, local npm publishing, or unrelated CI/CD setups.
---
# Release-It Guidelines

Guidelines and configuration instructions for managing package releases using release-it and conventional-changelog.

## Critical

- **Do NOT bypass the two-step release flow**: 1. Bump version and tag on a release branch, create a PR. 2. Publish package from the merged main branch via GitHub Actions.
- **Never publish manually to npm/GitHub Packages from local terminals**: Local publishes lack the validation gates executed in GitHub Actions.
- **Strictly adhere to Conventional Commits**: All commit messages must follow the Angular commit message format (e.g., `feat: ...`, `fix: ...`, `chore: ...`) to enable automatic changelog generation.

## Instructions

1. **Verify Project Dependencies**
   - Ensure `release-it` and `@release-it/conventional-changelog` are installed in the `devDependencies` of `package.json`.
   - Run `npx release-it --version` to verify the CLI is accessible.

2. **Configure release-it (`.release-it.json`)**
   - Create or update the `.release-it.json` file in the root directory.
   - Use the following baseline configuration mirroring project standards:
     ```json
     {
       "git": {
         "commitMessage": "chore: release v${version}",
         "tagName": "v${version}",
         "requireCleanWorkingDir": true,
         "requireBranch": "main"
       },
       "github": {
         "release": true,
         "releaseName": "v${version}"
       },
       "npm": {
         "publish": false
       },
       "plugins": {
         "@release-it/conventional-changelog": {
           "preset": {
             "name": "conventionalcommits"
           },
           "infile": "CHANGELOG.md"
         }
       }
     }
     ```
   - Validation Gate: Run `npx release-it --dry-run` and verify that no errors are thrown regarding git or changelog plugins.

3. **Set Up NPM Scripts**
   - In `package.json`, verify or add the `"release"` script pointing to `release-it`:
     ```json
     "scripts": {
       "release": "release-it"
     }
     ```
   - Validation Gate: Run `npm run release -- --dry-run` to ensure the script maps correctly to the locally installed CLI binary.

4. **GitHub Actions Integration**
   - Configure the publishing workflow under `.github/workflows/publish.yml` to trigger on tag creation or dispatch.
   - Example configuration template:
     ```yaml
     name: Publish Package
     on:
       workflow_dispatch:
         inputs:
           release_type:
             description: 'npm dist-tag'
             required: true
             default: 'release'
             type: choice
             options: [release, alpha, beta, rc]
           build_type:
             description: 'Validation criteria'
             required: true
             default: 'prod'
             type: choice
             options: [prod, beta, stage]
     ```
   - Validation Gate: Verify workflow syntax using action linter or by committing to a draft workflow.

## Examples

### User says
> I need to bump the version to a beta pre-release and generate a changelog.

### Actions taken
1. Check that the working directory is clean using `git status`.
2. Run `npm run release -- pre-release --preRelease=beta --dry-run` to preview the bump and changelog additions.
3. Verify that the correct version is suggested (e.g., `1.0.0-beta.0`) and that `CHANGELOG.md` will contain the new release notes.
4. Execute `npm run release -- pre-release --preRelease=beta` to complete the local bump, tagging, and git push.

### Result
- Version in `package.json` updated to pre-release target.
- New tag `v1.0.0-beta.0` pushed to git.
- `CHANGELOG.md` updated with parsed commits matching the conventional format.

## Common Issues

- **Error: "Git working directory is not clean"**
  - Fix: Commit or stash any outstanding local changes using `git stash` before initiating `npm run release`.
- **Error: "GitHub token missing"**
  - Fix: Ensure `GITHUB_TOKEN` is exported in the environment, or run release-it with `--no-github` option if doing local-only verification.
- **Error: "Could not find conventional-changelog template"**
  - Fix: Verify that `@release-it/conventional-changelog` is listed in the dependencies and run `npm install` to ensure it is present in `node_modules`.
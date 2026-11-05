# Local distribution

This workflow creates a distributable local release. It does not publish to npm,
create tags or commits, upload assets, or write to GitHub. The current checkout
has no configured remote and `gh` is unavailable; GitHub installation below is a
future workflow using explicit placeholders. No repository owner or URL is assumed.
The package remains private. The owner must decide licensing before public
distribution; this workflow assigns no license or permission to redistribute.

## Build and review

Use Node.js 20 or newer with npm installed. From the tool's source directory:

```text
node --check release-bundle.mjs
node --test release-bundle.test.mjs
node release-bundle.mjs --output-dir ./dist --dry-run
node release-bundle.mjs --output-dir ./dist
```

The integrated package also exposes `npm run release:bundle -- --output-dir ./dist`
and accepts `--dry-run` through that script. This works from a tarball-installed
package because both the runtime manager and bundle builder are packaged.

`dist` must not already exist, even if empty. Choose a new version-specific
directory for another build. Its parent must already exist. Relative output
paths resolve from the caller's current directory; the API's default is `dist`
beside `release-bundle.mjs`. Filesystem root, home, the source directory and its
ancestors, protected source subtrees, and symlink/junction paths are refused.
There is no overwrite or force option. Dry run validates source and destination
and reports JSON without running npm or creating any files/cache.

The exported synchronous API is:

```js
import { buildReleaseBundle } from './release-bundle.mjs';
const plan = buildReleaseBundle('/specific/new/release-directory', { dryRun: true });
const bundle = buildReleaseBundle('/specific/new/release-directory');
// buildReleaseBundle() defaults to the source directory's dist folder.
```

The optional `sourceDir` option selects another package source (also used by the
tests). Both real and dry runs return `outputDir`, `packageName`, `version`,
`dryRun`, `tarball`, `artifacts`, and `packageFiles`. Errors throw; CLI errors
exit with code 1. CLI success emits that result as JSON.

The bundle contains exactly the versioned npm tarball, `INSTALL.md`, and
`SHA256SUMS`. The manifest hashes the tarball and install instructions; it cannot
hash itself. `INSTALL.md` is this guide with the release version and tarball
placeholders filled in. The tarball contains a `package/` directory.

Packaging uses `npm pack --json --ignore-scripts --offline` in a temporary
snapshot, with a private temporary npm cache and no new dependencies. No package
lifecycle hooks run. Only the snapshot's `package.json.files` is expanded; source
metadata and global npm configuration are not changed. npm's reported contents
must match the whitelist exactly. Temporary staging/cache files are removed.

The whitelist includes `package.json`, `cli.mjs`, `file-safety.mjs`,
`skills-manager.mjs`, `release-bundle.mjs`, all existing
installer/uninstaller assets and launchers, `npm-shrinkwrap.json`, builtin
Markdown files under `skills/`, `README.md`, `CHANGELOG.md`, and `DISTRIBUTION.md`.
Both modules are required, regardless of the source package's files list.
Existing `LICENSE`, `LICENSE.md`, `LICENSE.txt`, and `NOTICE`
are included if present, without creating a license. Tests, development scripts,
`node_modules`, Git/CI files, custom project assets and `.env` are excluded.
Missing required files, symlinked package paths, or inconsistent package/lockfile
name/version fail before output is created. Dependencies are fetched later by
the installer using the shrinkwrap; the bundle is not an offline dependency kit.

The integrated installer copies `skills-manager.mjs`, `release-bundle.mjs`, and
`DISTRIBUTION.md`. Release tests inspect the actual archive, preview installation
from an extracted tarball, and run its packaged builder again. This builder itself
does not edit installer assets, source package metadata or CI configuration.

## Verify the received bundle before installation

Obtain `SHA256SUMS` through a trusted channel and compare its contents with the
publisher's independently supplied checksums. A checksum shipped beside an
archive detects corruption; it does not establish publisher identity by itself.
Inspect the instructions and archive before executing code. Stop on any mismatch.

On Linux, from the directory containing all three bundle files:

```sh
sha256sum -c SHA256SUMS
tar -tzf '<RELEASE_TARBALL>'
```

On macOS use `shasum -a 256 -c SHA256SUMS`. On Windows PowerShell:

```powershell
Get-Content -LiteralPath './SHA256SUMS' | ForEach-Object {
  if ($_ -notmatch '^([0-9a-f]{64})  ([A-Za-z0-9._+-]+)$') { throw 'Invalid checksum line' }
  $expectedDigest = $Matches[1]
  $artifactName = $Matches[2]
  $actualDigest = (Get-FileHash -LiteralPath (Join-Path (Get-Location) $artifactName) -Algorithm SHA256).Hash
  if ($actualDigest.ToLowerInvariant() -ne $expectedDigest) { throw "Checksum mismatch: $artifactName" }
  Write-Host "Verified: $artifactName"
}
tar -tzf '<RELEASE_TARBALL>'
```

After successful verification, extract into a fresh directory using your archive
tool (or `mkdir release-extracted`, then `tar -xzf '<RELEASE_TARBALL>' -C release-extracted`).
Review `package/install.mjs`, the runtime modules, package metadata and shrinkwrap.
From the extracted `package` directory, run the reviewed local installer:

```text
node install.mjs --dry-run
node install.mjs
```

The default installation directory is the user's `.agent-skills` folder. For a
different dedicated directory use `--prefix /specific/install-directory` in both
commands. The installer fetches locked dependencies with `npm ci --omit=dev`.
Installing here is a separate user/AI action after verification; building never
runs the installer. Updating an existing install preserves modified files unless
an explicit force decision is made; review its output.

`node install.mjs` does not add the command to PATH. Add only the dedicated install
directory to the current session, using your actual prefix. Default PowerShell:

```powershell
$agentInstallDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.agent-skills'
$env:PATH = "$agentInstallDir;$env:PATH"
```

Default POSIX shell:

```sh
export PATH="$HOME/.agent-skills:$PATH"
```

Then, from the intended project directory, preview, initialize and diagnose:

```text
initskill --version
initskill init --target both --json --dry-run
initskill init --target both --json
initskill doctor --json
```

Confirm `--version` matches `<RELEASE_VERSION>`. Check each exit status and JSON
`ok`; stop on failure or conflicts. Initialization writes project agent files,
so review the dry-run plan before applying it. Use the command by its absolute
installed path instead if you prefer not to modify PATH.

## Future installation from public or private GitHub

All angle-bracket values below are placeholders. Replace `<OWNER>`, `<REPOSITORY>`,
`<PINNED_TAG>`, and `<EXPECTED_COMMIT_SHA>` with values provided by the owner.
Use a version tag such as `v<RELEASE_VERSION>` only once that tag actually exists;
verify its full commit SHA from a trusted source. Tags can move, so a tag name
alone is not sufficient verification. Do not invent a remote for this checkout.

```text
git clone --branch <PINNED_TAG> --single-branch https://github.com/<OWNER>/<REPOSITORY>.git agent-skills-source
git -C agent-skills-source checkout --detach <EXPECTED_COMMIT_SHA>
git -C agent-skills-source rev-parse HEAD
git -C agent-skills-source rev-parse <PINNED_TAG>^{commit}
```

Both resolved commits must equal the independently trusted SHA. Quote
`'<PINNED_TAG>^{commit}'` in shells that interpret braces. Check the source's
`package.json` version against the pinned release and inspect the installer and
dependencies before running it. If the repository contains this tool under
`.agent-skills/`, change into that directory; otherwise use the package root.
Run `node install.mjs --dry-run`, then `node install.mjs`, then the version/init/
doctor commands above from the intended project, with the installed path available.
For a downloaded release asset, use the checksum workflow before extraction.

Public repositories may allow anonymous clone. For private repositories, use the
user's already configured Git credential manager and interactive sign-in, or an
SSH URL `git@github.com:<OWNER>/<REPOSITORY>.git` with the user's existing SSH key.
If authentication is needed, let the user complete it locally; do not collect or
embed tokens in URLs, commands, generated files or AI prompts. `gh` is not required
for cloning. Never pipe remote downloads directly into a shell or run an
unverified downloaded installer unattended.

Suggested instruction for an AI installer: clone the owner-provided repository
using the user's existing authentication, pin and verify the supplied release
commit/version, inspect the local installer and lockfile, preview installation,
install into a dedicated directory, preview project initialization, run
`initskill init --target both --json`, and confirm `initskill doctor --json` succeeds.
Stop for missing trusted identity/version/checksum information, authentication
requiring the user, or an unresolved file conflict. Do not publish or commit.

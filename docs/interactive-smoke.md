# Windows Interactive Smoke

Run these gates from a normal signed-in Windows desktop PowerShell in the
repository root. Do not run them from a non-interactive service session.

## 1. Tool Check

```powershell
pnpm --version
rustc --version
& .\examples\PROTOC\protoc.exe --version
Get-Command protoc-gen-go
```

Rust generation is built into the committed `libprotoc 34.1`; no external Rust
plugin is required.

## 2. Native Core Flow

```powershell
pnpm install --frozen-lockfile
pnpm test:e2e
```

The command builds a test-only binary with the embedded WebDriver capability,
prepares `.e2e-workspace`, downloads the matching EdgeDriver to `.e2e-runtime`,
sets a test-process-only WebView2 sandbox override, and verifies settings,
schema editing, relationship graph interactions, Excel collision/backup and
populated reads, resolved JSON, all eight protoc languages, Unreal,
failure/cancellation, a real `config.json` dry-run/import, and default AppData
save/reload across two fresh application processes. A passing run must report
all four E2E spec files as passed and remove the isolated AppData profile.

## 3. Installer

```powershell
pnpm tauri:build
.\scripts\windows-installer-smoke.ps1 `
  -InstallerPath .\target\release\bundle\nsis\DataManager_0.1.0_x64-setup.exe
```

The smoke installs into a unique temporary directory, requires the installed
app to remain running for five seconds with an isolated writable AppData
profile, runs the generated uninstaller, and removes the profile. It must end
with `Installer install, launch, and uninstall smoke passed.`

## 4. Excel and UI Inspection

Run the interactive smoke from the same normal signed-in PowerShell session:

```powershell
pnpm interactive:smoke
```

The command first opens both committed rewrite workbooks through Excel itself
and verifies hidden dropdown sheets, frozen headers, and Enum/Message validation
through row 10,001. It then launches the normal release application with an
isolated temporary AppData profile and a copied Proto workspace. The printed
paths are safe to select in the native dialogs and use for generated outputs.
The script prompts for `PASS` or `FAIL` for each remaining interactive check:

1. Native directory and protoc-file selection.
2. Relationship node drag and canvas pan.
3. Excel open and Enum/Message dropdown behavior through row 10,001.
4. Excel collision choices and workbook file-open actions.
5. protoc and Unreal output-folder open actions.

It removes the temporary profile/workspace and writes a timestamped JSON report
under `artifacts/` containing the application hash, Windows/PowerShell/WebView2/
Excel versions, and every result. A passing run ends with
`Interactive Excel and desktop smoke passed.` The passing reports are retained
as M8 evidence and uploaded by the Windows workflow. They were verified before
the final Tauri-only cutover.

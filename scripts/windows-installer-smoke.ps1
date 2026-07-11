[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$temporaryRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$installDirectory = Join-Path $temporaryRoot ("DataManager-installer-smoke-" + [guid]::NewGuid().ToString('N'))
$profileDirectory = Join-Path $temporaryRoot ("DataManager-installer-profile-" + [guid]::NewGuid().ToString('N'))
$application = Join-Path $installDirectory 'datamanager-desktop.exe'
$uninstaller = Join-Path $installDirectory 'uninstall.exe'
$applicationProcess = $null
$profileEnvironment = @('USERPROFILE', 'HOME', 'LOCALAPPDATA', 'APPDATA')
$previousEnvironment = @{}

foreach ($name in $profileEnvironment) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Restore-ProfileEnvironment {
    foreach ($name in $profileEnvironment) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
}

function Remove-TemporaryProfile {
    if (-not (Test-Path -LiteralPath $profileDirectory -PathType Container)) {
        return
    }

    $temporaryRootPrefix = [IO.Path]::GetFullPath($temporaryRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    $profileFullPath = [IO.Path]::GetFullPath($profileDirectory)
    if (-not $profileFullPath.StartsWith($temporaryRootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove profile outside the temporary root: $profileFullPath"
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try {
            Remove-Item -LiteralPath $profileFullPath -Recurse -Force -ErrorAction Stop
        }
        catch {
            if ([DateTime]::UtcNow -ge $deadline) {
                throw
            }
            Start-Sleep -Milliseconds 250
        }
    } while (Test-Path -LiteralPath $profileFullPath)
}

try {
    $install = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDirectory") -Wait -PassThru -WindowStyle Hidden
    if ($install.ExitCode -ne 0) {
        throw "Installer exited with code $($install.ExitCode)."
    }
    if (-not (Test-Path -LiteralPath $application -PathType Leaf)) {
        throw "Installed application was not found at $application."
    }
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "Uninstaller was not found at $uninstaller."
    }

    $localAppData = Join-Path $profileDirectory 'AppData\Local'
    $roamingAppData = Join-Path $profileDirectory 'AppData\Roaming'
    New-Item -ItemType Directory -Force -Path $localAppData, $roamingAppData | Out-Null
    $env:USERPROFILE = $profileDirectory
    $env:HOME = $profileDirectory
    $env:LOCALAPPDATA = $localAppData
    $env:APPDATA = $roamingAppData

    try {
        $applicationProcess = Start-Process -FilePath $application -PassThru -WindowStyle Hidden
    }
    finally {
        Restore-ProfileEnvironment
    }
    Start-Sleep -Seconds 5
    if ($applicationProcess.HasExited) {
        throw "Installed application exited early with code $($applicationProcess.ExitCode)."
    }
    & (Join-Path $PSScriptRoot 'windows-example-settings-check.ps1') -ProfileDirectory $profileDirectory
    Write-Output "Installed application stayed running: $application"
}
finally {
    Restore-ProfileEnvironment
    if ($applicationProcess -and -not $applicationProcess.HasExited) {
        Stop-Process -Id $applicationProcess.Id -Force
        $applicationProcess.WaitForExit()
    }
    if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
        $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
        if ($uninstall.ExitCode -ne 0) {
            throw "Uninstaller exited with code $($uninstall.ExitCode)."
        }
    }
    Remove-TemporaryProfile
}

$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ((Test-Path -LiteralPath $application) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
}
if (Test-Path -LiteralPath $application) {
    throw "Uninstall did not remove $application."
}
Write-Output "Installer install, launch, and uninstall smoke passed."

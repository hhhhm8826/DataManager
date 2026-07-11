[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArchivePath
)

$ErrorActionPreference = 'Stop'
$archive = (Resolve-Path -LiteralPath $ArchivePath).Path
$temporaryRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$extractDirectory = Join-Path $temporaryRoot ("DataManager-portable-smoke-" + [guid]::NewGuid().ToString('N'))
$profileDirectory = Join-Path $temporaryRoot ("DataManager-portable-profile-" + [guid]::NewGuid().ToString('N'))
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

function Remove-TemporaryDirectory([string]$Path) {
    $temporaryPrefix = [IO.Path]::GetFullPath($temporaryRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove directory outside the temporary root: $fullPath"
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (Test-Path -LiteralPath $fullPath) {
        try {
            Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
        }
        catch {
            if ([DateTime]::UtcNow -ge $deadline) {
                throw
            }
            Start-Sleep -Milliseconds 250
        }
    }
}

try {
    Expand-Archive -LiteralPath $archive -DestinationPath $extractDirectory
    $application = Join-Path $extractDirectory 'DataManager.exe'
    if (-not (Test-Path -LiteralPath $application -PathType Leaf)) {
        throw "Portable application was not found at $application."
    }
    foreach ($resource in @('PROTO', 'EXCEL', 'JSON', 'CODE', 'PROTOC')) {
        if (-not (Test-Path -LiteralPath (Join-Path $extractDirectory "examples\$resource") -PathType Container)) {
            throw "Portable resource is missing: examples\$resource"
        }
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

    & (Join-Path $PSScriptRoot 'windows-example-settings-check.ps1') -ProfileDirectory $profileDirectory
    if ($applicationProcess.HasExited) {
        throw "Portable application exited early with code $($applicationProcess.ExitCode)."
    }
    Write-Output "Portable launch smoke passed: $application"
}
finally {
    Restore-ProfileEnvironment
    if ($applicationProcess -and -not $applicationProcess.HasExited) {
        Stop-Process -Id $applicationProcess.Id -Force
        $applicationProcess.WaitForExit()
    }
    Remove-TemporaryDirectory $extractDirectory
    Remove-TemporaryDirectory $profileDirectory
}

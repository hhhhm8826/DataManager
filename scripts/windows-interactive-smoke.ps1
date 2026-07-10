[CmdletBinding()]
param(
    [string]$ApplicationPath = (Join-Path $PSScriptRoot '..\target\release\datamanager-desktop.exe'),
    [string]$ReportDirectory = (Join-Path $PSScriptRoot '..\artifacts'),
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$application = (Resolve-Path -LiteralPath $ApplicationPath).Path
$reportRoot = [IO.Path]::GetFullPath($ReportDirectory)
$fixtureRoot = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot 'tests\fixtures\m0-legacy\proto')).Path
$excelSmoke = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'windows-excel-smoke.ps1')).Path
$temporaryRoot = [IO.Path]::GetFullPath($env:TEMP)
$runId = [guid]::NewGuid().ToString('N')
$profileDirectory = Join-Path $temporaryRoot "DataManager-interactive-profile-$runId"
$workspaceDirectory = Join-Path $temporaryRoot "DataManager-interactive-workspace-$runId"
$applicationProcess = $null
$checks = [Collections.Generic.List[object]]::new()
$excelOutput = @()
$runError = $null

function Get-FileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Get-WebView2Version {
    $roots = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\EdgeWebView\Application'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\EdgeWebView\Application')
    )
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root -PathType Container)) {
            continue
        }
        $version = Get-ChildItem -LiteralPath $root -Directory |
            Where-Object { $_.Name -match '^\d+(\.\d+)+$' } |
            Sort-Object { [version]$_.Name } -Descending |
            Select-Object -First 1 -ExpandProperty Name
        if ($version) {
            return $version
        }
    }
    return $null
}

function Get-ExcelVersion {
    $configuration = Get-ItemProperty `
        -Path 'HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration' `
        -ErrorAction SilentlyContinue
    return $configuration.VersionToReport
}

function Assert-NormalInteractiveSession {
    $sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
    if (-not [Environment]::UserInteractive -or $sessionId -eq 0) {
        throw 'Run this command from a normal signed-in Windows desktop PowerShell session.'
    }
}

function New-IsolatedWorkspace {
    $protoRoot = Join-Path $workspaceDirectory 'proto'
    foreach ($directory in @(
        $profileDirectory,
        (Join-Path $profileDirectory 'AppData\Local'),
        (Join-Path $profileDirectory 'AppData\Roaming'),
        $protoRoot,
        (Join-Path $workspaceDirectory 'excel'),
        (Join-Path $workspaceDirectory 'json'),
        (Join-Path $workspaceDirectory 'code')
    )) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
    Copy-Item -Path (Join-Path $fixtureRoot '*.proto') -Destination $protoRoot -Force
}

function Remove-OwnedTemporaryDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedPrefix
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return
    }
    $temporaryPrefix = $temporaryRoot.TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (
        -not $fullPath.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not [IO.Path]::GetFileName($fullPath).StartsWith($ExpectedPrefix, [StringComparison]::Ordinal)
    ) {
        throw "Refusing to remove unexpected interactive-smoke path: $fullPath"
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try {
            Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
        }
        catch {
            if ([DateTime]::UtcNow -ge $deadline) {
                throw
            }
            Start-Sleep -Milliseconds 250
        }
    } while (Test-Path -LiteralPath $fullPath)
}

function Read-ManualCheck {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Prompt
    )
    do {
        $answer = (Read-Host "$Prompt [PASS/FAIL]").Trim().ToUpperInvariant()
    } while ($answer -notin @('PASS', 'FAIL'))
    $note = if ($answer -eq 'FAIL') { Read-Host 'Failure note' } else { '' }
    return [pscustomobject]@{
        id = $Id
        passed = $answer -eq 'PASS'
        note = $note
    }
}

if ($ValidateOnly) {
    Write-Output "Interactive smoke prerequisites are present."
    Write-Output "Application: $application"
    Write-Output "Fixture: $fixtureRoot"
    Write-Output "Excel smoke: $excelSmoke"
    exit 0
}

Assert-NormalInteractiveSession

try {
    $excelOutput = @(& pwsh -NoProfile -File $excelSmoke 2>&1)
    $excelPassed = $LASTEXITCODE -eq 0
    $checks.Add([pscustomobject]@{
        id = 'excel-com-structure'
        passed = $excelPassed
        note = ($excelOutput -join [Environment]::NewLine)
    })
    if (-not $excelPassed) {
        throw 'Excel COM structure smoke failed; desktop prompts were not started.'
    }

    New-IsolatedWorkspace
    $environment = @{
        USERPROFILE = $profileDirectory
        HOME = $profileDirectory
        LOCALAPPDATA = (Join-Path $profileDirectory 'AppData\Local')
        APPDATA = (Join-Path $profileDirectory 'AppData\Roaming')
    }
    $applicationProcess = Start-Process `
        -FilePath $application `
        -WorkingDirectory $repositoryRoot `
        -Environment $environment `
        -PassThru
    Start-Sleep -Seconds 3
    if ($applicationProcess.HasExited) {
        throw "DataManager exited early with code $($applicationProcess.ExitCode)."
    }

    Write-Output ''
    Write-Output 'DataManager is running with isolated paths:'
    Write-Output "  Profile:   $profileDirectory"
    Write-Output "  Proto:     $(Join-Path $workspaceDirectory 'proto')"
    Write-Output "  Excel:     $(Join-Path $workspaceDirectory 'excel')"
    Write-Output "  JSON:      $(Join-Path $workspaceDirectory 'json')"
    Write-Output "  Code:      $(Join-Path $workspaceDirectory 'code')"
    Write-Output ''

    $checks.Add((Read-ManualCheck 'native-dialogs' 'Directory and protoc file dialogs open and return the selected paths.'))
    $checks.Add((Read-ManualCheck 'diagram-drag-pan' 'A relationship node drags and the empty canvas pans.'))
    $checks.Add((Read-ManualCheck 'excel-dropdowns' 'Generated workbooks open in Excel and Enum/Message dropdowns work through row 10001.'))
    $checks.Add((Read-ManualCheck 'excel-file-open' 'Excel cancel/overwrite/backup and workbook file-open actions work.'))
    $checks.Add((Read-ManualCheck 'code-output-open' 'Generated protoc and Unreal output folders open from the application.'))
}
catch {
    $runError = $_.Exception.Message
}
finally {
    if ($applicationProcess -and -not $applicationProcess.HasExited) {
        Stop-Process -Id $applicationProcess.Id -Force
        $applicationProcess.WaitForExit()
    }
    Remove-OwnedTemporaryDirectory $profileDirectory 'DataManager-interactive-profile-'
    Remove-OwnedTemporaryDirectory $workspaceDirectory 'DataManager-interactive-workspace-'
}

$allPassed = -not $runError -and $checks.Count -eq 6 -and -not ($checks | Where-Object { -not $_.passed })
$report = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTimeOffset]::Now.ToString('O')
    passed = [bool]$allPassed
    error = $runError
    environment = [ordered]@{
        os = [Runtime.InteropServices.RuntimeInformation]::OSDescription
        powershell = $PSVersionTable.PSVersion.ToString()
        sessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
        webView2 = Get-WebView2Version
        excel = Get-ExcelVersion
    }
    application = [ordered]@{
        path = $application
        sha256 = Get-FileSha256 $application
    }
    checks = @($checks)
}

New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null
$reportPath = Join-Path $reportRoot ("interactive-smoke-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding utf8
Write-Output "Interactive smoke report: $reportPath"

if (-not $allPassed) {
    $reason = if ($runError) { $runError } else { 'One or more checks were marked FAIL.' }
    throw "Interactive smoke did not pass: $reason Review the generated report."
}
Write-Output 'Interactive Excel and desktop smoke passed.'

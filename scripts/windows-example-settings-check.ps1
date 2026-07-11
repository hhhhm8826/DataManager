[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProfileDirectory,

    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$profile = [IO.Path]::GetFullPath($ProfileDirectory)
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$settingsFile = $null

do {
    $settingsFile = Get-ChildItem -LiteralPath $profile -Recurse -Filter 'settings.v2.json' -File -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $settingsFile) {
        Start-Sleep -Milliseconds 250
    }
} while (-not $settingsFile -and [DateTime]::UtcNow -lt $deadline)

if (-not $settingsFile) {
    throw "First launch did not create settings.v2.json under $profile."
}

$settings = Get-Content -LiteralPath $settingsFile.FullName -Raw | ConvertFrom-Json
$workspace = Join-Path $settingsFile.Directory.FullName 'example-workspace'
$expected = @{
    protoRoot = Join-Path $workspace 'PROTO'
    excelRoot = Join-Path $workspace 'EXCEL'
    jsonRoot = Join-Path $workspace 'JSON'
    protocExecutable = Join-Path $workspace 'PROTOC\protoc.exe'
}

foreach ($field in $expected.Keys) {
    $actualPath = [IO.Path]::GetFullPath([string]$settings.$field)
    $expectedPath = [IO.Path]::GetFullPath($expected[$field])
    if (-not $actualPath.Equals($expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unexpected $field path. Expected '$expectedPath', received '$actualPath'."
    }
}

foreach ($directory in @($expected.protoRoot, $expected.excelRoot, $expected.jsonRoot)) {
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        throw "Example directory was not created: $directory"
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $expected.protoRoot 'StringTable.proto') -PathType Leaf)) {
    throw 'The bundled example Proto files were not copied on first launch.'
}
if (-not (Test-Path -LiteralPath $expected.protocExecutable -PathType Leaf)) {
    throw 'The bundled protoc executable was not copied on first launch.'
}
if (@($settings.codegenOutputs).Count -ne 4) {
    throw "Expected four example code generation outputs, received $(@($settings.codegenOutputs).Count)."
}

Write-Output "First-launch example settings passed: $($settingsFile.FullName)"

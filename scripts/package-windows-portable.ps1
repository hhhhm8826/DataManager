[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApplicationPath,

    [Parameter(Mandatory = $true)]
    [string]$ExamplesPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$application = (Resolve-Path -LiteralPath $ApplicationPath).Path
$examples = (Resolve-Path -LiteralPath $ExamplesPath).Path
$output = [IO.Path]::GetFullPath($OutputPath)
$temporaryRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$staging = Join-Path $temporaryRoot ("DataManager-portable-package-" + [guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $output), $staging | Out-Null
    Copy-Item -LiteralPath $application -Destination (Join-Path $staging 'DataManager.exe')
    $portableExamples = Join-Path $staging 'examples'
    New-Item -ItemType Directory -Force -Path $portableExamples | Out-Null
    foreach ($name in @('PROTO', 'EXCEL', 'JSON', 'CODE', 'PROTOC')) {
        $source = Join-Path $examples $name
        if (-not (Test-Path -LiteralPath $source -PathType Container)) {
            throw "Example directory is missing: $source"
        }
        Copy-Item -LiteralPath $source -Destination $portableExamples -Recurse
    }
    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output -Force
    }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $output -CompressionLevel Optimal
}
finally {
    $temporaryPrefix = [IO.Path]::GetFullPath($temporaryRoot).TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    $stagingPath = [IO.Path]::GetFullPath($staging)
    if ($stagingPath.StartsWith($temporaryPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        (Test-Path -LiteralPath $stagingPath)) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
}

Write-Output "Portable archive created: $output"

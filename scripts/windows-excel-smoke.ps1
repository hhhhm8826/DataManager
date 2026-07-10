[CmdletBinding()]
param(
    [string]$ExcelDirectory = (Join-Path $PSScriptRoot '..\examples\TAURI_REWRITE\EXCEL')
)

$ErrorActionPreference = 'Stop'
$excelRoot = (Resolve-Path -LiteralPath $ExcelDirectory).Path
$keyTablePath = Join-Path $excelRoot 'KeyTable.xlsx'
$referenceTablePath = Join-Path $excelRoot 'ReferenceTable.xlsx'

foreach ($path in @($keyTablePath, $referenceTablePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Workbook was not found: $path"
    }
}

function Assert-Equal {
    param(
        [object]$Actual,
        [object]$Expected,
        [string]$Message
    )
    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', received '$Actual'."
    }
}

function Assert-Contains {
    param(
        [string]$Actual,
        [string]$Expected,
        [string]$Message
    )
    if (-not $Actual.Contains($Expected)) {
        throw "$Message Expected '$Expected' in '$Actual'."
    }
}

function Get-Headers {
    param(
        [object]$Worksheet,
        [int]$Count
    )
    return 1..$Count | ForEach-Object { [string]$Worksheet.Cells.Item(1, $_).Value2 }
}

function Assert-FrozenHeader {
    param([object]$Excel, [object]$Worksheet)
    $Worksheet.Activate()
    Assert-Equal $Excel.ActiveWindow.SplitRow 1 "$($Worksheet.Name) split row."
    Assert-Equal $Excel.ActiveWindow.FreezePanes $true "$($Worksheet.Name) frozen header."
}

$excel = $null
$workbooks = @()
try {
    try {
        $excel = New-Object -ComObject Excel.Application
    }
    catch {
        throw "Microsoft Excel COM activation failed. Run this smoke from a normal signed-in Windows PowerShell session. $($_.Exception.Message)"
    }
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $keyWorkbook = $excel.Workbooks.Open($keyTablePath, 0, $true)
    $workbooks += $keyWorkbook
    Assert-Equal $keyWorkbook.Worksheets.Count 5 'KeyTable sheet count.'
    Assert-Equal $keyWorkbook.Worksheets.Item(1).Name 'SingleTarget' 'First KeyTable sheet.'
    Assert-Equal $keyWorkbook.Worksheets.Item(5).Name '_DropDown' 'Dropdown sheet name.'
    Assert-Equal $keyWorkbook.Worksheets.Item('_DropDown').Visible 2 'Dropdown sheet visibility.'

    $singleTarget = $keyWorkbook.Worksheets.Item('SingleTarget')
    Assert-Equal ((Get-Headers $singleTarget 3) -join ',') 'id,label,state' 'SingleTarget headers.'
    Assert-FrozenHeader $excel $singleTarget
    foreach ($cellAddress in @('C2', 'C10001')) {
        $formula = [string]$singleTarget.Range($cellAddress).Validation.Formula1
        Assert-Contains $formula '_DropDown' "SingleTarget $cellAddress Enum validation."
        Assert-Contains $formula '$A$2:$A$3' "SingleTarget $cellAddress Enum range."
    }

    $referenceWorkbook = $excel.Workbooks.Open($referenceTablePath, 0, $true)
    $workbooks += $referenceWorkbook
    Assert-Equal $referenceWorkbook.Worksheets.Count 5 'ReferenceTable sheet count.'
    Assert-Equal $referenceWorkbook.Worksheets.Item(1).Name 'MiddleTarget' 'First reference sheet.'
    Assert-Equal $referenceWorkbook.Worksheets.Item(5).Name '_DropDown' 'Reference dropdown sheet.'
    Assert-Equal $referenceWorkbook.Worksheets.Item('_DropDown').Visible 2 'Reference dropdown visibility.'

    $rootTarget = $referenceWorkbook.Worksheets.Item('RootTarget')
    Assert-Equal ((Get-Headers $rootTarget 7) -join ',') 'id,single,composite,group,middle,noKey,state' 'RootTarget headers.'
    Assert-FrozenHeader $excel $rootTarget
    foreach ($cellAddress in @('E2', 'E10001')) {
        $formula = [string]$rootTarget.Range($cellAddress).Validation.Formula1
        Assert-Contains $formula 'MiddleTarget' "RootTarget $cellAddress Message validation."
        Assert-Contains $formula '$A$10001' "RootTarget $cellAddress Message range."
    }
    foreach ($cellAddress in @('G2', 'G10001')) {
        $formula = [string]$rootTarget.Range($cellAddress).Validation.Formula1
        Assert-Contains $formula '_DropDown' "RootTarget $cellAddress Enum validation."
        Assert-Contains $formula '$A$2:$A$3' "RootTarget $cellAddress Enum range."
    }

    Write-Output "Microsoft Excel $($excel.Version) opened and validated both rewrite workbooks."
}
finally {
    foreach ($workbook in $workbooks) {
        $workbook.Close($false)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook)
    }
    if ($excel) {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

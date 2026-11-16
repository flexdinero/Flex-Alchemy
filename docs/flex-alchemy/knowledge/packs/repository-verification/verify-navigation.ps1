param([Parameter(Mandatory)][string]$KnowledgeRoot)
$ErrorActionPreference = 'Stop'
$readme = Join-Path $KnowledgeRoot 'README.md'
$navigation = Get-Content -LiteralPath $readme -Raw
$required = @('source-index.md', 'inventory.md', 'admission.md', 'packs/repository-verification/SKILL.md')
$failures = @()
foreach ($target in $required) {
    $linkPattern = '\]\(' + [regex]::Escape($target) + '\)'
    if ($navigation -notmatch $linkPattern) {
        $failures += "Missing navigation link: $target"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $KnowledgeRoot $target) -PathType Leaf)) {
        $failures += "Missing link target: $target"
    }
}
if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Output "FAIL $_" }
    exit 1
}
Write-Output "PASS all $($required.Count) required links and targets exist"

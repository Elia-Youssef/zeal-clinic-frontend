#Requires -Version 7.0
<#
.SYNOPSIS
    Dashboard CI stages, shared by local runs and GitHub Actions.

.DESCRIPTION
    pwsh scripts/ci.ps1 -Stage <name> [-ArtifactsDir <dir>] [-BackendDir <dir>]

    Stages
      install    npm ci --prefer-offline --no-audit --no-fund
      typecheck  tsc --noEmit for tsconfig.app.json, tsconfig.node.json and tsconfig.test.json
      lint       eslint . --max-warnings from scripts/baseline/eslint.json; fails if the warning count
                 grows past it, prints a tighten hint if it drops. Also runs a report-only strict preview
                 with the seven relaxed rules restored to their recommended levels. Reports go to -ArtifactsDir
      ui-unit    vitest run, once with TZ=Asia/Beirut and once with TZ=Pacific/Kiritimati; JUnit and JSON
                 results, a v8 coverage summary and ui-unit-summary.txt go to -ArtifactsDir
      build      npm run build (a size list of dist/ goes to -ArtifactsDir)
      audit      npm audit --omit=dev --json against scripts/baseline/npm-audit.json; a new advisory
                 fails, one no longer present prints a tighten hint; the count with dev dependencies
                 included is reported for information only
      bundle     scripts/check-bundle.mjs sizes dist/assets (needs the build stage first) against
                 scripts/baseline/bundle.json; fails if total JS or CSS raw size grows past budget
      e2e        Playwright (Chromium) against the server with dist/ embedded (needs the build stage first
                 and -BackendDir, a checkout of the backend repo, whose scripts/stack.ps1 builds, seeds, starts
                 and stops the server). -E2E smoke runs the per-role route walk on the demo instance; -E2E full
                 then starts a fresh scenario instance (migrations only) for every other project. Installs the
                 browser when it is missing. Reports, traces, server logs and e2e-summary.txt go to -ArtifactsDir
                 (the scenario pass to its "scenario" subfolder); local runs also save a screenshot per walked
                 page to <ArtifactsDir>/album. E2E_UPDATE_GOLDENS=1 records e2e/golden/ from the run instead of
                 comparing; E2E_GREP runs only the matching tests; E2E_STACK_BIN_DIR keeps the server binary at
                 one path across runs.

    Runs only in a disposable checkout: a GitHub Actions runner, or a throwaway clone marked by an empty
    `.ci-scratch` file at its root (create it there to confirm that the stages may change that clone;
    never in a working copy). Anything else is refused.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('install', 'typecheck', 'lint', 'ui-unit', 'build', 'bundle', 'audit', 'e2e', 'workflows')]
    [string]$Stage,
    [string]$BackendDir,
    [string]$ArtifactsDir,
    [ValidateSet('smoke', 'full')]
    [string]$E2E = 'smoke'
)

# Guard: must run before anything else
$RepoRoot = Split-Path -Parent $PSScriptRoot
if ($env:GITHUB_ACTIONS -ne 'true' -and -not (Test-Path -LiteralPath (Join-Path $RepoRoot '.ci-scratch') -PathType Leaf)) {
    [Console]::Error.WriteLine("Refusing to run: '$RepoRoot' has no .ci-scratch marker at its root and this is not a GitHub Actions runner. The stages change the checkout they run in, so run them only in a throwaway clone, with an empty .ci-scratch file created at its root to confirm.")
    exit 1
}

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$OnActions = $env:GITHUB_ACTIONS -eq 'true'
$ScratchRoot = if ($OnActions -and $env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { Split-Path -Parent $RepoRoot }
if (-not $ArtifactsDir) { $ArtifactsDir = Join-Path $ScratchRoot (Join-Path 'artifacts' "dashboard-$Stage") }
$ArtifactsDir = [System.IO.Path]::GetFullPath($ArtifactsDir)
$Npm = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
$Npx = if ($IsWindows) { 'npx.cmd' } else { 'npx' }

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null

function Assert-NodeModules {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'node_modules') -PathType Container)) {
        throw "node_modules is missing: run the 'install' stage first"
    }
}

function Invoke-WorkflowsStage {
    <#
      workflows: actionlint over the files in .github/workflows. go run builds the pinned version (Go must be
      installed), so local runs and GitHub Actions check with the same rules. go run asks the module proxy
      about the module even when it is cached, so this stage needs network access. A job waiting for a stage
      that does not exist yet is switched off with a literal "if: false"; the constant-condition notice for
      exactly that is ignored.
    #>
    $module = 'github.com/rhysd/actionlint/cmd/actionlint@v1.7.12'
    $ignore = 'constant expression .false. in condition'
    if (-not (Get-Command go -CommandType Application -ErrorAction SilentlyContinue)) {
        Write-Host 'Summary: workflows: go is not on PATH (actionlint is built and run with go run)'
        return 1
    }
    $files = @(Get-ChildItem -LiteralPath (Join-Path $RepoRoot '.github/workflows') -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -in '.yml', '.yaml' } | Sort-Object Name | ForEach-Object { ".github/workflows/$($_.Name)" })
    if (-not $files.Count) {
        Write-Host 'Summary: workflows: no workflow files in .github/workflows'
        return 1
    }
    Write-Host "> go run $module -oneline -no-color -ignore '$ignore' $($files -join ' ')"
    $global:LASTEXITCODE = 99
    $out = @(& go run $module -oneline -no-color -ignore $ignore @files)
    $code = $LASTEXITCODE
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'actionlint.txt'), [string[]]$out)
    $problems = 0
    foreach ($line in $out) {
        Write-Host $line
        if ($line -notmatch '^([^:\s]+):(\d+):(\d+): (.*)$') { continue }
        $problems++
        # On GitHub Actions each problem also becomes an annotation on its workflow line.
        if ($OnActions) { Write-Host "::error title=actionlint,file=$($Matches[1]),line=$($Matches[2]),col=$($Matches[3])::$($Matches[4] -replace '%', '%25')" }
    }
    $state = if ($code -eq 0) { 'clean' } elseif ($problems) { "$problems problems" } else { "actionlint failed (exit $code)" }
    Write-Host "Summary: workflows: $($module.Split('/')[-1] -replace '@', ' '), $($files.Count) files, $state"
    return $(if ($code -eq 0) { 0 } else { 1 })
}

function Invoke-InstallStage {
    Write-Host "> $Npm ci --prefer-offline --no-audit --no-fund"
    $global:LASTEXITCODE = 99
    & $Npm ci --prefer-offline --no-audit --no-fund | Out-Host
    $code = $LASTEXITCODE
    $count = 0
    $nm = Join-Path $RepoRoot 'node_modules'
    if (Test-Path -LiteralPath $nm) {
        $count = @(Get-ChildItem -LiteralPath $nm -Directory -Force | ForEach-Object {
                if ($_.Name.StartsWith('@')) { Get-ChildItem -LiteralPath $_.FullName -Directory -Force } elseif (-not $_.Name.StartsWith('.')) { $_ }
            }).Count
    }
    Write-Host "Summary: npm ci exit $code; $count top-level packages in node_modules"
    return $(if ($code -eq 0) { 0 } else { 1 })
}

function Invoke-TypecheckStage {
    Assert-NodeModules
    $fail = $false
    $parts = [System.Collections.Generic.List[string]]::new()
    $report = [System.Collections.Generic.List[string]]::new()
    foreach ($cfg in 'tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.test.json') {
        Write-Host "> $Npx --no -- tsc --noEmit --pretty false -p $cfg"
        $global:LASTEXITCODE = 99
        $out = @(& $Npx --no -- tsc --noEmit --pretty false -p $cfg)
        $code = $LASTEXITCODE
        foreach ($l in $out) { Write-Host $l }
        $errors = @($out | Where-Object { $_ -match '\berror TS\d+' }).Count
        if ($code -ne 0) { $fail = $true }
        $parts.Add("${cfg}: $errors errors (exit $code)")
        $report.Add("== $cfg (exit $code, $errors errors)")
        $report.AddRange([string[]]$out)
    }
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'typecheck.txt'), $report)
    Write-Host "Summary: $($parts -join '; ')"
    return $(if ($fail) { 1 } else { 0 })
}

function Invoke-LintStrictPreview {
    # Report-only: the seven rules eslint.config.js turns off (lines 25-31), restored to the level
    # their own recommended or vite preset uses. A temporary config next to eslint.config.js, deleted
    # right after; eslint.config.js itself is never touched.
    $configPath = Join-Path $RepoRoot '.eslint-strict-preview.config.mjs'
    $previewJson = Join-Path $ArtifactsDir 'eslint-strict-preview.json'
    $configText = @'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// prefer-const has no recommended or vite preset in this rule set, so it is set to
// error here, matching common practice; the other six inherit their preset level.
export default defineConfig([
  globalIgnores(['dist', 'coverage', 'test-results', 'playwright-report', 'blob-report']),
  {
    files: ['**/*.{ts,tsx}'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'prefer-const': 'error',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}', '*.config.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
'@
    $ruleNames = '@typescript-eslint/no-unused-vars', '@typescript-eslint/no-explicit-any', 'react-hooks/exhaustive-deps',
    'react-hooks/set-state-in-effect', 'react-refresh/only-export-components', 'no-useless-assignment', 'prefer-const'
    try {
        [System.IO.File]::WriteAllText($configPath, $configText)
        Write-Host "> $Npx --no -- eslint . --config $configPath --format json --output-file $previewJson"
        $global:LASTEXITCODE = 99
        & $Npx --no -- eslint . --config $configPath --format json --output-file $previewJson | Out-Host
        $previewCode = $LASTEXITCODE
        if (-not (Test-Path -LiteralPath $previewJson)) {
            $line = "strict preview: no report (exit $previewCode)"
            return @{ Text = $line; Lines = @($line) }
        }
        $previewResults = @(Get-Content -LiteralPath $previewJson -Raw | ConvertFrom-Json)
        $pErrors = 0; $pWarnings = 0
        $byRule = @{}
        foreach ($name in $ruleNames) { $byRule[$name] = [ordered]@{ errors = 0; warnings = 0 } }
        foreach ($r in $previewResults) {
            $pErrors += $r.errorCount; $pWarnings += $r.warningCount
            foreach ($m in $r.messages) {
                $rule = if ($m.PSObject.Properties['ruleId']) { $m.ruleId } else { $null }
                if ($rule -and $byRule.Contains($rule)) {
                    if ($m.severity -eq 2) { $byRule[$rule].errors++ } else { $byRule[$rule].warnings++ }
                }
            }
        }
        $ruleLines = foreach ($name in $ruleNames) { "$name  errors=$($byRule[$name].errors) warnings=$($byRule[$name].warnings)" }
        $text = "strict preview (report-only, 7 relaxed rules): $pErrors errors, $pWarnings warnings"
        return @{ Text = $text; Lines = (@($text) + $ruleLines) }
    } finally {
        Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-LintStage {
    Set-StrictMode -Off   # ESLint's JSON report omits some fields per message
    Assert-NodeModules
    $baseline = Get-Content -LiteralPath (Join-Path $RepoRoot 'scripts/baseline/eslint.json') -Raw | ConvertFrom-Json
    $maxWarnings = [int]$baseline.maxWarnings

    $json = Join-Path $ArtifactsDir 'eslint.json'
    Write-Host "> $Npx --no -- eslint . --max-warnings $maxWarnings --format json --output-file $json"
    $global:LASTEXITCODE = 99
    & $Npx --no -- eslint . --max-warnings $maxWarnings --format json --output-file $json | Out-Host
    $code = $LASTEXITCODE
    if (-not (Test-Path -LiteralPath $json)) {
        Write-Host "Summary: eslint produced no report (exit $code)"
        return 1
    }
    $results = @(Get-Content -LiteralPath $json -Raw | ConvertFrom-Json)
    $errors = 0; $warnings = 0; $fatal = 0
    $rules = @{}
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($r in $results) {
        $errors += $r.errorCount; $warnings += $r.warningCount; $fatal += $r.fatalErrorCount
        foreach ($m in $r.messages) {
            $rel = [System.IO.Path]::GetRelativePath($RepoRoot, $r.filePath) -replace '\\', '/'
            $sev = if ($m.severity -eq 2) { 'error' } else { 'warning' }
            $rule = if ($m.PSObject.Properties['ruleId'] -and $m.ruleId) { $m.ruleId } else { '(none)' }
            $rules[$rule] = 1 + $(if ($rules.Contains($rule)) { $rules[$rule] } else { 0 })
            $lines.Add(('{0}:{1}:{2}  {3}  {4}  ({5})' -f $rel, $m.line, $m.column, $sev, $m.message, $rule))
        }
    }
    foreach ($l in $lines) { Write-Host $l }
    $byRule = ($rules.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
    $ratchet = if ($warnings -gt $maxWarnings) { "$warnings warnings, over the baseline of $maxWarnings" }
    elseif ($warnings -lt $maxWarnings) { "can tighten: $warnings warnings, baseline allows $maxWarnings" }
    else { "matches the baseline of $maxWarnings" }
    $summary = "eslint: $errors errors, $warnings warnings ($ratchet), $fatal fatal in $($results.Count) files$(if ($byRule) { "; by rule: $byRule" })"
    $fail = ($code -ne 0) -or ($errors -gt 0) -or ($fatal -gt 0) -or ($warnings -gt $maxWarnings)

    $preview = Invoke-LintStrictPreview
    $txt = @($summary) + $lines + @('') + $preview.Lines
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'lint-summary.txt'), [string[]]$txt)
    Write-Host "Summary: $summary; $($preview.Text)"
    return $(if ($fail) { 1 } else { 0 })
}

function Invoke-UiUnitStage {
    Set-StrictMode -Off   # Vitest's JSON report omits some fields
    Assert-NodeModules
    # One run per zone: the clinic date helpers must give the same answers whatever the machine's zone is.
    $zones = @('Asia/Beirut', 'Pacific/Kiritimati')
    $fail = $false
    $parts = [System.Collections.Generic.List[string]]::new()
    $details = [System.Collections.Generic.List[string]]::new()
    $perFile = [ordered]@{}
    $coverageNote = 'coverage: no summary'
    $savedTz = $env:TZ
    try {
        foreach ($zone in $zones) {
            $label = ($zone -split '/')[-1].ToLowerInvariant()
            $junit = Join-Path $ArtifactsDir "junit-$label.xml"
            $json = Join-Path $ArtifactsDir "results-$label.json"
            $coverageDir = Join-Path $ArtifactsDir "coverage-$label"
            $argList = @('--no', '--', 'vitest', 'run', '--reporter=default', '--reporter=junit', "--outputFile.junit=$junit",
                '--reporter=json', "--outputFile.json=$json", '--coverage.enabled=true', "--coverage.reportsDirectory=$coverageDir")
            if ($OnActions) { $argList += '--reporter=github-actions' }
            $env:TZ = $zone
            Write-Host "> TZ=$zone $Npx $($argList -join ' ')"
            $watch = [System.Diagnostics.Stopwatch]::StartNew()
            $global:LASTEXITCODE = 99
            & $Npx @argList | Out-Host
            $code = $LASTEXITCODE
            $watch.Stop()
            $seconds = [Math]::Round($watch.Elapsed.TotalSeconds, 1)
            if ($code -ne 0) { $fail = $true }

            if (-not (Test-Path -LiteralPath $json)) {
                $fail = $true
                $parts.Add("${zone}: no results (exit $code, $seconds s)")
                continue
            }
            $results = Get-Content -LiteralPath $json -Raw | ConvertFrom-Json
            $skipped = [int]$results.numPendingTests + [int]$results.numTodoTests
            $files = @($results.testResults)
            $filesFailed = @($files | Where-Object { $_.status -eq 'failed' }).Count
            $parts.Add(('{0}: {1} tests, {2} passed, {3} failed, {4} skipped in {5} files{6} (exit {7}, {8} s)' -f $zone,
                    $results.numTotalTests, $results.numPassedTests, $results.numFailedTests, $skipped, $files.Count,
                    $(if ($filesFailed) { " ($filesFailed failed)" } else { '' }), $code, $seconds))
            foreach ($file in $results.testResults) {
                $rel = [System.IO.Path]::GetRelativePath($RepoRoot, $file.name) -replace '\\', '/'
                $counts = @($file.assertionResults | Group-Object status | Sort-Object Name | ForEach-Object { "$($_.Count) $($_.Name)" }) -join ', '
                if (-not $counts) { $counts = "no tests ($($file.status))" }
                if (-not $perFile.Contains($rel)) { $perFile[$rel] = [ordered]@{} }
                $perFile[$rel][$zone] = $counts
            }

            $summaryJson = Join-Path $coverageDir 'coverage-summary.json'
            if (Test-Path -LiteralPath $summaryJson) {
                $total = (Get-Content -LiteralPath $summaryJson -Raw | ConvertFrom-Json).total
                $line = 'lines {0}%, statements {1}%, functions {2}%, branches {3}%' -f $total.lines.pct, $total.statements.pct, $total.functions.pct, $total.branches.pct
                $details.Add("coverage with TZ=${zone} (all of src/): $line")
                if ($zone -eq $zones[0]) { $coverageNote = "coverage (src/): $line" }
            } else {
                $details.Add("coverage with TZ=${zone}: no summary")
            }
        }
    } finally {
        if ($null -eq $savedTz) { Remove-Item Env:TZ -ErrorAction SilentlyContinue } else { $env:TZ = $savedTz }
    }

    $summary = "ui-unit: $($parts -join '; '); $coverageNote"
    $report = [System.Collections.Generic.List[string]]::new()
    $report.Add($summary)
    $report.AddRange([string[]]$details)
    $report.Add('')
    $report.Add('tests per file and zone:')
    foreach ($entry in $perFile.GetEnumerator()) {
        $cells = foreach ($zone in $zones) { "${zone}: $(if ($entry.Value.Contains($zone)) { $entry.Value[$zone] } else { 'not run' })" }
        $report.Add("  $($entry.Key)  |  $($cells -join '  |  ')")
    }
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'ui-unit-summary.txt'), [string[]]$report)
    Write-Host "Summary: $summary"
    return $(if ($fail) { 1 } else { 0 })
}

function Invoke-BuildStage {
    Assert-NodeModules
    Write-Host "> $Npm run build"
    $global:LASTEXITCODE = 99
    & $Npm run build | Out-Host
    $code = $LASTEXITCODE
    $dist = Join-Path $RepoRoot 'dist'
    if ($code -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
        Write-Host "Summary: build failed (exit $code)"
        return 1
    }
    $files = @(Get-ChildItem -LiteralPath $dist -Recurse -File | Sort-Object FullName)
    $rows = foreach ($f in $files) {
        '{0,12}  {1}' -f $f.Length, ([System.IO.Path]::GetRelativePath($dist, $f.FullName) -replace '\\', '/')
    }
    $total = ($files | Measure-Object Length -Sum).Sum
    $js = ($files | Where-Object Extension -eq '.js' | Measure-Object Length -Sum).Sum
    $css = ($files | Where-Object Extension -eq '.css' | Measure-Object Length -Sum).Sum
    $summary = "dist: $($files.Count) files, $total bytes (js $js, css $css)"
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'dist-files.txt'), [string[]](@($summary) + $rows))
    Write-Host "Summary: $summary"
    return 0
}

function Invoke-AuditStage {
    Set-StrictMode -Off   # npm's audit JSON shape varies by npm version
    Assert-NodeModules
    $baseline = Get-Content -LiteralPath (Join-Path $RepoRoot 'scripts/baseline/npm-audit.json') -Raw | ConvertFrom-Json

    $omitDevLog = Join-Path $ArtifactsDir 'npm-audit-omit-dev.json'
    Write-Host "> $Npm audit --omit=dev --json"
    $global:LASTEXITCODE = 99
    $omitDevOut = & $Npm audit --omit=dev --json 2>&1
    [System.IO.File]::WriteAllLines($omitDevLog, [string[]]$omitDevOut)
    $omitDev = $null
    try { $omitDev = ($omitDevOut -join "`n") | ConvertFrom-Json } catch { }
    if (-not $omitDev -or -not $omitDev.PSObject.Properties['vulnerabilities']) {
        Write-Host 'Summary: npm audit --omit=dev produced no parseable report'
        return 1
    }

    $fullLog = Join-Path $ArtifactsDir 'npm-audit-full.json'
    Write-Host "> $Npm audit --json"
    $global:LASTEXITCODE = 99
    $fullOut = & $Npm audit --json 2>&1
    [System.IO.File]::WriteAllLines($fullLog, [string[]]$fullOut)
    $full = $null
    try { $full = ($fullOut -join "`n") | ConvertFrom-Json } catch { }

    function Get-CiAdvisories($report) {
        $seen = @{}
        $out = [System.Collections.Generic.List[object]]::new()
        foreach ($prop in $report.vulnerabilities.PSObject.Properties) {
            foreach ($via in @($prop.Value.via)) {
                if ($via -is [string]) { continue }   # a reference to another vulnerable package, not an advisory
                $id = [string]$via.source
                if (-not $id -or $seen.ContainsKey($id)) { continue }
                $seen[$id] = $true
                $out.Add([pscustomobject]@{ id = $id; url = $via.url; package = $via.name; severity = $via.severity })
            }
        }
        return @($out | Sort-Object { [int]$_.id })
    }

    $current = Get-CiAdvisories $omitDev
    $baselineList = @($baseline.advisories | ForEach-Object { [pscustomobject]@{ id = [string]$_.id; url = $_.url; package = $_.package; severity = $_.severity } })
    $currentIds = @($current | ForEach-Object Id)
    $baselineIds = @($baselineList | ForEach-Object Id)
    $new = @($current | Where-Object { $baselineIds -notcontains $_.id })
    $missing = @($baselineList | Where-Object { $currentIds -notcontains $_.id })

    $lines = foreach ($a in $current) { "$($a.id)  $($a.severity)  $($a.package)  $($a.url)" }
    $ratchet = if ($new.Count) { "new: $((@($new | ForEach-Object { "$($_.package) #$($_.id)" })) -join ', ')" }
    elseif ($missing.Count) { "can tighten, no longer present: $((@($missing | ForEach-Object { "$($_.package) #$($_.id)" })) -join ', ')" }
    else { 'matches the baseline' }
    $fullTotal = if ($full -and $full.PSObject.Properties['metadata']) { $full.metadata.vulnerabilities.total } else { 'unknown' }
    # npm counts affected packages, not distinct advisory ids; a package can carry several advisories.
    $summary = "npm audit --omit=dev: $($current.Count) advisory ids ($ratchet); with dev dependencies: $fullTotal affected packages (information only)"
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'audit-summary.txt'), [string[]](@($summary) + $lines))
    Write-Host "Summary: $summary"
    return $(if ($new.Count) { 1 } else { 0 })
}

function Invoke-BundleStage {
    $dist = Join-Path $RepoRoot 'dist'
    if (-not (Test-Path -LiteralPath (Join-Path $dist 'assets') -PathType Container)) {
        Write-Host "Summary: dist/assets not found; run the build stage first"
        return 1
    }
    $baselinePath = Join-Path $RepoRoot 'scripts/baseline/bundle.json'
    $reportPath = Join-Path $ArtifactsDir 'bundle.json'
    $checkScript = Join-Path $RepoRoot 'scripts/check-bundle.mjs'
    Write-Host "> node $checkScript --dist $dist --baseline $baselinePath --report $reportPath"
    $global:LASTEXITCODE = 99
    $out = & node $checkScript --dist $dist --baseline $baselinePath --report $reportPath
    $code = $LASTEXITCODE
    foreach ($l in $out) { Write-Host $l }
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'bundle-output.txt'), [string[]]$out)
    $last = @($out | Where-Object { $_ -like 'Summary:*' }) | Select-Object -Last 1
    Write-Host "Summary: $(if ($last) { $last -replace '^Summary:\s*', '' } else { "check-bundle.mjs exit $code" })"
    return $(if ($code -eq 0) { 0 } else { 1 })
}

function Stop-LeftoverServer([string]$Backend, [string]$PassDir) {
    # The global teardown stops the server; this catches one left behind by a crashed or killed run.
    $statePath = Join-Path $PassDir 'stack/state.json'
    if (-not (Test-Path -LiteralPath $statePath)) { return '' }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $proc = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
    $path = if ($proc) { try { $proc.Path } catch { $null } } else { $null }
    $binDir = [System.IO.Path]::GetFullPath($state.binDir).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $path -or -not [System.IO.Path]::GetFullPath($path).StartsWith($binDir, [System.StringComparison]::OrdinalIgnoreCase)) {
        return ''
    }
    Write-Host "> pwsh stack.ps1 -Stop -Pid $($state.pid)   (still running after the tests)"
    $global:LASTEXITCODE = 99
    & ([Environment]::ProcessPath) -NoProfile -NonInteractive -File (Join-Path $Backend 'scripts/stack.ps1') -Stop -Pid $state.pid -BinDir $state.binDir | Out-Host
    return "the server (pid $($state.pid)) was still running after the tests and was stopped (exit $LASTEXITCODE)"
}

function Get-E2EFailures($Suites, [string[]]$Titles) {
    foreach ($suite in @($Suites)) {
        if (-not $suite) { continue }
        $path = @($Titles | Where-Object { $_ })
        if ($suite.title -and $suite.title -notmatch '\.(ts|js)$') { $path += $suite.title }
        foreach ($spec in @($suite.specs)) {
            if (-not $spec) { continue }
            foreach ($t in @($spec.tests)) {
                if ($t.status -in 'unexpected', 'flaky') { "$($t.status): [$($t.projectName)] $((@($path) + $spec.title) -join ' > ')" }
            }
        }
        Get-E2EFailures $suite.suites $path
    }
}

function Get-E2ETests($Suites) {
    foreach ($suite in @($Suites)) {
        if (-not $suite) { continue }
        foreach ($spec in @($suite.specs)) {
            if (-not $spec) { continue }
            foreach ($t in @($spec.tests)) {
                $runs = @($t.results | Where-Object { $_ })
                $start = $null; $end = $null; $ms = 0
                foreach ($r in $runs) {
                    $ms += [double]$r.duration
                    if ($r.startTime) {
                        $s = [DateTimeOffset]::Parse($r.startTime)
                        $e = $s.AddMilliseconds([double]$r.duration)
                        if (-not $start -or $s -lt $start) { $start = $s }
                        if (-not $end -or $e -gt $end) { $end = $e }
                    }
                }
                [pscustomobject]@{ Project = $t.projectName; File = $spec.file; Status = $t.status; Start = $start; End = $end; Ms = $ms }
            }
        }
        Get-E2ETests $suite.suites
    }
}

function Format-E2EDuration([double]$Seconds) {
    if ($Seconds -lt 60) { return '{0:0.0}s' -f $Seconds }
    return '{0}m{1:00}s' -f [Math]::Floor($Seconds / 60), [Math]::Floor($Seconds % 60)
}

function Get-E2EProjectLines($Tests) {
    # Per project: counts, wall time from its first test start to its last test end, and summed test time.
    foreach ($group in @($Tests | Group-Object Project | Sort-Object Name)) {
        $items = @($group.Group)
        $starts = @($items | Where-Object Start | ForEach-Object Start)
        $ends = @($items | Where-Object End | ForEach-Object End)
        $wall = if ($starts.Count) { (($ends | Measure-Object -Maximum).Maximum - ($starts | Measure-Object -Minimum).Minimum).TotalSeconds } else { 0 }
        $sum = ($items | Measure-Object Ms -Sum).Sum / 1000
        $by = @($items | Group-Object Status | Sort-Object Name | ForEach-Object { "$($_.Count) $($_.Name)" }) -join ', '
        "project $($group.Name): $($items.Count) tests ($by), $(Format-E2EDuration $wall) wall, $(Format-E2EDuration $sum) summed"
        foreach ($file in @($items | Group-Object File | Sort-Object Name)) {
            $fby = @($file.Group | Group-Object Status | Sort-Object Name | ForEach-Object { "$($_.Count) $($_.Name)" }) -join ', '
            "  $($file.Name): $($file.Count) tests ($fby), $(Format-E2EDuration ((($file.Group | Measure-Object Ms -Sum).Sum) / 1000)) summed"
        }
    }
}

function Invoke-E2EStage {
    Set-StrictMode -Off   # Playwright's JSON report omits empty fields
    Assert-NodeModules
    if (-not $BackendDir) {
        Write-Host 'Summary: e2e needs -BackendDir (a checkout of the backend repo)'
        return 1
    }
    $backend = [System.IO.Path]::GetFullPath($BackendDir)
    if (-not (Test-Path -LiteralPath (Join-Path $backend 'scripts/stack.ps1') -PathType Leaf)) {
        Write-Host "Summary: e2e: $backend has no scripts/stack.ps1"
        return 1
    }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'dist/index.html') -PathType Leaf)) {
        Write-Host 'Summary: e2e: dist/index.html not found; run the build stage first'
        return 1
    }

    # The Chromium build this Playwright version expects; nothing is downloaded once it is installed.
    Write-Host "> $Npx --no -- playwright install chromium"
    $global:LASTEXITCODE = 99
    & $Npx --no -- playwright install chromium | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Summary: e2e: playwright install chromium failed (exit $LASTEXITCODE)"
        return 1
    }

    # One server per pass (the clinic allows one node per machine), one after the other. smoke: the
    # per-role route walk on the demo instance; full: that, then every flow on a fresh scenario instance.
    # The demo pass writes to the artifacts folder itself, the scenario pass to its "scenario" subfolder.
    $passes = @([pscustomobject]@{ Name = 'demo'; Dir = $ArtifactsDir })
    if ($E2E -eq 'full') { $passes += [pscustomobject]@{ Name = 'scenario'; Dir = (Join-Path $ArtifactsDir 'scenario') } }
    # The album holds screenshots of the demo data: local runs only, next to the other artifacts.
    $album = if ($OnActions) { $null } else { Join-Path $ArtifactsDir 'album' }
    # E2E_GREP narrows a run to a few tests, so a pass may have none.
    [string[]]$extraArgs = @(if ($env:E2E_GREP) { '--pass-with-no-tests' })

    $fail = $false
    $totals = [ordered]@{ tests = 0; passed = 0; failed = 0; flaky = 0; skipped = 0 }
    $lines = [System.Collections.Generic.List[string]]::new()
    $details = [System.Collections.Generic.List[string]]::new()
    $notes = [System.Collections.Generic.List[string]]::new()
    $harnessErrors = [System.Collections.Generic.List[string]]::new()
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    foreach ($pass in $passes) {
        New-Item -ItemType Directory -Force -Path $pass.Dir | Out-Null
        # NO_COLOR is dropped: Playwright colors its worker output itself, and Node warns when both are set.
        $vars = [ordered]@{
            BACKEND_DIR = $backend; E2E_INSTANCE = $pass.Name; E2E_ARTIFACTS_DIR = $pass.Dir
            E2E_ALBUM_DIR = $(if ($pass.Name -eq 'demo') { $album } else { $null }); E2E_PWSH = [Environment]::ProcessPath; NO_COLOR = $null
        }
        $saved = @{}
        foreach ($k in $vars.Keys) {
            $saved[$k] = [Environment]::GetEnvironmentVariable($k)
            [Environment]::SetEnvironmentVariable($k, $vars[$k])
        }
        $passWatch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            Write-Host "> E2E_INSTANCE=$($pass.Name) $Npx --no -- playwright test $($extraArgs -join ' ')$(if ($env:E2E_UPDATE_GOLDENS -eq '1') { '   (E2E_UPDATE_GOLDENS=1: recording goldens)' })"
            $global:LASTEXITCODE = 99
            & $Npx --no -- playwright test @extraArgs | Out-Host
            $code = $LASTEXITCODE
        } finally {
            $passWatch.Stop()
            foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
        }
        $leftover = Stop-LeftoverServer $backend $pass.Dir
        if ($code -ne 0 -or $leftover) { $fail = $true }

        $counts = "no results.json (exit $code)"
        $headerAt = $details.Count
        $resultsPath = Join-Path $pass.Dir 'results.json'
        if (Test-Path -LiteralPath $resultsPath) {
            $results = Get-Content -LiteralPath $resultsPath -Raw | ConvertFrom-Json
            $s = $results.stats
            $total = [int]$s.expected + [int]$s.unexpected + [int]$s.flaky + [int]$s.skipped
            $totals.tests += $total; $totals.passed += [int]$s.expected; $totals.failed += [int]$s.unexpected
            $totals.flaky += [int]$s.flaky; $totals.skipped += [int]$s.skipped
            $counts = '{0} tests, {1} passed, {2} failed, {3} flaky, {4} skipped' -f $total, $s.expected, $s.unexpected, $s.flaky, $s.skipped
            foreach ($f in @(Get-E2EFailures $results.suites @())) { $lines.Add($f) }
            foreach ($e in @($results.errors)) { if ($e -and $e.message) { $lines.Add("error ($($pass.Name)): $(($e.message -split "`n")[0])") } }
            foreach ($l in @(Get-E2EProjectLines @(Get-E2ETests $results.suites))) { $details.Add($l) }
        }
        $details.Insert($headerAt, "$($pass.Name) pass: $counts in $([Math]::Round($passWatch.Elapsed.TotalSeconds, 1)) s (exit $code)")
        $harnessPath = Join-Path $pass.Dir 'harness-summary.txt'
        $harness = if (Test-Path -LiteralPath $harnessPath) { @(Get-Content -LiteralPath $harnessPath | Where-Object { $_ }) } else { @() }
        foreach ($h in $harness) {
            if ($h -like 'error:*') { $harnessErrors.Add("$($pass.Name) $h") } else { $notes.Add("$($pass.Name) $h") }
        }
        if ($leftover) { $notes.Add("$($pass.Name): $leftover") }
    }
    $watch.Stop()
    $seconds = [Math]::Round($watch.Elapsed.TotalSeconds, 1)

    $shots = if ($album -and (Test-Path -LiteralPath $album)) { @(Get-ChildItem -LiteralPath $album -Recurse -File -Filter '*.png').Count } else { 0 }
    if ($shots) { $notes.Add("album: $shots screenshots in $album") }
    $counts = '{0} tests, {1} passed, {2} failed, {3} flaky, {4} skipped' -f $totals.tests, $totals.passed, $totals.failed, $totals.flaky, $totals.skipped
    $summary = "e2e ${E2E}: $counts in $seconds s ($($passes.Count) pass$(if ($passes.Count -gt 1) { 'es' }), $(if ($fail) { 'failed' } else { 'ok' }))$(if ($notes.Count) { '; ' + ($notes -join '; ') })"
    $report = @($summary) + $lines + $harnessErrors + @('') + $details
    [System.IO.File]::WriteAllLines((Join-Path $ArtifactsDir 'e2e-summary.txt'), [string[]]$report)
    foreach ($l in $lines) { Write-Host $l }
    foreach ($l in $details) { Write-Host $l }
    Write-Host "Summary: $summary"
    return $(if ($fail) { 1 } else { 0 })
}

Push-Location $RepoRoot
$exitCode = 1
try {
    Write-Host "dashboard ci: stage $Stage, artifacts $ArtifactsDir"
    $result = switch ($Stage) {
        'install' { Invoke-InstallStage }
        'typecheck' { Invoke-TypecheckStage }
        'lint' { Invoke-LintStage }
        'workflows' { Invoke-WorkflowsStage }
        'ui-unit' { Invoke-UiUnitStage }
        'build' { Invoke-BuildStage }
        'audit' { Invoke-AuditStage }
        'bundle' { Invoke-BundleStage }
        'e2e' { Invoke-E2EStage }
    }
    $exitCode = [int](@($result)[-1])
} catch {
    [Console]::Error.WriteLine("ERROR: $($_.Exception.Message)")
    $exitCode = 1
} finally {
    Pop-Location
}
exit $exitCode

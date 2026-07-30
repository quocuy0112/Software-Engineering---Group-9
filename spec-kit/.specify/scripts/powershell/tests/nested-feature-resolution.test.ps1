$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path $PSScriptRoot -Parent
. (Join-Path $scriptRoot 'common.ps1')
$expectedRepo = (Resolve-Path -LiteralPath ((git -C $PSScriptRoot rev-parse --show-toplevel).Trim())).Path
$expectedFeature = Join-Path $expectedRepo 'spec-kit/specs/001-identity-authentication-account-recovery'
$paths = Get-FeaturePathsEnv
if ($paths.REPO_ROOT -ne $expectedRepo) { throw "Wrong repo root: $($paths.REPO_ROOT)" }
if ($paths.FEATURE_DIR -ne $expectedFeature) { throw "Wrong nested feature: $($paths.FEATURE_DIR)" }
if (-not (Test-Path -LiteralPath $paths.IMPL_PLAN -PathType Leaf)) { throw 'plan missing' }
if (-not (Test-Path -LiteralPath $paths.TASKS -PathType Leaf)) { throw 'tasks missing' }
$before = $env:SPECIFY_FEATURE_DIRECTORY
try {
    $env:SPECIFY_FEATURE_DIRECTORY = 'spec-kit/specs/001-identity-authentication-account-recovery'
    $explicit = Get-FeaturePathsEnv
    if ($explicit.FEATURE_DIR -ne $expectedFeature) { throw "Explicit path failed: $($explicit.FEATURE_DIR)" }
} finally {
    $env:SPECIFY_FEATURE_DIRECTORY = $before
}
Write-Output "PASS nested feature resolution: $expectedFeature"

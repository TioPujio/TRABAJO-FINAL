param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDir
)

$ErrorActionPreference = "Stop"

function Remove-Diacritics([string]$text) {
  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    $uc = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($uc -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  return $sb.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Slugify([string]$name) {
  $x = Remove-Diacritics $name
  $x = $x.ToLowerInvariant()
  $x = [Regex]::Replace($x, "[^a-z0-9]+", "-")
  $x = $x.Trim("-")
  if ([string]::IsNullOrWhiteSpace($x)) { $x = "image" }
  return $x
}

$backendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$destDir = Join-Path $backendRoot.Path "public\\products"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$src = Resolve-Path $SourceDir
$files = Get-ChildItem -LiteralPath $src -File | Where-Object {
  $_.Extension.ToLowerInvariant() -match "^(\.png|\.jpg|\.jpeg|\.webp)$"
}

$manifest = @()
$hashToDest = @{}

foreach ($file in $files) {
  $base = [IO.Path]::GetFileNameWithoutExtension($file.Name)
  $ext = $file.Extension.ToLowerInvariant()
  $slug = Slugify $base

  $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  if ($hashToDest.ContainsKey($hash)) {
    $manifest += [PSCustomObject]@{
      source = $file.FullName
      dest = $hashToDest[$hash]
      url = "/products/" + (Split-Path $hashToDest[$hash] -Leaf)
      sha256 = $hash
      deduped = $true
    }
    continue
  }

  $candidate = "$slug$ext"
  $destPath = Join-Path $destDir $candidate

  $i = 2
  while (Test-Path -LiteralPath $destPath) {
    $existingHash = (Get-FileHash -LiteralPath $destPath -Algorithm SHA256).Hash
    if ($existingHash -eq $hash) {
      $hashToDest[$hash] = $destPath
      $manifest += [PSCustomObject]@{
        source = $file.FullName
        dest = $destPath
        url = "/products/" + (Split-Path $destPath -Leaf)
        sha256 = $hash
        deduped = $true
      }
      $destPath = $null
      break
    }
    $candidate = "$slug-$i$ext"
    $destPath = Join-Path $destDir $candidate
    $i++
  }
  if ($null -eq $destPath) { continue }

  Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force
  $hashToDest[$hash] = $destPath

  $manifest += [PSCustomObject]@{
    source = $file.FullName
    dest = $destPath
    url = "/products/" + (Split-Path $destPath -Leaf)
    sha256 = $hash
    deduped = $false
  }
}

# Delete duplicate files already in dest (same hash, different names)
$destFiles = Get-ChildItem -LiteralPath $destDir -File | Where-Object { $_.Name -ne ".gitkeep" }
$destHashes = @{}
foreach ($f in $destFiles) {
  $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
  if ($destHashes.ContainsKey($h)) {
    try {
      Remove-Item -LiteralPath $f.FullName -Force
    } catch {
      Write-Warning ("Could not delete duplicate file: {0} ({1})" -f $f.FullName, $_.Exception.Message)
    }
  } else {
    $destHashes[$h] = $f.FullName
  }
}

$manifestPath = Join-Path $destDir "manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ("Imported {0} source files into {1} (unique: {2})." -f $files.Count, $destDir, $destHashes.Count)
Write-Host ("Manifest: {0}" -f $manifestPath)

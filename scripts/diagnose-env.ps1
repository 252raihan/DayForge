# Diagnoses the Supabase .env.local configuration WITHOUT printing secret values.
# Prints only: key name, value length, scheme, quoting/whitespace anomalies, and
# for the URL: host + whether it parses. Never the key body itself.

$ErrorActionPreference = 'Stop'
Set-Location 'e:\DayForge'

$lines = Get-Content .env.local
foreach ($raw in $lines) {
  if ($raw -match '^\s*#') { continue }           # comment
  if ($raw -notmatch '^\s*[A-Za-z_]') { continue } # blank/malformed

  $k = ($raw -split '=', 2)[0].Trim()
  $v = ($raw -split '=', 2)[1]

  $len     = ($v -replace '^["'']|["'']$', '').Length
  $quoted  = if ($v -match '^["'']|["'']$') { ' QUOTED' } else { '' }
  $spaces  = if ($v -match '^\s|\s$') { ' HAS-WHITESPACE' } else { '' }
  $scheme  = if ($v -match '^(https?)://') { $matches[1] } else { 'no-scheme' }

  Write-Output ("{0,-32} len={1,-4} scheme={2,-10}{3}{4}" -f $k, $len, $scheme, $quoted, $spaces)

  if ($k -eq 'NEXT_PUBLIC_SUPABASE_URL') {
    $hostPart = ([uri]$v.Trim('"','''')).Host
    Write-Output ("{0,-32} host={1}" -f '', $hostPart)
    $parts = $hostPart -split '\.'
    Write-Output ("{0,-32} host-labels={1} first-label-len={2}" -f '', $parts.Count, $parts[0].Length)
    Write-Output ("{0,-32} first-label-pattern-ok={1}" -f '', ($parts[0] -match '^[a-z0-9]{20}$'))
  }
}

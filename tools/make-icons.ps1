# Renders the PNG app icons (same geometry as icons/icon.svg) with System.Drawing.
# Usage: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'

function Draw-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $s = $size / 512.0
  $g.Clear([System.Drawing.Color]::Black)
  $white = [System.Drawing.Brushes]::White
  $black = [System.Drawing.Brushes]::Black

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (44 * $s)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $g.DrawLine($pen, 300 * $s, 210 * $s, 420 * $s, 90 * $s)

  foreach ($c in @(@(130, $white), @(104, $black), @(86, $white))) {
    $r = $c[0] * $s
    $g.FillEllipse($c[1], 220 * $s - $r, 292 * $s - $r, 2 * $r, 2 * $r)
  }
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 'icon-192.png'
Draw-Icon 512 'icon-512.png'
Draw-Icon 180 'apple-touch-icon.png'

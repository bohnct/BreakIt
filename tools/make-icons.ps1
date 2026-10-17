# Renders the PNG app icons from icons/pan-source.png (a black frying pan on white): the colours
# are inverted to a white pan on black, and the pan is scaled and centred so all of it sits
# inside the circle Android keeps when it masks an icon.
# Usage: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$icons = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'
$src = [System.Drawing.Bitmap]::FromFile((Join-Path $icons 'pan-source.png'))

# Find the pan: its bounding box, then how far its furthest dark pixel is from the box centre.
$rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
$data = $src.LockBits($rect, 'ReadOnly', [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$bytes = New-Object byte[] ($data.Stride * $src.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)
$dark = { param($x, $y) $bytes[$y * $data.Stride + $x * 3 + 1] -lt 128 }
$minX = $src.Width; $minY = $src.Height; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y += 2) {
  for ($x = 0; $x -lt $src.Width; $x += 2) {
    if (& $dark $x $y) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$cx = ($minX + $maxX) / 2; $cy = ($minY + $maxY) / 2; $reach = 0
for ($y = $minY; $y -le $maxY; $y += 2) {
  for ($x = $minX; $x -le $maxX; $x += 2) {
    if (& $dark $x $y) { $d = [Math]::Sqrt(($x - $cx) * ($x - $cx) + ($y - $cy) * ($y - $cy)); if ($d -gt $reach) { $reach = $d } }
  }
}
"Pan box ($minX,$minY)-($maxX,$maxY), reach $([Math]::Round($reach))"

# Invert colours as the image is drawn.
$m = New-Object System.Drawing.Imaging.ColorMatrix
$m.Matrix00 = -1; $m.Matrix11 = -1; $m.Matrix22 = -1
$m.Matrix40 = 1; $m.Matrix41 = 1; $m.Matrix42 = 1
$attrs = New-Object System.Drawing.Imaging.ImageAttributes
$attrs.SetColorMatrix($m)

function Draw-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Black)
  # The pan's furthest point lands 200/512 of the way from the centre (Android keeps 205/512).
  $s = ($size * 200 / 512) / $reach
  $w = $src.Width * $s; $h = $src.Height * $s
  $dest = New-Object System.Drawing.Rectangle ([int]($size / 2 - $cx * $s)), ([int]($size / 2 - $cy * $s)), ([int]$w), ([int]$h)
  $g.DrawImage($src, $dest, 0, 0, $src.Width, $src.Height, 'Pixel', $attrs)
  $bmp.Save((Join-Path $icons $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 'icon-192.png'
Draw-Icon 512 'icon-512.png'
Draw-Icon 180 'apple-touch-icon.png'
Draw-Icon 64 'favicon.png'
$src.Dispose()

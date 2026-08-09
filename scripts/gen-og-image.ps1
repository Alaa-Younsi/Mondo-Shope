# Generates public/og-image.png (1200x630), the social share card.
#
# This is the FALLBACK path: a composited brand card. Once the client uploads
# real product photos, prefer replacing this with a straight 1200x630 crop of
# the best hero/product photo — platforms already render the site name, title
# and description as text ABOVE the image, so a logo-and-tagline card is
# largely redundant with what they draw anyway.
#
# One-off asset generation. Not wired into the build.
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/gen-og-image.ps1

Add-Type -AssemblyName System.Drawing

$root      = Split-Path -Parent $PSScriptRoot
$logoPath  = Join-Path $root "public\logo.png"
$outPath   = Join-Path $root "public\og-image.png"

$width  = 1200
$height = 630

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
# Drawing2D is a NAMESPACE, not a type — the enum types live inside it.
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Base
$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 8, 8, 10))
$g.FillRectangle($bg, 0, 0, $width, $height)

# Accent glow. Use a PathGradientBrush, NOT concentric-circle loops — those
# band visibly at this size.
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowSize = 1100
$path.AddEllipse(
  [int](($width - $glowSize) / 2),
  [int](($height - $glowSize) / 2),
  $glowSize, $glowSize)

$glow = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$glow.CenterColor    = [System.Drawing.Color]::FromArgb(90, 250, 166, 66)
$glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 250, 166, 66))
$g.FillPath($glow, $path)

# Faint technical grid, matching the site's texture.
$gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(16, 244, 244, 245), 1)
for ($x = 0; $x -lt $width; $x += 48)  { $g.DrawLine($gridPen, $x, 0, $x, $height) }
for ($y = 0; $y -lt $height; $y += 48) { $g.DrawLine($gridPen, 0, $y, $width, $y) }

# Logo, centred in the upper half.
if (Test-Path $logoPath) {
  $logo = [System.Drawing.Image]::FromFile($logoPath)
  $targetWidth = 620
  # [Math]::Round returns a double; Bitmap/DrawImage need ints. Without the
  # explicit cast the draw silently no-ops and the file saves out blank black.
  $scale        = $targetWidth / $logo.Width
  $scaledWidth  = [int][Math]::Round($logo.Width * $scale)
  $scaledHeight = [int][Math]::Round($logo.Height * $scale)
  $logoX = [int](($width - $scaledWidth) / 2)
  $logoY = [int](($height - $scaledHeight) / 2 - 40)
  $g.DrawImage($logo, $logoX, $logoY, $scaledWidth, $scaledHeight)
  $logo.Dispose()
}

# Tagline
$font   = New-Object System.Drawing.Font("Segoe UI Semibold", 26, [System.Drawing.FontStyle]::Regular)
$brush  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 166, 66))
$format = New-Object System.Drawing.StringFormat
$format.Alignment     = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$tagline = "Paiement a la livraison  -  58 wilayas"
$rect = New-Object System.Drawing.RectangleF(0, ($height - 190), $width, 80)
$g.DrawString($tagline, $font, $brush, $rect, $format)

$g.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Wrote $outPath"

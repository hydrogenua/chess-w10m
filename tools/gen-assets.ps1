param([string]$OutDir)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot "..\src\assets" }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

# chess.com green, white knight glyph. WPF PngBitmapEncoder, NOT System.Drawing
# (System.Drawing PNGs have crashed WWAHost on the phone before).
$bgColor = [System.Windows.Media.ColorConverter]::ConvertFromString("#81B64C")
$script:BG = New-Object System.Windows.Media.SolidColorBrush($bgColor)
$script:FG = [System.Windows.Media.Brushes]::White
$script:KNIGHT = [string][char]0x265E

function New-Tile {
  param([int]$W, [int]$H, [string]$Path, [double]$GlyphSize, [string]$Label, [double]$LabelSize)
  $vis = New-Object System.Windows.Media.DrawingVisual
  $ctx = $vis.RenderOpen()
  $rect = New-Object System.Windows.Rect -ArgumentList 0, 0, $W, $H
  $ctx.DrawRectangle($script:BG, $null, $rect)
  $tf = New-Object System.Windows.Media.Typeface("Segoe UI Symbol")
  $ft = New-Object System.Windows.Media.FormattedText($script:KNIGHT, [System.Globalization.CultureInfo]::InvariantCulture, [System.Windows.FlowDirection]::LeftToRight, $tf, $GlyphSize, $script:FG)
  $gx = ($W - $ft.Width) / 2
  $gy = ($H - $ft.Height) / 2
  if ($Label) { $gy = $gy - ($LabelSize * 0.9) }
  $pt = New-Object System.Windows.Point -ArgumentList $gx, $gy
  $ctx.DrawText($ft, $pt)
  if ($Label) {
    $tf2 = New-Object System.Windows.Media.Typeface("Segoe UI")
    $ft2 = New-Object System.Windows.Media.FormattedText($Label, [System.Globalization.CultureInfo]::InvariantCulture, [System.Windows.FlowDirection]::LeftToRight, $tf2, $LabelSize, $script:FG)
    $lx = ($W - $ft2.Width) / 2
    $ly = $H - $ft2.Height - [Math]::Max(10, $H * 0.07)
    $pt2 = New-Object System.Windows.Point -ArgumentList $lx, $ly
    $ctx.DrawText($ft2, $pt2)
  }
  $ctx.Close()
  $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap -ArgumentList $W, $H, 96, 96, ([System.Windows.Media.PixelFormats]::Pbgra32)
  $rtb.Render($vis)
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $frame = [System.Windows.Media.Imaging.BitmapFrame]::Create($rtb)
  $enc.Frames.Add($frame)
  $fs = [System.IO.File]::Create($Path)
  $enc.Save($fs)
  $fs.Close()
  Write-Host "OK: $Path"
}

New-Tile -W 44  -H 44  -Path (Join-Path $OutDir "Square44x44Logo.png")   -GlyphSize 34  -Label "" -LabelSize 0
New-Tile -W 50  -H 50  -Path (Join-Path $OutDir "StoreLogo.png")         -GlyphSize 40  -Label "" -LabelSize 0
New-Tile -W 71  -H 71  -Path (Join-Path $OutDir "Square71x71Logo.png")   -GlyphSize 56  -Label "" -LabelSize 0
New-Tile -W 150 -H 150 -Path (Join-Path $OutDir "Square150x150Logo.png") -GlyphSize 104 -Label "" -LabelSize 0
New-Tile -W 310 -H 150 -Path (Join-Path $OutDir "Wide310x150Logo.png")   -GlyphSize 70  -Label "Chess.com" -LabelSize 28
New-Tile -W 620 -H 300 -Path (Join-Path $OutDir "SplashScreen.png")      -GlyphSize 120 -Label "Chess.com" -LabelSize 34

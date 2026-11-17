# Draws the CastCall logo at every size we need (favicons for Google, phone icons, share image) – no design tools needed.
# Run: powershell -ExecutionPolicy Bypass -File tools\make-logo.ps1
param([string]$Out = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))
Add-Type -AssemblyName System.Drawing

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
  return @($bmp, $g)
}
function C($hex, $a = 255) { $c = [System.Drawing.ColorTranslator]::FromHtml($hex); [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B) }
function P($x, $y) { New-Object System.Drawing.PointF ([float]$x), ([float]$y) }

# The mark: deep-ocean rounded square, a bold white fish leaping over two waves, with a fishing line arcing in.
# $s = size in px, $round = $true for the rounded-square app icon, $false for full-bleed (Android/iOS mask it).
function Draw-Logo($g, [float]$x, [float]$y, [float]$s, [bool]$round = $true, [bool]$simple = $false) {
  $k = $s / 512.0
  $rect = New-Object System.Drawing.RectangleF $x, $y, $s, $s
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($round) { $r = 116 * $k; $path.AddArc($x, $y, 2*$r, 2*$r, 180, 90); $path.AddArc($x+$s-2*$r, $y, 2*$r, 2*$r, 270, 90); $path.AddArc($x+$s-2*$r, $y+$s-2*$r, 2*$r, 2*$r, 0, 90); $path.AddArc($x, $y+$s-2*$r, 2*$r, 2*$r, 90, 90); $path.CloseFigure() }
  else { $path.AddRectangle($rect) }
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, (C '#1c6fd1'), (C '#0a2f5e'), 60
  $g.FillPath($bg, $path)
  $g.SetClip($path)
  # soft light at the top
  $glow = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.RectangleF $x, $y, $s, ($s*0.55)), (C '#ffffff' 40), (C '#ffffff' 0), 90
  $g.FillRectangle($glow, $x, $y, $s, $s*0.55)
  # waves
  foreach ($w in @(@{y=356; c='#7fb6f2'; t=34}, @{y=420; c='#3e8ee6'; t=34})) {
    $pen = New-Object System.Drawing.Pen (C $w.c), ([float]($w.t*$k)); $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
    $pts = @(); for ($i = 0; $i -le 48; $i++) { $px = 40 + $i * (432/48); $py = $w.y - 22 * [Math]::Sin(($px - 40) / 108 * [Math]::PI); $pts += P ($x + $px*$k) ($y + $py*$k) }
    $g.DrawLines($pen, [System.Drawing.PointF[]]$pts)
  }
  $white = [System.Drawing.Brushes]::White
  # fishing line arcing down from the top right to the fish's mouth (dropped at tiny sizes – it would just be noise)
  if (-not $simple) {
    $line = New-Object System.Drawing.Pen (C '#ffffff' 210), ([float](9*$k)); $line.StartCap = 'Round'; $line.EndCap = 'Round'
    $g.DrawBezier($line, (P ($x+470*$k) ($y+40*$k)), (P ($x+330*$k) ($y+40*$k)), (P ($x+140*$k) ($y+90*$k)), (P ($x+117*$k) ($y+250*$k)))
  }
  # fish body (leaping, slightly tilted)
  $state = $g.Save()
  $g.TranslateTransform(($x + 262*$k), ($y + 222*$k)); $g.RotateTransform(-12)
  $body = New-Object System.Drawing.Drawing2D.GraphicsPath
  $body.AddBezier((P (-150*$k) 0), (P (-70*$k) (-112*$k)), (P (70*$k) (-112*$k)), (P (138*$k) 0))
  $body.AddBezier((P (138*$k) 0), (P (70*$k) (100*$k)), (P (-70*$k) (100*$k)), (P (-150*$k) 0))
  $g.FillPath($white, $body)
  $tail = [System.Drawing.PointF[]]@((P (128*$k) 0), (P (214*$k) (-70*$k)), (P (192*$k) 0), (P (214*$k) (70*$k)))
  $g.FillPolygon($white, $tail)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (C '#0a2f5e')), (-102*$k), (-30*$k), (30*$k), (30*$k))
  $g.Restore($state)
  $g.ResetClip()
}

function Save-Icon($size, $file, $round = $true, $simple = $false) {
  $c = New-Canvas $size $size; $bmp = $c[0]; $g = $c[1]
  if (-not $round) { $g.Clear((C '#0a2f5e')) }
  Draw-Logo $g 0 0 $size $round $simple
  $bmp.Save((Join-Path $Out $file), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}

# Google search favicons must be square and a multiple of 48 px.
Save-Icon 48 'favicon-48.png' $true $true
Save-Icon 96 'favicon-96.png' $true $true
Save-Icon 192 'favicon-192.png' $true $false
Save-Icon 512 'logo-512.png' $true $false
# Phone home-screen icons (full bleed – the phone rounds the corners itself)
Save-Icon 180 'icon-180.png' $false $false
Save-Icon 192 'icon-192.png' $false $false
Save-Icon 512 'icon-512.png' $false $false

# favicon.ico with 16, 32 and 48 px inside (PNG-compressed entries – supported by all modern browsers and Google)
$sizes = 16, 32, 48; $pngs = @()
foreach ($s in $sizes) { $c = New-Canvas $s $s; Draw-Logo $c[1] 0 0 $s $true $true; $ms = New-Object IO.MemoryStream; $c[0].Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $pngs += ,$ms.ToArray(); $c[1].Dispose(); $c[0].Dispose() }
$ico = New-Object IO.MemoryStream; $bw = New-Object IO.BinaryWriter $ico
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) { $bw.Write([byte]$sizes[$i]); $bw.Write([byte]$sizes[$i]); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$pngs[$i].Length); $bw.Write([UInt32]$offset); $offset += $pngs[$i].Length }
foreach ($p in $pngs) { $bw.Write($p) }
[IO.File]::WriteAllBytes((Join-Path $Out 'favicon.ico'), $ico.ToArray())

# Share image (1200x630) shown when the link is posted on Facebook, Messenger, iMessage etc.
$c = New-Canvas 1200 630; $bmp = $c[0]; $g = $c[1]
$rect = New-Object System.Drawing.Rectangle 0, 0, 1200, 630
$g.FillRectangle((New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, (C '#0a2f5e'), (C '#1c5cab'), 35), $rect)
for ($b = 0; $b -lt 3; $b++) {
  $pts = @(); for ($i = 0; $i -le 60; $i++) { $px = $i * 20; $py = 540 + $b*28 - 18 * [Math]::Sin($px / 140 + $b); $pts += P $px $py }
  $pts += P 1200 630; $pts += P 0 630
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40 + $b*25, 134, 182, 239))), [System.Drawing.PointF[]]$pts)
}
Draw-Logo $g 80 110 250 $true $false
$fT = New-Object System.Drawing.Font 'Segoe UI', 96, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$fS = New-Object System.Drawing.Font 'Segoe UI Semibold', 40, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fL = New-Object System.Drawing.Font 'Segoe UI', 30, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('CastCall', $fT, [System.Drawing.Brushes]::White, 365, 100)
$g.DrawString("Australia's free fishing forecast", $fS, (New-Object System.Drawing.SolidBrush (C '#cde2fb')), 372, 222)
$items = 'Best fishing spots and bite times, right now', 'Tide times, wind, swell and water temp', "What's biting, best bait and depth maps"
for ($i = 0; $i -lt $items.Count; $i++) { $yy = 305 + $i*50; $g.FillEllipse((New-Object System.Drawing.SolidBrush (C '#86b6ef')), 376, ($yy+13), 14, 14); $g.DrawString($items[$i], $fL, [System.Drawing.Brushes]::White, 402, $yy) }
$bmp.Save((Join-Path $Out 'share.png'), [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
Get-ChildItem $Out -Include favicon*, logo-512.png, icon-*.png, share.png -Recurse -Depth 0 | Select-Object Name, Length | Format-Table -AutoSize | Out-String

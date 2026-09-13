Add-Type -AssemblyName System.Drawing

function New-RoundedRectangle([single]$x, [single]$y, [single]$width, [single]$height, [single]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-CollectionIcon([int]$size, [string]$outputPath) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $paper = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#cbbd9f'))
  $graphics.FillRectangle($paper, 0, 0, $size, $size)

  $random = New-Object System.Random(812)
  $fiber = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(22, 92, 70, 40), [Math]::Max(1, $size / 512))
  for ($index = 0; $index -lt 360; $index++) {
    $x = $random.NextDouble() * $size
    $y = $random.NextDouble() * $size
    $length = (2 + $random.NextDouble() * 10) * $size / 512
    $graphics.DrawLine($fiber, [single]$x, [single]$y, [single]($x + $length), [single]($y + $random.NextDouble() * 2))
  }

  $bookX = [single]($size * .24); $bookY = [single]($size * .14)
  $bookWidth = [single]($size * .52); $bookHeight = [single]($size * .72)
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(62, 55, 42, 27))
  $shadowPath = New-RoundedRectangle ($bookX + $size * .025) ($bookY + $size * .03) $bookWidth $bookHeight ($size * .018)
  $graphics.FillPath($shadow, $shadowPath)

  $cover = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#264c4b'))
  $coverPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#173535'), [Math]::Max(2, $size * .012))
  $coverPath = New-RoundedRectangle $bookX $bookY $bookWidth $bookHeight ($size * .018)
  $graphics.FillPath($cover, $coverPath); $graphics.DrawPath($coverPen, $coverPath)
  $goldPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#c7a461'), [Math]::Max(2, $size * .012))
  $graphics.DrawLine($goldPen, [single]($bookX + $size * .06), [single]($bookY + $size * .02), [single]($bookX + $size * .06), [single]($bookY + $bookHeight - $size * .02))

  $labelX = [single]($size * .37); $labelY = [single]($size * .22)
  $labelWidth = [single]($size * .29); $labelHeight = [single]($size * .55)
  $label = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#eee3c8'))
  $labelPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#b49a67'), [Math]::Max(1, $size * .006))
  $graphics.FillRectangle($label, $labelX, $labelY, $labelWidth, $labelHeight)
  $graphics.DrawRectangle($labelPen, $labelX, $labelY, $labelWidth, $labelHeight)

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $ink = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#302a23'))
  $titleFont = New-Object System.Drawing.Font('Yu Mincho', [single]($size * .19), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.DrawString('集', $titleFont, $ink, (New-Object System.Drawing.RectangleF($labelX, $labelY, $labelWidth, $labelHeight)), $format)

  $sealSize = [single]($size * .105)
  $sealX = [single]($labelX + $labelWidth - $sealSize * .82); $sealY = [single]($labelY + $labelHeight - $sealSize * .82)
  $seal = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#96352b'))
  $sealInk = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f0dfc3'))
  $sealFont = New-Object System.Drawing.Font('Yu Mincho', [single]($size * .043), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.FillEllipse($seal, $sealX, $sealY, $sealSize, $sealSize)
  $graphics.DrawString('印', $sealFont, $sealInk, (New-Object System.Drawing.RectangleF($sealX, $sealY, $sealSize, $sealSize)), $format)

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

$iconDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets\icons'
New-CollectionIcon 192 (Join-Path $iconDirectory 'app-icon-192.png')
New-CollectionIcon 512 (Join-Path $iconDirectory 'app-icon-512.png')
New-CollectionIcon 180 (Join-Path $iconDirectory 'apple-touch-icon.png')

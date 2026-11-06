Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\admin\.gemini\antigravity\brain\78e4462b-5166-4133-8e5f-ad00261cab64\.user_uploaded\media_1790779976258.png'
if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)
Write-Output "Loaded source logo: $($srcImg.Width)x$($srcImg.Height)"

function RenderSquareImage($src, [int]$canvasW, [int]$canvasH, [float]$scale, [string]$shape, [string]$bgHex) {
    $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml($bgHex)
    $brush = New-Object System.Drawing.SolidBrush($bgColor)

    if ($shape -eq 'circle') {
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.FillEllipse($brush, 0, 0, $canvasW, $canvasH)
    } elseif ($shape -eq 'rounded') {
        $g.Clear([System.Drawing.Color]::Transparent)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $radius = [float]($canvasW * 0.22)
        $dia = $radius * 2
        $path.AddArc(0, 0, $dia, $dia, 180, 90)
        $path.AddArc($canvasW - $dia, 0, $dia, $dia, 270, 90)
        $path.AddArc($canvasW - $dia, $canvasH - $dia, $dia, $dia, 0, 90)
        $path.AddArc(0, $canvasH - $dia, $dia, $dia, 90, 90)
        $path.CloseFigure()
        $g.FillPath($brush, $path)
        $path.Dispose()
    } elseif ($shape -eq 'transparent') {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $g.Clear($bgColor)
    }

    if ($scale -gt 0) {
        $srcRatio = [float]$src.Width / [float]$src.Height
        $targetW = [float]($canvasW * $scale)
        $targetH = $targetW / $srcRatio
        if ($targetH -gt ($canvasH * $scale)) {
            $targetH = [float]($canvasH * $scale)
            $targetW = $targetH * $srcRatio
        }

        $posX = ($canvasW - $targetW) / 2.0
        $posY = ($canvasH - $targetH) / 2.0

        $destRect = New-Object System.Drawing.RectangleF($posX, $posY, $targetW, $targetH)
        $g.DrawImage($src, $destRect)
    }

    $g.Dispose()
    $brush.Dispose()
    return $bmp
}

# 1. Update mobile/assets
Write-Output "Generating mobile/assets images..."
# logo.png - copy high-res directly
Copy-Item $srcPath -Destination 'mobile\assets\logo.png' -Force
Write-Output " -> mobile\assets\logo.png updated"

# icon.png (1024x1024)
$icon = RenderSquareImage $srcImg 1024 1024 0.70 'rounded' '#FFFFFF'
$icon.Save('mobile\assets\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose()
Write-Output " -> mobile\assets\icon.png generated"

# splash-icon.png (512x512)
$splash = RenderSquareImage $srcImg 512 512 0.65 'square' '#FFFFFF'
$splash.Save('mobile\assets\splash-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$splash.Dispose()
Write-Output " -> mobile\assets\splash-icon.png generated"

# favicon.png (192x192)
$fav = RenderSquareImage $srcImg 192 192 0.75 'rounded' '#FFFFFF'
$fav.Save('mobile\assets\favicon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$fav.Dispose()
Write-Output " -> mobile\assets\favicon.png generated"

# android-icon-foreground.png (432x432)
$fg = RenderSquareImage $srcImg 432 432 0.60 'square' '#FFFFFF'
$fg.Save('mobile\assets\android-icon-foreground.png', [System.Drawing.Imaging.ImageFormat]::Png)
$fg.Dispose()
Write-Output " -> mobile\assets\android-icon-foreground.png generated"

# android-icon-background.png (432x432)
$bg = RenderSquareImage $srcImg 432 432 0.0 'square' '#FFFFFF'
$bg.Save('mobile\assets\android-icon-background.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bg.Dispose()
Write-Output " -> mobile\assets\android-icon-background.png generated"

# android-icon-monochrome.png (432x432)
Copy-Item 'mobile\assets\android-icon-foreground.png' -Destination 'mobile\assets\android-icon-monochrome.png' -Force
Write-Output " -> mobile\assets\android-icon-monochrome.png generated"

# 2. Update Android native splashscreen_logo.png in drawables
Write-Output "`nGenerating Android native splashscreen_logo..."
$splashSizes = @{
    'drawable-mdpi' = 288
    'drawable-hdpi' = 432
    'drawable-xhdpi' = 576
    'drawable-xxhdpi' = 864
    'drawable-xxxhdpi' = 1152
}
foreach ($folder in $splashSizes.Keys) {
    $dim = $splashSizes[$folder]
    $destDir = "mobile\android\app\src\main\res\$folder"
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    $sImg = RenderSquareImage $srcImg $dim $dim 0.65 'square' '#FFFFFF'
    $sImg.Save("$destDir\splashscreen_logo.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $sImg.Dispose()
    Write-Output " -> $destDir\splashscreen_logo.png ($dim x $dim)"
}

# 3. Update Android native mipmap launcher icons
Write-Output "`nGenerating Android native mipmap icons..."
$densities = @{
    'mipmap-mdpi'    = @{ icon = 48;  adaptive = 108 }
    'mipmap-hdpi'    = @{ icon = 72;  adaptive = 162 }
    'mipmap-xhdpi'   = @{ icon = 96;  adaptive = 216 }
    'mipmap-xxhdpi'  = @{ icon = 144; adaptive = 324 }
    'mipmap-xxxhdpi' = @{ icon = 192; adaptive = 432 }
}

foreach ($folder in $densities.Keys) {
    $destDir = "mobile\android\app\src\main\res\$folder"
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    $iconDim = $densities[$folder].icon
    $adaptDim = $densities[$folder].adaptive

    # Remove old .webp files to prevent resource duplication in AAPT2
    Get-ChildItem -Path $destDir -Filter "ic_launcher*.webp" | Remove-Item -Force

    # ic_launcher.png (rounded square)
    $ic = RenderSquareImage $srcImg $iconDim $iconDim 0.72 'rounded' '#FFFFFF'
    $ic.Save("$destDir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $ic.Dispose()

    # ic_launcher_round.png (circle)
    $icRound = RenderSquareImage $srcImg $iconDim $iconDim 0.68 'circle' '#FFFFFF'
    $icRound.Save("$destDir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icRound.Dispose()

    # ic_launcher_foreground.png (adaptive foreground)
    $icFg = RenderSquareImage $srcImg $adaptDim $adaptDim 0.60 'square' '#FFFFFF'
    $icFg.Save("$destDir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icFg.Dispose()

    # ic_launcher_background.png (adaptive background)
    $icBg = RenderSquareImage $srcImg $adaptDim $adaptDim 0.0 'square' '#FFFFFF'
    $icBg.Save("$destDir\ic_launcher_background.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icBg.Dispose()

    # ic_launcher_monochrome.png
    Copy-Item "$destDir\ic_launcher_foreground.png" -Destination "$destDir\ic_launcher_monochrome.png" -Force

    Write-Output " -> $destDir : ic_launcher ($iconDim px), adaptive ($adaptDim px)"
}

$srcImg.Dispose()
Write-Output "`nSUCCESS: All App Logo and Icon assets updated across Mobile and Android resources!"

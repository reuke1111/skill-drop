$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskIconDir = Join-Path $taskRoot 'icons'
$taskSource = [System.Drawing.Image]::FromFile((Join-Path $taskIconDir 'skill-drop.png'))
try {
    foreach ($taskSize in @(16, 32, 48, 128)) {
        $taskBitmap = New-Object System.Drawing.Bitmap($taskSize, $taskSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
        $taskAttributes = New-Object System.Drawing.Imaging.ImageAttributes
        try {
            $taskGraphics.Clear([System.Drawing.Color]::Transparent)
            $taskGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $taskGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $taskGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $taskAttributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            # Preserve the supplied artwork; export at 75% of the canvas with transparent padding.
            $taskInset = [int]($taskSize / 8)
            $taskArtworkSize = $taskSize - 2 * $taskInset
            $taskRect = New-Object System.Drawing.Rectangle($taskInset, $taskInset, $taskArtworkSize, $taskArtworkSize)
            $taskGraphics.DrawImage($taskSource, $taskRect, 0, 0, $taskSource.Width, $taskSource.Height, [System.Drawing.GraphicsUnit]::Pixel, $taskAttributes)
            $taskBitmap.Save((Join-Path $taskIconDir "icon$taskSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $taskAttributes.Dispose()
            $taskGraphics.Dispose()
            $taskBitmap.Dispose()
        }
    }
} finally {
    $taskSource.Dispose()
}

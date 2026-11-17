# Tiny static web server for CastCall NSW (no install needed).
# Run:  powershell -ExecutionPolicy Bypass -File serve.ps1   then open http://localhost:8080
param([int]$Port = 8080)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
            '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.txt'='text/plain' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "CastCall NSW running at http://localhost:$Port  (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq 'proxy') {
      # Fallback for networks/browsers that block direct calls: only Open-Meteo hosts are allowed.
      $target = [Uri]$ctx.Request.QueryString['url']
      if ($target.Scheme -eq 'https' -and $target.Host -match '^(api|marine-api|historical-forecast-api)\.open-meteo\.com$') {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $req = [Net.HttpWebRequest]::Create($target)
        $req.Timeout = 90000; $req.ReadWriteTimeout = 90000
        $req.AutomaticDecompression = [Net.DecompressionMethods]::GZip -bor [Net.DecompressionMethods]::Deflate
        $resp = $req.GetResponse(); $ms = New-Object IO.MemoryStream
        $resp.GetResponseStream().CopyTo($ms); $resp.Close(); $bytes = $ms.ToArray()
        $ctx.Response.ContentType = 'application/json'
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $ctx.Response.StatusCode = 403 }
      $ctx.Response.Close(); continue
    }
    if ($path -eq 'save' -and $ctx.Request.HttpMethod -eq 'POST') {
      # Used only by tools/build-pages.html to write the generated spot/fish pages and sitemap (local only).
      $rel = $ctx.Request.QueryString['path']
      if ($rel -match '^(spots|fish)/([a-z0-9-]+/)?index\.html$' -or $rel -eq 'sitemap.xml') {
        $dest = [IO.Path]::GetFullPath((Join-Path $root $rel))
        New-Item -ItemType Directory -Force (Split-Path -Parent $dest) | Out-Null
        $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
        [IO.File]::WriteAllText($dest, $reader.ReadToEnd(), (New-Object Text.UTF8Encoding $false))
        $ctx.Response.StatusCode = 204
      } else { $ctx.Response.StatusCode = 403 }
      $ctx.Response.Close(); continue
    }
    if ($path -eq '' -or $path.EndsWith('/')) { $path = $path + 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-cache')
      $ctx.Response.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else { $ctx.Response.StatusCode = 404 }
    } catch { Write-Host "Request error: $($_.Exception.Message)" }
    try { $ctx.Response.Close() } catch {}
  }
} finally { $listener.Stop() }

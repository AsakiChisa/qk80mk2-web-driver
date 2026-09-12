param(
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath($PSScriptRoot)

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.js'   { return 'text/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.svg'  { return 'image/svg+xml' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.ico'  { return 'image/x-icon' }
        '.txt'  { return 'text/plain; charset=utf-8' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response($Stream, [int]$StatusCode, [string]$StatusText, [string]$ContentType, [byte[]]$Body, [bool]$HeadOnly = $false) {
    if ($null -eq $Body) { $Body = [byte[]]@() }
    $headers = "HTTP/1.1 $StatusCode $StatusText`r`n" +
               "Content-Type: $ContentType`r`n" +
               "Content-Length: $($Body.Length)`r`n" +
               "Cache-Control: no-store`r`n" +
               "Connection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

$listener = $null
try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()

    Write-Host ''
    Write-Host 'QK80 MK2 Web Driver local server is running.' -ForegroundColor Green
    Write-Host "Root: $Root"
    Write-Host "URL : http://localhost:$Port/" -ForegroundColor Cyan
    Write-Host 'Keep this window open. Press Ctrl+C to stop.' -ForegroundColor Yellow
    Write-Host ''

    Start-Sleep -Milliseconds 400
    try {
        Start-Process "http://localhost:$Port/"
    } catch {
        Write-Host "Open http://localhost:$Port/ in Chrome or Edge." -ForegroundColor Yellow
    }

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line -eq '') { break }
            }

            $parts = $requestLine.Split(' ')
            if ($parts.Length -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Bad Request')
                Send-Response $stream 400 'Bad Request' 'text/plain; charset=utf-8' $body
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            $rawTarget = $parts[1]
            $headOnly = ($method -eq 'HEAD')

            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
                Send-Response $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $body $headOnly
                continue
            }

            $target = $rawTarget.Split('?')[0]
            $target = [System.Uri]::UnescapeDataString($target)
            if ($target -eq '/' -or [string]::IsNullOrWhiteSpace($target)) {
                $target = '/index.html'
            }

            $relative = $target.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))

            if (-not $candidate.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
                Send-Response $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body $headOnly
                continue
            }

            if ([System.IO.Directory]::Exists($candidate)) {
                $candidate = Join-Path $candidate 'index.html'
            }

            if (-not [System.IO.File]::Exists($candidate)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body $headOnly
                continue
            }

            $body = [System.IO.File]::ReadAllBytes($candidate)
            $contentType = Get-ContentType $candidate
            Send-Response $stream 200 'OK' $contentType $body $headOnly

            $displayPath = $candidate.Substring($Root.Length).TrimStart('\')
            if ([string]::IsNullOrWhiteSpace($displayPath)) { $displayPath = 'index.html' }
            Write-Host ("[{0}] {1} {2}" -f (Get-Date -Format 'HH:mm:ss'), $method, $displayPath)
        }
        catch {
            Write-Host ("Request error: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }
        finally {
            if ($reader) { $reader.Dispose() }
            if ($stream) { $stream.Dispose() }
            $client.Close()
        }
    }
}
catch {
    Write-Host ''
    Write-Host 'Unable to start local server.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ''
    if ($_.Exception.Message -match 'address.*use|占用|already in use') {
        Write-Host "Port $Port may already be in use." -ForegroundColor Yellow
        Write-Host "Try: .\start-local.ps1 -Port 8081" -ForegroundColor Yellow
    }
    exit 1
}
finally {
    if ($listener) { $listener.Stop() }
}

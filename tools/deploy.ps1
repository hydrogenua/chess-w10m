# Deploys the built appx to a Windows 10 Mobile device via Device Portal REST.
# Phone prep: Settings -> Update & security -> For developers:
#   Developer mode ON, Device discovery ON.
# Credentials: username "Administrator", password = the 6-char PIN shown by "Pair".
#
# Usage:
#   powershell -File tools\deploy.ps1 -Ip 192.168.x.x -Pin ab12cd [-Launch]
param(
    [Parameter(Mandatory = $true)][string]$Ip,
    [Parameter(Mandatory = $true)][string]$Pin,
    [switch]$Launch,
    [string]$Package = ''
)
$ErrorActionPreference = 'Stop'
$projRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $projRoot 'build\out'

if (-not $Package) {
    $p = Get-ChildItem $outDir -Filter 'ChessComMobile_*_neutral.appx' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $p) { throw 'no appx in build\out, run build.ps1 first' }
    $Package = $p.FullName
}
$packageName = [IO.Path]::GetFileName($Package)
$cerPath = Join-Path $outDir 'ChessCom.cer'
if (-not (Test-Path $cerPath)) { $cerPath = Join-Path $projRoot 'build\cert\ChessCom.cer' }
$base = "https://$Ip"
Write-Host "deploying $packageName -> $Ip"

Add-Type -TypeDefinition @"
using System.Net; using System.Security.Cryptography.X509Certificates;
public class WdpTrustAll {
    public static void Enable() {
        ServicePointManager.ServerCertificateValidationCallback =
            delegate(object s, X509Certificate c, X509Chain ch, System.Net.Security.SslPolicyErrors e) { return true; };
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
    }
}
"@
[WdpTrustAll]::Enable()

$script:Auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("Administrator:$Pin"))
$script:CsrfToken = ''
$script:Cookies = @{}
$script:CookieHeader = ''

function Invoke-Wdp([string]$method, [string]$uri, $body = $null, [string]$contentType = $null) {
    $req = [System.Net.HttpWebRequest]::Create($uri)
    $req.Method = $method
    $req.AllowAutoRedirect = $false      # 307 responses carry the CSRF token
    $req.Timeout = 300000
    $req.Headers.Add('Authorization', $script:Auth)
    if ($script:CsrfToken) { $req.Headers.Add('X-CSRF-Token', $script:CsrfToken) }
    if ($script:CookieHeader) { $req.Headers.Add('Cookie', $script:CookieHeader) }
    if ($contentType) { $req.ContentType = $contentType }
    if ($body -ne $null) {
        $bytes = if ($body -is [byte[]]) { $body } else { [Text.Encoding]::UTF8.GetBytes($body) }
        $req.ContentLength = $bytes.Length
        if ($bytes.Length -gt 0) {
            $s = $req.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
        } else {
            $req.GetRequestStream().Close()
        }
    } else {
        $req.ContentLength = 0
    }
    try { $resp = $req.GetResponse() } catch [System.Net.WebException] {
        if ($_.Exception.Response) { $resp = $_.Exception.Response } else {
            # WDP can hiccup between requests (protocol violation / dropped connection):
            # one retry on the same request usually succeeds
            Start-Sleep -Milliseconds 800
            try { $resp = $req.GetResponse() } catch [System.Net.WebException] {
                if ($_.Exception.Response) { $resp = $_.Exception.Response } else { throw }
            }
        }
    }
    $code = [int]$resp.StatusCode
    $text = ''
    try { $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    foreach ($hk in $resp.Headers.AllKeys) {
        if ($hk -ieq 'Set-Cookie') {
            foreach ($cv in ($resp.Headers[$hk] -split ',(?=[^;]+?=)')) {
                if ($cv -match '^\s*([^=]+)=([^;]*)') {
                    $n = $Matches[1].Trim(); $v = $Matches[2]
                    if ($n -ieq 'CSRF-Token') { $script:CsrfToken = $v }
                    $script:Cookies[$n] = $v
                }
            }
        }
    }
    $script:CookieHeader = ($script:Cookies.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '
    $resp.Close()
    return New-Object PSObject -Property @{ StatusCode = $code; Content = $text }
}

# 0) restore a saved session (pairing PIN is one-time; persistent=1 keeps us authorized)
$cookieFile = Join-Path $projRoot 'build\wdp-cookies.json'
if (Test-Path $cookieFile) {
    try {
        $saved = Get-Content $cookieFile -Raw | ConvertFrom-Json
        $saved.PSObject.Properties | ForEach-Object { $script:Cookies[$_.Name] = $_.Value }
        $script:CookieHeader = ($script:Cookies.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '
        if ($script:Cookies['CSRF-Token']) { $script:CsrfToken = $script:Cookies['CSRF-Token'] }
        Write-Host 'loaded saved WDP session (json)'
    } catch { }
}

# 1) probe: 200 on a real API means the session is alive (503 right after wake is transient)
$authorized = $false
for ($try = 0; $try -lt 3 -and -not $authorized; $try++) {
    $resp = Invoke-Wdp 'GET' "$base/api/app/packagemanager/state"
    Write-Host ("probe: HTTP " + $resp.StatusCode)
    if ($resp.StatusCode -eq 200) { $authorized = $true }
    elseif ($resp.StatusCode -eq 503) { Start-Sleep -Seconds 5 }
    else { break }
}

# 2) pair with the PIN (only when the saved session is not authorized)
if (-not $authorized) {
    $resp = Invoke-Wdp 'GET' "$base/api/os/info"   # fresh CSRF from the 307
    $resp = Invoke-Wdp 'POST' "$base/api/authorize/pair?pin=$([uri]::EscapeDataString($Pin))&persistent=1" ''
    Write-Host ("pair: HTTP " + $resp.StatusCode)
    if ($resp.StatusCode -ne 200) { throw "pairing failed (HTTP $($resp.StatusCode)): press Pair on the phone for a fresh PIN and retry" }
    $authorized = $true
}
# persist the session for future runs
try {
    $script:Cookies | ConvertTo-Json | Set-Content $cookieFile -Encoding UTF8
} catch { }

# 3) uninstall previous ChessComMobile (dev-sideload limit counts updates as adds)
$resp = Invoke-Wdp 'GET' "$base/api/app/packagemanager/packages"
try {
    $json = $resp.Content | ConvertFrom-Json
    $old = $json.InstalledPackages | Where-Object { $_.PackageFullName -like 'ChessComMobile*' } | Select-Object -First 1
    if ($old) {
        Write-Host ("uninstalling previous: " + $old.PackageFullName)
        $resp = Invoke-Wdp 'DELETE' "$base/api/app/packagemanager/package?package=$([uri]::EscapeDataString($old.PackageFullName))"
        Write-Host ("uninstall: HTTP " + $resp.StatusCode)
        Start-Sleep -Seconds 3
    }
} catch { Write-Host "package list parse failed, installing anyway" }

# 4) upload + install: multipart, fields named after the files (appx + cer)
$boundary = '----ChessCom' + [Guid]::NewGuid().ToString('N')
$lf = "`r`n"
$appxBytes = [IO.File]::ReadAllBytes($Package)
$cerBytes = [IO.File]::ReadAllBytes($cerPath)
$enc = [Text.Encoding]::GetEncoding('iso-8859-1')
$ms = New-Object IO.MemoryStream
function Add-Part($ms, $boundary, $lf, $enc, [string]$fieldName, [byte[]]$bytes) {
    $head = "$lf--$boundary$lf" +
        "Content-Disposition: form-data; name=`"$fieldName`"; filename=`"$fieldName`"$lf" +
        "Content-Type: application/octet-stream$lf$lf"
    $b = $enc.GetBytes($head); $ms.Write($b, 0, $b.Length)
    $ms.Write($bytes, 0, $bytes.Length)
}
Add-Part $ms $boundary $lf $enc $packageName $appxBytes
Add-Part $ms $boundary $lf $enc 'ChessCom.cer' $cerBytes
$tail = $enc.GetBytes("$lf--$boundary--$lf")
$ms.Write($tail, 0, $tail.Length)

$uri = "$base/api/app/packagemanager/package?package=$([uri]::EscapeDataString($packageName))"
$resp = Invoke-Wdp 'POST' $uri $ms.ToArray() "multipart/form-data; boundary=$boundary"
Write-Host ("install: HTTP " + $resp.StatusCode + " " + ($resp.Content -replace '\s+', ' '))
if ($resp.StatusCode -notin 200, 202) { throw "install failed: $($resp.Content)" }

# 5) poll install state
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 4
    $resp = Invoke-Wdp 'GET' "$base/api/app/packagemanager/state"
    $txt = $resp.Content
    if ($txt -match '"Success" : false') { throw "install error: $txt" }
    if ($txt -match 'installRunning" : false') { Write-Host 'install finished'; break }
    if ($i % 3 -eq 0) { Write-Host 'installing...' }
}

# 6) verify the package actually registered (a silent no-op install = sideload slots full)
$registered = $false
for ($i = 0; $i -lt 3 -and -not $registered; $i++) {
    Start-Sleep -Seconds 3
    $resp = Invoke-Wdp 'GET' "$base/api/app/packagemanager/packages"
    if ($resp.Content -match '"PackageFullName" : "ChessComMobile') { $registered = $true }
}
if (-not $registered) {
    throw 'install accepted but package not registered - sideload slots likely full: uninstall any old sideload app on the phone (DeepSeek/Gecko/Amugram/etc) and retry'
}

# 7) optional: launch the app (registration settles ~8 s; CSRF rotates every response)
if ($Launch) {
    Start-Sleep -Seconds 8
    $resp = Invoke-Wdp 'GET' "$base/api/app/packagemanager/packages"
    $family = ''
    try {
        $json = $resp.Content | ConvertFrom-Json
        $pkg = $json.InstalledPackages | Where-Object { $_.PackageFullName -like 'ChessComMobile*' } | Select-Object -First 1
        # this WDP reports PackageFamilyName without the publisher hash - use PackageRelativeId
        if ($pkg -and $pkg.PackageRelativeId) { $family = $pkg.PackageRelativeId }
        elseif ($pkg -and $pkg.PackageFamilyName) { $family = $pkg.PackageFamilyName }
    } catch { }
    if (-not $family) { throw 'package not found for launch' }
    if ($family -notmatch '!') { $family = "$family!App" }
    $appid = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($family))
    $resp = Invoke-Wdp 'POST' "$base/api/taskmanager/app?appid=$appid" ''
    Write-Host ("launch: HTTP " + $resp.StatusCode)
}
Write-Host 'DONE'

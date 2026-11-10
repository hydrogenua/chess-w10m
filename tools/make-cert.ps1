# Creates (once) a self-signed code-signing certificate for ChessComMobile appx packages.
# Subject CN must match the manifest Identity Publisher: "CN=ChessCom Dev".
# Outputs: build\cert\ChessCom.pfx (for signtool) + ChessCom.cer (trusted via WDP install POST).
param(
    [string]$PfxPassword = 'chesscom'
)
$ErrorActionPreference = 'Stop'

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $PSCommandPath }
$certDir = Join-Path (Split-Path -Parent $scriptRoot) 'build\cert'
if (-not (Test-Path $certDir)) { New-Item -ItemType Directory -Path $certDir | Out-Null }

$subject = 'CN=ChessCom Dev'

# reuse an existing cert if present
$existing = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $subject -and $_.HasPrivateKey } |
    Sort-Object NotAfter -Descending | Select-Object -First 1
if ($existing) {
    Write-Host "reusing existing cert: $($existing.Thumbprint)"
    $cert = $existing
} else {
    $cert = New-SelfSignedCertificate -Type Custom `
        -Subject $subject `
        -KeyUsage DigitalSignature `
        -FriendlyName 'ChessCom Dev' `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}') `
        -KeyExportPolicy Exportable `
        -NotAfter (Get-Date).AddYears(5)
    Write-Host "created cert: $($cert.Thumbprint)"
}

$secPwd = ConvertTo-SecureString -String $PfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath (Join-Path $certDir 'ChessCom.pfx') -Password $secPwd | Out-Null
Export-Certificate -Cert $cert -FilePath (Join-Path $certDir 'ChessCom.cer') | Out-Null
Write-Host "OK -> $certDir\ChessCom.pfx / .cer"

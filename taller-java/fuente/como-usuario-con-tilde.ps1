# El recorrido del modo taller corrido por un usuario de Windows de verdad,
# con espacio y tilde en su carpeta personal (punto 7.3 del SPEC 026).
#
# Solo para la integracion continua: crea un usuario local en la maquina.
# Todo lo que el recorrido arma, el clon, taller-git-trabajo y la casa, queda
# bajo C:\Users\José Pérez, porque sale de la carpeta temporal de ese usuario.

$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true') { throw 'como-usuario-con-tilde.ps1 crea un usuario local; solo corre en la integracion continua' }

$nombre = 'José Pérez'
$clave = ConvertTo-SecureString 'Taller-2026-Sii!' -AsPlainText -Force
New-LocalUser -Name $nombre -Password $clave -PasswordNeverExpires | Out-Null
Add-LocalGroupMember -Group 'Users' -Member $nombre
$credencial = New-Object System.Management.Automation.PSCredential (".\$nombre", $clave)

$base = 'C:\taller-usuario'
New-Item -ItemType Directory -Force "$base\salida" | Out-Null
Copy-Item -Recurse -Force $env:GITHUB_WORKSPACE "$base\repo"
icacls $base /grant "${nombre}:(OI)(CI)F" /T /Q | Out-Null

$guion = @"
`$ErrorActionPreference = 'Continue'
`$env:TALLER_CAPTURAS = '$base\salida'
`$env:TALLER_NAVEGADOR = 'msedge'
Set-Location '$base\repo\simulador'
"usuario `$env:USERNAME, carpeta personal `$env:USERPROFILE, temporal `$env:TEMP" | Out-File -Encoding utf8 '$base\salida\quien.txt'
npx vitest run --config vitest.taller-java.config.ts *>&1 | Out-File -Encoding utf8 '$base\salida\registro.txt'
exit `$LASTEXITCODE
"@
Set-Content -Encoding utf8 "$base\correr.ps1" $guion

$proceso = Start-Process pwsh -Credential $credencial -LoadUserProfile -Wait -PassThru `
  -ArgumentList '-NoProfile', '-File', "$base\correr.ps1" -WorkingDirectory $base
Get-Content "$base\salida\quien.txt" -ErrorAction SilentlyContinue
Get-Content "$base\salida\registro.txt" -Tail 60 -ErrorAction SilentlyContinue
exit $proceso.ExitCode

# Al cerrar el taller no queda nada vivo (SPEC 028, pedido despues del EBUSY).
#
# Solo Windows. Arma taller-git como el participante, arranca TALLER.cmd en
# una ventana de consola de verdad y le manda una orden que deja vivos, dentro
# de taller-git/lab-01/recetario, un bash.exe, un git.exe y un sleep.exe.
# Despues cierra:
#
#     -Cierre ventana   cierra la ventana de TALLER.cmd, como la X
#     -Cierre motor     termina el proceso del motor de golpe, como un cuelgue
#
# y comprueba que de todo el arbol que colgaba de TALLER.cmd no quede ningun
# proceso vivo. Luego arranca de nuevo enseguida y borra y recrea
# taller-git/lab-01 desde la consola: con un proceso viejo parado en esa
# carpeta, Windows no la deja borrar.
#
#     pwsh taller/probar-cierre.ps1 -Motor java -Cierre ventana
param(
  [ValidateSet('java', 'python')] [string] $Motor = 'java',
  [ValidateSet('ventana', 'motor')] [string] $Cierre = 'ventana'
)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'probar-cierre.ps1 es solo para Windows' }

$clon = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temporal = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$base = Join-Path $temporal "cierre-$Motor-$Cierre-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
$raiz = Join-Path $base 'Ana Núñez\taller-git'
New-Item -ItemType Directory -Force $raiz | Out-Null
$fallas = [System.Collections.Generic.List[string]]::new()

function Falla([string] $texto) {
  Write-Host "FALLA  $texto"
  $script:fallas.Add($texto)
}

# --- El taller, como lo arma el participante ---------------------------------

git clone -q $clon (Join-Path $raiz 'curso')
foreach ($ruta in 'SIMULADOR.html', 'taller', 'labs', 'INSTALAR.cmd', 'instalar.command') {
  $destino = Join-Path $raiz "curso\$ruta"
  Remove-Item -Recurse -Force $destino -ErrorAction SilentlyContinue
  Copy-Item -Recurse -Force (Join-Path $clon $ruta) $destino
}
Remove-Item -Recurse -Force (Join-Path $raiz 'curso\taller\java\fuente\target') -ErrorAction SilentlyContinue
cmd /c "cd /d `"$raiz\curso`" && INSTALAR.cmd < nul" | Out-Null
if (-not (Test-Path (Join-Path $raiz 'TALLER.cmd'))) { throw 'INSTALAR.cmd no dejo TALLER.cmd' }
if ($Motor -eq 'python') {
  Set-Content -NoNewline (Join-Path $raiz 'curso\taller\java\taller.jar') 'no es un jar'
}
$env:TALLER_SIN_NAVEGADOR = '1'
$env:GIT_CONFIG_GLOBAL = Join-Path $base 'gitconfig'
Set-Content $env:GIT_CONFIG_GLOBAL "[user]`n`tname = Ana`n`temail = ana@sii.cl`n[init]`n`tdefaultBranch = main`n"

# --- Procesos ----------------------------------------------------------------

function Arbol([int] $raizPid) {
  # Todo lo que cuelga de un proceso, por ParentProcessId, aunque el padre ya
  # haya muerto: Windows conserva el numero.
  $todos = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine, CreationDate
  $hijos = @{}
  foreach ($p in $todos) {
    if (-not $hijos.ContainsKey([int]$p.ParentProcessId)) { $hijos[[int]$p.ParentProcessId] = @() }
    $hijos[[int]$p.ParentProcessId] += $p
  }
  $salida = @($todos | Where-Object { $_.ProcessId -eq $raizPid })
  $pendientes = [System.Collections.Generic.Queue[int]]::new()
  $pendientes.Enqueue($raizPid)
  while ($pendientes.Count -gt 0) {
    $actual = $pendientes.Dequeue()
    foreach ($h in @($hijos[$actual])) {
      if ($null -eq $h -or $h.ProcessId -eq $actual) { continue }
      $salida += $h
      $pendientes.Enqueue([int]$h.ProcessId)
    }
  }
  return $salida
}

function Vivos($procesos) {
  # Vivo y el mismo proceso: el numero se puede reutilizar.
  $ahora = Get-CimInstance Win32_Process | Select-Object ProcessId, CreationDate
  return @($procesos | Where-Object {
      $p = $_
      $ahora | Where-Object { $_.ProcessId -eq $p.ProcessId -and $_.CreationDate -eq $p.CreationDate }
    })
}

function Arrancar {
  Remove-Item -Force (Join-Path $raiz '.taller\motor'), (Join-Path $raiz '.taller\direccion') -ErrorAction SilentlyContinue
  $ventana = Start-Process cmd.exe -ArgumentList '/c', 'TALLER.cmd' -WorkingDirectory $raiz -PassThru -WindowStyle Normal
  $esperado = if ($Motor -eq 'java') { 'Java' } else { 'Python' }
  $limite = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $limite) {
    $archivo = Join-Path $raiz '.taller\motor'
    if ((Test-Path $archivo) -and ((Get-Content $archivo -Raw).Trim() -eq $esperado)) { break }
    if ($ventana.HasExited) { throw "TALLER.cmd termino antes de arrancar el motor de $esperado" }
    Start-Sleep -Milliseconds 300
  }
  if (-not (Test-Path (Join-Path $raiz '.taller\motor'))) { throw "el motor de $esperado no arranco en 90 s" }
  $direccion = (Get-Content (Join-Path $raiz '.taller\direccion') -TotalCount 1).Trim()
  $cliente = [System.Net.Http.HttpClient]::new()
  $cliente.Timeout = [TimeSpan]::FromMinutes(15)
  $cliente.DefaultRequestHeaders.Add('X-Taller-Clave', ($direccion -replace '.*clave=', ''))
  return [pscustomobject]@{ Ventana = $ventana; Url = ($direccion -replace '/\?clave=.*', ''); Cliente = $cliente }
}

function Orden($taller, [string] $texto) {
  $cuerpo = [System.Net.Http.StringContent]::new((@{ orden = $texto } | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
  return $taller.Cliente.PostAsync("$($taller.Url)/api/orden", $cuerpo)
}

function CerrarVentana([int] $cmdPid) {
  # WM_CLOSE a la ventana de consola de TALLER.cmd, como la X. Se hace desde
  # otro proceso para no soltar la consola de esta prueba.
  $guion = @"
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class V {
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint p);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
}
'@
[V]::FreeConsole() | Out-Null
if (-not [V]::AttachConsole($cmdPid)) { exit 2 }
`$h = [V]::GetConsoleWindow()
[V]::FreeConsole() | Out-Null
if (`$h -eq [IntPtr]::Zero) { exit 3 }
if (-not [V]::PostMessage(`$h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)) { exit 4 }
exit 0
"@
  $archivo = Join-Path $base 'cerrar.ps1'
  Set-Content -Encoding utf8 $archivo $guion
  $p = Start-Process pwsh -ArgumentList '-NoProfile', '-File', $archivo -PassThru -Wait -WindowStyle Hidden
  if ($p.ExitCode -ne 0) { throw "no se pudo cerrar la ventana de TALLER.cmd (codigo $($p.ExitCode))" }
}

function EsperarQueMueran($procesos, [string] $cuando) {
  $limite = (Get-Date).AddSeconds(20)
  do {
    $vivos = Vivos $procesos
    if ($vivos.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $limite)
  if ($vivos.Count -eq 0) {
    Write-Host "BIEN   $cuando, no quedo ninguno de los $($procesos.Count) procesos del arbol"
    return
  }
  foreach ($v in $vivos) {
    $p = $procesos | Where-Object { $_.ProcessId -eq $v.ProcessId }
    Write-Host "  vivo  $($p.Name) $($p.ProcessId)  $($p.CommandLine)"
  }
  Falla "$cuando quedaron vivos $($vivos.Count): $((($vivos | ForEach-Object { ($procesos | Where-Object ProcessId -eq $_.ProcessId).Name }) | Sort-Object -Unique) -join ', ')"
}

# --- 1. Arranque, orden que deja procesos vivos, y cierre -------------------

$primero = Arrancar
Write-Host "motor $Motor arrancado, TALLER.cmd es el proceso $($primero.Ventana.Id)"
$tarea = Orden $primero "mkdir -p lab-01/recetario && cd lab-01/recetario && git init -q && git -c alias.espera='!sleep 600' espera"
$limite = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Milliseconds 500
  $arbol = Arbol $primero.Ventana.Id
  $nombres = $arbol.Name
} while ((Get-Date) -lt $limite -and -not (($nombres -contains 'git.exe') -and ($nombres -contains 'sleep.exe')))
Write-Host "arbol de TALLER.cmd antes de cerrar:"
$arbol | ForEach-Object { Write-Host "  $($_.Name) $($_.ProcessId) <- $($_.ParentProcessId)" }
foreach ($n in 'bash.exe', 'git.exe', 'sleep.exe') {
  if ($nombres -notcontains $n) { throw "la orden no dejo vivo un $n; la prueba no probaria nada" }
}

if ($Cierre -eq 'ventana') {
  CerrarVentana $primero.Ventana.Id
  EsperarQueMueran $arbol 'al cerrar la ventana de TALLER.cmd'
} else {
  $motorProceso = $arbol | Where-Object { $_.Name -in 'java.exe', 'python.exe', 'py.exe' } | Select-Object -Last 1
  Write-Host "se termina de golpe el motor, $($motorProceso.Name) $($motorProceso.ProcessId)"
  Stop-Process -Id $motorProceso.ProcessId -Force
  EsperarQueMueran $arbol 'al terminar el motor'
}
$null = $tarea.ContinueWith({ param($t) $t.Exception }, [System.Threading.Tasks.TaskContinuationOptions]::OnlyOnFaulted)

# --- 2. Un segundo arranque, enseguida --------------------------------------

try {
  $segundo = Arrancar
  $r = (Orden $segundo 'rm -rf lab-01 && mkdir -p lab-01/recetario && cd lab-01/recetario && git init -q && pwd').GetAwaiter().GetResult()
  $json = $r.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
  if ($json.codigo -ne 0) {
    Falla "el segundo arranque no pudo borrar y recrear lab-01: $($json.error)"
  } elseif (-not (Test-Path (Join-Path $raiz 'lab-01\recetario\.git'))) {
    Falla 'el segundo arranque no dejo lab-01/recetario con su repositorio'
  } else {
    Write-Host 'BIEN   el segundo arranque borro y recreo lab-01'
  }
  $arbol2 = Arbol $segundo.Ventana.Id
  CerrarVentana $segundo.Ventana.Id
  EsperarQueMueran $arbol2 'al cerrar la ventana del segundo arranque'
} catch {
  Falla "el segundo arranque: $_"
}

# --- Limpieza de la prueba, aparte de lo que se comprobo --------------------

Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($base) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force $base -ErrorAction SilentlyContinue

if ($fallas.Count -gt 0) {
  Write-Host "`n$($fallas.Count) falla(s), motor $Motor, cierre $Cierre"
  exit 1
}
Write-Host "`nBIEN   motor $Motor, cierre ${Cierre}: nada vivo, y el segundo arranque trabaja en lab-01"

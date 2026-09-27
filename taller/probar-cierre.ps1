# Al cerrar el taller no queda nada vivo (SPEC 028, pedido despues del EBUSY).
#
# Solo Windows. Arma taller-git como el participante, arranca TALLER.cmd en
# una consola y le manda una orden que deja vivos, dentro de
# taller-git/lab-01/recetario, un bash.exe, un git.exe y un sleep.exe.
# Despues cierra:
#
#     -Cierre ventana   cierra la consola de TALLER.cmd, como la X
#     -Cierre motor     termina el proceso del motor de golpe, como un cuelgue
#
# y cuenta lo que quedo vivo de todo el arbol que colgaba de TALLER.cmd. Luego
# arranca de nuevo enseguida y borra y recrea taller-git/lab-01 desde la
# consola: con un proceso viejo parado en esa carpeta, Windows no la deja
# borrar.
#
# La consola es una pseudoconsola (CreatePseudoConsole), la de Windows
# Terminal. Cerrarla con ClosePseudoConsole manda CTRL_CLOSE_EVENT de verdad a
# cada proceso unido a ella, como la X: nada se mata de golpe, y el gancho de
# cierre del motor de Java puede correr. Todo lo que la consola muestra queda
# en un archivo, y de ahi se lee si el gancho corrio. En la maquina de la
# integracion continua una ventana clasica no atiende WM_CLOSE, y la version
# anterior de esta prueba terminaba los procesos de la consola de golpe, que no
# se parece a la X.
#
# Con -Custodio, el motor de Java arranca con TALLER_CUSTODIO=1. Con el motor
# de Java sin custodio y -Cierre motor, pueden quedar procesos: el gancho no
# corre si el motor muere de golpe. Ese caso se informa y no falla.
#
#     pwsh taller/probar-cierre.ps1 -Motor java -Cierre ventana [-Custodio]
param(
  [ValidateSet('java', 'python')] [string] $Motor = 'java',
  [ValidateSet('ventana', 'motor')] [string] $Cierre = 'ventana',
  [switch] $Custodio
)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'probar-cierre.ps1 es solo para Windows' }

$clon = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temporal = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$base = Join-Path $temporal "cierre-$Motor-$Cierre-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
$raiz = Join-Path $base 'Ana Núñez\taller-git'
New-Item -ItemType Directory -Force $raiz | Out-Null
$fallas = [System.Collections.Generic.List[string]]::new()
$informe = [ordered]@{}
$puedenQuedar = $Motor -eq 'java' -and -not $Custodio -and $Cierre -eq 'motor'
$custodioDicho = if ($Motor -ne 'java') { '-' } elseif ($Custodio) { 'encendido' } else { 'apagado' }

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
  # Sin el jar, el arrancador salta directo al motor de Python.
  Remove-Item -Force (Join-Path $raiz 'curso\taller\java\taller.jar')
  if (Test-Path (Join-Path $raiz 'curso\taller\java\taller.jar')) { throw 'no se pudo sacar el jar' }
}
$env:TALLER_SIN_NAVEGADOR = '1'
if ($Custodio) { $env:TALLER_CUSTODIO = '1' } else { Remove-Item Env:TALLER_CUSTODIO -ErrorAction SilentlyContinue }
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

# El lanzador: un pwsh aparte que abre la pseudoconsola, lanza TALLER.cmd en
# ella, copia lo que muestra a un archivo, y la cierra cuando aparece el
# archivo de senal.
$lanzador = Join-Path $base 'lanzador.ps1'
Set-Content -Encoding utf8 $lanzador @'
param([string] $Carpeta, [string] $Salida, [string] $Senal, [string] $Numero)
Add-Type -TypeDefinition @"
using System; using System.IO; using System.Text; using System.Threading;
using System.Runtime.InteropServices; using Microsoft.Win32.SafeHandles;
public static class Pty {
  [StructLayout(LayoutKind.Sequential)] public struct Coord { public short X, Y; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct Inicio {
    public int cb; public string r, d, t; public int x, y, xs, ys, xc, yc, fa, fl;
    public short sw, r2; public IntPtr r3, i, o, e; }
  [StructLayout(LayoutKind.Sequential)] struct InicioEx { public Inicio I; public IntPtr Lista; }
  [StructLayout(LayoutKind.Sequential)] struct Info { public IntPtr P, H; public int Pid, Tid; }
  [DllImport("kernel32.dll")] static extern int CreatePseudoConsole(Coord c, SafeFileHandle i, SafeFileHandle o, uint f, out IntPtr h);
  [DllImport("kernel32.dll")] static extern void ClosePseudoConsole(IntPtr h);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool CreatePipe(out SafeFileHandle r, out SafeFileHandle w, IntPtr a, int n);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool InitializeProcThreadAttributeList(IntPtr l, int c, int f, ref IntPtr n);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool UpdateProcThreadAttribute(IntPtr l, uint f, IntPtr a, IntPtr v, IntPtr n, IntPtr p, IntPtr r);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool CreateProcessW(string a, StringBuilder c, IntPtr pa, IntPtr ta, bool h, uint f, IntPtr e, string d, ref InicioEx s, out Info p);
  static IntPtr consola; static SafeFileHandle escribir;
  public static int Lanzar(string linea, string carpeta, string salida) {
    SafeFileHandle entrada, lectura, sale;
    CreatePipe(out entrada, out escribir, IntPtr.Zero, 0);
    CreatePipe(out lectura, out sale, IntPtr.Zero, 0);
    int hr = CreatePseudoConsole(new Coord { X = 160, Y = 50 }, entrada, sale, 0, out consola);
    if (hr != 0) throw new Exception("CreatePseudoConsole " + hr);
    entrada.Dispose(); sale.Dispose();
    IntPtr n = IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref n);
    IntPtr lista = Marshal.AllocHGlobal(n); InitializeProcThreadAttributeList(lista, 1, 0, ref n);
    UpdateProcThreadAttribute(lista, 0, (IntPtr)0x00020016, consola, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero);
    var s = new InicioEx(); s.I.cb = Marshal.SizeOf(typeof(InicioEx)); s.Lista = lista;
    Info p;
    if (!CreateProcessW(null, new StringBuilder(linea), IntPtr.Zero, IntPtr.Zero, false, 0x00080000, IntPtr.Zero, carpeta, ref s, out p))
      throw new Exception("CreateProcess " + Marshal.GetLastWin32Error());
    var hilo = new Thread(() => {
      using (var de = new FileStream(lectura, FileAccess.Read))
      using (var a = new FileStream(salida, FileMode.Append, FileAccess.Write, FileShare.ReadWrite)) {
        var b = new byte[4096]; int k;
        while ((k = de.Read(b, 0, b.Length)) > 0) { a.Write(b, 0, k); a.Flush(); }
      }
    });
    hilo.IsBackground = true; hilo.Start();
    return p.Pid;
  }
  // ClosePseudoConsole puede esperar a que los procesos de la consola salgan.
  public static bool Cerrar(int ms) {
    var t = new Thread(() => ClosePseudoConsole(consola));
    t.IsBackground = true; t.Start();
    return t.Join(ms);
  }
}
"@
$cmd = [Pty]::Lanzar('cmd.exe /c TALLER.cmd', $Carpeta, $Salida)
Set-Content $Numero $cmd
while (-not (Test-Path $Senal)) { Start-Sleep -Milliseconds 200 }
[Pty]::Cerrar(30000) | Out-Null
Start-Sleep -Seconds 2
'@

function Arrancar([string] $nombre) {
  Remove-Item -Force (Join-Path $raiz '.taller\motor'), (Join-Path $raiz '.taller\direccion') -ErrorAction SilentlyContinue
  $salida = Join-Path $base "$nombre.consola.txt"
  $senal = Join-Path $base "$nombre.cerrar"
  $numero = Join-Path $base "$nombre.cmd.txt"
  # Start-Process junta los argumentos con espacios sin comillas: la carpeta
  # del taller tiene un espacio ('Ana Núñez'), asi que van entre comillas.
  $argumentos = "-NoProfile -File `"$lanzador`" -Carpeta `"$raiz`" -Salida `"$salida`" -Senal `"$senal`" -Numero `"$numero`""
  $lanzado = Start-Process pwsh -PassThru -WindowStyle Hidden -ArgumentList $argumentos
  $limite = (Get-Date).AddSeconds(30)
  while (-not (Test-Path $numero) -and (Get-Date) -lt $limite) { Start-Sleep -Milliseconds 200 }
  if (-not (Test-Path $numero)) { throw 'el lanzador no abrio la pseudoconsola' }
  $cmdPid = [int](Get-Content $numero -TotalCount 1)
  $esperado = if ($Motor -eq 'java') { 'Java' } else { 'Python' }
  $limite = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $limite) {
    $archivo = Join-Path $raiz '.taller\motor'
    if ((Test-Path $archivo) -and ((Get-Content $archivo -Raw).Trim() -eq $esperado)) { break }
    if ($null -eq (Get-Process -Id $cmdPid -ErrorAction SilentlyContinue)) { throw "TALLER.cmd termino antes de arrancar el motor de $esperado" }
    Start-Sleep -Milliseconds 300
  }
  $quedo = if (Test-Path (Join-Path $raiz '.taller\motor')) { (Get-Content (Join-Path $raiz '.taller\motor') -Raw).Trim() } else { 'nada' }
  if ($quedo -ne $esperado) {
    Write-Host '--- lo que mostro la consola'
    Write-Host (Pantalla ([pscustomobject]@{ Salida = $salida }))
    throw "se esperaba el motor de $esperado y el arrancador dejo: $quedo"
  }
  $direccion = (Get-Content (Join-Path $raiz '.taller\direccion') -TotalCount 1).Trim()
  $cliente = [System.Net.Http.HttpClient]::new()
  $cliente.Timeout = [TimeSpan]::FromMinutes(15)
  $cliente.DefaultRequestHeaders.Add('X-Taller-Clave', ($direccion -replace '.*clave=', ''))
  return [pscustomobject]@{
    Cmd = $cmdPid; Lanzador = $lanzado; Salida = $salida; Senal = $senal
    Url = ($direccion -replace '/\?clave=.*', ''); Cliente = $cliente
  }
}

function Pantalla($taller) {
  # Lo que mostro la consola, sin las secuencias de control de la terminal.
  if (-not (Test-Path $taller.Salida)) { return '' }
  $texto = [IO.File]::ReadAllText($taller.Salida)
  return ($texto -replace "`e\[[0-9;?]*[A-Za-z]", '' -replace "`e\][^`a]*`a", '')
}

function CerrarConsola($taller) {
  # ClosePseudoConsole: CTRL_CLOSE_EVENT a cada proceso unido a la consola.
  Set-Content $taller.Senal 'cerrar'
  $taller.Lanzador.WaitForExit(45000) | Out-Null
}

function Orden($taller, [string] $texto) {
  $cuerpo = [System.Net.Http.StringContent]::new((@{ orden = $texto } | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
  return $taller.Cliente.PostAsync("$($taller.Url)/api/orden", $cuerpo)
}

function EsperarQueMueran($procesos, [string] $cuando, [int[]] $salvo = @(), [switch] $SoloInforme) {
  $procesos = @($procesos | Where-Object { $_.ProcessId -notin $salvo })
  $limite = (Get-Date).AddSeconds(20)
  do {
    $vivos = Vivos $procesos
    if ($vivos.Count -eq 0) { break }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $limite)
  if ($vivos.Count -eq 0) {
    Write-Host "BIEN   $cuando, no quedo ninguno de los $($procesos.Count) procesos del arbol"
    return '0'
  }
  foreach ($v in $vivos) {
    $p = $procesos | Where-Object { $_.ProcessId -eq $v.ProcessId }
    Write-Host "  vivo  $($p.Name) $($p.ProcessId)  $($p.CommandLine)"
  }
  $nombres = (($vivos | ForEach-Object { ($procesos | Where-Object ProcessId -eq $_.ProcessId).Name }) | Sort-Object -Unique) -join ', '
  $texto = "$cuando quedaron vivos $($vivos.Count): $nombres"
  if ($SoloInforme) { Write-Host "INFORME  $texto" } else { Falla $texto }
  return "$($vivos.Count) ($nombres)"
}

function GanchoCorrio($taller) {
  # Solo el motor de Java tiene gancho de cierre.
  if ($Motor -ne 'java') { return '-' }
  $limite = (Get-Date).AddSeconds(10)
  do {
    if ((Pantalla $taller) -match 'El taller se cierra: termina (\d+) procesos') { return "si, $($Matches[1]) procesos" }
    Start-Sleep -Milliseconds 300
  } while ((Get-Date) -lt $limite)
  return 'no'
}

# --- 1. Arranque, orden que deja procesos vivos, y cierre -------------------

$primero = Arrancar 'primero'
Write-Host "motor $Motor arrancado (custodio $custodioDicho), TALLER.cmd es el proceso $($primero.Cmd)"
$tarea = Orden $primero "mkdir -p lab-01/recetario && cd lab-01/recetario && git init -q && git -c alias.espera='!sleep 600' espera"
$limite = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Milliseconds 500
  $arbol = Arbol $primero.Cmd
  $nombres = $arbol.Name
} while ((Get-Date) -lt $limite -and -not (($nombres -contains 'git.exe') -and ($nombres -contains 'sleep.exe')))
Write-Host "arbol de TALLER.cmd antes de cerrar:"
$arbol | ForEach-Object { Write-Host "  $($_.Name) $($_.ProcessId) <- $($_.ParentProcessId)" }
foreach ($n in 'bash.exe', 'git.exe', 'sleep.exe') {
  if ($nombres -notcontains $n) { throw "la orden no dejo vivo un $n; la prueba no probaria nada" }
}

if ($Cierre -eq 'ventana') {
  Write-Host 'se cierra la consola con ClosePseudoConsole: CTRL_CLOSE_EVENT a cada proceso unido a ella, sin matar a nadie de golpe'
  CerrarConsola $primero
  $informe['vivos'] = EsperarQueMueran $arbol 'al cerrar la consola de TALLER.cmd'
  $informe['gancho'] = GanchoCorrio $primero
} else {
  $motorProceso = $arbol | Where-Object { $_.Name -in 'java.exe', 'python.exe', 'py.exe' } | Select-Object -Last 1
  Write-Host "se termina de golpe el motor, $($motorProceso.Name) $($motorProceso.ProcessId) (TerminateProcess: ningun gancho puede correr)"
  Stop-Process -Id $motorProceso.ProcessId -Force
  # La consola queda, a proposito: arrancar.cmd hace pause para que se lea el
  # mensaje. Ella y su conhost no cuentan; todo lo demas se cuenta.
  $laVentana = @($primero.Cmd) + @($arbol | Where-Object { $_.Name -in 'conhost.exe', 'OpenConsole.exe' -and $_.ParentProcessId -eq $primero.Cmd } | ForEach-Object { [int]$_.ProcessId })
  $informe['vivos'] = EsperarQueMueran $arbol 'al terminar el motor' $laVentana -SoloInforme:$puedenQuedar
  $informe['gancho'] = GanchoCorrio $primero
  CerrarConsola $primero
}
Write-Host "gancho de cierre del motor: $($informe['gancho'])"

# --- 2. Un segundo arranque, enseguida --------------------------------------

try {
  $segundo = Arrancar 'segundo'
  $r = (Orden $segundo 'rm -rf lab-01 && mkdir -p lab-01/recetario && cd lab-01/recetario && git init -q && pwd').GetAwaiter().GetResult()
  $json = $r.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
  if ($json.codigo -ne 0) {
    $informe['segundo'] = "no: $($json.error.Trim())"
    $texto = "el segundo arranque no pudo borrar y recrear lab-01: $($json.error)"
    if ($puedenQuedar) { Write-Host "INFORME  $texto" } else { Falla $texto }
  } elseif (-not (Test-Path (Join-Path $raiz 'lab-01\recetario\.git'))) {
    $informe['segundo'] = 'no: sin repositorio'
    Falla 'el segundo arranque no dejo lab-01/recetario con su repositorio'
  } else {
    $informe['segundo'] = 'si'
    Write-Host 'BIEN   el segundo arranque borro y recreo lab-01'
  }
  $arbol2 = Arbol $segundo.Cmd
  CerrarConsola $segundo
  $null = EsperarQueMueran $arbol2 'al cerrar la consola del segundo arranque'
} catch {
  $informe['segundo'] = "no: $_"
  Falla "el segundo arranque: $_"
}

$fila = "| $Motor | $custodioDicho | $Cierre | $($informe['vivos']) | $($informe['gancho']) | $($informe['segundo']) |"
Write-Host "RESULTADO  $fila"
if ($env:GITHUB_STEP_SUMMARY) {
  Add-Content $env:GITHUB_STEP_SUMMARY "| motor | custodio | cierre | vivos | gancho | segundo arranque |`n|---|---|---|---|---|---|`n$fila"
}

# --- Limpieza de la prueba, aparte de lo que se comprobo --------------------

Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($base) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force $base -ErrorAction SilentlyContinue

if ($fallas.Count -gt 0) {
  Write-Host "`n$($fallas.Count) falla(s), motor $Motor, custodio $custodioDicho, cierre $Cierre"
  exit 1
}
Write-Host "`nBIEN   motor $Motor, custodio $custodioDicho, cierre ${Cierre}"

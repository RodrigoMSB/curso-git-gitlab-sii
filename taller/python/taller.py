"""El motor de Python del modo taller (SPEC 028).

Hace lo mismo que el motor de Java, en `../java`, y responde exactamente lo
que dice `../INTERFAZ.md`: la pagina es una sola y no sabe con cual de los dos
habla. El arrancador lo usa cuando el de Java no arranca.

Escucha solo en 127.0.0.1, con una clave por arranque. Ejecuta cada orden de la
consola de la pagina con Git Bash, en una carpeta que persiste entre ordenes y
no sale del taller, y le entrega a la pagina el estado del repositorio leido
con Git. En reposo no lanza ningun proceso: una huella de fechas y tamanos de
archivos dice cuando hay que volver a preguntarle a Git.

Un solo archivo y solo la biblioteca estandar, Python 3.9 o superior. Es uno
solo para que Python no deje una carpeta __pycache__ dentro del clon.

Del motor de Python anterior, de la rama taller-python, se conservan dos
cosas que el de Java no necesita. En Windows, cada orden corre dentro de un
objeto de trabajo, porque taskkill /T no alcanza a los procesos que abre Git
Bash. En Mac, bash y git se lanzan con /usr/bin/arch y la arquitectura de este
Python, porque a veces arrancaban bajo Rosetta y el git de Apple fallaba.
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import hashlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import platform  # noqa: E402
import re  # noqa: E402
import secrets  # noqa: E402
import shutil  # noqa: E402
import signal  # noqa: E402
import socketserver  # noqa: E402
import subprocess  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
from dataclasses import dataclass, field  # noqa: E402
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402
from pathlib import Path  # noqa: E402
from typing import Optional  # noqa: E402
from urllib.parse import parse_qs, urlparse  # noqa: E402

if sys.version_info < (3, 9):  # pragma: no cover
    sys.exit("El motor de Python del taller necesita Python 3.9 o superior.")

WINDOWS = os.name == "nt"
MAC = sys.platform == "darwin"
SISTEMA = "windows" if WINDOWS else "mac" if MAC else "otro"

AQUI = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# Donde esta todo


def ubicar_clon() -> Path:
    """La carpeta del clon: sube desde este archivo hasta la que tiene SIMULADOR.html y labs."""
    fija = os.environ.get("TALLER_CLON")
    if fija:
        return Path(fija).resolve()
    for carpeta in (AQUI, *AQUI.parents):
        if (carpeta / "SIMULADOR.html").is_file() and (carpeta / "labs").is_dir():
            return carpeta
    raise SystemExit(f"No se encontró la carpeta del clon desde {AQUI}.")


def real(ruta: Path) -> Path:
    try:
        return ruta.resolve(strict=True)
    except (OSError, RuntimeError):
        return Path(os.path.abspath(ruta))


def con_barras(ruta: Path) -> str:
    texto = str(ruta).replace("\\", "/")
    if len(texto) > 1 and texto.endswith("/") and not texto.endswith(":/"):
        texto = texto[:-1]
    return texto


def a_windows(ruta: str) -> str:
    """/c/Users/x a C:/Users/x."""
    m = re.match(r"^/([a-zA-Z])(/.*)?$", ruta)
    if not m:
        return ruta
    return f"{m.group(1).upper()}:{m.group(2) or '/'}"


def dentro_de(limite: Path, ruta: Path) -> bool:
    """Si ruta esta dentro de limite. Sin distinguir mayusculas en Windows y Mac."""
    a = con_barras(real(limite))
    b = con_barras(real(ruta))
    if SISTEMA != "otro":
        a, b = a.lower(), b.lower()
    if a.endswith("/"):
        return b.startswith(a)
    return b == a or b.startswith(a + "/")


def relativa(limite: Path, ruta: Path) -> str:
    try:
        r = os.path.relpath(real(ruta), real(limite)).replace("\\", "/")
    except ValueError:
        return con_barras(ruta)
    return "" if r == "." else r


def registrar(texto: str) -> None:
    """Lo que el motor cuenta, en su ventana. Nunca en archivos."""
    print(f"  {time.strftime('%H:%M:%S')}  {texto}", flush=True)


# ---------------------------------------------------------------------------
# Procesos: la unica puerta, y cuantos se lanzaron


@dataclass
class Salida:
    codigo: int
    salida: str
    error: str
    agotado: bool


class Procesos:
    lanzados = 0
    _cerrojo = threading.Lock()

    @classmethod
    def contar(cls) -> None:
        with cls._cerrojo:
            cls.lanzados += 1


def _arquitectura() -> list:
    """En Mac, bash y git de Apple son universales; se lanzan con la arquitectura de este Python."""
    if not MAC or not Path("/usr/bin/arch").exists():
        return []
    maquina = platform.machine()
    return ["/usr/bin/arch", f"-{maquina}"] if maquina in ("arm64", "x86_64") else []


ARQUITECTURA = _arquitectura()


class Trabajo:
    """Todo lo que una orden abre, para detenerlo junto.

    En Windows, un objeto de trabajo: los hijos lo heredan, y taskkill /T no
    alcanza a los procesos que abre Git Bash. En Mac y Linux, el grupo de
    procesos de una sesion nueva.

    En Windows cada orden entra ademas en el trabajo del motor, uno solo para
    toda la vida del programa, marcado para matar todo lo suyo cuando se
    cierra su ultima manija. Esa manija la tiene este proceso y nadie mas: si
    el motor termina de cualquier forma, al cerrar la ventana, por un error o
    muerto de golpe, Windows la cierra y termina todo lo que abrieron las
    ordenes. Sin esto un bash, un git o un sleep a medio correr quedaban
    vivos, parados en la carpeta del laboratorio, y el siguiente arranque no
    la podia borrar.
    """

    _del_motor: Optional[int] = None
    _cerrojo = threading.Lock()

    @classmethod
    def del_motor(cls, kernel32) -> Optional[int]:
        import ctypes
        from ctypes import wintypes

        with cls._cerrojo:
            if cls._del_motor is not None:
                return cls._del_motor

            class Basica(ctypes.Structure):
                _fields_ = [("tiempo_proceso", ctypes.c_int64), ("tiempo_trabajo", ctypes.c_int64),
                            ("limites", wintypes.DWORD), ("minimo", ctypes.c_size_t), ("maximo", ctypes.c_size_t),
                            ("procesos", wintypes.DWORD), ("afinidad", ctypes.c_size_t),
                            ("prioridad", wintypes.DWORD), ("planificacion", wintypes.DWORD)]

            class Contadores(ctypes.Structure):
                _fields_ = [(n, ctypes.c_uint64) for n in ("a", "b", "c", "d", "e", "f")]

            class Extendida(ctypes.Structure):
                _fields_ = [("basica", Basica), ("contadores", Contadores), ("memoria_proceso", ctypes.c_size_t),
                            ("memoria_trabajo", ctypes.c_size_t), ("pico_proceso", ctypes.c_size_t),
                            ("pico_trabajo", ctypes.c_size_t)]

            manija = kernel32.CreateJobObjectW(None, None)
            if not manija:
                return None
            info = Extendida()
            # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, y BREAKAWAY_OK para lo que
            # pida salir, como un editor que se abre y sigue solo.
            info.basica.limites = 0x2000 | 0x800
            # JobObjectExtendedLimitInformation
            if not kernel32.SetInformationJobObject(ctypes.c_void_p(manija), 9, ctypes.byref(info),
                                                    ctypes.sizeof(info)):
                kernel32.CloseHandle(ctypes.c_void_p(manija))
                return None
            cls._del_motor = manija
            return manija

    def __init__(self, proceso: subprocess.Popen) -> None:
        self.proceso = proceso
        self.manija = None
        if WINDOWS:
            try:
                import ctypes

                self.kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
                self.kernel32.CreateJobObjectW.restype = ctypes.c_void_p
                proceso_manija = ctypes.c_void_p(int(proceso._handle))  # type: ignore[attr-defined]
                # Primero el del motor; el de la orden queda anidado dentro.
                del_motor = Trabajo.del_motor(self.kernel32)
                if del_motor:
                    self.kernel32.AssignProcessToJobObject(ctypes.c_void_p(del_motor), proceso_manija)
                manija = self.kernel32.CreateJobObjectW(None, None)
                if manija and self.kernel32.AssignProcessToJobObject(ctypes.c_void_p(manija), proceso_manija):
                    self.manija = manija
            except (OSError, AttributeError, ValueError):
                self.manija = None

    def detener(self) -> None:
        try:
            if WINDOWS:
                import ctypes

                if self.manija is not None:
                    self.kernel32.TerminateJobObject(ctypes.c_void_p(self.manija), 1)
                Procesos.contar()
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.proceso.pid)], capture_output=True)
            else:
                os.killpg(self.proceso.pid, signal.SIGKILL)
        except (OSError, ProcessLookupError):
            pass

    def cerrar(self) -> None:
        if WINDOWS and self.manija is not None:
            import ctypes

            self.kernel32.CloseHandle(ctypes.c_void_p(self.manija))
            self.manija = None


def correr(orden: list, carpeta: Optional[Path], entorno: Optional[dict], segundos: float,
           entrada: Optional[str] = None) -> Salida:
    """Lanza un proceso, le escribe la entrada y la cierra, y espera. Si se pasa del tiempo, lo mata entero.

    Un valor None en el entorno quita la variable heredada.
    """
    ambiente = dict(os.environ)
    for clave, valor in (entorno or {}).items():
        if valor is None:
            ambiente.pop(clave, None)
        else:
            ambiente[clave] = valor
    opciones: dict = {}
    if WINDOWS:
        opciones["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
    else:
        opciones["start_new_session"] = True
    Procesos.contar()
    proceso = subprocess.Popen(
        orden,
        cwd=str(carpeta) if carpeta is not None else None,
        env=ambiente,
        stdin=subprocess.PIPE if entrada is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        **opciones,
    )
    trabajo = Trabajo(proceso)
    datos = entrada.encode("utf-8") if entrada is not None else None
    try:
        salida_b, error_b = proceso.communicate(input=datos, timeout=segundos)
        agotado = False
    except subprocess.TimeoutExpired:
        trabajo.detener()
        agotado = True
        try:
            salida_b, error_b = proceso.communicate(timeout=1)
        except subprocess.TimeoutExpired:
            # Un nieto que no murio puede tener el tubo abierto: no se le espera.
            for tubo in (proceso.stdout, proceso.stderr):
                if tubo is not None:
                    tubo.close()
            salida_b, error_b = b"", b""
    trabajo.cerrar()
    return Salida(
        -1 if agotado else proceso.returncode,
        (salida_b or b"").decode("utf-8", errors="replace"),
        (error_b or b"").decode("utf-8", errors="replace"),
        agotado,
    )


# ---------------------------------------------------------------------------
# Git y Git Bash, sin confiar en el PATH


@dataclass
class Instalacion:
    git: Path
    bash: Path
    login: bool
    origen: str


def _registro(rama: str) -> Optional[str]:
    """InstallPath de Git para Windows, leido del registro sin lanzar reg.exe."""
    try:
        import winreg

        raiz = winreg.HKEY_LOCAL_MACHINE if rama == "HKLM" else winreg.HKEY_CURRENT_USER
        with winreg.OpenKey(raiz, r"SOFTWARE\GitForWindows") as clave:
            valor, _ = winreg.QueryValueEx(clave, "InstallPath")
            return str(valor) or None
    except (OSError, ImportError):
        return None


def _instalacion_windows(raiz: Path, origen: str) -> Optional[Instalacion]:
    bash = raiz / "bin" / "bash.exe"
    if not bash.is_file():
        bash = raiz / "usr" / "bin" / "bash.exe"
    git = raiz / "cmd" / "git.exe"
    if not git.is_file():
        git = raiz / "bin" / "git.exe"
    if bash.is_file() and git.is_file():
        return Instalacion(git, bash, True, origen)
    return None


def buscar_git() -> Optional[Instalacion]:
    if WINDOWS:
        candidatas = []
        for rama in ("HKLM", "HKCU"):
            valor = _registro(rama)
            if valor:
                candidatas.append((Path(valor), f"registro {rama}"))
        candidatas.append((Path(r"C:\Program Files\Git"), r"C:\Program Files\Git"))
        candidatas.append((Path(r"C:\Program Files (x86)\Git"), r"C:\Program Files (x86)\Git"))
        local = os.environ.get("LOCALAPPDATA")
        if local:
            candidatas.append((Path(local) / "Programs" / "Git", "LOCALAPPDATA"))
        propia = os.environ.get("TALLER_GIT")
        if propia:
            p = Path(propia)
            if p.name.lower() == "git.exe":
                p = p.parent.parent
                if p.name.lower() == "mingw64":
                    p = p.parent
            candidatas.append((p, "TALLER_GIT"))
        for raiz, origen in candidatas:
            encontrada = _instalacion_windows(raiz, origen)
            if encontrada:
                return encontrada
        for carpeta in os.environ.get("PATH", "").split(";"):
            carpeta = carpeta.strip().strip('"')
            if carpeta and (Path(carpeta) / "git.exe").is_file():
                raiz = Path(carpeta).parent
                if raiz.name.lower() == "mingw64":
                    raiz = raiz.parent
                encontrada = _instalacion_windows(raiz, "PATH")
                if encontrada:
                    return encontrada
        return None

    bash = Path("/bin/bash")
    if MAC:
        candidatas_mac = []
        # /usr/bin/git abre el dialogo de instalacion si faltan las herramientas de Apple.
        apple = _herramientas_de_apple()
        if apple:
            candidatas_mac.append(Path("/usr/bin/git"))
        candidatas_mac += [Path("/opt/homebrew/bin/git"), Path("/usr/local/bin/git")]
        for c in candidatas_mac:
            if c.is_file():
                return Instalacion(c, bash, False, str(c))
        en_path = shutil.which("git")
        if en_path and (en_path != "/usr/bin/git" or apple):
            return Instalacion(Path(en_path), bash, False, "PATH")
        return None
    en_path = shutil.which("git")
    return Instalacion(Path(en_path), bash, False, "PATH") if en_path else None


def _herramientas_de_apple() -> bool:
    try:
        s = correr(["/usr/bin/xcode-select", "-p"], None, None, 10)
    except OSError:
        return False
    ruta = s.salida.strip()
    return s.codigo == 0 and bool(ruta) and (Path(ruta) / "usr" / "bin" / "git").is_file()


# ---------------------------------------------------------------------------
# Carpetas sincronizadas


def carpeta_sincronizada(ruta: Path) -> Optional[str]:
    texto = con_barras(Path(os.path.abspath(ruta))).lower() + "/"
    for nombre in ("OneDrive", "OneDriveCommercial", "OneDriveConsumer"):
        valor = os.environ.get(nombre)
        if valor and texto.startswith(con_barras(Path(os.path.abspath(valor))).lower() + "/"):
            return "OneDrive"
    for variable, servicio in (("DROPBOX_PATH", "Dropbox"), ("GoogleDriveFS", "Google Drive")):
        valor = os.environ.get(variable)
        if valor and texto.startswith(con_barras(Path(os.path.abspath(valor))).lower() + "/"):
            return servicio
    for trozo, servicio in (
        ("/onedrive", "OneDrive"),
        ("/library/mobile documents/", "iCloud Drive"),
        ("/library/cloudstorage/", "una carpeta sincronizada de macOS"),
        ("/dropbox", "Dropbox"),
        ("/google drive", "Google Drive"),
        ("/googledrive", "Google Drive"),
        ("/mi unidad", "Google Drive"),
        ("/my drive", "Google Drive"),
    ):
        if trozo in texto:
            return servicio
    return None


def aviso_sincronizada(servicio: str) -> str:
    return (
        f"El clon está dentro de una carpeta que sincroniza {servicio}. Esas carpetas corrompen el repositorio "
        "y hacen que el dibujo se mueva solo. Clona el curso en una carpeta que no se sincronice, por ejemplo "
        "C:\\taller o ~/taller."
    )


# ---------------------------------------------------------------------------
# El ejecutor de ordenes


# El mismo envoltorio del motor de Java, letra por letra (INTERFAZ.md).
ENVOLTORIO = "; ".join([
    '__taller_fin() { __taller_rc=$?; if [ -s "$TALLER_CD_DESPUES" ]; then builtin cd -- "$(cat "$TALLER_CD_DESPUES")" 2>/dev/null; rm -f -- "$TALLER_CD_DESPUES"; fi; if [ "$TALLER_SO" = windows ]; then pwd -W; else pwd -P; fi > "$TALLER_CARPETA_FINAL" 2>/dev/null; exit $__taller_rc; }',
    "trap __taller_fin EXIT",
    '__taller_limite=$(builtin cd -- "$TALLER_LIMITE" 2>/dev/null && pwd -P)',
    '__taller_dentro() { local __p; __p=$(pwd -P); shopt -s nocasematch; case "$__p/" in "$__taller_limite"/*) shopt -u nocasematch; return 0 ;; esac; shopt -u nocasematch; return 1; }',
    'cd() { local __antes="$PWD"; builtin cd "$@" || return; if ! __taller_dentro; then builtin cd -- "$__antes"; printf \'%s\\n\' "bash: cd: la consola del taller no sale de $TALLER_LIMITE" >&2; return 1; fi; }',
    'export PATH="$__taller_limite:$PATH"',
    'export TALLER_CD_DESPUES="$TALLER_CARPETA_FINAL.cd"',
    'rm -f -- "$TALLER_CD_DESPUES"',
    'builtin cd -- "$TALLER_CARPETA" || exit 97',
    "exec 0</dev/null",
    'eval "$TALLER_ORDEN"',
]) + "\n"

EDITOR = re.compile(r"(?i)(editor|terminal is dumb|la terminal es tonta)")
INTERACTIVA = re.compile(
    r"\bgit\b[^;&|]*\b(add|checkout|restore|reset|stash|commit|clean)\b[^;&|]*\s(-p|--patch|-i|--interactive)(\s|$)"
)
REBASE_INTERACTIVO = re.compile(r"\bgit\b[^;&|]*\brebase\b[^;&|]*\s(-i|--interactive)(\s|$)")
FIRMA = re.compile(r"^.*?bash(?:\.exe)?: (?:eval: )?line (\d+):", re.M)


def firma_de_bash(error: str) -> str:
    """Bash firma sus errores con la ruta con que se lo lanzo. En Git Bash firma bash."""
    return FIRMA.sub(lambda m: f"bash: line {m.group(1)}:", error)


def ayuda_editor() -> str:
    if MAC:
        return (
            "Git no pudo abrir el editor. Si configuraste code --wait, abre Visual Studio Code, busca con "
            "Cmd+Shift+P la orden Shell Command, Install 'code' command in PATH, y vuelve a abrir el taller. "
            'Mientras tanto, git commit -m "mensaje" no necesita editor.'
        )
    return (
        "Git no pudo abrir el editor. Si configuraste code --wait, instala Visual Studio Code marcando la opción "
        "de agregarlo al PATH, cierra el taller y vuelve a abrirlo. Mientras tanto, git commit -m \"mensaje\" "
        "no necesita editor."
    )


def describir_tiempo(ms: int) -> str:
    segundos = ms // 1000
    if segundos % 60 == 0:
        minutos = segundos // 60
        return "1 minuto" if minutos == 1 else f"{minutos} minutos"
    return "1 segundo" if segundos == 1 else f"{segundos} segundos"


def _sin_locale() -> bool:
    return not (os.environ.get("LANG") or os.environ.get("LC_ALL") or os.environ.get("LC_CTYPE"))


def _hay_git_en(path: Optional[str]) -> bool:
    return any(p and os.access(os.path.join(p, "git"), os.X_OK) for p in (path or "").split(":"))


def entorno_comun(git: Instalacion) -> dict:
    """Lo que ninguna orden puede heredar: ni paginador, ni preguntas, ni texto fuera de UTF-8."""
    e = {"GIT_PAGER": "cat", "PAGER": "cat", "TERM": "dumb", "GIT_TERMINAL_PROMPT": "0"}
    if WINDOWS:
        # El idioma lo pone el inicio de sesion de Git Bash, como en su ventana.
        e["CHERE_INVOKING"] = "1"
    else:
        if _sin_locale():
            e["LC_CTYPE"] = "UTF-8"
        path = os.environ.get("PATH", "")
        if not _hay_git_en(path):
            e["PATH"] = f"{git.git.parent}" + (f":{path}" if path else "")
    return e


@dataclass
class Resultado:
    codigo: int
    salida: str
    error: str
    carpeta: Path
    agotado: bool
    avisos: list = field(default_factory=list)


class Ejecutor:
    def __init__(self, git: Instalacion, limite: Path, propia: Path, tiempo_maximo_ms: int) -> None:
        self.git = git
        self.limite = limite
        self.tiempo_maximo = tiempo_maximo_ms
        propia.mkdir(parents=True, exist_ok=True)
        self.carpeta_final = propia / "carpeta-final"

    def _linea(self) -> list:
        linea = [str(self.git.bash)]
        if self.git.login:
            linea.append("--login")
        return [*ARQUITECTURA, *linea, "-s"]

    def ejecutar(self, orden: str, carpeta: Path) -> Resultado:
        avisos: list = []
        try:
            self.carpeta_final.unlink()
        except OSError:
            pass
        entorno = entorno_comun(self.git)
        entorno.update(
            TALLER_ORDEN=orden,
            TALLER_CARPETA=con_barras(carpeta),
            TALLER_LIMITE=con_barras(self.limite),
            TALLER_CARPETA_FINAL=con_barras(self.carpeta_final),
            TALLER_SO="windows" if WINDOWS else "unix",
        )
        try:
            s = correr(self._linea(), carpeta, entorno, self.tiempo_maximo / 1000, ENVOLTORIO)
        except OSError as e:
            return Resultado(-1, "", "", carpeta, False, [f"No se pudo lanzar bash, {e}"])

        nueva = real(carpeta)
        try:
            escrita = self.carpeta_final.read_text(encoding="utf-8").strip()
        except OSError:
            escrita = ""
        if escrita:
            candidata = Path(a_windows(escrita) if WINDOWS else escrita)
            if not candidata.is_dir():
                pass  # La carpeta se borro con la orden misma.
            elif dentro_de(self.limite, candidata):
                nueva = real(candidata)
            else:
                avisos.append(
                    f"La consola no sale de {con_barras(self.limite)}. La orden corrió, pero la consola se queda donde estaba."
                )
        if s.agotado:
            avisos.append(
                f"La orden pasó el límite de {describir_tiempo(self.tiempo_maximo)} y se detuvo, junto con todo lo que había lanzado."
            )
        if s.codigo != 0 and not s.agotado and EDITOR.search(s.error):
            avisos.append(ayuda_editor())
        if INTERACTIVA.search(orden) or (s.codigo != 0 and REBASE_INTERACTIVO.search(orden)):
            avisos.append(
                "Esta orden pide respuestas por teclado y la consola del taller no se las puede dar. Hazla en Git Bash."
            )
        return Resultado(s.codigo, s.salida, firma_de_bash(s.error), nueva, s.agotado, avisos)


# ---------------------------------------------------------------------------
# El estado, preguntado a Git


def _lineas(texto: Optional[str]) -> list:
    if not texto:
        return []
    salida = []
    for linea in texto.split("\n"):
        if linea.endswith("\r"):
            linea = linea[:-1]
        if linea.strip():
            salida.append(linea)
    return salida


class Lector:
    def __init__(self, git: Instalacion) -> None:
        self.git = git

    def _git(self, carpeta: Path, entorno: dict, *argumentos: str, entrada: Optional[str] = None) -> Salida:
        orden = [*ARQUITECTURA, str(self.git.git), "--no-optional-locks", "-c", "core.quotepath=false", *argumentos]
        return correr(orden, carpeta, entorno, 60, entrada)

    def secciones(self, carpeta: Path) -> dict:
        s: dict = {}
        if not carpeta.is_dir():
            s["sin-carpeta"] = ""
            return s
        entorno = entorno_comun(self.git)
        entorno["GIT_OPTIONAL_LOCKS"] = "0"
        rp = self._git(carpeta, entorno, "rev-parse", "--absolute-git-dir", "--show-toplevel")
        lineas = rp.salida.splitlines()
        gitdir = lineas[0].strip() if lineas else ""
        top = lineas[1].strip() if len(lineas) > 1 else ""
        if not gitdir:
            s["fuera"] = ""
            return s
        if not top:
            if not gitdir.endswith("/.git"):
                s["desnudo"] = ""
                return s
            s["dentro-de-git"] = ""
            top = gitdir[: -len("/.git")]
        s["raiz"] = f"{top}\n{gitdir}\n"
        raiz = Path(top)
        dir_git = Path(gitdir)

        s["refs"] = self._git(
            raiz, entorno, "for-each-ref",
            "--format=%(refname)%09%(objectname)%09%(objecttype)%09%(*objectname)%09%(*objecttype)",
            "refs/heads", "refs/remotes", "refs/tags",
        ).salida
        hay_confirmaciones = bool(s["refs"].strip()) or (dir_git / "logs" / "HEAD").is_file()
        s["arbol"] = (
            self._git(raiz, entorno, "ls-tree", "-r", "--name-only", "-z", "HEAD").salida if hay_confirmaciones else ""
        )

        puntas: list = []
        guardados = ""
        if (dir_git / "refs" / "stash").exists() or (dir_git / "logs" / "refs" / "stash").exists():
            guardados = self._git(raiz, entorno, "stash", "list", "--format=%H%x09%P%x09%gs").salida
            for linea in _lineas(guardados):
                c = linea.split("\t")
                if len(c) > 1 and c[1].strip():
                    puntas.append(c[1].strip().split(" ")[0])
        s["guardados"] = guardados

        registro: list = []
        logs_head = dir_git / "logs" / "HEAD"
        if logs_head.is_file() and logs_head.stat().st_size > 0:
            registro = [i.strip() for i in _lineas(self._git(raiz, entorno, "reflog", "show", "--format=%H", "HEAD", "--").salida)]

        log = ["log", "--ignore-missing", "--topo-order", "--abbrev=7",
               "--format=%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%ct%x1f%s%x1e", "--branches", "--remotes", "--tags", "HEAD",
               *puntas]
        l = self._git(raiz, entorno, *log, *dict.fromkeys(registro), "--")
        if l.codigo != 0 and registro:
            # Un registro viejo puede nombrar objetos que ya no existen.
            tipos = self._git(raiz, entorno, "cat-file", "--batch-check=%(objectname) %(objecttype)",
                              entrada="\n".join(registro) + "\n")
            filtrado = list(log)
            for linea in _lineas(tipos.salida):
                c = linea.strip().split(" ")
                if len(c) == 2 and c[1] == "commit":
                    filtrado.append(c[0])
            l = self._git(raiz, entorno, *filtrado, "--")
        s["log"] = l.salida

        operacion = ""
        for f in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"):
            if (dir_git / f).exists():
                operacion += f + "\n"
        if (dir_git / "rebase-merge").is_dir() or (dir_git / "rebase-apply").is_dir():
            operacion += "REBASE\n"
        s["operacion"] = operacion
        s["estado"] = self._git(raiz, entorno, "status", "--porcelain=v2", "-z", "--branch",
                                "--untracked-files=all").salida
        return s

    def leer(self, carpeta: Path) -> dict:
        return interpretar(self.secciones(carpeta))


def _porcelana(texto: str) -> dict:
    """git status --porcelain=v2 -z: cada entrada a su area."""
    preparado: list = []
    modificado: list = []
    sin_seguimiento: list = []
    conflicto: list = []
    partes = texto.split("\0")
    i = 0
    while i < len(partes):
        p = partes[i]
        i += 1
        if not p:
            continue
        clase = p[0]
        if clase == "1":
            c = p.split(" ", 8)
            if len(c) < 9:
                continue
            _agregar(c[1], c[8], None, preparado, modificado)
        elif clase == "2":
            c = p.split(" ", 9)
            if len(c) < 10:
                continue
            origen = partes[i] if i < len(partes) else None
            i += 1
            _agregar(c[1], c[9], origen, preparado, modificado)
        elif clase == "u":
            c = p.split(" ", 10)
            if len(c) < 11:
                continue
            conflicto.append(c[10])
        elif clase == "?":
            sin_seguimiento.append(p[2:])
    rutas = {e["ruta"] for e in preparado} | {e["ruta"] for e in modificado} | set(sin_seguimiento) | set(conflicto)
    return {
        "preparado": preparado,
        "modificado": modificado,
        "sinSeguimiento": sin_seguimiento,
        "conflicto": conflicto,
        "cambios": len(rutas),
    }


def _agregar(xy: str, ruta: str, origen: Optional[str], preparado: list, modificado: list) -> None:
    x = xy[0]
    y = xy[1] if len(xy) > 1 else "."
    if x != ".":
        entrada = {"ruta": ruta, "tipo": x}
        if x in "RC" and origen is not None:
            entrada["origen"] = origen
        preparado.append(entrada)
    if y != ".":
        modificado.append({"ruta": ruta, "tipo": y})


def _alcanzables(puntas: list, padres_de: dict) -> set:
    vistos: set = set()
    pendientes = list(puntas)
    while pendientes:
        i = pendientes.pop()
        if i in vistos:
            continue
        vistos.add(i)
        pendientes.extend(padres_de.get(i, []))
    return vistos


def interpretar(s: dict) -> dict:
    """Las respuestas de Git en la forma de INTERFAZ.md, en el mismo orden de campos del motor de Java."""
    if "raiz" not in s:
        return {"repositorio": False, "motivo": "desnudo" if "desnudo" in s else "fuera"}
    raiz = s["raiz"].split("\n")
    estado: dict = {
        "repositorio": True,
        "raiz": raiz[0].strip(),
        "gitdir": raiz[1].strip() if len(raiz) > 1 else "",
        "dentroDeGit": "dentro-de-git" in s,
    }
    rama = None
    head = ""
    for parte in s.get("estado", "").split("\0"):
        if parte.startswith("# branch.head "):
            nombre = parte[len("# branch.head "):].strip()
            rama = None if nombre == "(detached)" else nombre
        elif parte.startswith("# branch.oid "):
            oid = parte[len("# branch.oid "):].strip()
            head = "" if oid == "(initial)" else oid
    estado["rama"] = rama
    estado["head"] = head or None

    ramas: list = []
    remotas: list = []
    etiquetas: list = []
    puntas: list = []
    for linea in _lineas(s.get("refs")):
        c = linea.split("\t")
        if len(c) < 5:
            continue
        nombre, objeto, tipo, pelado, tipo_pelado = c[:5]
        if nombre.startswith("refs/heads/"):
            ramas.append({"nombre": nombre[11:], "id": objeto})
            puntas.append(objeto)
        elif nombre.startswith("refs/remotes/"):
            corto = nombre[13:]
            if corto.endswith("/HEAD"):
                continue
            remotas.append({"nombre": corto, "id": objeto})
            puntas.append(objeto)
        elif nombre.startswith("refs/tags/"):
            anotada = tipo == "tag"
            ident = pelado if anotada else objeto
            if (tipo_pelado if anotada else tipo) != "commit":
                continue
            etiquetas.append({"nombre": nombre[10:], "id": ident, "anotada": anotada})
            puntas.append(ident)
    if head:
        puntas.append(head)

    guardados: list = []
    indice = 0
    for linea in _lineas(s.get("guardados")):
        c = linea.split("\t")
        if len(c) < 3:
            continue
        base = c[1].split(" ")[0]
        guardados.append({"indice": indice, "id": c[0], "base": base, "mensaje": c[2]})
        indice += 1
        puntas.append(base)

    confirmaciones: list = []
    padres_de: dict = {}
    for registro in s.get("log", "").split("\x1e"):
        r = registro.strip()
        if not r:
            continue
        c = r.split("\x1f")
        if len(c) < 7:
            continue
        padres = c[2].strip().split(" ") if c[2].strip() else []
        try:
            epoca = int(c[5].strip())
        except ValueError:
            epoca = 0
        confirmaciones.append({
            "id": c[0], "corto": c[1], "padres": padres, "autor": c[3], "correo": c[4], "epoca": epoca, "asunto": c[6],
        })
        padres_de[c[0]] = padres
    vivas = _alcanzables(puntas, padres_de)
    for conf in confirmaciones:
        conf["huerfana"] = conf["id"] not in vivas

    operacion = None
    for linea in _lineas(s.get("operacion")):
        operacion = {"MERGE_HEAD": "fusion", "CHERRY_PICK_HEAD": "cherry-pick", "REVERT_HEAD": "revert",
                     "REBASE": "rebase"}.get(linea.strip(), operacion)
        if operacion == "rebase":
            break

    areas = _porcelana(s.get("estado", ""))
    estado.update({
        "confirmaciones": confirmaciones,
        "ramas": ramas,
        "remotas": remotas,
        "etiquetas": etiquetas,
        "guardados": guardados,
        "operacion": operacion,
        "areas": {k: areas[k] for k in ("preparado", "modificado", "sinSeguimiento", "conflicto")},
        "cambios": areas["cambios"],
        "arbol": [r for r in s.get("arbol", "").split("\0") if r],
    })
    return estado


# ---------------------------------------------------------------------------
# La huella, sin lanzar ningun proceso


DE_GIT = ("HEAD", "index", "packed-refs", "logs/HEAD", "ORIG_HEAD", "FETCH_HEAD", "MERGE_HEAD", "REBASE_HEAD",
          "CHERRY_PICK_HEAD", "REVERT_HEAD", "logs/refs/stash")
CARPETAS_DE_GIT = ("refs", "rebase-merge", "rebase-apply")


def raiz_de(carpeta: Path, limite: Path) -> Optional[Path]:
    actual: Optional[Path] = real(carpeta)
    tope = real(limite).parent
    while actual is not None and actual != tope:
        if (actual / ".git").exists():
            return actual
        if actual.name == ".git":
            return actual.parent
        actual = actual.parent if actual.parent != actual else None
    return None


def _ignoradas_de_primer_nivel(raiz: Path) -> set:
    r = {".git", "node_modules"}
    try:
        for linea in (raiz / ".gitignore").read_text(encoding="utf-8").splitlines():
            t = linea.strip()
            if not t or t.startswith("#") or t.startswith("!"):
                continue
            t = t.lstrip("/").rstrip("/")
            if not t or any(ch in t for ch in "/*?["):
                continue
            if (raiz / t).is_dir():
                r.add(t)
    except OSError:
        pass
    return r


def huella(carpeta: Path, limite: Path) -> str:
    partes = [f"carpeta:{carpeta}", "existe" if carpeta.is_dir() else "no-existe"]

    def archivo(ruta: Path, nombre: str) -> None:
        try:
            d = ruta.stat()
            partes.append(f"{nombre}:{d.st_size}:{d.st_mtime_ns}")
        except OSError:
            partes.append(f"{nombre}:-")

    def recorrer(base: Path, inicio: Path, saltar: set) -> None:
        if not inicio.is_dir():
            return
        for actual, carpetas, archivos in os.walk(inicio):
            if Path(actual) == inicio:
                carpetas[:] = sorted(c for c in carpetas if c not in saltar)
            else:
                carpetas.sort()
            partes.append(f"d:{os.path.relpath(actual, base)}")
            for nombre in sorted(archivos):
                archivo(Path(actual) / nombre, f"f:{os.path.relpath(os.path.join(actual, nombre), base)}")

    raiz = raiz_de(carpeta, limite)
    if raiz is None:
        partes.append("sin-repositorio")
    else:
        partes.append(f"raiz:{raiz}")
        git = raiz / ".git"
        if git.is_dir():
            for nombre in DE_GIT:
                archivo(git / nombre, nombre)
            for nombre in CARPETAS_DE_GIT:
                recorrer(git, git / nombre, set())
        else:
            archivo(git, ".git")
        recorrer(raiz, raiz, _ignoradas_de_primer_nivel(raiz))
    return hashlib.sha1("\n".join(partes).encode("utf-8", errors="replace")).hexdigest()


# ---------------------------------------------------------------------------
# La sesion


class Taller:
    def __init__(self, git: Instalacion, limite: Path, propia: Path, avisos: list, tiempo_maximo_ms: int) -> None:
        self.git = git
        self.limite = limite
        self.propia = propia
        self.avisos = avisos
        self.ejecutor = Ejecutor(git, limite, propia, tiempo_maximo_ms)
        self.lector = Lector(git)
        self.cerrojo_orden = threading.Lock()
        self.cerrojo_lectura = threading.Lock()
        self.termino_lectura = threading.Condition()
        self.orden_en_curso: Optional[str] = None
        self.version = 0
        self.documento = ""
        self.ultima_huella = ""
        self.ultima_por_huella = 0.0
        self.pendiente = False
        self.leyendo = False
        self.carpeta = self._carpeta_guardada()

    def _carpeta_guardada(self) -> Path:
        try:
            p = Path((self.propia / "carpeta").read_text(encoding="utf-8").strip())
            if p.is_dir() and dentro_de(self.limite, p):
                return real(p)
        except OSError:
            pass
        return real(self.limite)

    def _guardar_carpeta(self) -> None:
        try:
            (self.propia / "carpeta").write_text(str(self.carpeta), encoding="utf-8")
        except OSError as e:
            registrar(f"no se pudo guardar la carpeta de la consola, {e}")

    def ejecutar(self, orden: str):
        if not self.cerrojo_orden.acquire(blocking=False):
            return None, self.orden_en_curso
        self.orden_en_curso = orden
        try:
            registrar(f"orden en {relativa(self.limite, self.carpeta)} · {orden}")
            r = self.ejecutor.ejecutar(orden, self.carpeta)
            if r.carpeta != self.carpeta:
                self.carpeta = r.carpeta
                self._guardar_carpeta()
            if r.agotado:
                registrar("la orden se detuvo por tiempo")
            self.leer()
            return r, None
        finally:
            self.orden_en_curso = None
            self.cerrojo_orden.release()

    def leer(self) -> None:
        with self.cerrojo_lectura:
            self.leyendo = True
            try:
                self._leer_sin_avisar()
            finally:
                self.leyendo = False
                with self.termino_lectura:
                    self.termino_lectura.notify_all()

    def _leer_sin_avisar(self) -> None:
        donde = self.carpeta
        h = huella(donde, self.limite)
        try:
            estado = self.lector.leer(donde)
        except OSError as e:
            registrar(f"no se pudo leer el estado, {e}")
            return
        self.ultima_huella = h
        self.pendiente = False
        nuevo = json.dumps({"sesion": self._sesion(donde), "estado": estado}, ensure_ascii=False, separators=(",", ":"))
        if nuevo != self.documento:
            self.documento = nuevo
            self.version += 1

    def esperar_lectura(self, desde: int, segundos: float) -> None:
        """Si se esta leyendo, o la huella cambio y la lectura esta por empezar, espera a que termine."""
        fin = time.monotonic() + segundos
        with self.termino_lectura:
            while self.version == desde and (self.leyendo or self.pendiente):
                resta = fin - time.monotonic()
                if resta <= 0:
                    return
                self.termino_lectura.wait(resta)

    def vigilar(self) -> None:
        h = huella(self.carpeta, self.limite)
        if h != self.ultima_huella:
            self.pendiente = True
        ahora = time.monotonic()
        if self.pendiente and ahora - self.ultima_por_huella >= 1:
            self.ultima_por_huella = ahora
            self.leer()

    def _sesion(self, donde: Path) -> dict:
        return {
            "sistema": SISTEMA,
            "usuario": _usuario(),
            "equipo": _equipo(),
            "limite": self.limite.name or con_barras(self.limite),
            "carpeta": con_barras(donde),
            "relativa": relativa(self.limite, donde),
            "avisos": list(self.avisos),
            "tiempoMaximo": self.ejecutor.tiempo_maximo,
            "motor": "python",
        }


def _usuario() -> str:
    try:
        import getpass

        u = getpass.getuser()
    except Exception:  # noqa: BLE001
        u = ""
    return u or "participante"


def _equipo() -> str:
    nombre = os.environ.get("COMPUTERNAME") if WINDOWS else os.environ.get("HOSTNAME")
    if not nombre:
        nombre = "TALLER" if WINDOWS else "taller"
    punto = nombre.find(".")
    return nombre[:punto] if punto > 0 else nombre


# ---------------------------------------------------------------------------
# El servidor


class Servidor(ThreadingHTTPServer):
    daemon_threads = True
    taller: Taller
    clave: str
    pagina: Path

    def server_bind(self) -> None:
        # HTTPServer.server_bind resuelve el nombre de la maquina con
        # socket.getfqdn, que en los ejecutores de Mac de GitHub tardaba 35
        # segundos: por eso no arrancaba el prototipo en Mac. Aqui no se
        # resuelve nada.
        socketserver.TCPServer.server_bind(self)
        self.server_name = "127.0.0.1"
        self.server_port = self.server_address[1]


METODO = {"/": "GET", "/api/estado": "GET", "/api/diagnostico": "GET", "/api/orden": "POST"}


class Manejador(BaseHTTPRequestHandler):
    server: Servidor
    protocol_version = "HTTP/1.1"

    def log_message(self, *_: object) -> None:
        pass

    def _encabezados(self, codigo: int, tipo: Optional[str], largo: int, extra: Optional[dict] = None) -> None:
        self.send_response_only(codigo)
        if tipo is not None:
            self.send_header("Content-Type", tipo)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        if codigo != 204:
            self.send_header("Content-Length", str(largo))
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def _responder(self, codigo: int, tipo: str, cuerpo: bytes) -> None:
        self._encabezados(codigo, tipo, len(cuerpo))
        self.wfile.write(cuerpo)

    def _sin_cuerpo(self, codigo: int, extra: Optional[dict] = None) -> None:
        self._encabezados(codigo, None, 0, extra)

    def _json(self, codigo: int, valor: dict) -> None:
        self._responder(codigo, "application/json; charset=utf-8",
                        json.dumps(valor, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

    def _permitida(self, clave_en_direccion: bool, consulta: dict) -> bool:
        propio = f"127.0.0.1:{self.server.server_port}"
        if self.headers.get("Host") != propio:
            return False
        origen = self.headers.get("Origin")
        if origen is not None and origen != f"http://{propio}":
            return False
        recibida = consulta.get("clave", [None])[0] if clave_en_direccion else self.headers.get("X-Taller-Clave")
        if recibida is None:
            return False
        return secrets.compare_digest(recibida.encode("utf-8"), self.server.clave.encode("utf-8"))

    def _atender(self, metodo: str) -> None:
        try:
            url = urlparse(self.path)
            camino = url.path
            consulta = parse_qs(url.query, keep_blank_values=True)
            if camino not in METODO or not self._permitida(camino == "/", consulta):
                self._sin_cuerpo(403)
                return
            if METODO[camino] != metodo:
                self._sin_cuerpo(405, {"Allow": METODO[camino]})
                return
            if camino == "/":
                self._responder(200, "text/html; charset=utf-8", self.server.pagina.read_bytes())
            elif camino == "/api/estado":
                self._estado(consulta)
            elif camino == "/api/diagnostico":
                self._json(200, {"procesos": Procesos.lanzados, "version": self.server.taller.version})
            else:
                self._orden()
        except (ConnectionError, BrokenPipeError):
            pass
        except Exception as e:  # noqa: BLE001
            registrar(f"error atendiendo {self.path}, {e!r}")
            try:
                self._sin_cuerpo(500)
            except OSError:
                pass

    def _estado(self, consulta: dict) -> None:
        taller = self.server.taller
        desde = consulta.get("desde", [None])[0]
        if desde is not None and desde == str(taller.version):
            taller.esperar_lectura(taller.version, 1)
        version = taller.version
        if desde is not None and desde == str(version):
            self._sin_cuerpo(204)
            return
        documento = taller.documento
        cuerpo = '{"version":' + str(version) + ("," + documento[1:] if len(documento) > 2 else "}")
        self._responder(200, "application/json; charset=utf-8", cuerpo.encode("utf-8"))

    def _orden(self) -> None:
        taller = self.server.taller
        try:
            leido = json.loads(self._cuerpo(64 * 1024).decode("utf-8") or "null")
            orden = leido.get("orden") if isinstance(leido, dict) and isinstance(leido.get("orden"), str) else None
        except (ValueError, UnicodeDecodeError):
            orden = None
        if orden is None or not orden.strip():
            self._json(400, {"error": "falta la orden"})
            return
        r, en_curso = taller.ejecutar(orden.strip())
        if r is None:
            self._json(409, {"ocupado": True, "enCurso": en_curso,
                             "avisos": ["Todavía corre la orden anterior. Espera a que termine."]})
            return
        self._json(200, {"codigo": r.codigo, "salida": r.salida, "error": r.error, "agotado": r.agotado,
                         "avisos": r.avisos, "version": taller.version})

    def _cuerpo(self, maximo: int) -> bytes:
        """El cuerpo, con Content-Length o por partes, como lo lee el motor de Java."""
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            partes = b""
            while True:
                tamano = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if tamano == 0:
                    while self.rfile.readline().strip():
                        pass
                    return partes
                partes += self.rfile.read(tamano)
                self.rfile.readline()
                if len(partes) > maximo:
                    raise ValueError("cuerpo demasiado grande")
        largo = int(self.headers.get("Content-Length", "0"))
        if largo > maximo:
            raise ValueError("cuerpo demasiado grande")
        return self.rfile.read(largo)

    def do_GET(self) -> None:  # noqa: N802
        self._atender("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._atender("POST")

    def do_PUT(self) -> None:  # noqa: N802
        self._atender("PUT")

    def do_DELETE(self) -> None:  # noqa: N802
        self._atender("DELETE")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._atender("OPTIONS")


# ---------------------------------------------------------------------------
# El arranque


def tiempo_maximo_ms() -> int:
    valor = os.environ.get("TALLER_TIEMPO_MAXIMO")
    try:
        segundos = int(valor) if valor else 600
        return (segundos if segundos > 0 else 600) * 1000
    except ValueError:
        return 600_000


def abrir_navegador(direccion: str) -> None:
    orden = (["rundll32", "url.dll,FileProtocolHandler", direccion] if WINDOWS
             else ["/usr/bin/open", direccion] if MAC else ["xdg-open", direccion])
    try:
        Procesos.contar()
        subprocess.Popen(orden, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        registrar("no se pudo abrir el navegador, abre tú la dirección de arriba")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    clon = ubicar_clon()
    limite = clon.parent
    propia = limite / ".taller"
    propia.mkdir(parents=True, exist_ok=True)

    avisos = []
    servicio = carpeta_sincronizada(clon)
    if servicio:
        avisos.append(aviso_sincronizada(servicio))

    git = buscar_git()
    if git is None:
        print()
        print("  No se encontró Git en este equipo.")
        if WINDOWS:
            print("  Instala Git para Windows desde https://git-scm.com/download/win")
            print("  o define TALLER_GIT con la carpeta de un Git portable, y vuelve a abrir el taller.")
        else:
            print("  En Mac, instala las herramientas de línea de comandos con xcode-select --install")
            print("  y vuelve a abrir el taller.")
        print()
        sys.exit(1)

    taller = Taller(git, limite, propia, avisos, tiempo_maximo_ms())
    taller.leer()

    servidor = Servidor(("127.0.0.1", 0), Manejador)
    servidor.taller = taller
    servidor.clave = secrets.token_hex(16)
    servidor.pagina = clon / "SIMULADOR.html"
    direccion = f"http://127.0.0.1:{servidor.server_port}/?clave={servidor.clave}"

    def vigilante() -> None:
        while True:
            time.sleep(0.5)
            try:
                taller.vigilar()
            except Exception as e:  # noqa: BLE001
                registrar(f"el vigilante tropezó, {e!r}")

    threading.Thread(target=vigilante, name="vigilante", daemon=True).start()

    archivo = os.environ.get("TALLER_ARCHIVO_DIRECCION")
    if archivo:
        Path(archivo).write_text(direccion + "\n", encoding="utf-8")
    print()
    print("  El taller está listo, con el motor de Python.")
    print(f"  Dirección: {direccion}")
    print("  No cierres esta ventana mientras trabajas.")
    print()
    for aviso in avisos:
        print(f"  ATENCIÓN. {aviso}")
        print()
    registrar(f"Git en {git.git}, bash en {git.bash}, encontrado por {git.origen}")
    if os.environ.get("TALLER_SIN_NAVEGADOR") != "1":
        abrir_navegador(direccion)
    try:
        servidor.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

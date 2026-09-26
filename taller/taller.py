"""El taller de Git: la consola de la página ejecuta Git de verdad (SPEC 026).

Se arranca con doble clic en ``TALLER.cmd`` (Windows) o ``taller.command``
(Mac), que llaman a este archivo. Levanta un servidor que escucha solo en
127.0.0.1, abre el navegador con el simulador en modo taller y ejecuta cada
orden que se escribe en la consola de la página con el Git Bash del equipo.

Seguridad
    Cada arranque genera una clave aleatoria. La página la recibe en su
    dirección y la manda en cada petición; sin ella la respuesta es 403. Se
    rechaza además cualquier petición con un ``Origin`` o un ``Host`` que no
    sean los propios, y no se envía ninguna cabecera CORS: una página de
    internet abierta en el mismo navegador no puede mandar órdenes.

Rastros
    Solo escribe dentro de ``taller-git-trabajo``, la carpeta hermana del
    clon, y un archivo propio ahí mismo (``.taller-sesion.json``). No toca la
    configuración de Git del alumno. Es un solo archivo para que Python no deje
    una carpeta ``__pycache__`` dentro del clon.

Solo biblioteca estándar. Python 3.9 o superior.
"""

from __future__ import annotations

import sys

sys.dont_write_bytecode = True

import hashlib  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import secrets  # noqa: E402
import shutil  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import threading  # noqa: E402
import urllib.request  # noqa: E402
import webbrowser  # noqa: E402
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402
from pathlib import Path  # noqa: E402
from urllib.parse import parse_qs, urlparse  # noqa: E402

if sys.version_info < (3, 9):  # pragma: no cover
    sys.exit("El taller necesita Python 3.9 o superior.")

WINDOWS = os.name == "nt"
AQUI = Path(__file__).resolve().parent
CLON = AQUI.parent
TRABAJO = CLON.parent / "taller-git-trabajo"
SESION = TRABAJO / ".taller-sesion.json"
PAGINA = CLON / "SIMULADOR.html"
EDITOR = AQUI / "editor.sh"
MARCA = "__TALLER_CARPETA__"
# Veinte minutos: de sobra para escribir un mensaje en VS Code.
LIMITE = int(os.environ.get("TALLER_LIMITE", "1200"))
HISTORIAL = 5000

INTERACTIVAS = [
    re.compile(r"\bgit\s+(?:add|checkout|restore|reset|stash|commit)\b[^;&|]*\s(?:-p|--patch|-i|--interactive)\b"),
    re.compile(r"\bgit\s+add\b[^;&|]*\s-[a-zA-Z]*[pi]\b"),
    re.compile(r"\bgit\s+clean\b[^;&|]*\s(?:-i|--interactive)\b"),
    re.compile(r"(?:^|[;&|]\s*)(?:vi|vim|nvim|nano|pico|emacs|less|more|man|top|htop|ssh)(?:\s|$)"),
]


# ---------------------------------------------------------------------------
# Git Bash


def buscar_bash() -> str:
    """El bash de Git para Windows, ubicado desde donde está git. Nunca el de WSL."""
    if not WINDOWS:
        return shutil.which("bash") or "/bin/bash"
    candidatos = []
    git = shutil.which("git")
    if git:
        real = Path(git).resolve()
        # C:\Program Files\Git\cmd\git.exe o ...\Git\mingw64\bin\git.exe
        for base in (real.parent.parent, real.parent.parent.parent):
            candidatos.append(base / "bin" / "bash.exe")
    for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"), os.environ.get("LOCALAPPDATA")):
        if base:
            candidatos.append(Path(base) / "Git" / "bin" / "bash.exe")
            candidatos.append(Path(base) / "Programs" / "Git" / "bin" / "bash.exe")
    for candidato in candidatos:
        # System32\bash.exe es el de WSL: no sirve.
        if candidato.exists() and "system32" not in str(candidato).lower():
            return str(candidato)
    raise SystemExit("No se encontró Git Bash. Instala Git para Windows y vuelve a abrir el taller.")


def arquitectura() -> list[str]:
    """En Mac, el bash de /bin es universal y a veces arrancaba como x86_64 bajo
    Rosetta, y el git de Apple fallaba ("unable to load libxcrun"). Se lanza
    con la misma arquitectura que este Python."""
    if sys.platform != "darwin" or not Path("/usr/bin/arch").exists():
        return []
    import platform

    maquina = platform.machine()
    return ["/usr/bin/arch", f"-{maquina}"] if maquina in ("arm64", "x86_64") else []


ARQUITECTURA = arquitectura()


def ruta_de_windows(ruta: str) -> str:
    """Git Bash escribe /c/Users/...; Windows necesita C:/Users/..."""
    if WINDOWS and re.match(r"^/[a-zA-Z](/|$)", ruta):
        return f"{ruta[1].upper()}:{ruta[2:] or '/'}"
    return ruta


def ruta_de_bash(ruta: Path) -> str:
    texto = str(ruta).replace("\\", "/")
    if WINDOWS and re.match(r"^[a-zA-Z]:", texto):
        return f"/{texto[0].lower()}{texto[2:]}"
    return texto


def comillas(texto: str) -> str:
    return "'" + texto.replace("'", "'\\''") + "'"


def entorno_base() -> dict:
    entorno = dict(os.environ)
    entorno.update(
        GIT_PAGER="cat",
        PAGER="cat",
        TERM="dumb",
        GIT_TERMINAL_PROMPT="0",
        # Git Bash como shell de inicio de sesión se va a la carpeta del
        # usuario; con esto se queda donde se le pide.
        CHERE_INVOKING="1",
        PYTHONIOENCODING="utf-8",
    )
    return entorno


# Git abre siempre `editor.sh`, que decide en el momento: abre el editor
# configurado si es uno de ventana, o termina de inmediato con un mensaje.
REVISAR_EDITOR = 'export GIT_EDITOR="$TALLER_EDITOR"\n'


class Trabajo:
    """Todo lo que una orden abre, para poder detenerlo junto (3.7).

    En Windows, `taskkill /T` no alcanza a los procesos que abre Git Bash: no
    quedan en el árbol que ve Windows, y una orden detenida seguía hasta
    terminar sola. Un objeto de trabajo de Windows sí los contiene, porque los
    hijos lo heredan. En Mac y Linux basta con el grupo de procesos.
    """

    def __init__(self, proceso: subprocess.Popen) -> None:
        self.proceso = proceso
        self.manija = None
        if WINDOWS:
            try:
                import ctypes

                self.kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
                self.kernel32.CreateJobObjectW.restype = ctypes.c_void_p
                manija = self.kernel32.CreateJobObjectW(None, None)
                proceso_manija = ctypes.c_void_p(int(proceso._handle))  # type: ignore[attr-defined]
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


class Consola:
    """La terminal del alumno: una carpeta actual y una orden a la vez."""

    def __init__(self, inicio: Path) -> None:
        self.carpeta = inicio
        self.bloqueo = threading.Lock()
        self.historial: list[dict] = []
        self.bash = buscar_bash()

    @property
    def ocupada(self) -> bool:
        return self.bloqueo.locked()

    def ejecutar(self, orden: str, indicador: dict | None = None) -> dict:
        if not self.bloqueo.acquire(blocking=False):
            return {"ocupada": True}
        try:
            resultado = self._ejecutar(orden)
            # Lo que la página mostraba al escribirla, para dibujarla igual al volver a entrar (2.8).
            self.historial.append({"orden": orden, "indicador": indicador, **resultado})
            del self.historial[:-HISTORIAL]
            return resultado
        finally:
            self.bloqueo.release()

    def _ejecutar(self, orden: str) -> dict:
        antes = str(self.carpeta)
        if any(patron.search(orden) for patron in INTERACTIVAS):
            return {
                "salida": "",
                "error": "Esta orden espera respuestas por teclado, y la consola de la página no puede darlas.\n"
                "Hazla en Git Bash, en la misma carpeta.",
                "codigo": 1,
                "carpeta": antes,
                "carpetaAntes": antes,
            }
        if not self.carpeta.is_dir():
            # La carpeta se borró por fuera: se vuelve a la de trabajo.
            self.carpeta = TRABAJO
        script = (
            REVISAR_EDITOR
            + orden
            + f"\n__taller_codigo=$?\nprintf '\\n{MARCA}%s\\n' \"$(pwd -W 2>/dev/null || pwd)\"\nexit $__taller_codigo\n"
        )
        entorno = entorno_base()
        entorno["TALLER_EDITOR"] = comillas(ruta_de_bash(EDITOR))
        argumentos = [self.bash, "--login", "-c", script] if WINDOWS else [*ARQUITECTURA, self.bash, "-c", script]
        opciones: dict = {}
        if WINDOWS:
            opciones["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
        else:
            opciones["start_new_session"] = True
        proceso = subprocess.Popen(
            argumentos,
            cwd=str(self.carpeta),
            env=entorno,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            **opciones,
        )
        trabajo = Trabajo(proceso)
        try:
            salida_b, error_b = proceso.communicate(timeout=LIMITE)
        except subprocess.TimeoutExpired:
            trabajo.detener()
            try:
                proceso.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                # Algo quedó con la salida abierta: no se espera más por él.
                for tubo in (proceso.stdout, proceso.stderr):
                    if tubo is not None:
                        tubo.close()
            trabajo.cerrar()
            minutos = LIMITE // 60
            return {
                "salida": "",
                "error": f"La orden no terminó en {minutos if minutos else LIMITE} {'minutos' if minutos else 'segundos'} y se detuvo. "
                "Si abrió un editor, escribe el mensaje, guarda y cierra la pestaña antes de ese plazo.",
                "codigo": 124,
                "carpeta": antes,
                "carpetaAntes": antes,
                "detenida": True,
            }
        trabajo.cerrar()
        salida = salida_b.decode("utf-8", errors="replace")
        error = error_b.decode("utf-8", errors="replace")
        if MARCA in salida:
            salida, _, resto = salida.rpartition(MARCA)
            nueva = resto.strip().splitlines()[0] if resto.strip() else ""
            if nueva:
                self.carpeta = Path(ruta_de_windows(nueva))
            if salida.endswith("\n"):
                salida = salida[:-1]
        return {
            "salida": salida,
            "error": error,
            "codigo": proceso.returncode,
            "carpeta": str(self.carpeta),
            "carpetaAntes": antes,
        }


# ---------------------------------------------------------------------------
# El estado, preguntado a Git


def git(carpeta: Path, *argumentos: str, entrada: str | None = None) -> tuple[int, str]:
    entorno = entorno_base()
    # Mirar no tiene que cambiar lo que se mira: sin esto `git status` reescribe el índice.
    entorno["GIT_OPTIONAL_LOCKS"] = "0"
    opciones: dict = {"creationflags": subprocess.CREATE_NO_WINDOW} if WINDOWS else {}
    try:
        resultado = subprocess.run(
            [*ARQUITECTURA, "git", "-c", "core.quotepath=false", *argumentos],
            cwd=str(carpeta),
            env=entorno,
            input=entrada.encode("utf-8") if entrada is not None else None,
            stdin=None if entrada is not None else subprocess.DEVNULL,
            capture_output=True,
            timeout=30,
            **opciones,
        )
    except (OSError, subprocess.TimeoutExpired):
        return 1, ""
    return resultado.returncode, resultado.stdout.decode("utf-8", errors="replace")


def buscar_git_dir(carpeta: Path) -> Path | None:
    """La carpeta .git del repositorio que contiene a `carpeta`, sin llamar a git."""
    for actual in (carpeta, *carpeta.parents):
        punto = actual / ".git"
        if punto.is_dir():
            return punto
        if punto.is_file():
            texto = punto.read_text(encoding="utf-8", errors="replace").strip()
            if texto.startswith("gitdir:"):
                destino = Path(texto[7:].strip())
                return destino if destino.is_absolute() else (actual / destino).resolve()
    return None


def huella(carpeta: Path) -> str:
    """Tamaño y fecha de lo que cambia con cada orden: se relee solo si cambió (4.3)."""
    partes = [str(carpeta)]
    git_dir = buscar_git_dir(carpeta)
    raiz = git_dir.parent if git_dir is not None and git_dir.name == ".git" else carpeta
    contados = 0

    def anotar(ruta: Path) -> None:
        try:
            datos = ruta.stat()
            partes.append(f"{ruta}:{datos.st_size}:{datos.st_mtime_ns}")
        except OSError:
            partes.append(f"{ruta}:-")

    if git_dir is not None:
        for nombre in ("HEAD", "index", "packed-refs", "MERGE_HEAD", "REVERT_HEAD", "CHERRY_PICK_HEAD", "ORIG_HEAD", "config"):
            anotar(git_dir / nombre)
        anotar(git_dir / "logs" / "HEAD")
        for sub in ("refs", "rebase-merge", "rebase-apply"):
            base = git_dir / sub
            if base.is_dir():
                for actual, carpetas, archivos in os.walk(base):
                    carpetas.sort()
                    for nombre in sorted(archivos):
                        anotar(Path(actual) / nombre)
    for actual, carpetas, archivos in os.walk(raiz):
        carpetas[:] = sorted(c for c in carpetas if c != ".git")
        partes.append(f"{actual}/")
        for nombre in sorted(archivos):
            anotar(Path(actual) / nombre)
            contados += 1
        if contados > 20000:
            break
    return hashlib.sha1("\n".join(partes).encode("utf-8", errors="replace")).hexdigest()


def indicador(carpeta: Path) -> str:
    """La carpeta como la escribe Git Bash: relativa a la carpeta del usuario, con ~."""
    try:
        casa = Path(os.environ.get("HOME") or Path.home()).resolve()
        relativa = carpeta.resolve().relative_to(casa)
        return "~" if str(relativa) == "." else "~/" + relativa.as_posix()
    except (ValueError, OSError):
        return ruta_de_bash(carpeta)


def estado(carpeta: Path) -> dict:
    """Todo lo que la página dibuja, sacado del mismo Git que usa la consola."""
    base = {"carpeta": str(carpeta), "indicador": indicador(carpeta)}
    codigo, raiz = git(carpeta, "rev-parse", "--show-toplevel")
    if codigo != 0 or not raiz.strip():
        try:
            archivos = sorted(
                (p.name + ("/" if p.is_dir() else "")) for p in carpeta.iterdir() if p.name != ".taller-sesion.json"
            )
        except OSError:
            archivos = []
        dentro = buscar_git_dir(carpeta) is not None
        return {**base, "repositorio": False, "dentroDeGit": dentro, "archivos": archivos}
    raiz_p = Path(raiz.strip())
    _, rama = git(raiz_p, "symbolic-ref", "--short", "-q", "HEAD")
    _, cabeza = git(raiz_p, "rev-parse", "-q", "--verify", "HEAD")
    cabeza = cabeza.strip()

    # El registro de HEAD, para dibujar las confirmaciones que ya no alcanza nada.
    _, registro = git(raiz_p, "log", "-g", "--format=%H%x1f%gs", "HEAD") if cabeza else (0, "")
    movimientos = []
    for linea in registro.splitlines():
        if "\x1f" in linea:
            sha, descripcion = linea.split("\x1f", 1)
            movimientos.append({"id": sha, "descripcion": descripcion})

    confirmaciones = []
    if cabeza or rama.strip():
        puntas = "\n".join({m["id"] for m in movimientos}) + "\n"
        _, texto = git(
            raiz_p,
            "log",
            "--topo-order",
            "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1e",
            "--branches",
            "--tags",
            "--remotes",
            *(["HEAD"] if cabeza else []),
            "--stdin",
            "-n",
            "400",
            entrada=puntas,
        )
        for bloque in texto.split("\x1e"):
            bloque = bloque.strip("\n")
            if not bloque:
                continue
            sha, padres, autor, correo, epoca, asunto = bloque.split("\x1f")
            confirmaciones.append(
                {
                    "id": sha,
                    "padres": padres.split(),
                    "autor": autor,
                    "correo": correo,
                    "epoca": int(epoca or 0),
                    "mensaje": asunto,
                }
            )

    referencias = []
    _, refs = git(
        raiz_p,
        "for-each-ref",
        "--format=%(refname)%09%(objectname)%09%(*objectname)%09%(objecttype)%09%(symref)%09%(contents:subject)",
        "refs/heads",
        "refs/tags",
        "refs/remotes",
    )
    for linea in refs.splitlines():
        campos = linea.split("\t")
        if len(campos) < 6 or campos[4]:
            continue
        nombre, objeto, pelado, tipo, _, asunto = campos[:6]
        referencias.append(
            {
                "nombre": nombre,
                "id": pelado or objeto,
                "anotada": tipo == "tag",
                "mensaje": asunto if tipo == "tag" else None,
            }
        )

    cambios = []
    _, porcelana = git(raiz_p, "status", "--porcelain=v1", "-z", "--untracked-files=normal")
    trozos = porcelana.split("\0")
    k = 0
    while k < len(trozos):
        entrada = trozos[k]
        k += 1
        if len(entrada) < 4:
            continue
        x, y, ruta = entrada[0], entrada[1], entrada[3:]
        cambio = {"x": x, "y": y, "ruta": ruta}
        if x in "RC" and k < len(trozos):
            cambio["origen"] = trozos[k]
            k += 1
        cambios.append(cambio)

    guardados = []
    _, lista = git(raiz_p, "stash", "list", "--format=%H%x1f%P%x1f%gs")
    for linea in lista.splitlines():
        campos = linea.split("\x1f")
        if len(campos) < 3:
            continue
        sha, padres, mensaje = campos
        padres_l = padres.split()
        _, nombres = git(raiz_p, "diff", "--name-only", f"{sha}^1", sha) if padres_l else (0, "")
        guardados.append(
            {"id": sha, "base": padres_l[0] if padres_l else "", "mensaje": mensaje, "archivos": nombres.split()}
        )

    git_dir = buscar_git_dir(raiz_p)
    operacion = None
    if git_dir is not None:
        if (git_dir / "MERGE_HEAD").exists():
            operacion = "fusion"
        elif (git_dir / "REVERT_HEAD").exists():
            operacion = "reversion"
        elif (git_dir / "CHERRY_PICK_HEAD").exists():
            operacion = "seleccion"
        elif (git_dir / "rebase-merge").exists() or (git_dir / "rebase-apply").exists():
            operacion = "reorganizacion"

    return {
        **base,
        "repositorio": True,
        "raiz": str(raiz_p),
        "rama": rama.strip() or None,
        "cabeza": cabeza or None,
        "confirmaciones": confirmaciones,
        "referencias": referencias,
        "movimientos": movimientos,
        "cambios": cambios,
        "guardados": guardados,
        "operacion": operacion,
    }


# ---------------------------------------------------------------------------
# El servidor


class Servidor(ThreadingHTTPServer):
    daemon_threads = True
    consola: Consola
    clave: str


class Manejador(BaseHTTPRequestHandler):
    server: Servidor

    def log_message(self, *_: object) -> None:
        pass

    @property
    def propio(self) -> str:
        return f"127.0.0.1:{self.server.server_port}"

    def _permitido(self, clave: str) -> bool:
        if not secrets.compare_digest(clave, self.server.clave):
            return False
        # Contra el cambio de nombre de un dominio de internet a 127.0.0.1.
        if self.headers.get("Host", "") not in (self.propio, f"localhost:{self.server.server_port}"):
            return False
        origen = self.headers.get("Origin")
        return origen is None or origen == f"http://{self.propio}"

    def _responder(self, codigo: int, cuerpo: bytes, tipo: str = "application/json; charset=utf-8") -> None:
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, datos: dict, codigo: int = 200) -> None:
        self._responder(codigo, json.dumps(datos, ensure_ascii=False).encode("utf-8"))

    def _prohibido(self) -> None:
        self._responder(403, b"sin permiso", "text/plain; charset=utf-8")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._prohibido()

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        consulta = parse_qs(url.query)
        if url.path == "/":
            if not self._permitido(consulta.get("clave", [""])[0]):
                self._prohibido()
                return
            self._responder(200, PAGINA.read_bytes(), "text/html; charset=utf-8")
            return
        if not self._permitido(self.headers.get("X-Taller-Clave", "")):
            self._prohibido()
            return
        consola = self.server.consola
        if url.path == "/api/estado":
            actual = huella(consola.carpeta)
            if consulta.get("huella", [""])[0] == actual:
                self._json({"huella": actual, "igual": True, "ocupada": consola.ocupada})
                return
            self._json({"huella": actual, "ocupada": consola.ocupada, **estado(consola.carpeta)})
        elif url.path == "/api/sesion":
            self._json({"carpeta": str(consola.carpeta), "ocupada": consola.ocupada, "historial": consola.historial})
        else:
            self._responder(404, b"{}")

    def do_POST(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        if url.path != "/api/orden" or not self._permitido(self.headers.get("X-Taller-Clave", "")):
            self._prohibido()
            return
        try:
            largo = int(self.headers.get("Content-Length", "0"))
            cuerpo = json.loads(self.rfile.read(largo) or b"{}")
            orden = cuerpo.get("orden", "")
            indicador = cuerpo.get("indicador")
        except (ValueError, AttributeError):
            self._json({"error": "petición mal formada"}, 400)
            return
        if not isinstance(orden, str) or not orden.strip():
            self._json({"salida": "", "error": "", "codigo": 0, "carpeta": str(self.server.consola.carpeta)})
            return
        resultado = self.server.consola.ejecutar(orden, indicador if isinstance(indicador, dict) else None)
        self._json(resultado, 409 if resultado.get("ocupada") else 200)


# ---------------------------------------------------------------------------
# El arranque


def sesion_anterior() -> str | None:
    """Si el taller ya está abierto, su dirección: un segundo doble clic vuelve a él (2.8)."""
    try:
        datos = json.loads(SESION.read_text(encoding="utf-8"))
        peticion = urllib.request.Request(
            f"http://127.0.0.1:{int(datos['puerto'])}/api/sesion", headers={"X-Taller-Clave": datos["clave"]}
        )
        with urllib.request.urlopen(peticion, timeout=2) as respuesta:
            if respuesta.status == 200:
                return f"http://127.0.0.1:{int(datos['puerto'])}/?clave={datos['clave']}"
    except (OSError, ValueError, KeyError):
        return None
    return None


def abrir_navegador(direccion: str) -> None:
    if os.environ.get("TALLER_SIN_NAVEGADOR") == "1":
        return
    try:
        webbrowser.open(direccion)
    except webbrowser.Error:
        pass


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    TRABAJO.mkdir(parents=True, exist_ok=True)
    anterior = sesion_anterior()
    if anterior is not None:
        print("El taller ya estaba abierto: se abre de nuevo la página.", flush=True)
        print(f"Dirección: {anterior}", flush=True)
        abrir_navegador(anterior)
        return
    servidor = Servidor(("127.0.0.1", 0), Manejador)
    servidor.clave = secrets.token_urlsafe(24)
    servidor.consola = Consola(TRABAJO)
    direccion = f"http://127.0.0.1:{servidor.server_port}/?clave={servidor.clave}"
    SESION.write_text(
        json.dumps({"puerto": servidor.server_port, "clave": servidor.clave, "pid": os.getpid()}), encoding="utf-8"
    )
    print("El taller de Git está listo. No cierres esta ventana mientras trabajas.", flush=True)
    print(f"Si cierras la pestaña, vuelve a entrar en {direccion}", flush=True)
    abrir_navegador(direccion)
    try:
        servidor.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            if json.loads(SESION.read_text(encoding="utf-8")).get("pid") == os.getpid():
                SESION.unlink()
        except (OSError, ValueError):
            pass


if __name__ == "__main__":
    main()

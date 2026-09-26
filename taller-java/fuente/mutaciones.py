#!/usr/bin/env python3
"""
Ver fallar las pruebas de unidad (seccion 7 del SPEC 026).

Cada mutacion mete a proposito un defecto en el codigo, corre la prueba que
deberia atraparlo y deja el codigo como estaba. Una mutacion que la prueba no
atrapa es una prueba que no comprueba lo que dice.

Uso, desde taller-java/fuente:  python3 mutaciones.py
"""
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent
FUENTE = RAIZ / "src/main/java/taller"

MUTACIONES = [
    ("Servidor.java", 'if (!propio.equals(host)) return false;', '', "ServidorTest",
     "se acepta cualquier Host"),
    ("Servidor.java", 'if (origen != null && !origen.equals("http://" + propio)) return false;', '', "ServidorTest",
     "se acepta cualquier Origin"),
    ("Servidor.java", 'return iguales(recibida, clave);', 'return true;', "ServidorTest",
     "no se pide la clave"),
    ("Servidor.java", 'new InetSocketAddress(local, 0)', 'new InetSocketAddress(0)', "ServidorTest",
     "se escucha en todas las interfaces"),
    ("Procesos.java", 'p.toHandle().descendants().forEach(ProcessHandle::destroyForcibly);', '', "EjecutorTest",
     "el limite de tiempo mata solo a bash y no a sus hijos"),
    ("Procesos.java", 'pb.redirectInput(ProcessBuilder.Redirect.from(nulo()));\n        LANZADOS', 'LANZADOS', "EjecutorTest",
     "la entrada queda abierta"),
    ("Procesos.java", 'return bytes.toString(StandardCharsets.UTF_8);', 'return bytes.toString(StandardCharsets.ISO_8859_1);',
     "EjecutorTest", "la salida no se lee en UTF-8"),
    ("Ejecutor.java", '            if ! __taller_dentro; then', '            if false; then', "EjecutorTest",
     "cd sale del limite"),
    ("Ejecutor.java", '} else if (Rutas.dentroDe(limite, candidata, sistema)) {', '} else if (true) {', "EjecutorTest",
     "la carpeta final no se compara con el limite"),
    ("Ejecutor.java", '"(?i)(editor|terminal is dumb|la terminal es tonta)"', '"(?i)(editorzzz)"', "EjecutorTest",
     "no se explica el problema del editor"),
    ("Huella.java", 'recorrer(crc, raiz, raiz, ignoradasDePrimerNivel(raiz));', '', "HuellaTest",
     "la huella no mira el directorio de trabajo"),
    ("Huella.java", 'if (t.isEmpty() || t.contains("/")', 'if (true || t.contains("/")', "HuellaTest",
     "la huella no salta lo que .gitignore excluye"),
    ("LectorEstado.java", 'conf.put("huerfana", !vivas.contains((String) conf.get("id")));', 'conf.put("huerfana", false);',
     "LectorEstadoTest", "nunca hay huerfanas"),
    ("LectorEstado.java", 'String id = anotada ? pelado : objeto;', 'String id = objeto;', "LectorEstadoTest",
     "la etiqueta anotada apunta al objeto etiqueta"),
    ("LectorEstado.java", 'g() { "$TALLER_GIT" --no-optional-locks', 'g() { "$TALLER_GIT"', "LectorEstadoTest",
     "leer reescribe el indice (1 de 2)"),
    ("Porcelana.java", 'if (x != \'.\') preparado.add', 'if (y != \'.\') preparado.add', "PorcelanaTest",
     "las columnas X e Y se confunden"),
    ("Taller.java", 'if (huella != ultimaHuella) pendiente = true;', 'pendiente = true;', "TallerTest",
     "en reposo se le pregunta a Git igual"),
    ("Taller.java", 'if (pendiente && System.currentTimeMillis() - ultimaLectura >= 1000) leer();', 'if (false) leer();',
     "TallerTest", "un cambio de afuera no se ve"),
    ("BuscadorGit.java", 'String instalacion = entorno.registro(rama);', 'String instalacion = null;', "BuscadorGitTest",
     "no se mira el registro"),
    ("BuscadorGit.java", 'if (entorno.herramientasDeApple()) candidatas.add', 'candidatas.add', "BuscadorGitTest",
     "se usa el git de Apple sin sus herramientas"),
    ("Rutas.java", 'return m.group(1).toUpperCase(Locale.ROOT) + ":" + resto;', 'return ruta;', "RutasTest",
     "no se convierte /c/ a C:/"),
    ("Rutas.java", 'return b.equals(a) || b.startsWith(a + "/");', 'return b.startsWith(a);', "RutasTest",
     "una carpeta hermana con el mismo prefijo cuenta como dentro"),
]

# La segunda mitad de la mutacion del indice: las dos defensas juntas.
SEGUNDA = ("LectorEstado.java", 'entorno.put("GIT_OPTIONAL_LOCKS", "0");', '')


def mvn(prueba: str) -> bool:
    r = subprocess.run(["./mvnw", "-q", "-B", "test", f"-Dtest={prueba}", "-Dsurefire.failIfNoSpecifiedTests=false"],
                       cwd=RAIZ, capture_output=True, text=True)
    return r.returncode == 0


def main() -> int:
    atrapadas = 0
    escapadas = []
    for archivo, original, mutado, prueba, que in MUTACIONES:
        ruta = FUENTE / archivo
        texto = ruta.read_text(encoding="utf-8")
        if original not in texto:
            print(f"  ?  {que}: el texto a mutar ya no esta en {archivo}")
            escapadas.append(que)
            continue
        extra = None
        try:
            ruta.write_text(texto.replace(original, mutado, 1), encoding="utf-8")
            if "indice (1 de 2)" in que:
                extra = FUENTE / SEGUNDA[0]
                t2 = extra.read_text(encoding="utf-8")
                extra.write_text(t2.replace(SEGUNDA[1], SEGUNDA[2], 1), encoding="utf-8")
            paso = mvn(prueba)
        finally:
            ruta.write_text(texto, encoding="utf-8")
        if paso:
            print(f"  ✗  {prueba} no atrapo: {que}")
            escapadas.append(que)
        else:
            print(f"  ✓  {prueba} atrapo: {que}")
            atrapadas += 1
    print(f"\n  {atrapadas} de {len(MUTACIONES)} mutaciones atrapadas")
    return 0 if not escapadas else 1


if __name__ == "__main__":
    sys.exit(main())

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
    # Sacar el exec 0</dev/null del envoltorio no deja la entrada abierta:
    # Java cierra el tubo apenas escribe el envoltorio, y la orden igual
    # encuentra el fin. El defecto de verdad es que Java no lo cierre.
    ("Procesos.java",
     'try (var in = p.getOutputStream()) {\n                in.write(entrada.getBytes(java.nio.charset.StandardCharsets.UTF_8));',
     'try { var in = p.getOutputStream();\n                in.write(entrada.getBytes(java.nio.charset.StandardCharsets.UTF_8)); in.flush();',
     "EjecutorTest", "la entrada de la orden queda abierta",
     [("Ejecutor.java", '"exec 0</dev/null",', '')]),
    ("Procesos.java", 'return bytes.toString(StandardCharsets.UTF_8);', 'return bytes.toString(StandardCharsets.ISO_8859_1);',
     "EjecutorTest", "la salida no se lee en UTF-8"),
    ("Ejecutor.java", 'if ! __taller_dentro; then', 'if false; then', "EjecutorTest",
     "cd sale del limite"),
    ("Ejecutor.java", '} else if (Rutas.dentroDe(limite, candidata, sistema)) {', '} else if (true) {', "EjecutorTest",
     "la carpeta final no se compara con el limite"),
    ("Ejecutor.java", '"(?i)(editor|terminal is dumb|la terminal es tonta)"', '"(?i)(editorzzz)"', "EjecutorTest",
     "no se explica el problema del editor"),
    ("Ejecutor.java", 'return FIRMA.matcher(error).replaceAll("bash: line $1:");', 'return error;', "EjecutorTest",
     "los errores nombran la ruta de bash"),
    ("Huella.java", 'recorrer(crc, raiz, raiz, ignoradasDePrimerNivel(raiz));', '', "HuellaTest",
     "la huella no mira el directorio de trabajo"),
    ("Huella.java", 'if (t.isEmpty() || t.contains("/")', 'if (true || t.contains("/")', "HuellaTest",
     "la huella no salta lo que .gitignore excluye"),
    ("LectorEstado.java", 'conf.put("huerfana", !vivas.contains((String) conf.get("id")));', 'conf.put("huerfana", false);',
     "LectorEstadoTest", "nunca hay huerfanas"),
    ("LectorEstado.java", 'String id = anotada ? pelado : objeto;', 'String id = objeto;', "LectorEstadoTest",
     "la etiqueta anotada apunta al objeto etiqueta"),
    ("LectorEstado.java", 'orden.add("--no-optional-locks");', '', "LectorEstadoTest",
     "leer reescribe el indice",
     [("LectorEstado.java", 'entorno.put("GIT_OPTIONAL_LOCKS", "0");', '')]),
    ("Porcelana.java", 'if (x != \'.\') preparado.add', 'if (y != \'.\') preparado.add', "PorcelanaTest",
     "las columnas X e Y se confunden"),
    ("Taller.java", 'if (huella != ultimaHuella) pendiente = true;', 'pendiente = true;', "TallerTest",
     "en reposo se le pregunta a Git igual"),
    ("Taller.java", 'if (pendiente && ahora - ultimaPorHuella >= 1000) {', 'if (false) {',
     "TallerTest", "un cambio de afuera no se ve"),
    ("Taller.java", 'while (version == desde && (leyendo || pendiente)) {', 'while (version == desde && false) {', "TallerTest",
     "la pagina no espera la lectura en curso"),
    ("OrdenesPropias.java", 'if (Files.exists(recetario) && !forzar) {', 'if (false && Files.exists(recetario)) {',
     "OrdenesPropiasTest", "preparar borra un laboratorio hecho sin pedir --forzar"),
    ("OrdenesPropias.java", 'forzar ? script + " --forzar" : script', 'script + " --forzar"', "OrdenesPropiasTest",
     "la consola pasa --forzar por su cuenta"),
    ("Taller.java", 'if (r.codigo() == 0 && plan.destino() != null', 'if (false && plan.destino() != null', "OrdenesPropiasTest",
     "preparar no deja la consola en el laboratorio"),
    ("OrdenesPropias.java", 'nn = numero.length() == 1 ? "0" + numero : numero;', 'nn = numero;', "OrdenesPropiasTest",
     "preparar 2 no se entiende como el 02"),
    ("OrdenesPropias.java", 'return Optional.of(new Plan(script, clon, null, List.of()));',
     'return Optional.of(new Plan(script, clon, trabajo, List.of()));', "OrdenesPropiasTest", "verificar mueve la consola"),
    ("OrdenesPropias.java", 'return m.matches() ? m.group(1) : null;', 'return null;', "OrdenesPropiasTest",
     "sin numero no se usa el laboratorio de la consola"),
    ("LectorEstado.java", 's.put("arbol", hayConfirmaciones', 's.put("arbol", false', "LectorEstadoTest",
     "el estado no trae el arbol de HEAD"),
    ("BuscadorGit.java", 'String instalacion = entorno.registro(rama);', 'String instalacion = null;', "BuscadorGitTest",
     "no se mira el registro"),
    ("BuscadorGit.java", 'if (entorno.herramientasDeApple()) candidatas.add', 'candidatas.add', "BuscadorGitTest",
     "se usa el git de Apple sin sus herramientas"),
    ("Rutas.java", 'return m.group(1).toUpperCase(Locale.ROOT) + ":" + resto;', 'return ruta;', "RutasTest",
     "no se convierte /c/ a C:/"),
    ("Rutas.java", 'return b.equals(a) || b.startsWith(a + "/");', 'return b.startsWith(a);', "RutasTest",
     "una carpeta hermana con el mismo prefijo cuenta como dentro"),
]

class NoCompila(Exception):
    pass


def mvn(prueba: str) -> bool:
    r = subprocess.run(["./mvnw", "-q", "-B", "test", f"-Dtest={prueba}", "-Dsurefire.failIfNoSpecifiedTests=false"],
                       cwd=RAIZ, capture_output=True, text=True)
    # Una mutacion que no compila no prueba nada: la prueba ni siquiera corrio.
    if "COMPILATION ERROR" in r.stdout + r.stderr:
        raise NoCompila()
    return r.returncode == 0


def main() -> int:
    atrapadas = 0
    escapadas = []
    for mutacion in MUTACIONES:
        archivo, original, mutado, prueba, que = mutacion[:5]
        # Algunas mutaciones tocan mas de un lugar: dos defensas que se cubren
        # una a la otra solo se ven fallar si caen las dos.
        cambios = [(archivo, original, mutado), *(mutacion[5] if len(mutacion) > 5 else [])]
        originales = {}
        faltante = None
        for nombre, antes, _ in cambios:
            ruta = FUENTE / nombre
            originales.setdefault(ruta, ruta.read_text(encoding="utf-8"))
            if antes not in originales[ruta]:
                faltante = nombre
        if faltante is not None:
            print(f"  ?  {que}: el texto a mutar ya no esta en {faltante}")
            escapadas.append(que)
            continue
        try:
            for nombre, antes, despues in cambios:
                ruta = FUENTE / nombre
                ruta.write_text(ruta.read_text(encoding="utf-8").replace(antes, despues, 1), encoding="utf-8")
            try:
                paso = mvn(prueba)
            except NoCompila:
                print(f"  ?  {que}: la mutacion no compila, no prueba nada")
                escapadas.append(que)
                continue
        finally:
            for ruta, texto in originales.items():
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

package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Ejecuta en bash lo que el participante escribe en la consola (punto 3.4).
 *
 * Cada orden corre en un bash nuevo, parado en la carpeta de la sesion y con la
 * entrada cerrada. El envoltorio que la rodea deja escrita la carpeta en que
 * termino bash, y con eso la carpeta persiste de una orden a la otra como en
 * una terminal.
 */
public final class Ejecutor {

    /** Lo que dejo una orden. {@code avisos} son lineas del programa, no de Git. */
    public record Resultado(
            int codigo, String salida, String error, Path carpeta, boolean agotado, List<String> avisos) {}

    private static final Pattern EDITOR = Pattern.compile(
            "(?i)(editor|terminal is dumb|la terminal es tonta)");

    /** Ordenes que leen del teclado y aqui encuentran la entrada cerrada. */
    private static final Pattern INTERACTIVA = Pattern.compile(
            "\\bgit\\b[^;&|]*\\b(add|checkout|restore|reset|stash|commit|clean)\\b[^;&|]*"
                    + "\\s(-p|--patch|-i|--interactive)(\\s|$)");
    private static final Pattern REBASE_INTERACTIVO = Pattern.compile(
            "\\bgit\\b[^;&|]*\\brebase\\b[^;&|]*\\s(-i|--interactive)(\\s|$)");

    private final Sistema sistema;
    private final BuscadorGit.Instalacion git;
    private final Path limite;
    private final Path archivoCarpeta;
    private final long tiempoMaximo;

    public Ejecutor(Sistema sistema, BuscadorGit.Instalacion git, Path limite, Path carpetaPropia, long tiempoMaximo)
            throws IOException {
        this.sistema = sistema;
        this.git = git;
        this.limite = limite;
        this.tiempoMaximo = tiempoMaximo;
        Files.createDirectories(carpetaPropia);
        this.archivoCarpeta = carpetaPropia.resolve("carpeta-final");
    }

    public long tiempoMaximo() {
        return tiempoMaximo;
    }

    /** Variables que se agregan a cada orden. Solo las pruebas lo usan, para aislar la configuracion global. */
    private Map<String, String> extra = Map.of();

    Ejecutor conEntornoExtra(Map<String, String> variables) {
        this.extra = new HashMap<>(variables);
        return this;
    }

    /** Ejecuta {@code orden} parado en {@code carpeta}. Nunca lanza: los problemas vuelven como avisos. */
    public Resultado ejecutar(String orden, Path carpeta) {
        List<String> avisos = new ArrayList<>();
        try {
            Files.deleteIfExists(archivoCarpeta);
        } catch (IOException ignorada) {
            // Si no se pudo borrar, se sobrescribe igual al terminar.
        }
        Procesos.Salida s;
        try {
            s = Procesos.correr(linea(), carpeta.toFile(), entorno(orden, carpeta), tiempoMaximo, ENVOLTORIO);
        } catch (IOException e) {
            avisos.add("No se pudo lanzar bash, " + e.getMessage());
            return new Resultado(-1, "", "", carpeta, false, avisos);
        }

        Path nueva = Rutas.real(carpeta);
        String escrita = leerCarpetaFinal();
        if (escrita != null && !escrita.isBlank()) {
            Path candidata = Path.of(sistema == Sistema.WINDOWS ? Rutas.aWindows(escrita.trim()) : escrita.trim());
            if (!Files.isDirectory(candidata)) {
                // La carpeta se borro con la orden misma, como en rm -rf . desde dentro.
            } else if (Rutas.dentroDe(limite, candidata, sistema)) {
                nueva = Rutas.real(candidata);
            } else {
                avisos.add("La consola no sale de " + Rutas.conBarras(limite)
                        + ". La orden corrió, pero la consola se queda donde estaba.");
            }
        }

        if (s.agotado()) {
            avisos.add("La orden pasó el límite de " + describirTiempo(tiempoMaximo)
                    + " y se detuvo, junto con todo lo que había lanzado.");
        }
        if (s.codigo() != 0 && !s.agotado() && EDITOR.matcher(s.error()).find()) {
            avisos.add(ayudaEditor(sistema));
        }
        if (INTERACTIVA.matcher(orden).find()
                || (s.codigo() != 0 && REBASE_INTERACTIVO.matcher(orden).find())) {
            avisos.add("Esta orden pide respuestas por teclado y la consola del taller no se las puede dar. Hazla en Git Bash.");
        }
        return new Resultado(s.codigo(), s.salida(), firmaDeBash(s.error()), nueva, s.agotado(), avisos);
    }

    static String ayudaEditor(Sistema sistema) {
        if (sistema == Sistema.MAC) {
            return "Git no pudo abrir el editor. Si configuraste code --wait, abre Visual Studio Code, "
                    + "busca con Cmd+Shift+P la orden Shell Command, Install 'code' command in PATH, "
                    + "y vuelve a abrir el taller. Mientras tanto, git commit -m \"mensaje\" no necesita editor.";
        }
        return "Git no pudo abrir el editor. Si configuraste code --wait, instala Visual Studio Code "
                + "marcando la opción de agregarlo al PATH, cierra el taller y vuelve a abrirlo. "
                + "Mientras tanto, git commit -m \"mensaje\" no necesita editor.";
    }

    static String describirTiempo(long ms) {
        long segundos = ms / 1000;
        if (segundos % 60 == 0) {
            long minutos = segundos / 60;
            return minutos == 1 ? "1 minuto" : minutos + " minutos";
        }
        return segundos == 1 ? "1 segundo" : segundos + " segundos";
    }

    private String leerCarpetaFinal() {
        try {
            if (!Files.isRegularFile(archivoCarpeta)) return null;
            return Files.readString(archivoCarpeta, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    private List<String> linea() {
        List<String> l = new ArrayList<>();
        l.add(git.bash().toString());
        if (git.login()) l.add("--login");
        l.add("-s");
        return l;
    }

    Map<String, String> entorno(String orden, Path carpeta) {
        Map<String, String> e = new HashMap<>(entornoComun(sistema, git));
        e.put("TALLER_ORDEN", orden);
        e.put("TALLER_CARPETA", Rutas.conBarras(carpeta));
        e.put("TALLER_LIMITE", Rutas.conBarras(limite));
        e.put("TALLER_CARPETA_FINAL", Rutas.conBarras(archivoCarpeta));
        e.put("TALLER_SO", sistema == Sistema.WINDOWS ? "windows" : "unix");
        e.putAll(extra);
        return e;
    }

    /**
     * Lo que ninguna orden puede heredar: nada se queda esperando una tecla ni
     * una clave, ningun paginador se abre y el texto viaja en UTF-8.
     */
    static Map<String, String> entornoComun(Sistema sistema, BuscadorGit.Instalacion git) {
        Map<String, String> e = new HashMap<>();
        e.put("GIT_PAGER", "cat");
        e.put("PAGER", "cat");
        e.put("TERM", "dumb");
        e.put("GIT_TERMINAL_PROMPT", "0");
        if (sistema == Sistema.WINDOWS) {
            e.put("CHERE_INVOKING", "1");
            if (sinLocale()) e.put("LANG", "C.UTF-8");
        } else {
            if (sinLocale()) e.put("LC_CTYPE", "UTF-8");
            // El git que se encontro va primero, para que la orden escrita use
            // el mismo que el programa usa para leer el estado.
            Path carpetaGit = git.git().getParent();
            String path = System.getenv("PATH");
            e.put("PATH", carpetaGit + (path == null || path.isEmpty() ? "" : ":" + path));
        }
        return e;
    }

    private static boolean sinLocale() {
        return System.getenv("LANG") == null && System.getenv("LC_ALL") == null && System.getenv("LC_CTYPE") == null;
    }

    /**
     * El envoltorio de cada orden, en una sola linea.
     *
     * Define un {@code cd} que no sale del limite, deja escrita al salir la
     * carpeta en que quedo bash, cierra la entrada y ejecuta la orden tal como
     * se escribio. La orden viaja en una variable de entorno y no en la linea
     * de comandos, para no pelear con las comillas de Windows.
     *
     * Bash lo lee de su entrada estandar, y no de un archivo: asi los errores
     * no nombran un archivo interno del taller sino la linea de la orden, como
     * con {@code bash -c}. Va en una sola linea porque bash lee la linea entera
     * antes de ejecutarla, y en ella se cierra la entrada: la orden ya no
     * encuentra nada que leer, que es lo que se quiere (punto 3.4).
     */
    static final String ENVOLTORIO = String.join("; ",
            "__taller_fin() { __taller_rc=$?; if [ \"$TALLER_SO\" = windows ]; then pwd -W; else pwd -P; fi > \"$TALLER_CARPETA_FINAL\" 2>/dev/null; exit $__taller_rc; }",
            "trap __taller_fin EXIT",
            "__taller_limite=$(builtin cd -- \"$TALLER_LIMITE\" 2>/dev/null && pwd -P)",
            "__taller_dentro() { local __p; __p=$(pwd -P); shopt -s nocasematch; case \"$__p/\" in \"$__taller_limite\"/*) shopt -u nocasematch; return 0 ;; esac; shopt -u nocasematch; return 1; }",
            "cd() { local __antes=\"$PWD\"; builtin cd \"$@\" || return; if ! __taller_dentro; then builtin cd -- \"$__antes\"; printf '%s\\n' \"bash: cd: la consola del taller no sale de $TALLER_LIMITE\" >&2; return 1; fi; }",
            "builtin cd -- \"$TALLER_CARPETA\" || exit 97",
            "exec 0</dev/null",
            "eval \"$TALLER_ORDEN\"") + "\n";

    /**
     * Bash firma sus errores con el nombre con que se lo lanzo, que aqui es su
     * ruta completa. En Git Bash firma {@code bash}, y asi se deja.
     */
    private static final Pattern FIRMA = Pattern.compile("(?m)^.*?bash(?:\\.exe)?: (?:eval: )?line (\\d+):");

    static String firmaDeBash(String error) {
        return FIRMA.matcher(error).replaceAll("bash: line $1:");
    }
}

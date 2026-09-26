package taller;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Encuentra Git y el bash con que se ejecutan las ordenes (punto 3.3).
 *
 * Nunca supone que {@code git} esta en el PATH: quien instalo Git para Windows
 * con la opcion de usarlo solo desde Git Bash no lo tiene ahi.
 */
public final class BuscadorGit {

    /** Lo que el buscador necesita saber del equipo. Se reemplaza en las pruebas. */
    public interface Entorno {
        String variable(String nombre);

        boolean esArchivo(Path ruta);

        /** El valor {@code InstallPath} de Git para Windows bajo esa rama del registro, o null. */
        String registro(String rama);

        /** Si estan las herramientas de linea de comandos de Apple, sin provocar su instalacion. */
        boolean herramientasDeApple();
    }

    /** Git y bash encontrados. {@code login} dice si bash se lanza con {@code --login}. */
    public record Instalacion(Path git, Path bash, boolean login, String origen) {}

    public static final String DESCARGA = "https://git-scm.com/download/win";

    private final Sistema sistema;
    private final Entorno entorno;

    public BuscadorGit(Sistema sistema, Entorno entorno) {
        this.sistema = sistema;
        this.entorno = entorno;
    }

    public Optional<Instalacion> buscar() {
        return switch (sistema) {
            case WINDOWS -> buscarEnWindows();
            case MAC -> buscarEnMac();
            case OTRO -> buscarEnUnix();
        };
    }

    private Optional<Instalacion> buscarEnWindows() {
        List<String[]> candidatas = new ArrayList<>();
        for (String rama : List.of("HKLM\\SOFTWARE\\GitForWindows", "HKCU\\SOFTWARE\\GitForWindows")) {
            String instalacion = entorno.registro(rama);
            if (instalacion != null && !instalacion.isBlank()) candidatas.add(new String[] {instalacion, "registro " + rama});
        }
        candidatas.add(new String[] {"C:\\Program Files\\Git", "C:\\Program Files\\Git"});
        candidatas.add(new String[] {"C:\\Program Files (x86)\\Git", "C:\\Program Files (x86)\\Git"});
        String local = entorno.variable("LOCALAPPDATA");
        if (local != null && !local.isBlank()) candidatas.add(new String[] {unir(local, "Programs", "Git"), "LOCALAPPDATA"});
        String propia = entorno.variable("TALLER_GIT");
        if (propia != null && !propia.isBlank()) candidatas.add(new String[] {raizDeGitParaWindows(propia), "TALLER_GIT"});

        for (String[] c : candidatas) {
            Optional<Instalacion> encontrada = instalacionWindows(c[0], c[1]);
            if (encontrada.isPresent()) return encontrada;
        }
        // Por ultimo el PATH. El git.exe de Git para Windows vive en cmd, en bin
        // o en mingw64\bin, y la raiz de la instalacion esta mas arriba.
        String path = entorno.variable("PATH");
        if (path == null) path = entorno.variable("Path");
        if (path == null) return Optional.empty();
        for (String carpeta : path.split(";")) {
            String c = carpeta.replace("\"", "").trim();
            if (c.isEmpty() || !entorno.esArchivo(Path.of(unir(c, "git.exe")))) continue;
            String raiz = padre(c);
            if (raiz != null && nombre(raiz).equalsIgnoreCase("mingw64")) raiz = padre(raiz);
            if (raiz == null) continue;
            Optional<Instalacion> encontrada = instalacionWindows(raiz, "PATH");
            if (encontrada.isPresent()) return encontrada;
        }
        return Optional.empty();
    }

    /**
     * Las rutas de Windows se arman como texto, con barras invertidas, y no con
     * {@link Path}: asi la busqueda se prueba igual desde cualquier sistema.
     */
    static String unir(String base, String... partes) {
        StringBuilder sb = new StringBuilder(sinBarraFinal(base));
        for (String p : partes) sb.append('\\').append(p);
        return sb.toString();
    }

    static String padre(String ruta) {
        String r = sinBarraFinal(ruta);
        int i = Math.max(r.lastIndexOf('\\'), r.lastIndexOf('/'));
        return i <= 0 ? null : r.substring(0, i);
    }

    static String nombre(String ruta) {
        String r = sinBarraFinal(ruta);
        int i = Math.max(r.lastIndexOf('\\'), r.lastIndexOf('/'));
        return r.substring(i + 1);
    }

    private static String sinBarraFinal(String ruta) {
        String r = ruta;
        while (r.length() > 1 && (r.endsWith("\\") || r.endsWith("/"))) r = r.substring(0, r.length() - 1);
        return r;
    }

    /** {@code TALLER_GIT} puede nombrar la raiz, o el git.exe de adentro. */
    static String raizDeGitParaWindows(String valor) {
        if (nombre(valor).equalsIgnoreCase("git.exe")) {
            String carpeta = padre(valor);
            String raiz = carpeta == null ? null : padre(carpeta);
            if (raiz != null && nombre(raiz).equalsIgnoreCase("mingw64")) raiz = padre(raiz);
            if (raiz != null) return raiz;
        }
        return valor;
    }

    private Optional<Instalacion> instalacionWindows(String raiz, String origen) {
        Path bash = Path.of(unir(raiz, "bin", "bash.exe"));
        if (!entorno.esArchivo(bash)) bash = Path.of(unir(raiz, "usr", "bin", "bash.exe"));
        Path git = Path.of(unir(raiz, "cmd", "git.exe"));
        if (!entorno.esArchivo(git)) git = Path.of(unir(raiz, "bin", "git.exe"));
        if (entorno.esArchivo(bash) && entorno.esArchivo(git)) {
            return Optional.of(new Instalacion(git, bash, true, origen));
        }
        return Optional.empty();
    }

    private Optional<Instalacion> buscarEnMac() {
        Path bash = Path.of("/bin/bash");
        List<Path> candidatas = new ArrayList<>();
        // /usr/bin/git es un envoltorio de Apple: si faltan las herramientas de
        // linea de comandos, lanzarlo abre el dialogo de instalacion. Solo se
        // usa si estan.
        if (entorno.herramientasDeApple()) candidatas.add(Path.of("/usr/bin/git"));
        candidatas.add(Path.of("/opt/homebrew/bin/git"));
        candidatas.add(Path.of("/usr/local/bin/git"));
        for (Path c : candidatas) {
            if (entorno.esArchivo(c)) return Optional.of(new Instalacion(c, bash, false, c.toString()));
        }
        return enElPath("git")
                .filter(p -> !p.toString().equals("/usr/bin/git") || entorno.herramientasDeApple())
                .map(p -> new Instalacion(p, bash, false, "PATH"));
    }

    private Optional<Instalacion> buscarEnUnix() {
        Path bash = Path.of("/bin/bash");
        return enElPath("git").map(p -> new Instalacion(p, bash, false, "PATH"));
    }

    private Optional<Path> enElPath(String nombre) {
        String path = entorno.variable("PATH");
        if (path == null) path = entorno.variable("Path");
        if (path == null) return Optional.empty();
        String separador = sistema == Sistema.WINDOWS ? ";" : File.pathSeparator;
        for (String carpeta : path.split(java.util.regex.Pattern.quote(separador))) {
            if (carpeta.isBlank()) continue;
            Path candidata = Path.of(carpeta.replace("\"", "")).resolve(nombre);
            if (entorno.esArchivo(candidata)) return Optional.of(candidata);
        }
        return Optional.empty();
    }

    /** El entorno verdadero del equipo. */
    public static Entorno delEquipo() {
        return new Entorno() {
            @Override
            public String variable(String nombre) {
                return System.getenv(nombre);
            }

            @Override
            public boolean esArchivo(Path ruta) {
                return Files.isRegularFile(ruta);
            }

            @Override
            public String registro(String rama) {
                return leerRegistro(rama, Procesos::correr);
            }

            @Override
            public boolean herramientasDeApple() {
                try {
                    Procesos.Salida s = Procesos.correr(List.of("/usr/bin/xcode-select", "-p"), null, null, 10_000);
                    if (s.codigo() != 0) return false;
                    String ruta = s.salida().trim();
                    return !ruta.isEmpty() && Files.isRegularFile(Path.of(ruta, "usr", "bin", "git"));
                } catch (IOException e) {
                    return false;
                }
            }
        };
    }

    /** Lo que corre una orden y devuelve lo que dejo. Para que la prueba no dependa de reg.exe. */
    @FunctionalInterface
    interface Corredor {
        Procesos.Salida correr(List<String> orden, File carpeta, java.util.Map<String, String> entorno, long ms)
                throws IOException;
    }

    static String leerRegistro(String rama, Corredor corredor) {
        try {
            Procesos.Salida s = corredor.correr(List.of("reg", "query", rama, "/v", "InstallPath"), null, null, 10_000);
            if (s.codigo() != 0) return null;
            return valorDeRegistro(s.salida());
        } catch (IOException e) {
            return null;
        }
    }

    /** Saca el valor de la salida de {@code reg query}, que va en columnas separadas por espacios. */
    static String valorDeRegistro(String salida) {
        for (String linea : salida.split("\\R")) {
            String t = linea.trim();
            if (!t.startsWith("InstallPath")) continue;
            int tipo = t.indexOf("REG_");
            if (tipo < 0) continue;
            int espacio = t.indexOf(' ', tipo);
            if (espacio < 0) continue;
            String valor = t.substring(espacio).trim();
            return valor.isEmpty() ? null : valor;
        }
        return null;
    }
}

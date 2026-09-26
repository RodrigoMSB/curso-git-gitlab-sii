package taller;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rutas entre las dos formas que conviven en Windows y el limite de la consola.
 *
 * Git Bash escribe {@code /c/Users/...} y Java y Git para Windows entienden
 * {@code C:/Users/...}. La conversion va en los dos sentidos.
 */
public final class Rutas {

    private static final Pattern MSYS = Pattern.compile("^/([a-zA-Z])(/.*)?$");
    private static final Pattern WINDOWS = Pattern.compile("^([a-zA-Z]):[/\\\\]?(.*)$");

    private Rutas() {}

    /** {@code /c/Users/x} a {@code C:/Users/x}. Lo que no tenga esa forma vuelve igual. */
    public static String aWindows(String ruta) {
        Matcher m = MSYS.matcher(ruta);
        if (!m.matches()) return ruta;
        String resto = m.group(2) == null ? "/" : m.group(2);
        return m.group(1).toUpperCase(Locale.ROOT) + ":" + resto;
    }

    /** {@code C:\Users\x} o {@code C:/Users/x} a {@code /c/Users/x}. */
    public static String aMsys(String ruta) {
        Matcher m = WINDOWS.matcher(ruta);
        if (!m.matches()) return ruta.replace('\\', '/');
        String resto = m.group(2).replace('\\', '/');
        String unidad = "/" + m.group(1).toLowerCase(Locale.ROOT);
        return resto.isEmpty() ? unidad : unidad + "/" + resto;
    }

    /** Barras normales, sin barra final, que es como Git imprime las rutas. */
    public static String conBarras(Path ruta) {
        String texto = ruta.toString().replace('\\', '/');
        if (texto.length() > 1 && texto.endsWith("/") && !texto.endsWith(":/")) {
            texto = texto.substring(0, texto.length() - 1);
        }
        return texto;
    }

    /** La ruta real, resolviendo enlaces, o la absoluta normalizada si no existe. */
    public static Path real(Path ruta) {
        try {
            return ruta.toRealPath();
        } catch (IOException e) {
            return ruta.toAbsolutePath().normalize();
        }
    }

    /**
     * Si {@code ruta} queda dentro de {@code limite}, o es el propio limite.
     *
     * Se compara sin distinguir mayusculas en Windows y en Mac, cuyos sistemas
     * de archivos por omision no las distinguen: {@code cd /users/x} deja a la
     * consola en la misma carpeta que {@code cd /Users/x}.
     */
    public static boolean dentroDe(Path limite, Path ruta, Sistema sistema) {
        String a = conBarras(real(limite));
        String b = conBarras(real(ruta));
        if (sistema != Sistema.OTRO) {
            a = a.toLowerCase(Locale.ROOT);
            b = b.toLowerCase(Locale.ROOT);
        }
        if (a.endsWith("/")) return b.startsWith(a);
        return b.equals(a) || b.startsWith(a + "/");
    }

    /** La ruta relativa al limite, con barras normales, o vacia si es el limite. */
    public static String relativa(Path limite, Path ruta) {
        Path r = real(limite).relativize(real(ruta));
        return r.toString().replace('\\', '/');
    }
}

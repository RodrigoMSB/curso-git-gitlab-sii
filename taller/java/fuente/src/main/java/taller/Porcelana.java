package taller;

import java.util.ArrayList;
import java.util.List;

/**
 * Lee {@code git status --porcelain=v2 -z}.
 *
 * Cada entrada termina en un NUL. Los renombrados traen la ruta anterior como
 * una entrada mas, tambien terminada en NUL. En cada entrada ordinaria las dos
 * letras XY dicen que hay en el area de preparacion (X) y que hay en el
 * directorio de trabajo (Y); un punto es sin cambios.
 */
public final class Porcelana {

    /** Un archivo en un area. {@code tipo} es la letra de Git: M, A, D, R, C o T. */
    public record Entrada(String ruta, char tipo, String origen) {}

    public record Areas(
            List<Entrada> preparado, List<Entrada> modificado, List<String> sinSeguimiento, List<String> conflicto) {

        /** Cuantas rutas distintas tienen algo pendiente. Es lo que cuenta la barra. */
        public int cambios() {
            java.util.Set<String> rutas = new java.util.HashSet<>();
            preparado.forEach(e -> rutas.add(e.ruta()));
            modificado.forEach(e -> rutas.add(e.ruta()));
            rutas.addAll(sinSeguimiento);
            rutas.addAll(conflicto);
            return rutas.size();
        }
    }

    private Porcelana() {}

    public static Areas leer(String texto) {
        List<Entrada> preparado = new ArrayList<>();
        List<Entrada> modificado = new ArrayList<>();
        List<String> sinSeguimiento = new ArrayList<>();
        List<String> conflicto = new ArrayList<>();
        String[] partes = texto.split("\0", -1);
        for (int i = 0; i < partes.length; i++) {
            String p = partes[i];
            if (p.isEmpty()) continue;
            char clase = p.charAt(0);
            switch (clase) {
                case '1' -> {
                    // 1 XY sub mH mI mW hH hI ruta
                    String[] c = p.split(" ", 9);
                    if (c.length < 9) continue;
                    agregar(c[1], c[8], null, preparado, modificado);
                }
                case '2' -> {
                    // 2 XY sub mH mI mW hH hI Xpuntaje ruta, y la anterior en la parte siguiente
                    String[] c = p.split(" ", 10);
                    if (c.length < 10) continue;
                    String origen = i + 1 < partes.length ? partes[++i] : null;
                    agregar(c[1], c[9], origen, preparado, modificado);
                }
                case 'u' -> {
                    // u XY sub m1 m2 m3 mW h1 h2 h3 ruta
                    String[] c = p.split(" ", 11);
                    if (c.length < 11) continue;
                    conflicto.add(c[10]);
                }
                case '?' -> sinSeguimiento.add(p.substring(2));
                default -> {
                    // '!' son los ignorados y '#' los encabezados: no son de ninguna area.
                }
            }
        }
        return new Areas(preparado, modificado, sinSeguimiento, conflicto);
    }

    private static void agregar(String xy, String ruta, String origen, List<Entrada> preparado, List<Entrada> modificado) {
        char x = xy.charAt(0);
        char y = xy.length() > 1 ? xy.charAt(1) : '.';
        if (x != '.') preparado.add(new Entrada(ruta, x, x == 'R' || x == 'C' ? origen : null));
        if (y != '.') modificado.add(new Entrada(ruta, y, null));
    }
}

package taller;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Las ordenes propias de la consola del taller, {@code preparar} y
 * {@code verificar} (seccion 4 del SPEC 027).
 *
 * Con ellas el participante no tiene que ir a la raiz del clon para correr los
 * scripts de un laboratorio y volver despues a su carpeta. Los scripts no se
 * tocan: la consola los corre desde la raiz del clon, como siempre.
 */
final class OrdenesPropias {

    private OrdenesPropias() {}

    private static final Pattern ORDEN = Pattern.compile(
            "^(preparar|verificar)(?:\\s+(--forzar))?(?:\\s+([^\\s-]\\S*))?(?:\\s+(--forzar))?\\s*$");
    private static final Pattern LABORATORIO = Pattern.compile("^lab-(\\d{2})$");

    /**
     * Lo que hay que hacer con una orden propia.
     *
     * @param script  la orden de bash que se corre, o null si no se corre nada
     * @param carpeta donde se corre
     * @param destino donde queda la consola si el script termina bien, o null si no se mueve
     * @param avisos  lo que la consola dice antes, con la voz del programa
     */
    record Plan(String script, Path carpeta, Path destino, List<String> avisos) {
        static Plan solo(String aviso) {
            return new Plan(null, null, null, List.of(aviso));
        }
    }

    static Optional<Plan> planDe(String orden, Path actual, Path clon, Path trabajo) {
        String texto = orden.strip();
        if (!texto.matches("^(preparar|verificar)(\\s.*)?$")) return Optional.empty();
        Matcher m = ORDEN.matcher(texto);
        if (!m.matches()) {
            return Optional.of(Plan.solo("No entendí la orden. Se escribe, por ejemplo, preparar 02, verificar 02 o preparar 02 --forzar."));
        }
        String verbo = m.group(1);
        boolean forzar = m.group(2) != null || m.group(4) != null;
        String numero = m.group(3);

        String nn;
        if (numero == null) {
            nn = laboratorioDe(actual, trabajo);
            if (nn == null) {
                return Optional.of(Plan.solo("¿Qué laboratorio? La consola no está dentro de uno. Escribe, por ejemplo, " + verbo + " 02."));
            }
        } else if (numero.matches("\\d{1,2}")) {
            nn = numero.length() == 1 ? "0" + numero : numero;
        } else {
            return Optional.of(Plan.solo("El laboratorio se dice con su número, por ejemplo " + verbo + " 02."));
        }

        Path carpetaLab = clon.resolve("labs").resolve("lab-" + nn);
        if (!Files.isDirectory(carpetaLab)) {
            return Optional.of(Plan.solo("No hay un laboratorio " + nn + " en el curso."));
        }
        String script = "labs/lab-" + nn + "/" + verbo + ".sh";
        if (!Files.isRegularFile(clon.resolve(script))) {
            if (verbo.equals("preparar")) {
                return Optional.of(Plan.solo("El laboratorio " + nn
                        + " no tiene preparación. Se arma a mano, siguiendo su enunciado desde el principio."));
            }
            return Optional.of(Plan.solo("El laboratorio " + nn + " no tiene verificador."));
        }

        if (verbo.equals("verificar")) {
            if (forzar) return Optional.of(Plan.solo("verificar no lleva --forzar. Escribe verificar " + nn + "."));
            return Optional.of(new Plan(script, clon, null, List.of()));
        }

        Path recetario = trabajo.resolve("lab-" + nn).resolve("recetario");
        if (Files.exists(recetario) && !forzar) {
            // El script pediria confirmar por teclado, y la consola no tiene.
            // Nunca se pasa --forzar por el participante.
            return Optional.of(Plan.solo("El laboratorio " + nn + " ya está preparado. Prepararlo de nuevo borra todo tu trabajo en "
                    + "taller-git-trabajo/lab-" + nn + " y no hay vuelta atrás. Si es lo que quieres, escribe preparar " + nn
                    + " --forzar."));
        }
        return Optional.of(new Plan(forzar ? script + " --forzar" : script, clon, recetario, List.of()));
    }

    /** El laboratorio en que esta parada la consola, por su carpeta dentro de taller-git-trabajo. */
    static String laboratorioDe(Path actual, Path trabajo) {
        Path a = Rutas.real(actual);
        Path t = Rutas.real(trabajo);
        if (!a.startsWith(t) || a.equals(t)) return null;
        Matcher m = LABORATORIO.matcher(t.relativize(a).getName(0).toString());
        return m.matches() ? m.group(1) : null;
    }
}

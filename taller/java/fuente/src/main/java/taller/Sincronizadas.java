package taller;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;

/**
 * Si el clon vive bajo una carpeta que un servicio de la nube sincroniza.
 *
 * Esas carpetas suben y bajan archivos de {@code .git} por su cuenta: corrompen
 * el repositorio y hacen que el dibujo se mueva solo. Se detecta por la ruta y
 * por las variables de entorno que esos programas dejan (punto 3.2).
 */
public final class Sincronizadas {

    private Sincronizadas() {}

    private static final List<String> VARIABLES = List.of("OneDrive", "OneDriveCommercial", "OneDriveConsumer");

    private static final List<String[]> TROZOS = List.of(
            new String[] {"/onedrive", "OneDrive"},
            new String[] {"/library/mobile documents/", "iCloud Drive"},
            new String[] {"/library/cloudstorage/", "una carpeta sincronizada de macOS"},
            new String[] {"/dropbox", "Dropbox"},
            new String[] {"/google drive", "Google Drive"},
            new String[] {"/googledrive", "Google Drive"},
            new String[] {"/mi unidad", "Google Drive"},
            new String[] {"/my drive", "Google Drive"});

    /** El nombre del servicio que sincroniza la ruta, si hay uno. */
    public static Optional<String> servicio(Path ruta, Function<String, String> variables) {
        String texto = Rutas.conBarras(ruta.toAbsolutePath()).toLowerCase(Locale.ROOT) + "/";
        for (String nombre : VARIABLES) {
            String valor = variables.apply(nombre);
            if (valor == null || valor.isBlank()) continue;
            String base = Rutas.conBarras(Path.of(valor).toAbsolutePath()).toLowerCase(Locale.ROOT) + "/";
            if (texto.startsWith(base)) return Optional.of("OneDrive");
        }
        String dropbox = variables.apply("DROPBOX_PATH");
        if (dropbox != null && !dropbox.isBlank()
                && texto.startsWith(Rutas.conBarras(Path.of(dropbox).toAbsolutePath()).toLowerCase(Locale.ROOT) + "/")) {
            return Optional.of("Dropbox");
        }
        // Google Drive para escritorio monta una unidad con su propia letra, y
        // la ruta ya no dice nada. Su variable si.
        String drive = variables.apply("GoogleDriveFS");
        if (drive != null && !drive.isBlank()
                && texto.startsWith(Rutas.conBarras(Path.of(drive).toAbsolutePath()).toLowerCase(Locale.ROOT) + "/")) {
            return Optional.of("Google Drive");
        }
        for (String[] t : TROZOS) {
            if (texto.contains(t[0])) return Optional.of(t[1]);
        }
        return Optional.empty();
    }

    public static String aviso(String servicio) {
        return "El clon está dentro de una carpeta que sincroniza " + servicio
                + ". Esas carpetas corrompen el repositorio y hacen que el dibujo se mueva solo. "
                + "Clona el curso en una carpeta que no se sincronice, por ejemplo C:\\taller o ~/taller.";
    }
}

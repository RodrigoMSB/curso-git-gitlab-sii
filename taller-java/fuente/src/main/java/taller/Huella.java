package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.CRC32;

/**
 * Una huella del repositorio calculada sin lanzar ningun proceso (punto 3.7).
 *
 * Suma fechas y tamanos de los archivos de {@code .git} que cambian cuando
 * cambia algo que el dibujo muestra, y de todos los archivos del directorio de
 * trabajo. Si la huella no cambio, no se le pregunta nada a Git.
 */
public final class Huella {

    /** Los archivos sueltos de {@code .git} que se miran. */
    static final List<String> DE_GIT = List.of(
            "HEAD", "index", "packed-refs", "logs/HEAD", "ORIG_HEAD", "FETCH_HEAD",
            "MERGE_HEAD", "REBASE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "logs/refs/stash");

    /** Las carpetas de {@code .git} que se recorren enteras. */
    static final List<String> CARPETAS_DE_GIT = List.of("refs", "rebase-merge", "rebase-apply");

    private Huella() {}

    /**
     * La raiz del repositorio que contiene a {@code carpeta}, buscando {@code .git}
     * hacia arriba sin salir de {@code limite}. Null si no hay.
     */
    public static Path raizDe(Path carpeta, Path limite) {
        Path actual = Rutas.real(carpeta);
        Path tope = Rutas.real(limite).getParent();
        while (actual != null && !actual.equals(tope)) {
            if (Files.exists(actual.resolve(".git"))) return actual;
            // Parado dentro de .git, el repositorio es el de la carpeta de arriba.
            if (actual.getFileName() != null && actual.getFileName().toString().equals(".git")) {
                return actual.getParent();
            }
            actual = actual.getParent();
        }
        return null;
    }

    /** La huella de la carpeta de la consola: la de su repositorio, o la de la carpeta si no hay. */
    public static long de(Path carpeta, Path limite) {
        CRC32 crc = new CRC32();
        agregar(crc, "carpeta:" + carpeta);
        agregar(crc, Files.isDirectory(carpeta) ? "existe" : "no-existe");
        Path raiz = raizDe(carpeta, limite);
        if (raiz == null) {
            agregar(crc, "sin-repositorio");
            return crc.getValue();
        }
        agregar(crc, "raiz:" + raiz);
        Path git = raiz.resolve(".git");
        if (Files.isDirectory(git)) {
            for (String nombre : DE_GIT) archivo(crc, git.resolve(nombre), nombre);
            for (String nombre : CARPETAS_DE_GIT) recorrer(crc, git, git.resolve(nombre), Set.of());
        } else {
            archivo(crc, git, ".git");
        }
        recorrer(crc, raiz, raiz, ignoradasDePrimerNivel(raiz));
        return crc.getValue();
    }

    /**
     * Carpetas del primer nivel que el {@code .gitignore} de la raiz excluye.
     * Solo lineas simples, un nombre con o sin barra; lo demas se recorre igual,
     * que en los repositorios del taller es barato.
     */
    static Set<String> ignoradasDePrimerNivel(Path raiz) {
        Set<String> r = new HashSet<>();
        r.add(".git");
        r.add("node_modules");
        Path archivo = raiz.resolve(".gitignore");
        if (!Files.isRegularFile(archivo)) return r;
        try {
            for (String linea : Files.readAllLines(archivo, StandardCharsets.UTF_8)) {
                String t = linea.strip();
                if (t.isEmpty() || t.startsWith("#") || t.startsWith("!")) continue;
                if (t.startsWith("/")) t = t.substring(1);
                if (t.endsWith("/")) t = t.substring(0, t.length() - 1);
                if (t.isEmpty() || t.contains("/") || t.contains("*") || t.contains("?") || t.contains("[")) continue;
                if (Files.isDirectory(raiz.resolve(t))) r.add(t);
            }
        } catch (IOException | RuntimeException e) {
            // Un .gitignore ilegible no impide calcular la huella: se recorre todo.
        }
        return r;
    }

    private static void recorrer(CRC32 crc, Path base, Path inicio, Set<String> saltar) {
        if (!Files.isDirectory(inicio, LinkOption.NOFOLLOW_LINKS)) return;
        try {
            Files.walkFileTree(inicio, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (!dir.equals(inicio) && dir.getParent().equals(inicio)
                            && saltar.contains(dir.getFileName().toString())) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    agregar(crc, "d:" + base.relativize(dir));
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    agregar(crc, "f:" + base.relativize(file) + ":" + attrs.size() + ":"
                            + attrs.lastModifiedTime().toMillis());
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            agregar(crc, "error:" + inicio);
        }
    }

    private static void archivo(CRC32 crc, Path ruta, String nombre) {
        try {
            BasicFileAttributes a = Files.readAttributes(ruta, BasicFileAttributes.class);
            agregar(crc, nombre + ":" + a.size() + ":" + a.lastModifiedTime().toMillis());
        } catch (IOException e) {
            agregar(crc, nombre + ":-");
        }
    }

    private static void agregar(CRC32 crc, String texto) {
        crc.update(texto.getBytes(StandardCharsets.UTF_8));
        crc.update('\n');
    }
}

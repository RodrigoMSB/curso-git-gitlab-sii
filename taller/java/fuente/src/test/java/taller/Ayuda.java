package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Lo que comparten las pruebas: el Git del equipo y una forma de correrlo sin
 * pasar por {@link Procesos}, para que preparar un repositorio no cuente como
 * proceso lanzado por el programa.
 */
final class Ayuda {

    private Ayuda() {}

    static final Sistema SISTEMA = Sistema.actual();

    static BuscadorGit.Instalacion git() {
        return new BuscadorGit(SISTEMA, BuscadorGit.delEquipo()).buscar()
                .orElseThrow(() -> new IllegalStateException("las pruebas necesitan Git"));
    }

    /**
     * Variables que aislan a Git de la configuracion de quien corre la prueba:
     * sin configuracion global ni del sistema, con autor fijo y sin editor.
     */
    static Map<String, String> aislado(Path hogar) {
        Map<String, String> m = new java.util.HashMap<>();
        m.put("GIT_CONFIG_GLOBAL", Rutas.conBarras(hogar.resolve("gitconfig")));
        m.put("GIT_CONFIG_NOSYSTEM", "1");
        m.put("GIT_AUTHOR_NAME", "Ana Núñez");
        m.put("GIT_AUTHOR_EMAIL", "ana@taller.cl");
        m.put("GIT_COMMITTER_NAME", "Ana Núñez");
        m.put("GIT_COMMITTER_EMAIL", "ana@taller.cl");
        m.put("GIT_EDITOR", null);
        m.put("EDITOR", null);
        m.put("VISUAL", null);
        return m;
    }

    /** Corre git en {@code carpeta} y devuelve la salida. Falla la prueba si git falla. */
    static String git(Path carpeta, String... argumentos) throws IOException, InterruptedException {
        List<String> orden = new ArrayList<>();
        orden.add(git().git().toString());
        orden.add("-c");
        orden.add("core.quotepath=false");
        orden.addAll(List.of(argumentos));
        ProcessBuilder pb = new ProcessBuilder(orden).directory(carpeta.toFile()).redirectErrorStream(true);
        aislado(carpeta).forEach((k, v) -> {
            if (v == null) pb.environment().remove(k);
            else pb.environment().put(k, v);
        });
        pb.environment().put("GIT_EDITOR", "true");
        Process p = pb.start();
        String salida = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        if (!p.waitFor(60, TimeUnit.SECONDS) || p.exitValue() != 0) {
            throw new AssertionError("git " + String.join(" ", argumentos) + " fallo:\n" + salida);
        }
        return salida;
    }

    static Path repositorio(Path carpeta) throws IOException, InterruptedException {
        Files.createDirectories(carpeta);
        git(carpeta, "init", "-q", "-b", "main");
        return carpeta;
    }

    static void escribir(Path archivo, String texto) throws IOException {
        Files.createDirectories(archivo.getParent());
        Files.writeString(archivo, texto, StandardCharsets.UTF_8);
    }

    static void confirmar(Path repo, String mensaje) throws IOException, InterruptedException {
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", mensaje);
    }
}

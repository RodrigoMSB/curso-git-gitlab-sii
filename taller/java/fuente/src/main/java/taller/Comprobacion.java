package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * La comprobacion del primer dia (seccion 5 del spec).
 *
 * Prueba una por una las cosas que en un equipo corporativo pueden fallar y
 * deja una tabla en la ventana y en {@code taller-git-trabajo/.taller/}, para
 * que el relator la pida.
 */
final class Comprobacion {

    private record Fila(int numero, String que, boolean bien, String detalle, String hacer) {}

    private final Sistema sistema;
    private final BuscadorGit.Instalacion git;
    private final Path clon;
    private final Path propia;
    private final List<String> avisos;
    private final boolean sinNavegador;
    private final List<Fila> filas = new ArrayList<>();

    Comprobacion(Sistema sistema, BuscadorGit.Instalacion git, Path clon, Path propia, List<String> avisos,
            boolean sinNavegador) {
        this.sistema = sistema;
        this.git = git;
        this.clon = clon;
        this.propia = propia;
        this.avisos = avisos;
        this.sinNavegador = sinNavegador;
    }

    int correr() throws IOException, InterruptedException {
        System.out.println();
        System.out.println("  Comprobación del taller");
        System.out.println();

        anotar(1, "El arrancador corre", true, "", "");

        Path javaHome = Rutas.real(Path.of(System.getProperty("java.home")));
        boolean delClon = Rutas.dentroDe(clon, javaHome, sistema);
        anotar(2, "Java del repositorio", delClon,
                "Java " + System.getProperty("java.version") + " en " + Rutas.conBarras(javaHome),
                "Se usó un Java ajeno al clon. Revisa que curso/taller/java/jre venga completo en el clon.");

        String versionGit = primeraLinea(correrSimple(List.of(git.git().toString(), "--version")));
        String versionBash = primeraLinea(correrSimple(List.of(git.bash().toString(), "--version")));
        boolean hayGit = versionGit.startsWith("git version");
        anotar(3, "Git y Git Bash", hayGit && !versionBash.isEmpty(),
                versionGit + " en " + Rutas.conBarras(git.git()) + ", bash en " + Rutas.conBarras(git.bash()),
                "Instala Git para Windows desde " + BuscadorGit.DESCARGA + ".");

        Servidor servidor;
        try {
            servidor = new Servidor();
        } catch (IOException e) {
            anotar(4, "Abrir un puerto en 127.0.0.1", false, e.getMessage(),
                    "Pide al soporte que permita a Java escuchar en 127.0.0.1.");
            return terminar();
        }
        anotar(4, "Abrir un puerto en 127.0.0.1", true, "puerto " + servidor.puerto(), "");

        CountDownLatch llego = new CountDownLatch(1);
        servidor.ruta("/llego", true, x -> {
            // Primero la respuesta y despues el aviso: el servidor se detiene
            // apenas llega el aviso, y detenido antes cortaba la respuesta.
            Servidor.responder(x, 200, "text/html; charset=utf-8", PAGINA.getBytes(StandardCharsets.UTF_8));
            llego.countDown();
        });
        servidor.iniciar();
        String direccion = "http://127.0.0.1:" + servidor.puerto() + "/llego?clave=" + servidor.clave();
        System.out.println("  Esperando al navegador en " + direccion);
        System.out.flush();
        if (!sinNavegador) Navegador.abrir(sistema, direccion);
        boolean vino = llego.await(20, TimeUnit.SECONDS);
        servidor.detener();
        anotar(5, "El navegador llega a 127.0.0.1", vino,
                vino ? "llegó" : "no llegó en veinte segundos",
                "Probablemente el proxy del equipo captura 127.0.0.1. Pide al soporte excluir 127.0.0.1 del proxy.");

        Ejecutor ejecutor = new Ejecutor(sistema, git, clon.getParent(), propia, 60_000);
        long inicio = System.nanoTime();
        Ejecutor.Resultado trivial = ejecutor.ejecutar("git --version", propia);
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        boolean corrio = trivial.codigo() == 0 && trivial.salida().startsWith("git version");
        anotar(6, "Java lanza bash y Git", corrio && ms <= 3000,
                corrio ? ms + " ms por orden" : "no corrió, " + primeraLinea(trivial.error()),
                corrio ? "Es lento, probablemente por el antivirus. Avisa al relator." : "Avisa al relator con esta tabla.");

        anotar(7, "El clon no está en una carpeta sincronizada", avisos.isEmpty(),
                avisos.isEmpty() ? Rutas.conBarras(clon) : Rutas.conBarras(clon),
                avisos.isEmpty() ? "" : avisos.get(0));

        anotar(8, "La ruta del clon pasa entera por bash y Git", rutaEntera(ejecutor),
                Rutas.conBarras(clon),
                "Avisa al relator con esta tabla. Mientras tanto clona el curso en una carpeta sin espacios ni tildes.");

        return terminar();
    }

    /** La ruta del clon, y una carpeta con espacio y tildes, vistas desde bash y desde Git. */
    private boolean rutaEntera(Ejecutor ejecutor) throws IOException {
        Ejecutor.Resultado raiz = ejecutor.ejecutar("git rev-parse --show-toplevel", clon);
        boolean clonBien = raiz.codigo() == 0
                && Rutas.real(Path.of(raiz.salida().strip())).equals(Rutas.real(clon));
        Path prueba = propia.resolve("prueba de ruta ñandú");
        Files.createDirectories(prueba);
        Ejecutor.Resultado dentro = ejecutor.ejecutar("cd \"prueba de ruta ñandú\" && git init -q . && git rev-parse --show-toplevel", propia);
        boolean tildesBien = dentro.codigo() == 0
                && Rutas.real(Path.of(dentro.salida().strip())).equals(Rutas.real(prueba))
                && Rutas.real(dentro.carpeta()).equals(Rutas.real(prueba));
        borrar(prueba);
        return clonBien && tildesBien;
    }

    private int terminar() throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("Comprobación del taller, ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
                .append(System.lineSeparator()).append(System.lineSeparator());
        boolean todo = true;
        for (Fila f : filas) {
            todo &= f.bien();
            sb.append(String.format("  %d  %-46s %s%n", f.numero(), f.que(), f.bien() ? "bien" : "FALLA"));
            if (!f.detalle().isEmpty()) sb.append("       ").append(f.detalle()).append(System.lineSeparator());
            if (!f.bien() && !f.hacer().isEmpty()) sb.append("       Qué hacer. ").append(f.hacer()).append(System.lineSeparator());
        }
        sb.append(System.lineSeparator()).append(todo ? "  Todo en orden. El taller va a funcionar en este equipo."
                : "  Hay algo que resolver. Muéstrale esta tabla al relator.").append(System.lineSeparator());
        Path archivo = propia.resolve("comprobacion.txt");
        Files.writeString(archivo, sb.toString(), StandardCharsets.UTF_8);
        System.out.println();
        System.out.print(sb);
        System.out.println();
        System.out.println("  El resultado quedó también en " + Rutas.conBarras(archivo));
        System.out.println();
        return todo ? 0 : 1;
    }

    private void anotar(int n, String que, boolean bien, String detalle, String hacer) {
        filas.add(new Fila(n, que, bien, detalle, hacer));
        System.out.printf("  %d  %-46s %s%n", n, que, bien ? "bien" : "FALLA");
        System.out.flush();
    }

    private static String correrSimple(List<String> orden) {
        try {
            return Procesos.correr(orden, null, null, 20_000).salida();
        } catch (IOException e) {
            return "";
        }
    }

    private static String primeraLinea(String texto) {
        String t = texto.strip();
        int n = t.indexOf('\n');
        return (n < 0 ? t : t.substring(0, n)).strip();
    }

    private static void borrar(Path p) throws IOException {
        if (!Files.exists(p)) return;
        try (var s = Files.walk(p)) {
            for (Path x : s.sorted(java.util.Comparator.reverseOrder()).toList()) {
                x.toFile().setWritable(true);
                Files.deleteIfExists(x);
            }
        }
    }

    private static final String PAGINA = """
            <!doctype html>
            <html lang="es"><head><meta charset="utf-8"><title>Taller</title></head>
            <body style="font-family:system-ui,sans-serif;padding:2rem">
            <h1>El navegador llegó al taller</h1>
            <p>Vuelve a la ventana de la comprobación. Puedes cerrar esta pestaña.</p>
            </body></html>
            """;
}

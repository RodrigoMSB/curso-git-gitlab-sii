package taller;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * La unica puerta por la que el programa lanza procesos.
 *
 * Cada proceso que se lanza pasa por el antivirus corporativo, asi que se
 * cuentan todos aqui. La prueba del reposo lee este contador y exige cero en un
 * minuto sin nadie escribiendo (punto 3.7).
 */
public final class Procesos {

    private static final AtomicLong LANZADOS = new AtomicLong();

    private Procesos() {}

    public static long lanzados() {
        return LANZADOS.get();
    }

    /** Lo que dejo un proceso al terminar. */
    public record Salida(int codigo, String salida, String error, boolean agotado) {}

    /**
     * Lanza un proceso con la entrada cerrada y espera a que termine.
     *
     * Salida y error se leen por separado, en UTF-8, en hilos propios para que
     * ninguno de los dos se llene y bloquee al proceso. Si se pasa el tiempo
     * se mata el proceso con todo su arbol.
     */
    public static Salida correr(List<String> orden, File carpeta, Map<String, String> entorno, long milisegundos)
            throws IOException {
        return correr(orden, carpeta, entorno, milisegundos, null);
    }

    /**
     * Igual, pero con {@code entrada} escrita en la entrada estandar del
     * proceso, que se cierra enseguida. Sin entrada, la entrada es el
     * dispositivo nulo.
     */
    public static Salida correr(List<String> orden, File carpeta, Map<String, String> entorno, long milisegundos,
            String entrada) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(orden);
        if (carpeta != null) pb.directory(carpeta);
        if (entorno != null) {
            // Un valor nulo quita la variable heredada.
            entorno.forEach((k, v) -> {
                if (v == null) pb.environment().remove(k);
                else pb.environment().put(k, v);
            });
        }
        if (entrada == null) pb.redirectInput(ProcessBuilder.Redirect.from(nulo()));
        // Una orden no se lanza hasta que el motor este dentro de su trabajo,
        // para que todo lo que abra nazca dentro (ver Custodio).
        if (entrada != null) Custodio.esperar();
        LANZADOS.incrementAndGet();
        Process p = pb.start();
        if (entrada != null) {
            try (var in = p.getOutputStream()) {
                in.write(entrada.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            } catch (IOException cerrada) {
                // Bash puede cerrar su entrada antes de leerla entera si termina antes.
            }
        }
        Lectura salida = new Lectura(p.getInputStream());
        Lectura error = new Lectura(p.getErrorStream());
        salida.start();
        error.start();
        boolean termino;
        try {
            termino = p.waitFor(milisegundos, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            termino = false;
        }
        if (!termino) matarArbol(p);
        // Terminada la orden, lo que falte por leer llega enseguida. Muerta por
        // tiempo, un nieto que no murio puede tener el tubo abierto: no se le
        // espera mas de un segundo.
        long espera = termino ? 5000 : 1000;
        try {
            salida.join(espera);
            error.join(espera);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        int codigo = termino ? p.exitValue() : -1;
        return new Salida(codigo, salida.texto(), error.texto(), !termino);
    }

    /** Lanza un proceso y lo deja correr solo, sin esperarlo. Para abrir el navegador. */
    public static void soltar(List<String> orden) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(orden);
        pb.redirectInput(ProcessBuilder.Redirect.from(nulo()));
        pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        LANZADOS.incrementAndGet();
        pb.start();
    }

    /**
     * Lanza el custodio de Windows: con la entrada y la salida abiertas para
     * hablar con el, y sin esperarlo. Cuenta como un proceso lanzado.
     */
    static Process lanzarAyudante(List<String> orden) throws IOException {
        ProcessBuilder pb = new ProcessBuilder(orden);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        LANZADOS.incrementAndGet();
        return pb.start();
    }

    static void matarArbol(Process p) {
        p.toHandle().descendants().forEach(ProcessHandle::destroyForcibly);
        p.destroyForcibly();
        try {
            p.waitFor(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static File nulo() {
        return new File(Sistema.actual() == Sistema.WINDOWS ? "NUL" : "/dev/null");
    }

    private static final class Lectura extends Thread {
        private final InputStream entrada;
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

        Lectura(InputStream entrada) {
            this.entrada = entrada;
            setDaemon(true);
        }

        @Override
        public void run() {
            try (entrada) {
                entrada.transferTo(bytes);
            } catch (IOException ignorada) {
                // El proceso se mato: lo leido hasta ahi es lo que hay.
            }
        }

        synchronized String texto() {
            return bytes.toString(StandardCharsets.UTF_8);
        }
    }
}

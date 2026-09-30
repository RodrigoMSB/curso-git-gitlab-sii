package taller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * El servidor HTTP local, solo en 127.0.0.1 (punto 3.8).
 *
 * Toda peticion pasa por la misma guardia antes de llegar a su manejador: el
 * encabezado Host tiene que ser exactamente la direccion propia, un Origin que
 * venga tiene que ser el propio, y la clave tiene que ser la de este arranque.
 * No se envia ningun encabezado CORS, asi que una pagina de internet abierta en
 * el mismo navegador no puede leer lo que se responde.
 */
public final class Servidor {

    public static final String ENCABEZADO_CLAVE = "X-Taller-Clave";

    private final HttpServer http;
    private final String clave;
    private final int puerto;

    public Servidor() throws IOException {
        this(nuevaClave());
    }

    Servidor(String clave) throws IOException {
        this.clave = clave;
        InetAddress local = InetAddress.getByAddress(new byte[] {127, 0, 0, 1});
        this.http = HttpServer.create(new InetSocketAddress(local, 0), 0);
        this.puerto = http.getAddress().getPort();
        http.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    }

    /** Ciento veintiocho bits al azar, en hexadecimal. */
    static String nuevaClave() {
        byte[] b = new byte[16];
        new SecureRandom().nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    public int puerto() {
        return puerto;
    }

    public String clave() {
        return clave;
    }

    public String direccion() {
        return "http://127.0.0.1:" + puerto + "/?clave=" + clave;
    }

    public void iniciar() {
        http.start();
    }

    public void detener() {
        http.stop(0);
    }

    /** Un manejador que solo recibe peticiones que pasaron la guardia. */
    @FunctionalInterface
    public interface Manejador {
        void atender(HttpExchange intercambio) throws IOException;
    }

    /**
     * Registra una ruta. {@code claveEnDireccion} dice si la clave viaja en la
     * direccion, como en la pagina que abre el navegador, o en el encabezado,
     * como en lo que la pagina pide despues.
     */
    public void ruta(String camino, boolean claveEnDireccion, Manejador manejador) {
        http.createContext(camino, guardia(camino, claveEnDireccion, manejador));
    }

    private HttpHandler guardia(String camino, boolean claveEnDireccion, Manejador manejador) {
        return intercambio -> {
            try (intercambio) {
                // Toda respuesta los lleva, tambien el 403 y el 405 sin cuerpo.
                seguridad(intercambio);
                if (!permitida(intercambio, camino, claveEnDireccion)) {
                    intercambio.sendResponseHeaders(403, -1);
                    return;
                }
                manejador.atender(intercambio);
            } catch (IOException | RuntimeException e) {
                Registro.escribir("error atendiendo " + camino + ", " + e);
                try {
                    intercambio.sendResponseHeaders(500, -1);
                } catch (IOException | RuntimeException ignorada) {
                    // La respuesta ya habia empezado.
                }
            }
        };
    }

    boolean permitida(HttpExchange x, String camino, boolean claveEnDireccion) {
        String propio = "127.0.0.1:" + puerto;
        String host = x.getRequestHeaders().getFirst("Host");
        if (!propio.equals(host)) return false;
        String origen = x.getRequestHeaders().getFirst("Origin");
        if (origen != null && !origen.equals("http://" + propio)) return false;
        // El contexto de HttpServer atiende todo lo que empieza con el camino;
        // aqui se exige el camino exacto.
        if (!x.getRequestURI().getPath().equals(camino)) return false;
        String recibida = claveEnDireccion ? parametro(x.getRequestURI(), "clave") : x.getRequestHeaders().getFirst(ENCABEZADO_CLAVE);
        return iguales(recibida, clave);
    }

    static boolean iguales(String recibida, String clave) {
        if (recibida == null) return false;
        return MessageDigest.isEqual(recibida.getBytes(StandardCharsets.UTF_8), clave.getBytes(StandardCharsets.UTF_8));
    }

    public static String parametro(URI uri, String nombre) {
        String consulta = uri.getRawQuery();
        if (consulta == null) return null;
        for (String par : consulta.split("&")) {
            int igual = par.indexOf('=');
            String k = igual < 0 ? par : par.substring(0, igual);
            if (k.equals(nombre)) {
                return java.net.URLDecoder.decode(igual < 0 ? "" : par.substring(igual + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    public static String cuerpo(HttpExchange x, int maximo) throws IOException {
        try (InputStream in = x.getRequestBody()) {
            byte[] b = in.readNBytes(maximo + 1);
            if (b.length > maximo) throw new IOException("cuerpo demasiado grande");
            return new String(b, StandardCharsets.UTF_8);
        }
    }

    static void seguridad(HttpExchange x) {
        var h = x.getResponseHeaders();
        h.set("Cache-Control", "no-store");
        h.set("X-Content-Type-Options", "nosniff");
        h.set("Referrer-Policy", "no-referrer");
    }

    /** {@code tipo} null no manda Content-Type, para las respuestas sin cuerpo. */
    public static void responder(HttpExchange x, int codigo, String tipo, byte[] cuerpo) throws IOException {
        if (tipo != null) x.getResponseHeaders().set("Content-Type", tipo);
        seguridad(x);
        if (cuerpo.length == 0) {
            x.sendResponseHeaders(codigo, -1);
            return;
        }
        x.sendResponseHeaders(codigo, cuerpo.length);
        try (OutputStream out = x.getResponseBody()) {
            out.write(cuerpo);
        }
    }

    public static void json(HttpExchange x, int codigo, Object valor) throws IOException {
        responder(x, codigo, "application/json; charset=utf-8", Json.escribir(valor).getBytes(StandardCharsets.UTF_8));
    }

    public static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pares.length; i += 2) m.put((String) pares[i], pares[i + 1]);
        return m;
    }
}

package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * La guardia del servidor, con peticiones escritas a mano sobre un socket para
 * poder mandar el Host y el Origin que un atacante mandaria.
 */
class ServidorTest {

    private Servidor servidor;

    @BeforeEach
    void iniciar() throws IOException {
        servidor = new Servidor("a".repeat(32));
        servidor.ruta("/", true, x -> Servidor.responder(x, 200, "text/plain", "pagina".getBytes(StandardCharsets.UTF_8)));
        servidor.ruta("/api/estado", false, x -> Servidor.responder(x, 200, "text/plain", "estado".getBytes(StandardCharsets.UTF_8)));
        servidor.iniciar();
    }

    @AfterEach
    void detener() {
        servidor.detener();
    }

    private String pedir(String metodo, String camino, String host, String... encabezados) throws IOException {
        try (Socket s = new Socket(InetAddress.getByAddress(new byte[] {127, 0, 0, 1}), servidor.puerto())) {
            s.setSoTimeout(5000);
            StringBuilder p = new StringBuilder(metodo + " " + camino + " HTTP/1.1\r\n");
            if (host != null) p.append("Host: ").append(host).append("\r\n");
            for (String e : encabezados) p.append(e).append("\r\n");
            p.append("Content-Length: 0\r\nConnection: close\r\n\r\n");
            OutputStream out = s.getOutputStream();
            out.write(p.toString().getBytes(StandardCharsets.UTF_8));
            out.flush();
            InputStream in = s.getInputStream();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String propio() {
        return "127.0.0.1:" + servidor.puerto();
    }

    private static int codigo(String respuesta) {
        return Integer.parseInt(respuesta.substring(9, 12));
    }

    private String clave() {
        return "X-Taller-Clave: " + servidor.clave();
    }

    @Test
    void conTodoEnReglaResponde() throws IOException {
        String r = pedir("GET", "/api/estado", propio(), clave());
        assertEquals(200, codigo(r));
        assertTrue(r.endsWith("estado"));
        assertEquals(200, codigo(pedir("GET", "/?clave=" + servidor.clave(), propio())));
    }

    @Test
    void sinClave_oConOtra_403SinCuerpo() throws IOException {
        String r = pedir("GET", "/api/estado", propio());
        assertEquals(403, codigo(r));
        assertTrue(r.endsWith("\r\n\r\n"), "la respuesta traia cuerpo: " + r);
        assertEquals(403, codigo(pedir("GET", "/api/estado", propio(), "X-Taller-Clave: " + "b".repeat(32))));
        assertEquals(403, codigo(pedir("GET", "/", propio())));
        assertEquals(403, codigo(pedir("GET", "/?clave=" + "b".repeat(32), propio())));
        // La clave de la direccion no sirve para la API, ni la del encabezado para la pagina.
        assertEquals(403, codigo(pedir("GET", "/api/estado?clave=" + servidor.clave(), propio())));
    }

    @Test
    void unHostQueNoEsElPropio_403() throws IOException {
        assertEquals(403, codigo(pedir("GET", "/api/estado", "localhost:" + servidor.puerto(), clave())));
        assertEquals(403, codigo(pedir("GET", "/api/estado", "ataque.ejemplo.com:" + servidor.puerto(), clave())));
        assertEquals(403, codigo(pedir("GET", "/api/estado", "127.0.0.1", clave())));
        assertEquals(403, codigo(pedir("GET", "/api/estado", null, clave())));
    }

    @Test
    void unOrigenAjeno_403() throws IOException {
        assertEquals(403, codigo(pedir("GET", "/api/estado", propio(), clave(), "Origin: http://ataque.ejemplo.com")));
        assertEquals(403, codigo(pedir("GET", "/api/estado", propio(), clave(), "Origin: null")));
        assertEquals(200, codigo(pedir("GET", "/api/estado", propio(), clave(), "Origin: http://" + propio())));
    }

    @Test
    void unCaminoDesconocido_403() throws IOException {
        assertEquals(403, codigo(pedir("GET", "/api/estado/otro", propio(), clave())));
        assertEquals(403, codigo(pedir("GET", "/favicon.ico", propio(), clave())));
    }

    @Test
    void sinEncabezadosCors() throws IOException {
        String r = pedir("GET", "/api/estado", propio(), clave(), "Origin: http://" + propio());
        assertFalse(r.toLowerCase().contains("access-control-"), r);
    }

    @Test
    void soloEscuchaEn127001() throws IOException {
        for (NetworkInterface ni : java.util.Collections.list(NetworkInterface.getNetworkInterfaces())) {
            for (InetAddress a : java.util.Collections.list(ni.getInetAddresses())) {
                if (a.isLoopbackAddress()) continue;
                try (Socket s = new Socket()) {
                    s.connect(new java.net.InetSocketAddress(a, servidor.puerto()), 500);
                    throw new AssertionError("el servidor acepto una conexion en " + a);
                } catch (IOException esperado) {
                    // Rechazada: es lo que se quiere.
                }
            }
        }
    }

    @Test
    void laClaveTieneAlMenos128Bits() {
        String c = Servidor.nuevaClave();
        assertEquals(32, c.length());
        assertTrue(c.matches("[0-9a-f]{32}"));
        assertFalse(c.equals(Servidor.nuevaClave()));
    }
}

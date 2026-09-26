package taller;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Lo que el servidor atiende en el modo taller.
 *
 * <ul>
 *   <li>{@code GET /?clave=...}, la pagina del simulador, el mismo
 *       {@code SIMULADOR.html} del clon.</li>
 *   <li>{@code GET /api/estado?desde=N}, el ultimo estado leido. Si la version
 *       sigue siendo N responde 204 sin cuerpo y la pagina no redibuja.</li>
 *   <li>{@code POST /api/orden}, ejecuta una orden y responde lo que imprimio.</li>
 *   <li>{@code GET /api/diagnostico}, cuantos procesos lanzo el programa.</li>
 * </ul>
 */
final class Paginas {

    private Paginas() {}

    static void registrar(Servidor servidor, Taller taller, Path pagina) {
        servidor.ruta("/", true, x -> {
            if (!metodo(x, "GET")) return;
            byte[] html = Files.readAllBytes(pagina);
            Servidor.responder(x, 200, "text/html; charset=utf-8", html);
        });

        servidor.ruta("/api/estado", false, x -> {
            if (!metodo(x, "GET")) return;
            String desde = Servidor.parametro(x.getRequestURI(), "desde");
            long version = taller.version();
            if (desde != null && desde.equals(Long.toString(version))) {
                Servidor.responder(x, 204, "application/json; charset=utf-8", new byte[0]);
                return;
            }
            String documento = taller.documento();
            String cuerpo = "{\"version\":" + version + (documento.length() > 2 ? "," + documento.substring(1) : "}");
            Servidor.responder(x, 200, "application/json; charset=utf-8", cuerpo.getBytes(StandardCharsets.UTF_8));
        });

        // Cuantos procesos lanzo el programa desde que arranco. Lo lee la prueba
        // del reposo (punto 7.5): en un minuto sin nadie escribiendo tiene
        // que seguir igual.
        servidor.ruta("/api/diagnostico", false, x -> {
            if (!metodo(x, "GET")) return;
            Servidor.json(x, 200, Servidor.mapa("procesos", Procesos.lanzados(), "version", taller.version()));
        });

        servidor.ruta("/api/orden", false, x -> {
            if (!metodo(x, "POST")) return;
            String orden;
            try {
                Object leido = Json.leer(Servidor.cuerpo(x, 64 * 1024));
                orden = leido instanceof Map<?, ?> m && m.get("orden") instanceof String s ? s : null;
            } catch (IllegalArgumentException | IOException e) {
                orden = null;
            }
            if (orden == null || orden.isBlank()) {
                Servidor.json(x, 400, Servidor.mapa("error", "falta la orden"));
                return;
            }
            Taller.Respuesta r = taller.ejecutar(orden.strip());
            if (r.resultado() == null) {
                Servidor.json(x, 409, Servidor.mapa(
                        "ocupado", true,
                        "enCurso", r.enCurso(),
                        "avisos", java.util.List.of("Todavía corre la orden anterior. Espera a que termine.")));
                return;
            }
            Ejecutor.Resultado e = r.resultado();
            Servidor.json(x, 200, Servidor.mapa(
                    "codigo", e.codigo(),
                    "salida", e.salida(),
                    "error", e.error(),
                    "agotado", e.agotado(),
                    "avisos", e.avisos(),
                    "version", taller.version()));
        });
    }

    private static boolean metodo(HttpExchange x, String esperado) throws IOException {
        if (x.getRequestMethod().equals(esperado)) return true;
        x.getResponseHeaders().set("Allow", esperado);
        x.sendResponseHeaders(405, -1);
        return false;
    }
}

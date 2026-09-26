package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class OtrosTest {

    @Test
    void jsonIdaYVuelta_conTildesYControles() {
        String t = Json.escribir(Map.of("orden", "echo \"ñandú\"\n\t\u0001"));
        assertEquals(Map.of("orden", "echo \"ñandú\"\n\t\u0001"), Json.leer(t));
        assertEquals(List.of(1L, true, "x"), Json.leer("[1, true, \"x\"]"));
    }

    @Test
    void lasCarpetasSincronizadas() {
        Map<String, String> sinVariables = Map.of();
        assertEquals("OneDrive", Sincronizadas.servicio(Path.of("/c/Users/ana/OneDrive - SII/curso"), sinVariables::get).orElseThrow());
        assertEquals("iCloud Drive", Sincronizadas.servicio(
                Path.of("/Users/ana/Library/Mobile Documents/com~apple~CloudDocs/curso"), sinVariables::get).orElseThrow());
        assertEquals("Dropbox", Sincronizadas.servicio(Path.of("/Users/ana/Dropbox/curso"), sinVariables::get).orElseThrow());
        assertEquals("Google Drive", Sincronizadas.servicio(
                Path.of("/Users/ana/Library/CloudStorage/GoogleDrive-ana/Mi unidad/curso"), sinVariables::get).isPresent() ? "Google Drive" : "");
        assertTrue(Sincronizadas.servicio(Path.of("/Users/ana/taller/curso"), sinVariables::get).isEmpty());

        // OneDrive puede tener un nombre de carpeta que no dice OneDrive: su variable si.
        Map<String, String> conVariable = Map.of("OneDriveCommercial", "/Users/ana/Documentos de la empresa");
        assertEquals("OneDrive", Sincronizadas.servicio(
                Path.of("/Users/ana/Documentos de la empresa/curso"), conVariable::get).orElseThrow());
    }

    @Test
    void elTiempoSeDiceEnPalabras() {
        assertEquals("10 minutos", Ejecutor.describirTiempo(600_000));
        assertEquals("1 minuto", Ejecutor.describirTiempo(60_000));
        assertEquals("8 segundos", Ejecutor.describirTiempo(8_000));
    }

    @Test
    void lasSeccionesDelGuion() {
        Map<String, String> s = LectorEstado.secciones("\u0001raiz\u0001/a\n/a/.git\n\u0001rama\u0001refs/heads/main\n\u0001fin\u0001");
        assertEquals("/a\n/a/.git\n", s.get("raiz"));
        assertEquals("refs/heads/main\n", s.get("rama"));
        assertTrue(s.containsKey("fin"));
    }
}

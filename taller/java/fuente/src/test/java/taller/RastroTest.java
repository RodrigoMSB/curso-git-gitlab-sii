package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RastroTest {

    private static Process largo() throws Exception {
        List<String> orden = Sistema.actual() == Sistema.WINDOWS
                ? List.of("cmd.exe", "/c", "ping -n 60 127.0.0.1 >nul")
                : List.of("/bin/sleep", "60");
        return new ProcessBuilder(orden).start();
    }

    @Test
    void loQueQuedoDeLaVezAnteriorSeCierraAlArrancar(@TempDir Path propia) throws Exception {
        assertEquals(0, Rastro.limpiar(propia));
        Process orden = largo();
        try {
            Rastro.seguir(orden);
            String anotado = Files.readString(propia.resolve("procesos"), StandardCharsets.UTF_8);
            assertTrue(anotado.contains(orden.pid() + " "), anotado);

            // El arranque siguiente: el motor anterior murio y la orden sigue viva.
            assertTrue(Rastro.limpiar(propia) >= 1);
            assertTrue(orden.waitFor(10, TimeUnit.SECONDS), "la orden seguia viva");
            assertEquals("", Files.readString(propia.resolve("procesos"), StandardCharsets.UTF_8).trim());
        } finally {
            orden.destroyForcibly();
        }
    }

    @Test
    void unProcesoAjenoQueReusoElNumeroNoSeToca(@TempDir Path propia) throws Exception {
        Process ajeno = largo();
        try {
            // El mismo numero, otra hora de inicio: es otro proceso.
            Files.writeString(propia.resolve("procesos"), ajeno.pid() + " 2001-01-01T00:00:00Z\n", StandardCharsets.UTF_8);
            assertEquals(0, Rastro.limpiar(propia));
            assertFalse(ajeno.waitFor(1, TimeUnit.SECONDS), "se termino un proceso ajeno");
            assertTrue(ajeno.isAlive());
        } finally {
            ajeno.destroyForcibly();
        }
    }
}

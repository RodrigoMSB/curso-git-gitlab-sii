package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RutasTest {

    @Test
    void deGitBashAWindows() {
        assertEquals("C:/Users/José Pérez/SII", Rutas.aWindows("/c/Users/José Pérez/SII"));
        assertEquals("D:/", Rutas.aWindows("/d"));
        assertEquals("/usr/bin", Rutas.aWindows("/usr/bin"));
        assertEquals("C:/Users/x", Rutas.aWindows("C:/Users/x"));
    }

    @Test
    void deWindowsAGitBash() {
        assertEquals("/c/Users/José Pérez/SII", Rutas.aMsys("C:\\Users\\José Pérez\\SII"));
        assertEquals("/c/Users/x", Rutas.aMsys("C:/Users/x"));
        assertEquals("/d", Rutas.aMsys("D:\\"));
        assertEquals("/tmp/x", Rutas.aMsys("/tmp/x"));
    }

    @Test
    void idaYVuelta() {
        String r = "C:/Users/Ñandú Ávila/taller-git-trabajo/lab-01";
        assertEquals(r, Rutas.aWindows(Rutas.aMsys(r)));
    }

    @Test
    void elLimite(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("José Pérez"));
        Path dentro = Files.createDirectories(limite.resolve("taller-git-trabajo/lab-01"));
        Path hermana = Files.createDirectories(tmp.resolve("José Pérez2"));
        assertTrue(Rutas.dentroDe(limite, limite, Sistema.MAC));
        assertTrue(Rutas.dentroDe(limite, dentro, Sistema.MAC));
        assertFalse(Rutas.dentroDe(limite, tmp, Sistema.MAC));
        // Una carpeta cuyo nombre empieza igual no esta dentro.
        assertFalse(Rutas.dentroDe(limite, hermana, Sistema.MAC));
        assertFalse(Rutas.dentroDe(limite, dentro.resolve("../../.."), Sistema.MAC));
        assertEquals("taller-git-trabajo/lab-01", Rutas.relativa(limite, dentro));
    }

    @Test
    void elLimiteNoDistingueMayusculasEnWindowsNiEnMac() {
        assertTrue(Rutas.dentroDe(Path.of("/A/B"), Path.of("/a/b/c"), Sistema.WINDOWS));
        assertFalse(Rutas.dentroDe(Path.of("/A/B"), Path.of("/a/b/c"), Sistema.OTRO));
    }
}

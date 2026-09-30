package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class HuellaTest {

    @Test
    void cambiaConUnArchivoDelDirectorioDeTrabajo_yNoSinCambios(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("recetas/pastel.md"), "a");
        Ayuda.confirmar(repo, "a");
        long h1 = Huella.de(repo, tmp);
        assertEquals(h1, Huella.de(repo, tmp));

        // Mismo tamano, otra fecha: es lo que deja un editor que guarda.
        Files.writeString(repo.resolve("recetas/pastel.md"), "b");
        Files.setLastModifiedTime(repo.resolve("recetas/pastel.md"), FileTime.fromMillis(System.currentTimeMillis() + 3000));
        assertNotEquals(h1, Huella.de(repo, tmp));
    }

    @Test
    void cambiaConUnArchivoNuevo_yConUnaRama(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("a.md"), "a");
        Ayuda.confirmar(repo, "a");
        long h1 = Huella.de(repo, tmp);
        Ayuda.escribir(repo.resolve("nuevo.md"), "n");
        long h2 = Huella.de(repo, tmp);
        assertNotEquals(h1, h2);
        Ayuda.git(repo, "branch", "otra");
        assertNotEquals(h2, Huella.de(repo, tmp));
    }

    @Test
    void desdeUnaSubcarpetaEsLaDelRepositorio(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Path sub = Files.createDirectories(repo.resolve("recetas"));
        assertEquals(Rutas.real(repo), Huella.raizDe(sub, tmp));
        assertEquals(Rutas.real(repo), Huella.raizDe(repo.resolve(".git"), tmp));
        assertNull(Huella.raizDe(Files.createDirectories(tmp.resolve("suelta")), tmp));
    }

    @Test
    void noSubeMasAllaDelLimite(@TempDir Path tmp) throws Exception {
        Ayuda.repositorio(tmp.resolve("afuera"));
        Path limite = Files.createDirectories(tmp.resolve("afuera/limite"));
        assertNull(Huella.raizDe(Files.createDirectories(limite.resolve("x")), limite));
    }

    @Test
    void saltaLoQueElGitignoreExcluyeEnElPrimerNivel(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve(".gitignore"), "construido/\n*.tmp\n");
        Ayuda.escribir(repo.resolve("construido/x.bin"), "1");
        long h1 = Huella.de(repo, tmp);
        Ayuda.escribir(repo.resolve("construido/y.bin"), "2");
        assertEquals(h1, Huella.de(repo, tmp));
    }
}

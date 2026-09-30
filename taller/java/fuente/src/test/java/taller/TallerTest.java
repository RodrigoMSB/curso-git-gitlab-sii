package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** La sesion: cuando se le pregunta a Git y cuando no. */
class TallerTest {

    private static Taller taller(Path limite) throws Exception {
        Path trabajo = Files.createDirectories(limite.resolve("taller-git-trabajo"));
        Path propia = trabajo.resolve(".taller");
        var git = Ayuda.git();
        Ejecutor e = new Ejecutor(Ayuda.SISTEMA, git, limite, propia, 60_000).conEntornoExtra(Ayuda.aislado(limite));
        LectorEstado l = new LectorEstado(Ayuda.SISTEMA, git, propia);
        return new Taller(new Taller.Datos(Ayuda.SISTEMA, limite, limite.resolve("curso"), trabajo, propia, "ana", "equipo", List.of()), e, l);
    }

    @Test
    void enReposoNoSeLanzaNingunProceso_yUnCambioDeAfueraSeVeEnMenosDeUnSegundo(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("limite"));
        Taller t = taller(limite);
        t.ejecutar("mkdir r && cd r && git init -q && echo a > a.md && git add a.md && git commit -qm a");
        long version = t.version();

        long antes = Procesos.lanzados();
        long fin = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < fin) {
            t.vigilar();
            Thread.sleep(500);
        }
        assertEquals(antes, Procesos.lanzados(), "el vigilante lanzo procesos sin que nada cambiara");
        assertEquals(version, t.version());

        Path archivo = t.carpeta().resolve("a.md");
        Files.writeString(archivo, "cambiado por el editor\n");
        Files.setLastModifiedTime(archivo, FileTime.fromMillis(System.currentTimeMillis() + 2000));
        long inicio = System.currentTimeMillis();
        while (t.version() == version && System.currentTimeMillis() - inicio < 3000) {
            t.vigilar();
            Thread.sleep(100);
        }
        long demora = System.currentTimeMillis() - inicio;
        assertNotEquals(version, t.version());
        assertTrue(demora < 1000, "tardo " + demora + " ms");
        assertTrue(t.documento().contains("\"modificado\":[{\"ruta\":\"a.md\""), t.documento());
    }

    @Test
    void siLaPaginaPreguntaMientrasSeLee_esperaElEstadoNuevo(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("limite"));
        Taller t = taller(limite);
        t.ejecutar("mkdir r && cd r && git init -q && echo a > a.md && git add a.md && git commit -qm a");
        long version = t.version();
        Files.writeString(t.carpeta().resolve("b.md"), "nuevo\n");
        Thread vigilante = Thread.ofVirtual().start(t::vigilar);
        long inicio = System.currentTimeMillis();
        while (!t.leyendo() && vigilante.isAlive() && System.currentTimeMillis() - inicio < 5000) Thread.onSpinWait();
        t.esperarLectura(version, 5000);
        assertNotEquals(version, t.version(), "respondio antes de que terminara la lectura");
        vigilante.join();
    }

    @Test
    void laCarpetaSeRecuerdaEntreArranques(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("José Pérez"));
        Taller t = taller(limite);
        t.ejecutar("mkdir -p \"lab 01\" && cd \"lab 01\"");
        Path donde = t.carpeta();
        assertTrue(donde.endsWith("lab 01"), donde.toString());
        assertEquals(donde, taller(limite).carpeta());
    }

    @Test
    void unaOrdenALaVez(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("limite"));
        Taller t = taller(limite);
        Thread larga = Thread.ofVirtual().start(() -> t.ejecutar("sleep 2"));
        Thread.sleep(500);
        Taller.Respuesta r = t.ejecutar("echo hola");
        assertEquals(null, r.resultado());
        assertEquals("sleep 2", r.enCurso());
        larga.join();
        assertEquals("hola\n", t.ejecutar("echo hola").resultado().salida());
    }

    @Test
    void laCarpetaPropiaNoMolestaALosScriptsDeLosLaboratorios(@TempDir Path tmp) throws Exception {
        Path limite = Files.createDirectories(tmp.resolve("limite"));
        Taller t = taller(limite);
        t.ejecutar("true");
        Path trabajo = limite.resolve("taller-git-trabajo");
        // Lo que el programa deja vive solo en .taller, al lado de los lab-NN.
        try (var s = Files.list(trabajo)) {
            assertEquals(List.of(".taller"), s.map(p -> p.getFileName().toString()).toList());
        }
    }
}

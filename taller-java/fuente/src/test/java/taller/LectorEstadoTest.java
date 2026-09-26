package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** El lector contra repositorios de verdad, armados con Git. */
class LectorEstadoTest {

    private static Map<String, Object> leer(Path tmp, Path carpeta) throws Exception {
        return new LectorEstado(Ayuda.SISTEMA, Ayuda.git(), tmp.resolve(".taller")).leer(carpeta);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> lista(Map<String, Object> m, String clave) {
        return (List<Map<String, Object>>) m.get(clave);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> areas(Map<String, Object> m) {
        return (Map<String, Object>) m.get("areas");
    }

    private static Set<String> huerfanas(Map<String, Object> estado) {
        return lista(estado, "confirmaciones").stream()
                .filter(c -> (Boolean) c.get("huerfana"))
                .map(c -> (String) c.get("asunto"))
                .collect(Collectors.toSet());
    }

    @Test
    void fueraDeUnRepositorio(@TempDir Path tmp) throws Exception {
        Path suelta = Files.createDirectories(tmp.resolve("suelta"));
        Map<String, Object> e = leer(tmp, suelta);
        assertEquals(false, e.get("repositorio"));
    }

    @Test
    void recienIniciado_sinConfirmaciones(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("recetario"));
        Ayuda.escribir(repo.resolve("platos.md"), "# Platos\n");
        Map<String, Object> e = leer(tmp, repo);
        assertEquals(true, e.get("repositorio"));
        assertEquals("main", e.get("rama"));
        assertNull(e.get("head"));
        assertTrue(lista(e, "confirmaciones").isEmpty());
        assertEquals(List.of("platos.md"), areas(e).get("sinSeguimiento"));
    }

    @Test
    void elAmendDejaHuerfanaLaAnterior_yLaEtiquetaAnotadaApuntaALaConfirmacion(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("recetario"));
        Ayuda.escribir(repo.resolve("platos.md"), "cazuela\n");
        Ayuda.confirmar(repo, "primera");
        Ayuda.escribir(repo.resolve("platos.md"), "cazuela\ncuranto\n");
        Ayuda.confirmar(repo, "se docuemnta");
        Ayuda.git(repo, "commit", "-q", "--amend", "-m", "se documenta la canción");
        Ayuda.git(repo, "tag", "-a", "v1.0", "-m", "versión uno");
        String head = Ayuda.git(repo, "rev-parse", "HEAD").strip();

        Map<String, Object> e = leer(tmp, repo);
        assertEquals(Set.of("se docuemnta"), huerfanas(e));
        assertEquals(3, lista(e, "confirmaciones").size());
        assertEquals("se documenta la canción", lista(e, "confirmaciones").get(0).get("asunto"));
        Map<String, Object> etiqueta = lista(e, "etiquetas").get(0);
        assertEquals("v1.0", etiqueta.get("nombre"));
        assertEquals(head, etiqueta.get("id"));
        assertEquals(true, etiqueta.get("anotada"));
    }

    @Test
    void unResetDejaHuerfanas_yUnaRamaLasRecupera(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        for (String n : List.of("uno", "dos", "tres")) {
            Ayuda.escribir(repo.resolve(n + ".md"), n);
            Ayuda.confirmar(repo, n);
        }
        Ayuda.git(repo, "reset", "-q", "--hard", "HEAD~2");
        assertEquals(Set.of("dos", "tres"), huerfanas(leer(tmp, repo)));
        Ayuda.git(repo, "branch", "rescate", "HEAD@{1}");
        assertEquals(Set.of(), huerfanas(leer(tmp, repo)));
    }

    @Test
    void posicionDesconectada(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("a.md"), "a");
        Ayuda.confirmar(repo, "a");
        Ayuda.escribir(repo.resolve("b.md"), "b");
        Ayuda.confirmar(repo, "b");
        Ayuda.git(repo, "checkout", "-q", "HEAD~1");
        Map<String, Object> e = leer(tmp, repo);
        assertNull(e.get("rama"));
        assertEquals(Ayuda.git(repo, "rev-parse", "HEAD").strip(), e.get("head"));
    }

    @Test
    void unConflictoDeFusion(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("platos.md"), "cazuela\n");
        Ayuda.confirmar(repo, "base");
        Ayuda.git(repo, "switch", "-q", "-c", "otra");
        Ayuda.escribir(repo.resolve("platos.md"), "curanto\n");
        Ayuda.confirmar(repo, "en otra");
        Ayuda.git(repo, "switch", "-q", "main");
        Ayuda.escribir(repo.resolve("platos.md"), "pastel\n");
        Ayuda.confirmar(repo, "en main");
        try {
            Ayuda.git(repo, "merge", "otra");
        } catch (AssertionError esperado) {
            // La fusion choca, que es lo que se quiere.
        }
        Map<String, Object> e = leer(tmp, repo);
        assertEquals("fusion", e.get("operacion"));
        assertEquals(List.of("platos.md"), areas(e).get("conflicto"));
        assertEquals(2, lista(e, "ramas").size());
    }

    @Test
    void lasTresAreas_conTildesYRenombrado(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("recetario con ñ"));
        Ayuda.escribir(repo.resolve("canción.md"), "letra\nlarga\nde\nverdad\n");
        Ayuda.escribir(repo.resolve("platos.md"), "cazuela\n");
        Ayuda.confirmar(repo, "base");
        Ayuda.git(repo, "mv", "canción.md", "canción nueva.md");
        Ayuda.escribir(repo.resolve("platos.md"), "cazuela\ncuranto\n");
        Ayuda.escribir(repo.resolve("recetas/ñoquis.md"), "ñoquis\n");

        Map<String, Object> e = leer(tmp, repo);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> preparado = (List<Map<String, Object>>) areas(e).get("preparado");
        assertEquals("canción nueva.md", preparado.get(0).get("ruta"));
        assertEquals("R", preparado.get(0).get("tipo"));
        assertEquals("canción.md", preparado.get(0).get("origen"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> modificado = (List<Map<String, Object>>) areas(e).get("modificado");
        assertEquals("platos.md", modificado.get(0).get("ruta"));
        assertEquals(List.of("recetas/ñoquis.md"), areas(e).get("sinSeguimiento"));
    }

    @Test
    void elGuardadoTemporal_yLaBaseQueSoloElGuardadoAlcanza(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("a.md"), "a");
        Ayuda.confirmar(repo, "a");
        Ayuda.escribir(repo.resolve("a.md"), "b");
        Ayuda.git(repo, "stash", "push", "-q", "-m", "a medias");
        Map<String, Object> e = leer(tmp, repo);
        List<Map<String, Object>> guardados = lista(e, "guardados");
        assertEquals(1, guardados.size());
        assertTrue(((String) guardados.get(0).get("mensaje")).contains("a medias"));
        // El guardado no es una confirmacion del grafo.
        assertEquals(1, lista(e, "confirmaciones").size());
        assertFalse(huerfanas(e).contains("a medias"));
    }

    @Test
    void paradoDentroDeLaCarpetaGit(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("a.md"), "a");
        Ayuda.confirmar(repo, "a");
        Map<String, Object> e = leer(tmp, repo.resolve(".git"));
        assertEquals(true, e.get("repositorio"));
        assertEquals(true, e.get("dentroDeGit"));
        assertEquals(1, lista(e, "confirmaciones").size());
    }

    @Test
    void leerNoReescribeElIndice(@TempDir Path tmp) throws Exception {
        Path repo = Ayuda.repositorio(tmp.resolve("r"));
        Ayuda.escribir(repo.resolve("a.md"), "a");
        Ayuda.confirmar(repo, "a");
        // Se toca el archivo sin cambiarlo: un git status corriente refrescaria el indice.
        Files.setLastModifiedTime(repo.resolve("a.md"), java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() + 5000));
        long antes = Files.getLastModifiedTime(repo.resolve(".git/index")).toMillis();
        Thread.sleep(20);
        leer(tmp, repo);
        assertEquals(antes, Files.getLastModifiedTime(repo.resolve(".git/index")).toMillis());
    }
}

package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * preparar y verificar, con scripts de laboratorio de mentira que anotan cuando
 * y como se los llamo, y desde donde.
 */
class OrdenesPropiasTest {

    @TempDir
    Path tmp;

    private Path limite;
    private Path clon;
    private Path trabajo;
    private Path registro;
    private Taller taller;

    private void script(String lab, String nombre, int salida) throws Exception {
        Path s = clon.resolve("labs").resolve(lab).resolve(nombre);
        Files.createDirectories(s.getParent());
        String cuerpo = "#!/usr/bin/env bash\n"
                + "AQUI=$(cd \"$(dirname \"$0\")\" && pwd -P)\n"
                + "CLON=$(cd \"$AQUI/../..\" && pwd -P)\n"
                + "echo \"" + lab + " " + nombre + " [$*] en $(basename \"$PWD\")\" >> \"" + Rutas.conBarras(registro) + "\"\n"
                + (nombre.equals("preparar.sh") && salida == 0
                        ? "mkdir -p \"$(dirname \"$CLON\")/taller-git-trabajo/" + lab + "/recetario\"\n" : "")
                + "echo hecho\n"
                + "exit " + salida + "\n";
        Files.writeString(s, cuerpo, StandardCharsets.UTF_8);
        s.toFile().setExecutable(true);
    }

    @BeforeEach
    void preparar() throws Exception {
        limite = Files.createDirectories(tmp.resolve("José Pérez"));
        clon = Files.createDirectories(limite.resolve("curso-git-gitlab-sii"));
        trabajo = Files.createDirectories(limite.resolve("taller-git-trabajo"));
        registro = tmp.resolve("registro.txt");
        Files.createDirectories(clon.resolve("labs/lab-01"));
        Files.writeString(clon.resolve("labs/lab-01/verificar.sh"), "#!/usr/bin/env bash\necho verificado 01\n");
        clon.resolve("labs/lab-01/verificar.sh").toFile().setExecutable(true);
        script("lab-02", "preparar.sh", 0);
        script("lab-02", "verificar.sh", 0);
        script("lab-03", "preparar.sh", 1);
        Path propia = trabajo.resolve(".taller");
        var git = Ayuda.git();
        Ejecutor e = new Ejecutor(Ayuda.SISTEMA, git, limite, propia, 60_000).conEntornoExtra(Ayuda.aislado(limite));
        taller = new Taller(new Taller.Datos(Ayuda.SISTEMA, limite, clon, trabajo, propia, "ana", "equipo", List.of()), e,
                new LectorEstado(Ayuda.SISTEMA, git, propia));
    }

    private List<String> llamadas() throws Exception {
        return Files.exists(registro) ? Files.readAllLines(registro, StandardCharsets.UTF_8) : List.of();
    }

    private Ejecutor.Resultado orden(String texto) {
        return taller.ejecutar(texto).resultado();
    }

    @Test
    void prepararCorreElScriptDesdeElClon_yDejaLaConsolaEnElLaboratorio() throws Exception {
        Ejecutor.Resultado r = orden("preparar 2");
        assertEquals(0, r.codigo(), r.error());
        assertEquals(List.of("lab-02 preparar.sh [] en curso-git-gitlab-sii"), llamadas());
        assertEquals(Rutas.real(trabajo.resolve("lab-02/recetario")), taller.carpeta());
        assertTrue(r.avisos().get(r.avisos().size() - 1).contains("taller-git-trabajo/lab-02/recetario"), r.avisos().toString());
    }

    @Test
    void sobreUnLaboratorioYaPreparado_avisaYNoCorreNada() throws Exception {
        orden("preparar 02");
        Ejecutor.Resultado r = orden("preparar 02");
        assertEquals(1, llamadas().size(), "corrio el script sin --forzar");
        assertTrue(r.avisos().get(0).contains("preparar 02 --forzar"), r.avisos().toString());
        assertTrue(r.avisos().get(0).contains("no hay vuelta atrás"), r.avisos().toString());

        Ejecutor.Resultado forzado = orden("preparar 02 --forzar");
        assertEquals(0, forzado.codigo());
        assertEquals("lab-02 preparar.sh [--forzar] en curso-git-gitlab-sii", llamadas().get(1));
    }

    @Test
    void sinNumero_usaElLaboratorioDondeEstaLaConsola() throws Exception {
        orden("preparar 02");
        Path antes = taller.carpeta();
        Ejecutor.Resultado r = orden("verificar");
        assertEquals(0, r.codigo());
        assertEquals("lab-02 verificar.sh [] en curso-git-gitlab-sii", llamadas().get(1));
        assertEquals("hecho\n", r.salida());
        // verificar no mueve la consola.
        assertEquals(antes, taller.carpeta());
    }

    @Test
    void sinNumeroFueraDeUnLaboratorio_preguntaCual() throws Exception {
        Ejecutor.Resultado r = orden("verificar");
        assertTrue(r.avisos().get(0).contains("verificar 02"), r.avisos().toString());
        assertTrue(llamadas().isEmpty());
    }

    @Test
    void unLaboratorioSinPreparacion_oQueNoExiste() throws Exception {
        assertTrue(orden("preparar 01").avisos().get(0).contains("no tiene preparación"));
        assertTrue(orden("preparar 99").avisos().get(0).contains("No hay un laboratorio 99"));
        assertTrue(orden("preparar dos").avisos().get(0).contains("con su número"));
        assertEquals("verificado 01\n", orden("verificar 1").salida());
        assertTrue(llamadas().isEmpty());
    }

    @Test
    void siElScriptFalla_laConsolaNoSeMueve() throws Exception {
        Path antes = taller.carpeta();
        Ejecutor.Resultado r = orden("preparar 03");
        assertEquals(1, r.codigo());
        assertEquals(antes, taller.carpeta());
        assertFalse(r.avisos().stream().anyMatch(a -> a.contains("quedó en")));
    }

    @Test
    void lasOrdenesDeBashConElMismoPrincipioNoSonPropias() throws Exception {
        assertTrue(OrdenesPropias.planDe("preparar.sh", trabajo, clon, trabajo).isEmpty());
        assertTrue(OrdenesPropias.planDe("verificarlo", trabajo, clon, trabajo).isEmpty());
        assertTrue(OrdenesPropias.planDe("git status", trabajo, clon, trabajo).isEmpty());
    }
}

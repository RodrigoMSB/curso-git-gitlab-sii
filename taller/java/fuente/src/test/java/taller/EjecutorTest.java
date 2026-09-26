package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EjecutorTest {

    /** Un limite con espacio y tildes, como la carpeta personal de un participante. */
    private static Path limite(Path tmp) throws Exception {
        return Files.createDirectories(tmp.resolve("José Pérez").resolve("SII"));
    }

    private static Ejecutor ejecutor(Path tmp, Path limite, long ms) throws Exception {
        Ejecutor e = new Ejecutor(Ayuda.SISTEMA, Ayuda.git(), limite, limite.resolve("taller-git-trabajo/.taller"), ms);
        Map<String, String> aislado = new HashMap<>(Ayuda.aislado(tmp));
        return e.conEntornoExtra(aislado);
    }

    @Test
    void laCarpetaPersiste_yLasTildesPasanEnteras(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path trabajo = Files.createDirectories(limite.resolve("taller-git-trabajo"));
        Ejecutor e = ejecutor(tmp, limite, 60_000);

        Ejecutor.Resultado r = e.ejecutar("mkdir -p \"lab 01/señal\" && cd \"lab 01/señal\" && git init -q && echo \"canción\" > ñandú.md && git add . && git commit -qm \"señal ñ\" && git log --format=%s", trabajo);
        assertEquals(0, r.codigo(), r.error());
        assertEquals("señal ñ\n", r.salida());
        assertEquals(Rutas.real(trabajo.resolve("lab 01/señal")), r.carpeta());

        Ejecutor.Resultado ls = e.ejecutar("ls", r.carpeta());
        assertEquals("ñandú.md\n", ls.salida());
    }

    @Test
    void cdNoSaleDelLimite_nisiquieraConCadenas(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path trabajo = Files.createDirectories(limite.resolve("taller-git-trabajo"));
        Path fuera = Files.createDirectories(tmp.resolve("fuera"));
        Ejecutor e = ejecutor(tmp, limite, 60_000);

        Ejecutor.Resultado r = e.ejecutar("cd ../.. && touch no-deberia-existir", trabajo);
        assertEquals(1, r.codigo());
        assertEquals(Rutas.real(trabajo), r.carpeta());
        assertFalse(Files.exists(tmp.resolve("José Pérez/no-deberia-existir")));
        assertTrue(r.error().contains("no sale de"), r.error());

        Ejecutor.Resultado absoluta = e.ejecutar("cd \"" + Rutas.conBarras(fuera) + "\"", trabajo);
        assertEquals(Rutas.real(trabajo), absoluta.carpeta());

        // Dentro del limite si se mueve, incluido el limite mismo.
        Ejecutor.Resultado arriba = e.ejecutar("cd ..", trabajo);
        assertEquals(Rutas.real(limite), arriba.carpeta());
    }

    @Test
    void siBashTerminaFueraDelLimite_laConsolaSeQuedaDondeEstaba(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path trabajo = Files.createDirectories(limite.resolve("taller-git-trabajo"));
        Ejecutor e = ejecutor(tmp, limite, 60_000);
        // builtin cd salta la funcion del envoltorio: queda la segunda red.
        Ejecutor.Resultado r = e.ejecutar("builtin cd ../..", trabajo);
        assertEquals(Rutas.real(trabajo), r.carpeta());
        assertTrue(r.avisos().stream().anyMatch(a -> a.contains("no sale de")), r.avisos().toString());
    }

    @Test
    void laEntradaEstaCerrada(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Ejecutor e = ejecutor(tmp, limite, 20_000);
        long inicio = System.nanoTime();
        Ejecutor.Resultado r = e.ejecutar("read x; echo \"[$x] $?\"", limite);
        assertTrue((System.nanoTime() - inicio) / 1_000_000 < 10_000);
        assertEquals("[] 1\n", r.salida());
    }

    @Test
    void elLimiteDeTiempoMataElArbol(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Ejecutor e = ejecutor(tmp, limite, 1500);
        Path marca = limite.resolve("marca");
        long inicio = System.nanoTime();
        Ejecutor.Resultado r = e.ejecutar("(sleep 4; touch marca) & sleep 30", limite);
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        assertTrue(r.agotado());
        assertTrue(ms < 10_000, "tardo " + ms);
        assertTrue(r.avisos().get(0).contains("1 segundo") || r.avisos().get(0).contains("límite"), r.avisos().toString());
        Thread.sleep(4000);
        assertFalse(Files.exists(marca), "el hijo siguio vivo despues de matar la orden");
    }

    @Test
    void conEditor_laOrdenEsperaYTermina(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path repo = Ayuda.repositorio(limite.resolve("repo"));
        Path editor = limite.resolve("editor falso.sh");
        Files.writeString(editor, "#!/bin/sh\nsleep 2\nprintf 'escrito en el editor\\n' > \"$1\"\n", StandardCharsets.UTF_8);
        editor.toFile().setExecutable(true);
        Ejecutor e = ejecutor(tmp, limite, 60_000);
        String ruta = Ayuda.SISTEMA == Sistema.WINDOWS ? Rutas.aMsys(Rutas.conBarras(editor)) : Rutas.conBarras(editor);
        e.ejecutar("git config core.editor \"'" + ruta + "'\" && echo a > a.md && git add a.md", repo);
        Ejecutor.Resultado r = e.ejecutar("git commit", repo);
        assertEquals(0, r.codigo(), r.error());
        assertEquals("escrito en el editor\n", e.ejecutar("git log --format=%s", repo).salida());
    }

    @Test
    void sinEditor_terminaEnMenosDeCincoSegundosYDiceQueConfigurar(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path repo = Ayuda.repositorio(limite.resolve("repo"));
        Ejecutor e = ejecutor(tmp, limite, 60_000);
        e.ejecutar("git config core.editor \"code-que-no-existe --wait\" && echo a > a.md && git add a.md", repo);
        long inicio = System.nanoTime();
        Ejecutor.Resultado r = e.ejecutar("git commit", repo);
        long ms = (System.nanoTime() - inicio) / 1_000_000;
        assertTrue(ms < 5000, "tardo " + ms);
        assertTrue(r.codigo() != 0);
        assertTrue(r.avisos().stream().anyMatch(a -> a.contains("editor")), r.avisos().toString());

        // Sin editor configurado y con la terminal tonta, Git tampoco espera.
        e.ejecutar("git config --unset core.editor", repo);
        inicio = System.nanoTime();
        Ejecutor.Resultado r2 = e.ejecutar("git commit", repo);
        assertTrue((System.nanoTime() - inicio) / 1_000_000 < 5000);
        assertTrue(r2.codigo() != 0);
        assertTrue(r2.avisos().stream().anyMatch(a -> a.contains("editor")), r2.error() + r2.avisos());
    }

    @Test
    void lasOrdenesInteractivasLoDicen(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path repo = Ayuda.repositorio(limite.resolve("repo"));
        Ejecutor e = ejecutor(tmp, limite, 20_000);
        e.ejecutar("echo a > a.md && git add a.md && git commit -qm a && echo b >> a.md", repo);
        Ejecutor.Resultado r = e.ejecutar("git add -p", repo);
        assertTrue(r.avisos().stream().anyMatch(a -> a.contains("teclado")), r.avisos().toString());
        Ejecutor.Resultado normal = e.ejecutar("git add -A", repo);
        assertTrue(normal.avisos().isEmpty());
    }

    @Test
    void losErroresDeBashNoNombranArchivosDelTaller(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Ejecutor e = ejecutor(tmp, limite, 20_000);
        Ejecutor.Resultado r = e.ejecutar("cd no-existe", limite);
        assertEquals("bash: line 1: cd: no-existe: No such file or directory\n", r.error());
        Ejecutor.Resultado orden = e.ejecutar("orden-que-no-existe", limite);
        assertEquals("bash: line 1: orden-que-no-existe: command not found\n", orden.error());
        assertEquals(127, orden.codigo());
        // Un error de sintaxis ocurre dentro del eval del envoltorio, y tampoco se nota.
        Ejecutor.Resultado sintaxis = e.ejecutar("git reset --hard <identificador anterior>", limite);
        assertTrue(sintaxis.error().startsWith("bash: line 1: syntax error"), sintaxis.error());
    }

    @Test
    void losScriptsDeLaRaizSeLlamanPorSuNombre_yPuedenMoverLaConsola(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Path lab = Files.createDirectories(limite.resolve("lab-02").resolve("recetario"));
        // Un preparar de mentira en la raiz del taller, como el de verdad:
        // deja en TALLER_CD_DESPUES la carpeta a la que la consola tiene que ir.
        Path preparar = limite.resolve("preparar");
        Files.writeString(preparar, "#!/usr/bin/env bash\necho preparado $1\n"
                + "[ -n \"$TALLER_CD_DESPUES\" ] && printf '%s' \"$(cd \"$(dirname \"$0\")\" && pwd)/lab-$1/recetario\" > \"$TALLER_CD_DESPUES\"\n",
                StandardCharsets.UTF_8);
        preparar.toFile().setExecutable(true);
        Path otra = Files.createDirectories(limite.resolve("otra"));
        Ejecutor e = ejecutor(tmp, limite, 20_000);
        Ejecutor.Resultado r = e.ejecutar("preparar 02", otra);
        assertEquals("preparado 02\n", r.salida(), r.error());
        assertEquals(Rutas.real(lab), r.carpeta());

        // Un script que pide ir fuera del limite no lo consigue.
        Files.writeString(preparar, "#!/usr/bin/env bash\nprintf '%s' / > \"$TALLER_CD_DESPUES\"\n", StandardCharsets.UTF_8);
        Ejecutor.Resultado fuera = e.ejecutar("preparar 02", otra);
        assertEquals(Rutas.real(otra), fuera.carpeta());
    }

    @Test
    void salidaYErrorPorSeparado(@TempDir Path tmp) throws Exception {
        Path limite = limite(tmp);
        Ejecutor e = ejecutor(tmp, limite, 20_000);
        Ejecutor.Resultado r = e.ejecutar("echo afuera; echo adentro >&2; exit 3", limite);
        assertEquals("afuera\n", r.salida());
        assertEquals("adentro\n", r.error());
        assertEquals(3, r.codigo());
    }
}

package taller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class BuscadorGitTest {

    /** Un equipo inventado: variables, archivos que existen y valores del registro. */
    static final class Falso implements BuscadorGit.Entorno {
        final Map<String, String> variables = new HashMap<>();
        final Set<Path> archivos = new HashSet<>();
        final Map<String, String> registro = new HashMap<>();
        boolean apple = true;
        int consultasApple;

        @Override
        public String variable(String nombre) {
            return variables.get(nombre);
        }

        @Override
        public boolean esArchivo(Path ruta) {
            return archivos.contains(ruta);
        }

        @Override
        public String registro(String rama) {
            return registro.get(rama);
        }

        @Override
        public boolean herramientasDeApple() {
            consultasApple++;
            return apple;
        }

        void gitParaWindows(String raiz) {
            archivos.add(Path.of(BuscadorGit.unir(raiz, "bin", "bash.exe")));
            archivos.add(Path.of(BuscadorGit.unir(raiz, "cmd", "git.exe")));
        }
    }

    private static Optional<BuscadorGit.Instalacion> windows(Falso f) {
        return new BuscadorGit(Sistema.WINDOWS, f).buscar();
    }

    @Test
    void enWindowsManda_elRegistroDeLaMaquina() {
        Falso f = new Falso();
        f.registro.put("HKLM\\SOFTWARE\\GitForWindows", "D:\\Herramientas\\Git");
        f.gitParaWindows("D:\\Herramientas\\Git");
        f.gitParaWindows("C:\\Program Files\\Git");
        var i = windows(f).orElseThrow();
        assertEquals(Path.of(BuscadorGit.unir("D:\\Herramientas\\Git", "bin", "bash.exe")), i.bash());
        assertEquals(Path.of(BuscadorGit.unir("D:\\Herramientas\\Git", "cmd", "git.exe")), i.git());
        assertTrue(i.login());
    }

    @Test
    void enWindows_elRegistroDelUsuarioSiNoEstaElDeLaMaquina() {
        Falso f = new Falso();
        f.registro.put("HKCU\\SOFTWARE\\GitForWindows", "C:\\Users\\José Pérez\\AppData\\Local\\Programs\\Git");
        f.gitParaWindows("C:\\Users\\José Pérez\\AppData\\Local\\Programs\\Git");
        assertEquals("registro HKCU\\SOFTWARE\\GitForWindows", windows(f).orElseThrow().origen());
    }

    @Test
    void enWindows_unRegistroQueApuntaAUnaCarpetaVaciaNoSirve() {
        Falso f = new Falso();
        f.registro.put("HKLM\\SOFTWARE\\GitForWindows", "D:\\Borrado");
        f.gitParaWindows("C:\\Program Files\\Git");
        assertEquals("C:\\Program Files\\Git", windows(f).orElseThrow().origen());
    }

    @Test
    void enWindows_laInstalacionDelUsuarioEnLocalAppData() {
        Falso f = new Falso();
        f.variables.put("LOCALAPPDATA", "C:\\Users\\ana\\AppData\\Local");
        f.gitParaWindows("C:\\Users\\ana\\AppData\\Local\\Programs\\Git");
        assertEquals("LOCALAPPDATA", windows(f).orElseThrow().origen());
    }

    @Test
    void enWindows_unGitPortableEnTallerGit() {
        Falso f = new Falso();
        f.variables.put("TALLER_GIT", "E:\\PortableGit\\cmd\\git.exe");
        f.gitParaWindows("E:\\PortableGit");
        assertEquals("TALLER_GIT", windows(f).orElseThrow().origen());
    }

    @Test
    void enWindows_elPathVaAlFinal_ySubeHastaLaRaiz() {
        Falso f = new Falso();
        f.variables.put("PATH", "C:\\Windows;E:\\Otro Git\\cmd");
        f.archivos.add(Path.of(BuscadorGit.unir("E:\\Otro Git\\cmd", "git.exe")));
        f.gitParaWindows("E:\\Otro Git");
        var i = windows(f).orElseThrow();
        assertEquals("PATH", i.origen());
        assertEquals(Path.of(BuscadorGit.unir("E:\\Otro Git", "bin", "bash.exe")), i.bash());
    }

    @Test
    void enWindows_sinGitNoHayInstalacion() {
        assertTrue(windows(new Falso()).isEmpty());
    }

    @Test
    void enWindows_gitSinBashNoSirve() {
        Falso f = new Falso();
        f.archivos.add(Path.of(BuscadorGit.unir("C:\\Program Files\\Git", "cmd", "git.exe")));
        assertTrue(windows(f).isEmpty());
    }

    @Test
    void enMac_elGitDeAppleSoloSiEstanLasHerramientas() {
        Falso f = new Falso();
        f.archivos.add(Path.of("/usr/bin/git"));
        f.archivos.add(Path.of("/opt/homebrew/bin/git"));
        f.apple = false;
        var i = new BuscadorGit(Sistema.MAC, f).buscar().orElseThrow();
        assertEquals(Path.of("/opt/homebrew/bin/git"), i.git());
        assertEquals(Path.of("/bin/bash"), i.bash());
        assertFalse(i.login());

        f.apple = true;
        assertEquals(Path.of("/usr/bin/git"), new BuscadorGit(Sistema.MAC, f).buscar().orElseThrow().git());
    }

    @Test
    void enMac_sinHerramientasNiOtroGit_noSeTocaElDeApple() {
        Falso f = new Falso();
        f.archivos.add(Path.of("/usr/bin/git"));
        f.variables.put("PATH", "/usr/bin:/bin");
        f.apple = false;
        assertTrue(new BuscadorGit(Sistema.MAC, f).buscar().isEmpty());
    }

    @Test
    void elValorDelRegistroSaleDeLaSalidaDeReg() {
        String salida = """

                HKEY_LOCAL_MACHINE\\SOFTWARE\\GitForWindows
                    InstallPath    REG_SZ    C:\\Program Files\\Git

                """;
        assertEquals("C:\\Program Files\\Git", BuscadorGit.valorDeRegistro(salida));
        assertEquals(null, BuscadorGit.valorDeRegistro("ERROR: The system was unable to find the specified registry key"));
    }

    @Test
    void enEsteEquipoSeEncuentraGit() {
        var i = Ayuda.git();
        assertTrue(java.nio.file.Files.isRegularFile(i.git()), i.git().toString());
        assertTrue(java.nio.file.Files.isRegularFile(i.bash()), i.bash().toString());
    }
}

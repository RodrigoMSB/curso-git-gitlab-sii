package taller;

import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * El programa local del modo taller (SPEC 026).
 *
 * Sin argumentos arranca el taller. Con {@code --comprobar} corre la
 * comprobacion del primer dia. {@code --sin-navegador} no abre el navegador,
 * para las pruebas.
 */
public final class Principal {

    private Principal() {}

    public static void main(String[] args) throws Exception {
        List<String> a = Arrays.asList(args);
        boolean sinNavegador = a.contains("--sin-navegador") || "1".equals(System.getenv("TALLER_SIN_NAVEGADOR"));
        Sistema sistema = Sistema.actual();

        // La carpeta unica del SPEC 028: taller-git, con el clon adentro en
        // curso/ y el trabajo en taller-git/lab-NN. La consola parte en la raiz
        // y no sube de ahi.
        Path clon = ubicarClon();
        Path limite = clon.getParent();
        Path trabajo = limite;
        Path propia = limite.resolve(".taller");
        Files.createDirectories(propia);

        List<String> avisos = new ArrayList<>();
        Sincronizadas.servicio(clon, System::getenv).ifPresent(s -> avisos.add(Sincronizadas.aviso(s)));

        Optional<BuscadorGit.Instalacion> encontrada = new BuscadorGit(sistema, BuscadorGit.delEquipo()).buscar();
        if (encontrada.isEmpty()) {
            System.out.println();
            System.out.println("  No se encontró Git en este equipo.");
            if (sistema == Sistema.WINDOWS) {
                System.out.println("  Instala Git para Windows desde " + BuscadorGit.DESCARGA);
                System.out.println("  o define TALLER_GIT con la carpeta de un Git portable, y vuelve a abrir el taller.");
            } else {
                System.out.println("  En Mac, instala las herramientas de línea de comandos con xcode-select --install");
                System.out.println("  y vuelve a abrir el taller.");
            }
            System.out.println();
            System.exit(1);
            return;
        }
        BuscadorGit.Instalacion git = encontrada.get();

        if (a.contains("--comprobar")) {
            int codigo = new Comprobacion(sistema, git, clon, propia, avisos, sinNavegador).correr();
            System.exit(codigo);
            return;
        }

        // Lo que quedo abierto de la vez anterior se cierra antes de atender
        // (ver Rastro). Un gancho de cierre no servia: con CTRL_CLOSE_EVENT
        // la maquina virtual muere antes de correrlo.
        int terminados = Rastro.limpiar(propia);
        if (terminados > 0) {
            System.out.println("  Se cerraron " + terminados + " procesos que habían quedado abiertos de la vez anterior.");
            System.out.flush();
        }
        // En Windows, antes de lanzar ninguna orden, el motor entra en un objeto
        // de trabajo que termina todo lo que lanzo cuando el motor termina, de
        // cualquier forma (SPEC 030). Si no se puede, avisa y sigue: Rastro
        // cierra lo que quede al arrancar la vez siguiente.
        TrabajoWindows.crear();
        long tiempo = tiempoMaximo();
        Ejecutor ejecutor = new Ejecutor(sistema, git, limite, propia, tiempo).conClon(clon);
        LectorEstado lector = new LectorEstado(sistema, git, propia);
        Taller taller = new Taller(
                new Taller.Datos(sistema, limite, clon, trabajo, propia, usuario(), equipo(sistema), List.copyOf(avisos)),
                ejecutor, lector);
        taller.leer();

        Servidor servidor = new Servidor();
        Path pagina = clon.resolve("SIMULADOR.html");
        Paginas.registrar(servidor, taller, pagina);
        servidor.iniciar();

        ScheduledExecutorService vigilante = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "vigilante");
            t.setDaemon(true);
            return t;
        });
        vigilante.scheduleWithFixedDelay(() -> {
            try {
                taller.vigilar();
            } catch (RuntimeException e) {
                Registro.escribir("el vigilante tropezó, " + e);
            }
        }, 500, 500, TimeUnit.MILLISECONDS);

        System.out.println();
        System.out.println("  El taller está listo, con el motor de Java.");
        System.out.println("  Dirección: " + servidor.direccion());
        System.out.println("  No cierres esta ventana mientras trabajas.");
        System.out.println();
        System.out.flush();

        for (String aviso : avisos) {
            System.out.println("  ATENCIÓN. " + aviso);
            System.out.println();
        }
        System.out.flush();
        // El arrancador espera la direccion en este archivo para saber que el
        // motor respondio, y abrir el navegador el mismo. Va al final, cuando
        // todo lo demas ya esta dicho.
        String archivoDireccion = System.getenv("TALLER_ARCHIVO_DIRECCION");
        if (archivoDireccion != null && !archivoDireccion.isBlank()) {
            Files.writeString(Path.of(archivoDireccion), servidor.direccion() + "\n");
        }
        Registro.anotar(propia.resolve("registro.txt"),
                "Git en " + git.git() + ", bash en " + git.bash() + ", encontrado por " + git.origen());
        System.out.flush();

        if (!sinNavegador) Navegador.abrir(sistema, servidor.direccion());
        Thread.currentThread().join();
    }

    static long tiempoMaximo() {
        String valor = System.getProperty("taller.tiempo", System.getenv("TALLER_TIEMPO_MAXIMO"));
        if (valor != null) {
            try {
                long segundos = Long.parseLong(valor.trim());
                if (segundos > 0) return segundos * 1000;
            } catch (NumberFormatException ignorada) {
                // Un valor que no es numero deja el de omision.
            }
        }
        return 10 * 60 * 1000;
    }

    /**
     * La carpeta del clon. El jar vive en {@code curso/taller/java/taller.jar}, y
     * desde ahi se sube hasta la carpeta que tiene {@code SIMULADOR.html} y
     * {@code labs}. {@code -Dtaller.clon} la fija, para las pruebas.
     */
    static Path ubicarClon() throws URISyntaxException {
        String fija = System.getProperty("taller.clon");
        if (fija != null) return Rutas.real(Path.of(fija));
        Path desde = Rutas.real(Path.of(Principal.class.getProtectionDomain().getCodeSource().getLocation().toURI()));
        for (Path p = desde; p != null; p = p.getParent()) {
            if (Files.isRegularFile(p.resolve("SIMULADOR.html")) && Files.isDirectory(p.resolve("labs"))) return p;
        }
        throw new IllegalStateException("no se encontró la carpeta del clon desde " + desde);
    }

    static String usuario() {
        String u = System.getProperty("user.name");
        return u == null || u.isBlank() ? "participante" : u;
    }

    static String equipo(Sistema sistema) {
        Map<String, String> e = System.getenv();
        String nombre = sistema == Sistema.WINDOWS ? e.get("COMPUTERNAME") : e.get("HOSTNAME");
        if (nombre == null || nombre.isBlank()) nombre = sistema == Sistema.WINDOWS ? "TALLER" : "taller";
        int punto = nombre.indexOf('.');
        return punto > 0 ? nombre.substring(0, punto) : nombre;
    }
}

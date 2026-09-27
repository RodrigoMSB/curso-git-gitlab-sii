package taller;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * En Windows, que nada de lo que abren las ordenes sobreviva al motor.
 *
 * Apagado por omision: se enciende con TALLER_CUSTODIO=1 (ver Principal). Sin
 * el, lo que queda es el gancho de cierre del motor, en Java puro.
 *
 * Java lanza cada proceso con CREATE_NO_WINDOW, en una consola propia y
 * oculta: al cerrar la ventana de TALLER.cmd el motor recibe CTRL_CLOSE y
 * termina, pero un bash, un git o un sleep a medio correr no se enteran, y
 * quedaban vivos parados en la carpeta del laboratorio. Lo mismo si el motor
 * muere de golpe.
 *
 * Windows tiene para eso los objetos de trabajo marcados con
 * KILL_ON_JOB_CLOSE: al cerrarse su ultima manija, terminan todos sus
 * procesos. Java 21 no los alcanza sin codigo nativo, asi que el motor lanza al
 * arrancar un ayudante de PowerShell que crea el trabajo y mete en el al motor
 * mismo. Desde ahi todo lo que el motor lance nace dentro del trabajo. El
 * ayudante, lanzado antes, queda fuera: lee su entrada hasta que se cierra,
 * que es cuando el motor termina, de cualquier forma, y al salir se cierra la
 * manija y Windows termina el trabajo entero.
 *
 * El trabajo no permite salir de el (sin BREAKAWAY_OK): Git Bash lanza los
 * programas de Windows, git.exe entre ellos, pidiendo salir, y con permiso
 * salian y sobrevivian. La consecuencia es que un Visual Studio Code abierto
 * con code desde la consola del taller se cierra con el taller.
 *
 * Sumar cada orden despues de lanzarla no alcanzaba: el bash.exe de Git para
 * Windows es un lanzador que abre enseguida el bash de verdad, y ese nacia
 * fuera del trabajo antes de que llegara el numero. Lo vio la prueba del
 * cierre en la integracion continua.
 */
final class Custodio {

    private static final String GUION = """
            $ErrorActionPreference = 'Stop'
            Add-Type -TypeDefinition @'
            using System; using System.Runtime.InteropServices;
            public static class Custodio {
              [DllImport("kernel32.dll")] static extern IntPtr CreateJobObjectW(IntPtr a, IntPtr n);
              [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr j, int c, ref Extendida i, int l);
              [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr j, IntPtr p);
              [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a, bool i, int p);
              [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
              [StructLayout(LayoutKind.Sequential)] struct Basica { public long a; public long b; public int Limites; public UIntPtr c; public UIntPtr d; public int e; public UIntPtr f; public int g; public int h; }
              [StructLayout(LayoutKind.Sequential)] struct Contadores { public ulong a, b, c, d, e, f; }
              [StructLayout(LayoutKind.Sequential)] struct Extendida { public Basica B; public Contadores C; public UIntPtr p1, p2, p3, p4; }
              static IntPtr trabajo;
              public static bool Crear() {
                trabajo = CreateJobObjectW(IntPtr.Zero, IntPtr.Zero);
                if (trabajo == IntPtr.Zero) return false;
                var i = new Extendida();
                i.B.Limites = 0x2000;
                return SetInformationJobObject(trabajo, 9, ref i, Marshal.SizeOf(typeof(Extendida)));
              }
              public static bool Sumar(int pid) {
                IntPtr p = OpenProcess(0x0101, false, pid);
                if (p == IntPtr.Zero) return false;
                bool ok = AssignProcessToJobObject(trabajo, p);
                CloseHandle(p);
                return ok;
              }
            }
            '@
            if (-not [Custodio]::Crear()) { [Console]::Out.WriteLine('no'); exit 1 }
            [Console]::Out.WriteLine('listo')
            [Console]::Out.Flush()
            while ($null -ne ($linea = [Console]::In.ReadLine())) {
              [Console]::Out.WriteLine([string][Custodio]::Sumar([int]$linea))
              [Console]::Out.Flush()
            }
            """;

    private static final CountDownLatch LISTO = new CountDownLatch(1);
    private static Process ayudante;
    private static Writer escritor;
    private static BufferedReader lector;
    private static volatile boolean activo;
    private static volatile boolean pedido;
    private static final java.util.concurrent.atomic.AtomicBoolean AVISADO = new java.util.concurrent.atomic.AtomicBoolean();

    /**
     * Lo que se espera al ayudante, una sola vez, desde que el motor arranca.
     * Add-Type compila C# en el momento y en un equipo lento o con antivirus
     * puede tardar; si PowerShell esta bloqueado, no existe o se cuelga, el
     * taller sigue sin custodio.
     */
    static final long PLAZO_MS = 10_000;

    /** La linea de la ventana negra cuando el taller sigue sin custodio. */
    static final String AVISO =
            "  Aviso: no se pudo preparar el cierre ordenado con PowerShell. Al cerrar esta ventana pueden quedar procesos abiertos.";

    private Custodio() {}

    /** Lanza el ayudante sin esperarlo: Add-Type compila y tarda un par de segundos. */
    static synchronized void arrancar() {
        if (Sistema.actual() != Sistema.WINDOWS || ayudante != null) {
            LISTO.countDown();
            return;
        }
        pedido = true;
        String raiz = System.getenv().getOrDefault("SystemRoot", "C:\\Windows");
        Path powershell = Path.of(raiz, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
        String codificado = Base64.getEncoder().encodeToString(GUION.getBytes(StandardCharsets.UTF_16LE));
        // Pasado el plazo, se sigue sin custodio: las ordenes dejan de esperar.
        Thread plazo = new Thread(() -> {
            try {
                if (!LISTO.await(PLAZO_MS, TimeUnit.MILLISECONDS)) {
                    Registro.escribir("el custodio de procesos no respondio en " + PLAZO_MS / 1000 + " s");
                    sinCustodio();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "custodio-plazo");
        plazo.setDaemon(true);
        plazo.start();
        try {
            ayudante = Procesos.lanzarAyudante(List.of(powershell.toString(), "-NoLogo", "-NoProfile",
                    "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado));
            escritor = new OutputStreamWriter(ayudante.getOutputStream(), StandardCharsets.US_ASCII);
            lector = new BufferedReader(new InputStreamReader(ayudante.getInputStream(), StandardCharsets.US_ASCII));
        } catch (IOException | RuntimeException e) {
            Registro.escribir("no arranco el custodio de procesos: " + e);
            sinCustodio();
            return;
        }
        Thread espera = new Thread(() -> {
            try {
                if ("listo".equals(lector.readLine())) {
                    escritor.write(ProcessHandle.current().pid() + "\n");
                    escritor.flush();
                    activo = "True".equals(lector.readLine());
                }
                if (!activo) Registro.escribir("el custodio de procesos no pudo meter al motor en su trabajo");
            } catch (IOException | RuntimeException e) {
                Registro.escribir("el custodio de procesos no respondio: " + e);
            } finally {
                if (!activo) sinCustodio();
                LISTO.countDown();
            }
        }, "custodio");
        espera.setDaemon(true);
        espera.start();
    }

    /** Sigue sin custodio: las ordenes dejan de esperar y la ventana lo dice una vez. */
    private static void sinCustodio() {
        LISTO.countDown();
        if (activo || !AVISADO.compareAndSet(false, true)) return;
        System.out.println();
        System.out.println(AVISO);
        System.out.println();
        System.out.flush();
    }

    /**
     * Espera a que el motor este dentro del trabajo, hasta el plazo.
     * Las ordenes pasan por aqui antes de lanzarse. Sin custodio, porque no
     * es Windows o porque nadie lo arranco, como en la comprobacion del primer
     * dia, no espera.
     */
    static boolean esperar() {
        if (Sistema.actual() != Sistema.WINDOWS || !pedido) return false;
        try {
            return LISTO.await(PLAZO_MS, TimeUnit.MILLISECONDS) && activo;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}

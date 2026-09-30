package taller;

import static java.lang.foreign.ValueLayout.ADDRESS;
import static java.lang.foreign.ValueLayout.JAVA_INT;

import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.invoke.MethodHandle;

/**
 * En Windows, que nada de lo que abren las ordenes sobreviva al motor (SPEC 030).
 *
 * Java lanza cada proceso con CREATE_NO_WINDOW, en una consola propia y
 * oculta: al cerrar la ventana de TALLER.cmd el motor muere, pero un bash, un
 * git o un sleep a medio correr no se enteran. Un gancho de cierre no alcanza:
 * con CTRL_CLOSE_EVENT la maquina virtual muere antes de correrlo (seccion 74.8).
 *
 * Al arrancar, antes de lanzar ninguna orden, el motor crea un objeto de
 * trabajo marcado con KILL_ON_JOB_CLOSE y se mete adentro. Todo lo que lanza
 * despues nace dentro, y el trabajo no deja salir a nadie (Git Bash lanza
 * git.exe pidiendo salir, y con permiso salia: SPEC 028). La manija la tiene
 * solo este proceso y no se cierra nunca: cuando el motor termina, de cualquier
 * forma, Windows la cierra y termina el trabajo entero.
 *
 * Con la API de funciones nativas de Java 22 en adelante: sin lanzar ningun
 * otro programa, sin JNI y sin compilar nada en el momento. El Custodio del
 * SPEC 028 compilaba C# en cada arranque, y eso es lo que un EDR marca como
 * sospechoso.
 *
 * Si algo falla, el taller sigue sin trabajo, lo dice una vez en la ventana y
 * la limpieza al arrancar (Rastro) cierra lo que quede la vez siguiente.
 */
final class TrabajoWindows {

    /** La linea de la ventana cuando no hay cierre ordenado. */
    static final String AVISO = "  Aviso: no se pudo preparar el cierre ordenado. Al cerrar esta ventana pueden"
            + " quedar procesos abiertos, que se cierran al abrir el taller otra vez.";

    /** JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, y nada que permita salir del trabajo. */
    static final int KILL_ON_JOB_CLOSE = 0x2000;
    /** JobObjectExtendedLimitInformation. */
    static final int INFORMACION_EXTENDIDA = 9;
    /**
     * JOBOBJECT_EXTENDED_LIMIT_INFORMATION en 64 bits: la basica ocupa 64 bytes
     * (dos LARGE_INTEGER, LimitFlags en el desplazamiento 16 con su relleno, y
     * el resto de tamaños y banderas), los contadores de E/S 48 y los cuatro
     * SIZE_T de memoria 32.
     */
    static final long TAMANO_INFORMACION = 144;
    static final long DESPLAZAMIENTO_LIMITES = 16;

    /** La manija del trabajo. Vive lo que vive el motor, a proposito. */
    private static MemorySegment trabajo;

    private TrabajoWindows() {}

    /**
     * Crea el trabajo y mete al motor adentro. En Windows, si falla, avisa en la
     * ventana y devuelve false; fuera de Windows no hace nada.
     */
    static synchronized boolean crear() {
        if (Sistema.actual() != Sistema.WINDOWS || trabajo != null) return trabajo != null;
        // Para la prueba del caso en que falla (SPEC 030, 3.2): un tamaño que
        // Windows rechaza de verdad.
        long tamano = "1".equals(System.getenv("TALLER_PRUEBA_FALLA_TRABAJO")) ? 8 : TAMANO_INFORMACION;
        try {
            Linker linker = Linker.nativeLinker();
            SymbolLookup kernel32 = SymbolLookup.libraryLookup("kernel32", Arena.global());
            MethodHandle crearTrabajo = linker.downcallHandle(
                    kernel32.find("CreateJobObjectW").orElseThrow(),
                    FunctionDescriptor.of(ADDRESS, ADDRESS, ADDRESS));
            MethodHandle ponerLimites = linker.downcallHandle(
                    kernel32.find("SetInformationJobObject").orElseThrow(),
                    FunctionDescriptor.of(JAVA_INT, ADDRESS, JAVA_INT, ADDRESS, JAVA_INT));
            MethodHandle meter = linker.downcallHandle(
                    kernel32.find("AssignProcessToJobObject").orElseThrow(),
                    FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS));
            MethodHandle procesoActual = linker.downcallHandle(
                    kernel32.find("GetCurrentProcess").orElseThrow(),
                    FunctionDescriptor.of(ADDRESS));

            MemorySegment nuevo = (MemorySegment) crearTrabajo.invokeExact(MemorySegment.NULL, MemorySegment.NULL);
            if (nuevo.equals(MemorySegment.NULL)) return fallo("CreateJobObjectW");
            try (Arena arena = Arena.ofConfined()) {
                // La memoria de una arena llega en cero: solo se ponen los limites.
                MemorySegment informacion = arena.allocate(TAMANO_INFORMACION, 8);
                informacion.set(JAVA_INT, DESPLAZAMIENTO_LIMITES, KILL_ON_JOB_CLOSE);
                int puesto = (int) ponerLimites.invokeExact(nuevo, INFORMACION_EXTENDIDA, informacion, (int) tamano);
                if (puesto == 0) return fallo("SetInformationJobObject");
            }
            MemorySegment yo = (MemorySegment) procesoActual.invokeExact();
            int adentro = (int) meter.invokeExact(nuevo, yo);
            if (adentro == 0) return fallo("AssignProcessToJobObject");
            trabajo = nuevo;
            return true;
        } catch (Throwable e) {
            return fallo(e.toString());
        }
    }

    static synchronized boolean activo() {
        return trabajo != null;
    }

    private static boolean fallo(String donde) {
        Registro.escribir("no se pudo preparar el cierre ordenado: " + donde);
        System.out.println();
        System.out.println(AVISO);
        System.out.println();
        System.out.flush();
        return false;
    }
}

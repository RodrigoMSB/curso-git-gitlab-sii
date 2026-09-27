package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Lo que abrieron las ordenes, para cerrarlo en el arranque siguiente.
 *
 * En Windows, al cerrar la ventana del taller el motor muere, pero lo que
 * lanzaron sus ordenes vive en consolas propias y ocultas y sigue: un bash, un
 * git o un sleep a medio correr, parados en la carpeta del laboratorio, y el
 * siguiente arranque no la puede borrar. Un gancho de cierre no alcanza: con
 * CTRL_CLOSE_EVENT la maquina virtual muere antes de correrlo (lo midio la
 * prueba del cierre).
 *
 * Asi que el motor anota, en taller-git/.taller/procesos, el numero y la hora
 * de inicio de cada orden que lanza y de sus descendientes, con ProcessHandle,
 * sin lanzar nada. Al arrancar, antes de atender, termina los que sigan vivos
 * con el mismo numero y la misma hora de inicio, y vacia el archivo. La hora
 * es la que impide terminar un proceso ajeno que reutilizo el numero.
 */
final class Rastro {

    /** Cada cuanto se miran los descendientes de una orden que corre. */
    private static final long CADA_MS = 500;

    private static Path archivo;
    private static final Map<Long, String> ANOTADOS = new LinkedHashMap<>();

    private Rastro() {}

    /**
     * Termina lo que quedo de la vez anterior y deja el archivo vacio.
     * Devuelve cuantos procesos termino.
     */
    static synchronized int limpiar(Path propia) {
        archivo = propia.resolve("procesos");
        ANOTADOS.clear();
        int terminados = 0;
        List<String> lineas;
        try {
            lineas = Files.exists(archivo) ? Files.readAllLines(archivo, StandardCharsets.UTF_8) : List.of();
        } catch (IOException e) {
            Registro.escribir("no se pudo leer " + archivo + ": " + e);
            lineas = List.of();
        }
        for (String linea : lineas) {
            String[] partes = linea.trim().split(" ", 2);
            if (partes.length < 2) continue;
            long pid;
            try {
                pid = Long.parseLong(partes[0]);
            } catch (NumberFormatException e) {
                continue;
            }
            Optional<ProcessHandle> proceso = ProcessHandle.of(pid);
            if (proceso.isEmpty() || !proceso.get().isAlive() || !partes[1].equals(inicio(proceso.get()))) continue;
            // Tambien lo que ese proceso haya lanzado despues de la ultima mirada.
            for (ProcessHandle hijo : proceso.get().descendants().toList()) {
                if (hijo.destroyForcibly()) terminados++;
            }
            if (proceso.get().destroyForcibly()) terminados++;
        }
        escribir();
        return terminados;
    }

    /**
     * Anota una orden recien lanzada y, mientras corre, a sus descendientes.
     * Al terminar deja en el archivo solo lo que siga vivo.
     */
    static void seguir(Process orden) {
        if (archivo == null) return;
        anotar(List.of(orden.toHandle()));
        Thread mirada = new Thread(() -> {
            try {
                while (orden.isAlive()) {
                    anotar(orden.toHandle().descendants().toList());
                    if (orden.waitFor(CADA_MS, java.util.concurrent.TimeUnit.MILLISECONDS)) break;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            quitarMuertos();
        }, "rastro");
        mirada.setDaemon(true);
        mirada.start();
    }

    private static String inicio(ProcessHandle p) {
        return p.info().startInstant().map(Instant::toString).orElse(null);
    }

    private static synchronized void anotar(List<ProcessHandle> procesos) {
        boolean nuevos = false;
        for (ProcessHandle p : procesos) {
            String inicio = inicio(p);
            if (inicio != null && ANOTADOS.putIfAbsent(p.pid(), inicio) == null) nuevos = true;
        }
        if (nuevos) escribir();
    }

    private static synchronized void quitarMuertos() {
        ANOTADOS.entrySet().removeIf(e -> {
            Optional<ProcessHandle> p = ProcessHandle.of(e.getKey());
            return p.isEmpty() || !p.get().isAlive() || !e.getValue().equals(inicio(p.get()));
        });
        escribir();
    }

    private static void escribir() {
        if (archivo == null) return;
        List<String> lineas = new ArrayList<>();
        ANOTADOS.forEach((pid, inicio) -> lineas.add(pid + " " + inicio));
        try {
            Path temporal = archivo.resolveSibling("procesos.nuevo");
            Files.write(temporal, lineas, StandardCharsets.UTF_8);
            Files.move(temporal, archivo, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            Registro.escribir("no se pudo anotar los procesos en " + archivo + ": " + e);
        }
    }
}

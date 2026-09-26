package taller;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/** Lo que el programa cuenta en la ventana del terminal. Nunca en archivos (punto 3.8). */
public final class Registro {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private Registro() {}

    public static synchronized void escribir(String texto) {
        System.out.println("  " + LocalTime.now().format(HORA) + "  " + texto);
        System.out.flush();
    }
}

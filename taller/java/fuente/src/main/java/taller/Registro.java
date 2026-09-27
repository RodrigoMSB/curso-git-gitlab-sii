package taller;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * Lo que el programa cuenta en la ventana del terminal (punto 3.8). La unica
 * excepcion es lo tecnico que al participante no le dice nada, como la ruta de
 * Git y la clave del registro de Windows donde se encontro: va a
 * taller-git/.taller/registro.txt (SPEC 029).
 */
public final class Registro {

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private Registro() {}

    /** Al archivo de registro, no a la ventana. Si no se puede escribir, se pierde sin mas. */
    public static synchronized void anotar(java.nio.file.Path archivo, String texto) {
        try {
            java.nio.file.Files.writeString(archivo,
                    java.time.LocalDateTime.now().withNano(0) + "  " + texto + System.lineSeparator(),
                    java.nio.charset.StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        } catch (java.io.IOException ignorada) {
            // El registro es ayuda para el relator; sin el, el taller sigue.
        }
    }

    public static synchronized void escribir(String texto) {
        System.out.println("  " + LocalTime.now().format(HORA) + "  " + texto);
        System.out.flush();
    }
}

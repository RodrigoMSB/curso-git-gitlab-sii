package taller;

import java.io.IOException;
import java.util.List;

/** Abre la direccion en el navegador predeterminado del equipo. */
final class Navegador {

    private Navegador() {}

    static void abrir(Sistema sistema, String direccion) {
        // En Windows no se usa cmd /c start: el & de una direccion con varios
        // parametros lo corta. rundll32 la recibe entera.
        List<String> orden = switch (sistema) {
            case WINDOWS -> List.of("rundll32", "url.dll,FileProtocolHandler", direccion);
            case MAC -> List.of("/usr/bin/open", direccion);
            case OTRO -> List.of("xdg-open", direccion);
        };
        try {
            Procesos.soltar(orden);
        } catch (IOException e) {
            Registro.escribir("no se pudo abrir el navegador, abre tú la dirección de arriba");
        }
    }
}

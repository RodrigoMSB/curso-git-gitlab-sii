package taller;

import java.util.Locale;

/** El sistema operativo en que corre el programa. Solo dos importan al taller. */
public enum Sistema {
    WINDOWS,
    MAC,
    OTRO;

    public static Sistema actual() {
        return de(System.getProperty("os.name", ""));
    }

    static Sistema de(String nombre) {
        String minusculas = nombre.toLowerCase(Locale.ROOT);
        if (minusculas.startsWith("windows")) return WINDOWS;
        if (minusculas.startsWith("mac")) return MAC;
        return OTRO;
    }
}

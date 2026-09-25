/**
 * Como se le piden archivos al repositorio real (SPEC 020).
 *
 * El lector no sabe de donde vienen: en el navegador salen de la carpeta que el
 * alumno eligio, con la API de acceso a archivos, y en las pruebas salen del
 * disco con Node. Las rutas son relativas a la carpeta del repositorio, la que
 * contiene `.git`.
 *
 * **No hay forma de escribir.** El adaptador solo lee y lista, y en el
 * navegador la carpeta se abre en modo lectura: la pagina nunca toca el
 * repositorio del alumno (punto 1.3).
 */

export interface EntradaDirectorio {
  readonly nombre: string;
  readonly esDirectorio: boolean;
}

export interface EntradaConDatos extends EntradaDirectorio {
  /** Null en una carpeta, o si el archivo desaparecio mientras se listaba. */
  readonly datos: DatosArchivo | null;
}

export interface DatosArchivo {
  readonly tamano: number;
  /** Milisegundos desde la epoca, con la precision que dé el sistema. */
  readonly modificado: number;
}

export interface Adaptador {
  /** El contenido del archivo, o `null` si no existe. */
  leer(ruta: readonly string[]): Promise<Uint8Array | null>;
  /** Lo que hay en la carpeta, o `null` si no existe. */
  listar(ruta: readonly string[]): Promise<readonly EntradaDirectorio[] | null>;
  /**
   * Tamaño y fecha de modificacion, o `null` si no existe. Sirven para mirar
   * sin volver a leerlo todo (punto 2.7) y para comparar un archivo del disco
   * con lo que Git anoto en el indice sin calcular su huella.
   */
  datos(ruta: readonly string[]): Promise<DatosArchivo | null>;
  /**
   * Lo que hay en la carpeta, con el tamaño y la fecha de cada archivo, o
   * `null` si no existe. Es lo que el vigia pide en cada vuelta: en el
   * navegador, pedir los datos de un archivo por su ruta obliga a bajar desde
   * la raiz, y listando se obtienen de una vez (SPEC 024, CA5).
   */
  listarConDatos(ruta: readonly string[]): Promise<readonly EntradaConDatos[] | null>;
  /**
   * Si la carpeta elegida se puede seguir leyendo (SPEC 024, 5.1). Sin esto,
   * una carpeta borrada o un permiso retirado se verian como una carpeta vacia.
   */
  acceso(): Promise<Acceso>;
}

export type Acceso = 'ok' | 'no-existe' | 'sin-permiso';

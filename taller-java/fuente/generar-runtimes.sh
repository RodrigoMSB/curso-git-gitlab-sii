#!/usr/bin/env bash
# Genera los dos runtimes de Java que viajan en el clon (punto 6.2 del SPEC 026).
#
#     taller-java/fuente/generar-runtimes.sh
#
# Deja taller-java/jre/windows-x64 y taller-java/jre/macos-aarch64, recortados
# con jlink a partir de los jmods de Eclipse Temurin 21. jlink arma un runtime
# para otra plataforma si recibe los jmods de esa plataforma, asi que los dos
# salen de una sola maquina: el jlink es el del JDK de esta maquina, de la
# misma version exacta, y los jmods son los de cada destino.
#
# Las versiones y las sumas SHA-256 van fijas aqui. Si una descarga no coincide
# con su suma, el script se detiene. Los runtimes se confirman una sola vez;
# regenerarlos solo hace falta para cambiar de version de Java.
#
# Corre en macOS con chip de Apple o en Linux x64. Necesita curl, tar, unzip y
# shasum o sha256sum.

set -euo pipefail

VERSION='21.0.12.1+1'
BASE='https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1'

MAC_ARCHIVO='OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz'
MAC_SUMA='3623232f33a9c3baadf304480b2535f9a3cba8a58d42ecbb438ba267315d9998'
WIN_ARCHIVO='OpenJDK21U-jdk_x64_windows_hotspot_21.0.12.1_1.zip'
WIN_SUMA='f9d6e191ab098c0d416e7d588a24420a8621cd2f4720dab2459b8b7b2d2d8b4e'
LINUX_ARCHIVO='OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
LINUX_SUMA='ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94'

# Los modulos que el programa usa de verdad. Salen de
#     jdeps --print-module-deps --ignore-missing-deps taller-java/taller.jar
# y el script lo vuelve a comprobar antes de recortar.
MODULOS='java.base,jdk.httpserver'

AQUI=$(cd "$(dirname "$0")" && pwd -P)
TALLER=$(cd "$AQUI/.." && pwd -P)
CACHE="${TALLER_CACHE_JDK:-$HOME/.cache/taller-java-jdk}"
mkdir -p "$CACHE"

sha256() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else sha256sum "$1" | awk '{print $1}'; fi
}

bajar() {
  local archivo=$1 suma=$2
  if [ ! -f "$CACHE/$archivo" ]; then
    echo "  bajando $archivo"
    curl -fsSL -o "$CACHE/$archivo.parcial" "$BASE/$archivo"
    mv "$CACHE/$archivo.parcial" "$CACHE/$archivo"
  fi
  local obtenida
  obtenida=$(sha256 "$CACHE/$archivo")
  if [ "$obtenida" != "$suma" ]; then
    echo "  la suma de $archivo no coincide: se esperaba $suma y salio $obtenida" >&2
    exit 1
  fi
}

extraer() {
  local archivo=$1 destino=$2
  rm -rf "$destino"
  mkdir -p "$destino"
  case $archivo in
    *.zip) unzip -q "$CACHE/$archivo" -d "$destino" ;;
    *) tar xzf "$CACHE/$archivo" -C "$destino" ;;
  esac
}

TRABAJO=$(mktemp -d)
trap 'rm -rf "$TRABAJO"' EXIT

bajar "$MAC_ARCHIVO" "$MAC_SUMA"
bajar "$WIN_ARCHIVO" "$WIN_SUMA"
extraer "$MAC_ARCHIVO" "$TRABAJO/mac"
extraer "$WIN_ARCHIVO" "$TRABAJO/win"
MAC_JMODS="$TRABAJO/mac/jdk-$VERSION/Contents/Home/jmods"
WIN_JMODS="$TRABAJO/win/jdk-$VERSION/jmods"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ANFITRION="$TRABAJO/mac/jdk-$VERSION/Contents/Home" ;;
  Linux-x86_64)
    bajar "$LINUX_ARCHIVO" "$LINUX_SUMA"
    extraer "$LINUX_ARCHIVO" "$TRABAJO/linux"
    ANFITRION="$TRABAJO/linux/jdk-$VERSION"
    ;;
  *) echo "  este script corre en macOS con chip de Apple o en Linux x64" >&2; exit 1 ;;
esac

DEPS=$("$ANFITRION/bin/jdeps" --print-module-deps --ignore-missing-deps "$TALLER/taller.jar")
if [ "$DEPS" != "$MODULOS" ]; then
  echo "  jdeps dice que el programa usa $DEPS, y aqui se recortan $MODULOS. Actualiza MODULOS." >&2
  exit 1
fi

recortar() {
  local jmods=$1 destino=$2
  rm -rf "$destino"
  "$ANFITRION/bin/jlink" \
    --module-path "$jmods" \
    --add-modules "$MODULOS" \
    --strip-debug --no-header-files --no-man-pages --compress zip-6 \
    --output "$destino"
  echo "  $(du -sh "$destino" | awk '{print $1}')  $destino"
}

recortar "$WIN_JMODS" "$TALLER/jre/windows-x64"
recortar "$MAC_JMODS" "$TALLER/jre/macos-aarch64"

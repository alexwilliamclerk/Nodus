#!/usr/bin/env bash
set -euo pipefail

repo='alexwilliamclerk/Nodus'
version_less(){
  local a b c d e f
  IFS=. read -r a b c <<< "$1"
  IFS=. read -r d e f <<< "$2"
  (( 10#$a < 10#$d || (10#$a == 10#$d && (10#$b < 10#$e || (10#$b == 10#$e && 10#$c < 10#$f))) ))
}
install_dir="${NODUS_INSTALL_DIR:-$HOME/.local/bin}"
latest_url="https://github.com/$repo/releases/latest"
tag="$(curl -fsSL -o /dev/null -w '%{url_effective}' "$latest_url" | sed 's#.*/##')"
if [[ ! "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'Could not identify a stable Nodus release.' >&2
  exit 1
fi

name="Nodus-$tag-Linux-x86_64.AppImage"
url="https://github.com/$repo/releases/download/$tag/$name"
mkdir -p "$install_dir"
partial="$(mktemp "$install_dir/.Nodus-download.XXXXXXXX")"
sums="$(mktemp "$install_dir/.Nodus-checksums.XXXXXXXX")"
trap 'rm -f -- "$partial" "$sums"' EXIT
download_name="$name"
if ! curl -fL --retry 3 "$url" -o "$partial"; then
  download_name='Nodus-linux-x64.AppImage'
  curl -fL --retry 3 "https://github.com/$repo/releases/download/$tag/$download_name" -o "$partial"
fi
curl -fL --retry 3 "https://github.com/$repo/releases/download/$tag/SHA256SUMS.txt" -o "$sums"
expected="$(awk -v file="$download_name" '$2 == file {print $1; exit}' "$sums" | tr 'A-F' 'a-f')"
if [[ ! "$expected" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo 'Release checksum for this AppImage is missing.' >&2
  exit 1
fi
actual="$(sha256sum "$partial" | awk '{print $1}')"
if [[ "$actual" != "$expected" ]]; then
  echo 'AppImage checksum mismatch; the previous version was kept.' >&2
  exit 1
fi

target="$install_dir/$name"
chmod 755 "$partial"
mv -f -- "$partial" "$target"
echo "Installed $target"
echo 'The new app will open now. Close it when you are ready to review older program files.'
"$target"

for old in "$install_dir"/Nodus-v*-Linux-x86_64.AppImage "$install_dir"/Nodus.AppImage "$install_dir"/Nodus-linux-x64.AppImage; do
  [[ -f "$old" && ! -L "$old" && "$old" != "$target" ]] || continue
  if [[ "$(basename "$old")" =~ ^Nodus-v([0-9]+\.[0-9]+\.[0-9]+)-Linux-x86_64\.AppImage$ ]]; then
    old_version="${BASH_REMATCH[1]}"
    version_less "$old_version" "${tag#v}" || continue
  fi
  printf 'Remove old program file %s? [y/N] ' "$(basename "$old")"
  IFS= read -r answer || answer=''
  if [[ "$answer" == 'y' || "$answer" == 'Y' ]]; then
    if command -v gio >/dev/null 2>&1; then gio trash "$old" || rm -f -- "$old"; else rm -f -- "$old"; fi
    echo "Removed $(basename "$old"); Nodus task data was not touched."
  fi
done

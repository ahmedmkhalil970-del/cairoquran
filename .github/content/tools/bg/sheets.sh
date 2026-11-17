#!/usr/bin/env bash
set -u
cd .github/content/tools/bg/out && mkdir -p t sheets
while IFS=$'\t' read -r id url label; do
  code=$(curl -sSL -A 'CairoQuranContent/1.0 (+https://cairoquran.com)' -m 30 -o "t/$id.jpg" -w '%{http_code}' "$url"); [ "$code" = 200 ] || { rm -f "t/$id.jpg"; sleep 2; continue; }
  convert "t/$id.jpg" -resize 330x200^ -gravity center -extent 330x200 -fill white -undercolor '#000a' -pointsize 18 -gravity northwest -annotate +4+4 "$label" "t/$id.jpg" 2>/dev/null || rm -f "t/$id.jpg"
  sleep 0.2
done < thumbs.tsv
ls t/*.jpg | split -l 36 - grp_
for g in grp_*; do montage $(cat $g) -tile 4x -geometry 330x200+3+3 -background '#222' "sheets/${g#grp_}.jpg"; done
rm -rf t grp_*; ls sheets

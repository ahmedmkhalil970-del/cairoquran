#!/usr/bin/env bash
# Downloads 400px thumbnails and builds labeled contact sheets (12 places, up to 36 images per sheet).
set -u
cd .github/landmarks/out && mkdir -p t sheets
UA='CairoQuranLandmarks/1.0 (+https://cairoquran.com)'
while IFS=$'\t' read -r id url label; do
  code=$(curl -sSL -A "$UA" -m 30 -o "t/$id.jpg" -w '%{http_code}' "$url"); [ "$code" = 200 ] || { echo "thumb $code $id"; rm -f "t/$id.jpg"; sleep 2; continue; }
  convert "t/$id.jpg" -resize 330x215^ -gravity center -extent 330x215 -fill white -undercolor '#000a' -pointsize 17 -gravity northwest -annotate +4+4 "$label" "t/$id.jpg" 2>/dev/null || rm -f "t/$id.jpg"
  sleep 0.2
done < thumbs.tsv
for g in $(ls t | cut -c1-3 | sort -u | awk '{print int(($1-1)/12)}' | sort -nu); do
  files=$(ls t/*.jpg | awk -F/ -v g=$g '{n=substr($2,1,3)+0; if (int((n-1)/12)==g) print $0}')
  montage $files -tile 3x -geometry 330x215+3+3 -background '#222' "sheets/sheet-$(printf %02d $((g+1))).jpg"
done
rm -rf t
ls -l sheets

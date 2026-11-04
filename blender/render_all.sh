#!/bin/sh
# Renders every film into assets/seq. Run from the site root: sh blender/render_all.sh
B=/Applications/Blender.app/Contents/MacOS/Blender
Q=${Q:-draft}
$B -b --factory-startup -P blender/scenes.py -- --scene gift --out assets/seq/gift --quality $Q --res 1440x810 > /tmp/nini_gift.log 2>&1
$B -b --factory-startup -P blender/scenes.py -- --scene cake --out assets/seq/cake --quality $Q --res 1440x810 > /tmp/nini_cake.log 2>&1
$B -b --factory-startup -P blender/scenes.py -- --scene cake --flames off --range 72-72 --out assets/seq/cake_off --quality $Q --res 1440x810 > /tmp/nini_off.log 2>&1
echo done

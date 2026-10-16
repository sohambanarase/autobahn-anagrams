"""Builds index.html (for Vercel) and dist/autobahn-anagrams-single.html (one self-contained file)."""
import os
src=open('_head.html').read()
i=src.index('<div id="app">')
head,body=src[:i],src[i:]
base='<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}*,*::before,*::after{box-sizing:inherit}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
deploy=('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
 '<meta name="theme-color" content="#0e1115">\n<meta name="description" content="Road-trip word game: unscramble German license plates with friends.">\n'
 +base+head+'</head>\n<body>\n'+body+
 '<script src="config.js"></script>\n'
 '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2"></script>\n'
 '<script src="words.js"></script>\n<script src="game.js"></script>\n</body>\n</html>\n')
open('index.html','w').write(deploy)
os.makedirs('dist',exist_ok=True)
single=head+body+'<script>\n'+open('config.js').read()+'\n</script>\n<script>\n'+open('words.js').read()+'\n</script>\n<script>\n'+open('game.js').read()+'\n</script>\n'
open('dist/autobahn-anagrams-single.html','w').write(single)
print(len(deploy),len(single))

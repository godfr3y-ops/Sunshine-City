import {build} from 'esbuild'; import fs from 'fs';
fs.mkdirSync('dist', { recursive: true });
await build({entryPoints:['src/game.js'],bundle:true,minify:true,format:'iife',outfile:'dist/bundle.js',target:'es2019',legalComments:'none'});
let js=fs.readFileSync('dist/bundle.js','utf8').replace(/<\/script/gi,'<\\/script');
const html=fs.readFileSync('src/index.html','utf8').replace('/*BUNDLE*/',()=>js);
fs.writeFileSync('dist/index.html',html);
console.log('built',(html.length/1024|0)+'KB');

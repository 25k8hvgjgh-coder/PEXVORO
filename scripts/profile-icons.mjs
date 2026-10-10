import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));const sharp=require('sharp');
const paths={
 pencil:'<path d="m16 3 5 5M4 16 12 8 7-7 5 5-7 7-8 8-6 1z"/>',
 footprints:'<ellipse cx="7" cy="8" rx="3" ry="6" transform="rotate(-12 7 8)"/><ellipse cx="17" cy="13" rx="3" ry="6" transform="rotate(12 17 13)"/><path d="m5 16 1 4h4l1-3m3 2-1 3h4l2-3"/>',
 adduser:'<circle cx="9" cy="6" r="4"/><path d="M2 21v-3a7 7 0 0 1 12-5m4-3v10m-5-5h10"/>',
 menu:'<path d="M3 5h18M3 12h18M3 19h18"/>',
 grid:'<path d="M4 3v6m0 6v6M10 3v6m0 6v6M16 3v6m0 6v6"/><path d="m19 10 3 3-3 3"/>',
 photos:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 5"/>',
 lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
 repost:'<path d="M4 15V5h13m-4-4 4 4-4 4m7 0v10H7m4-4-4 4 4 4"/>',
 bookmark:'<path d="M6 3h12v19l-6-5-6 5z"/>',
 heart:'<path d="M12 21 3 12C-3 5 6-2 12 5c6-7 15 0 9 7z"/>',
 home:'<path d="m2 11 10-9 10 9M5 9v13h5v-8h4v8h5V9"/>',
 users:'<circle cx="9" cy="6" r="4"/><path d="M2 21v-4a7 7 0 0 1 14 0v4zM17 3a4 4 0 0 1 0 8m2 3a5 5 0 0 1 3 5v2h-3"/>',
 inbox:'<path d="M5 3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-6l-6 4v-4H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM7 8h10M7 13h6"/>',
 user:'<circle cx="12" cy="6" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/>',
 plus:'<path d="M12 4v16M4 12h16"/>'
};
const folder=new URL('../mobile/assets/profile-icons/',import.meta.url);await mkdir(folder,{recursive:true});
for(const [name,body] of Object.entries(paths)){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="-1 -1 26 26"><g fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;await sharp(Buffer.from(svg)).png().toFile(new URL(name+'.png',folder).pathname)}

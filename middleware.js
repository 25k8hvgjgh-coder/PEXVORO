// ReconFeed access policy: process the request before static CDN content,
// application files and /api functions are served. Vercel supplies this
// geolocation header at its trusted ingress; never use browser locale, an
// account field or a client-submitted country as an authorization signal.
// Requests without a recognized US country are denied (fail closed).
export const config={matcher:'/(.*)'};
export default function middleware(request){
 const country=request.headers.get('x-vercel-ip-country');
 if(country!=='US'){
  const isApi=new URL(request.url).pathname.startsWith('/api/');
  return new Response(isApi?JSON.stringify({error:'ReconFeed is available only in the United States.'}):'ReconFeed is currently available only to visitors in the United States.',{
   status:403,
   headers:{
    'Content-Type':isApi?'application/json; charset=utf-8':'text/plain; charset=utf-8',
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer'
   }
  });
 }
 // Returning undefined lets Vercel serve the original website or API.
 return undefined;
}

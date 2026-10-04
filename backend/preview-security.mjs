// A generated preview is executable, untrusted content. It cannot make network
// requests or open an external browser. Exported files run outside this boundary.
export const previewContentPolicy="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
export function previewRequestAllowed(details,previewOrigin){
  const url=details.url||'';
  if(url.startsWith('file:'))return details.resourceType!=='subFrame';
  if(url.startsWith('data:')||url.startsWith('blob:'))return !['mainFrame','subFrame'].includes(details.resourceType);
  try{return new URL(url).origin===previewOrigin;}catch{return false;}
}
export function installPreviewNetworkBoundary(contents,previewOrigin){
  contents.setWindowOpenHandler(()=>({action:'deny'}));
  contents.on('will-navigate',event=>event.preventDefault());
  contents.on('will-frame-navigate',(event,details)=>{
    const url=details?.url||event.url;
    try{if(new URL(url).origin!==previewOrigin)event.preventDefault();}catch{event.preventDefault();}
  });
  contents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!previewRequestAllowed(details,previewOrigin)}));
}

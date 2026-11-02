import { serializeWorkoutFile, workoutFileName } from './workout-file.js';

// This app copies ES modules without a bundler. Capacitor injects Plugins into the
// Android WebView at runtime; do not use unresolved bare package imports here.
function nativeSharing(win) {
  const plugins = win.Capacitor?.Plugins;
  return plugins?.Filesystem && plugins?.Share ? plugins : null;
}
function utf8Base64(value) {
  const bytes=new TextEncoder().encode(value);
  let binary='';
  for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
// The system share sheet (Android Sharesheet: Telegram, WhatsApp, mail, Drive…) with one file the user sends.
export async function shareFile({data, name, title}, {win = window, nav = navigator, doc = document} = {}) {
  const plugins=nativeSharing(win);
  if (plugins) {
    const path='fight-tech-' + Date.now() + '-' + name;
    // Android Share's FileProvider exposes cache files without storage permissions.
    await plugins.Filesystem.writeFile({path,data:utf8Base64(data),directory:'CACHE'});
    const {uri}=await plugins.Filesystem.getUri({path,directory:'CACHE'});
    await plugins.Share.share({title,dialogTitle:'Fight Tech',files:[uri]});
    return 'shared';
  }
  if (win.Capacitor?.isNativePlatform?.()) throw new Error('native_unavailable');
  const file=new File([data],name,{type:'application/json'});
  if (nav.canShare?.({files:[file]}) && nav.share) {
    await nav.share({files:[file],title});
    return 'shared';
  }
  return download(file,name,doc);
}
function download(file,name,doc) {
  const url=URL.createObjectURL(file);
  try {
    const link=doc.createElement('a');link.href=url;link.download=name;
    doc.body.append(link);link.click();link.remove();
    return 'downloaded';
  } finally {setTimeout(()=>URL.revokeObjectURL(url),2000);}
}
// «Сохранить в файл»: on Android the public Documents/Fight Tech folder (no permission on Android 11+); a browser downloads.
// Resolves to the folder path shown to the user, or 'downloaded'.
export async function saveFile({data, name}, {win = window, doc = document} = {}) {
  const fs=win.Capacitor?.isNativePlatform?.() && win.Capacitor?.Plugins?.Filesystem;
  if (fs) {
    const write=file=>fs.writeFile({path:'Fight Tech/'+file,data:utf8Base64(data),directory:'DOCUMENTS',recursive:true}).then(()=>'Documents/Fight Tech/'+file);
    // Android 11+: a same-named file left by an earlier installation of the app (after a reinstall) is not the app's
    // own and cannot be overwritten (EACCES); the copy is then saved beside it under a new name.
    return write(name).catch(e=>{
      if (!/EACCES/.test(e?.message)) throw e;
      return write(name.replace(/(\.\w+)?$/,'_'+new Date().toTimeString().slice(0,8).replace(/:/g,'')+'$1'));
    });
  }
  return download(new File([data],name,{type:'application/json'}),name,doc);
}
export async function shareWorkout(program, options) {
  return shareFile({data:serializeWorkoutFile(program),name:workoutFileName(program.name),title:program.name},options);
}

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
export async function shareWorkout(program, {win = window, nav = navigator, doc = document} = {}) {
  const data=serializeWorkoutFile(program);
  const name=workoutFileName(program.name);
  const plugins=nativeSharing(win);
  if (plugins) {
    const path='fight-tech-' + Date.now() + '-' + name;
    // Android Share's FileProvider exposes cache files without storage permissions.
    await plugins.Filesystem.writeFile({path,data:utf8Base64(data),directory:'CACHE'});
    const {uri}=await plugins.Filesystem.getUri({path,directory:'CACHE'});
    await plugins.Share.share({title:program.name,dialogTitle:'Fight Tech',files:[uri]});
    return 'shared';
  }
  if (win.Capacitor?.isNativePlatform?.()) throw new Error('native_unavailable');
  const file=new File([data],name,{type:'application/json'});
  if (nav.canShare?.({files:[file]}) && nav.share) {
    await nav.share({files:[file],title:program.name});
    return 'shared';
  }
  const url=URL.createObjectURL(file);
  try {
    const link=doc.createElement('a');link.href=url;link.download=name;
    doc.body.append(link);link.click();link.remove();
    return 'downloaded';
  } finally {setTimeout(()=>URL.revokeObjectURL(url),2000);}
}
